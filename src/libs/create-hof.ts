import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
  MaybePromise,
} from "../types/type.js";

/**
 * Mixes the shared `skipHof` bypass slot into a fn-first HOF's options object.
 *
 * Semantics of `skipHof` (consumed by the `createHofSync` /
 * `createHofAsync` factories below):
 * - `true` — the HOF resolves to the original function untouched, at wrap
 *   time.
 * - a function — a per-call predicate receiving the call arguments: a truthy
 *   result bypasses the enhancement for that single call (`fn` runs raw, with
 *   the same `this` and arguments); a falsy result applies the enhancement as
 *   usual. Async HOFs may pass an async predicate (`MaybePromise<boolean>`).
 * - omitted / `false` — the enhancement applies normally.
 * @template T - The rest of the options object (an object type by default).
 * @template Fn - The wrapped function type, used to type the predicate's
 * arguments and (for async HOFs) its possible promise return.
 */
export type WithSkipHof<T = object, Fn extends AnyFunction = AnyFunction> = {
  skipHof?:
    | boolean
    | ((
        ...args: Parameters<Fn>
      ) => ReturnType<Fn> extends Promise<any>
        ? MaybePromise<boolean>
        : boolean);
} & T;

/**
 * A type-level function from the wrapped function type (`fn`) to the HOF's
 * options type (`options`). Declare one per HOF as
 * `interface MyKind extends HofKind { options: MyOptions<this["fn"]> }`;
 * {@link ApplyKind} then resolves it for a concrete function.
 * @template T - The function-type upper bound.
 */
export interface HofKind<T extends AnyFunction = AnyFunction> {
  readonly fn: T;
  readonly options: unknown;
}

/**
 * Resolves a {@link HofKind}'s `options` for the concrete function type `TF`.
 * @template K - The kind.
 * @template TF - The wrapped function type.
 */
export type ApplyKind<K extends HofKind, TF extends AnyFunction> = (K & {
  readonly fn: TF;
})["options"];

/**
 * The core handler a HOF supplies to {@link createHofSync} /
 * {@link createHofAsync}. It receives the function being wrapped plus the
 * full options object EXACTLY ONCE per wrapper creation — never per call —
 * and returns the enhanced function. All per-call behavior must live inside
 * the returned function's body, so wrap-time state (memo stores, in-flight
 * maps, timers bookkeeping) is safe in the handler's closure.
 *
 * Returning `fn` itself signals "no enhancement needed": the factory then
 * skips its dispatch wrapper too, and the public wrapper resolves to `fn`
 * unchanged.
 * @template K - The HOF's kind.
 * @template TF - The erased function shape the handler sees.
 */
export type Hof<K extends HofKind, TF extends AnyFunction = AnyFunction> = (
  fn: TF,
  options: ApplyKind<K, TF>, // handler sees erased types
) => AnyFunction;

/**
 * Public shape of a HOF built by {@link createHofAsync}: the callable plus a
 * type-only brand so composers (`withAsync`) can recover the kind `K`.
 * @template K - The HOF's kind.
 */
export interface HofAsyncFn<K extends HofKind> {
  <TF extends AnyAsyncFunction>(
    fn: TF,
    options?: WithSkipHof<ApplyKind<K, TF>, TF>,
  ): TF;
  /** Type-only brand (never set at runtime) so composers can recover `K`. */
  readonly __kind: K;
  /** Type-only flavor tag: this HOF wraps promise-returning functions. */
  readonly __flavor: "async";
}

/**
 * Public shape of a HOF that accepts BOTH sync and async functions — the
 * "any" flavor, used by wrappers whose runtime handles a promise result
 * itself (`lazy`) and by composed stacks.
 *
 * The brand is the same type-only marker the other flavors carry, so a
 * decorator or a composer can recover the kind of an "any" HOF exactly as it
 * would for a sync or async one.
 * @template K - The HOF's kind.
 */
export interface HofAnyFn<K extends HofKind> {
  <TF extends AnyFunction>(
    fn: TF,
    options?: WithSkipHof<ApplyKind<K, TF>, TF>,
  ): TF;
  /** Type-only brand (never set at runtime) so composers can recover `K`. */
  readonly __kind: K;
  /** Type-only flavor tag: this HOF wraps sync or async functions. */
  readonly __flavor: "any";
}

/**
 * Recovers the kind `K` a HOF was built with, from its type-only
 * `__kind` brand. Composes with any HOF flavor
 * ({@link HofSyncFn} / {@link HofAsyncFn} / {@link HofAnyFn}) — and yields
 * `never` for a function that is not a brand-carrying HOF.
 * @template H - The HOF type to probe.
 */
export type KindOf<H> = H extends { readonly __kind: infer K extends HofKind }
  ? K
  : never;

/**
 * The flavors a HOF can have: `"sync"` (wraps non-promise-returning
 * functions), `"async"` (wraps promise-returning ones) and `"any"` (wraps
 * either).
 */
export type HofFlavor = "sync" | "async" | "any";

/**
 * Recovers the flavor of a HOF — `"sync"`, `"async"` or `"any"` — from its
 * type-only `__flavor` tag. The tag is what lets a consumer branch on the
 * flavor (e.g. a decorator refusing a member whose async-ness contradicts
 * the HOF's slot) instead of guessing from the signature shape.
 * @template H - The HOF type to probe.
 */
export type FlavorOf<H> = H extends {
  readonly __flavor: infer F extends HofFlavor;
}
  ? F
  : never;

/**
 * Public shape of a HOF built by {@link createHofSync}: the callable plus a
 * type-only brand so composers (`withSync`) can recover the kind `K`.
 * @template K - The HOF's kind.
 */
export interface HofSyncFn<K extends HofKind> {
  <TF extends AnyFunction>(
    fn: AnySyncFunction<TF>,
    options?: WithSkipHof<
      ApplyKind<K, AnySyncFunction<TF>>,
      AnySyncFunction<TF>
    >,
  ): AnySyncFunction<TF>;
  /** Type-only brand (never set at runtime) so composers can recover `K`. */
  readonly __kind: K;
  /** Type-only flavor tag: this HOF wraps non-promise-returning functions. */
  readonly __flavor: "sync";
}

/**
 * Builds a sync fn-first HOF from a core handler.
 *
 * The returned wrapper applies the shared `WithSkipHof` bypass:
 * - `skipHof: true` — resolves to `fn` itself (wrap time).
 * - `skipHof` as a function — a per-call predicate: a truthy result for the
 *   current arguments invokes `fn` raw (same `this` and arguments), otherwise
 *   the handler's enhanced function runs.
 * - anything else — the handler's enhanced function runs directly (returned
 *   as the wrapper itself, so wraps without a predicate keep the exact shape
 *   of a hand-written wrapper).
 * @template K - The HOF's kind (options as a function of the wrapped fn).
 * @param handler - The core handler building the enhanced wrapper; called
 * exactly once per wrap.
 * @returns The new fn-first HOF taking `(fn, options)`.
 */
export function createHofSync<K extends HofKind>(
  handler: Hof<K, AnySyncFunction>,
) {
  const hof = <TF extends AnyFunction>(
    fn: AnySyncFunction<TF>,
    options: WithSkipHof<
      ApplyKind<K, AnySyncFunction<TF>>,
      AnySyncFunction<TF>
    > = {},
  ) => {
    if (options.skipHof === true) return fn;

    // Built once per wrap: wrap-time state lives in the handler's closure,
    // never per call.
    const enhanced = handler(fn, options) as TF;

    // The handler echoed `fn` back — nothing to enhance, so return it
    // unchanged (also means nothing to bypass per call).
    if (enhanced === fn) return fn;
    if (typeof options.skipHof !== "function") return enhanced;

    return function (this: ThisParameterType<TF>, ...args: Parameters<TF>) {
      return typeof options.skipHof === "function" && options.skipHof(...args)
        ? fn.apply(this, args)
        : enhanced.apply(this, args);
    } as TF;
  };

  return hof as unknown as HofSyncFn<K>;
}

/**
 * Builds an async fn-first HOF from a core handler. See
 * {@link createHofSync} for the shared bypass semantics; the only difference
 * is the per-call predicate, which may be async (its result is awaited
 * before deciding whether to bypass).
 * @template K - The HOF's kind (options as a function of the wrapped fn).
 * @param handler - The core handler building the enhanced wrapper; called
 * exactly once per wrap.
 * @returns The new fn-first HOF taking `(fn, options)`.
 */
export function createHofAsync<K extends HofKind>(
  handler: Hof<K, AnyAsyncFunction>,
) {
  const hof = <TF extends AnyAsyncFunction>(
    fn: TF,
    options: WithSkipHof<ApplyKind<K, TF>, TF> = {},
  ) => {
    if (options.skipHof === true) return fn;

    // Built once per wrap: wrap-time state lives in the handler's closure,
    // never per call.
    const enhanced = handler(fn, options) as TF;

    // The handler echoed `fn` back — nothing to enhance, so return it
    // unchanged (also means nothing to bypass per call).
    if (enhanced === fn) return fn;
    if (typeof options.skipHof !== "function") return enhanced;

    // The dispatch wrapper is async so per-call predicates may await and
    // wrapped calls always settle through a promise.
    return async function (
      this: ThisParameterType<TF>,
      ...args: Parameters<TF>
    ) {
      return typeof options.skipHof === "function" &&
        (await options.skipHof(...args))
        ? fn.apply(this, args)
        : enhanced.apply(this, args);
    } as TF;
  };

  return hof as unknown as HofAsyncFn<K>;
}

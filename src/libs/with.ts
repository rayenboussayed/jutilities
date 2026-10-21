import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
} from "../types/type.js";
import type {
  ApplyKind,
  HofAsyncFn,
  HofKind,
  HofSyncFn,
  WithSkipHof,
} from "./create-hof.js";

type AnyHof = (fn: any, options: any) => unknown;

/** Recovers the phantom kind `K` from a HOF returned by createHof*. */
type KindOf<H> = H extends { readonly __kind: infer K extends HofKind }
  ? K
  : never;

/**
 * Intersection of every HOF's options, resolved for the concrete wrapped
 * function `TF` (so `parameters` / `result` in each hook are typed from it).
 */
export type MergeOptions<
  Hs extends readonly unknown[],
  TF extends AnyFunction,
> = Hs extends readonly [infer H, ...infer R]
  ? ApplyKind<KindOf<H>, TF> & MergeOptions<R, TF>
  : unknown;

/**
 * Composes async HOFs into one. The FIRST hof is the OUTERMOST layer:
 * `withAsync(a, b, c)(fn, o)` === `a(b(c(fn, o), o), o)`.
 * Options are one flat bag shared by all layers (each reads its own keys).
 * `skipHof` is handled once for the whole stack (inner layers never see it),
 * so a per-call predicate runs once per call, not once per layer.
 * @param hofs - The HOFs to stack, outermost first.
 * @returns A fn-first wrapper applying the whole stack.
 */
export function withAsync<const Hs extends readonly HofAsyncFn<any>[]>(
  ...hofs: Hs
) {
  return <TF extends AnyAsyncFunction>(
    fn: TF,
    options: WithSkipHof<MergeOptions<Hs, TF>, TF> = {} as never,
  ): TF => {
    const { skipHof, ...rest } = options as { skipHof?: unknown } & Record<
      string,
      unknown
    >;
    if (skipHof === true) return fn;

    const layered = hofs.reduceRight<TF>(
      (acc, hof) => (hof as AnyHof)(acc, rest) as TF,
      fn,
    );

    if (layered === fn || typeof skipHof !== "function") return layered;

    return async function (this: ThisParameterType<TF>, ...args: Parameters<TF>) {
      return (await (skipHof as AnyFunction)(...args))
        ? fn.apply(this, args)
        : layered.apply(this, args);
    } as TF;
  };
}

/**
 * Sync counterpart of {@link withAsync}: same ordering and `skipHof` rules,
 * but the per-call predicate is sync and async functions are rejected at
 * compile time via the `AnySyncFunction<TF>` gate.
 * @param hofs - The HOFs to stack, outermost first.
 * @returns A fn-first wrapper applying the whole stack.
 */
export function withSync<const Hs extends readonly HofSyncFn<any>[]>(
  ...hofs: Hs
) {
  return <TF extends AnyFunction>(
    fn: AnySyncFunction<TF>,
    options: WithSkipHof<MergeOptions<Hs, TF>, TF> = {} as never,
  ): TF => {
    const raw = fn as TF;
    const { skipHof, ...rest } = options as { skipHof?: unknown } & Record<
      string,
      unknown
    >;
    if (skipHof === true) return raw;

    const layered = hofs.reduceRight<TF>(
      (acc, hof) => (hof as AnyHof)(acc, rest) as TF,
      raw,
    );

    if (layered === raw || typeof skipHof !== "function") return layered;

    return function (this: ThisParameterType<TF>, ...args: Parameters<TF>) {
      return (skipHof as AnyFunction)(...args)
        ? raw.apply(this, args)
        : layered.apply(this, args);
    } as TF;
  };
}

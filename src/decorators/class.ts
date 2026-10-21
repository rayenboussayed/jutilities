import type { AnyFunction } from "../types/type.js";
import { isAsyncFunction } from "../is.js";
import type { HofOptionsOf } from "./hof.js";
import type {
  HofFlavor,
  HofFn,
} from "../libs/create-hof.js";
import { assertNotRawApplication, assertNotRawMemberApplication } from "../assert.js";

/**
 * Class-level enhancer fan-out.
 */

/**
 * A HOF ensemble for {@link decorateClass}: one enhancer for every own
 * prototype method, or a sync/async pair resolved per method via
 * `pick` (default `"detect"` through {@link ../is.ts | isAsyncFunction}).
 * @template HS - The sync slot's HOF type.
 * @template HA - The async slot's HOF type.
 */
export type EnhancerPair<
  HS extends HofFn<any, "sync"> | HofFn<any, "any"> = HofFn<any, "sync"> |
  HofFn<any, "any">,
  HA extends HofFn<any, "async"> | HofFn<any, "any"> = HofFn<any, "async"> |
  HofFn<any, "any">,
> = {
  /** Enhancer applied to non-`async` members. */
  sync?: HS;
  /** Enhancer applied to declared-`async` members. */
  async?: HA;
};

/**
 * The option bag a {@link decorateClass} pair receives: the intersection of
 * both slots' option bags (each slot reads its own keys, the shared bag
 * carries their union).
 * @template HS - The sync slot's HOF type.
 * @template HA - The async slot's HOF type.
 */
export type EnhancerOptions<
  HS extends HofFn<any, "sync"> | HofFn<any, "any">,
  HA extends HofFn<any, "async"> | HofFn<any, "any">,
> = HofOptionsOf<HS> & HofOptionsOf<HA>;

/**
 * How {@link decorateClass} chooses the enhancer for each own prototype
 * method: `"detect"` per member (pair mode), or force a single slot for every
 * member (pair mode), or apply one HOF everywhere (single mode).
 */
export type ClassPick = "sync" | "async" | "detect";

/**
 * Standard Stage 3 class decorator shape returned by {@link decorateClass}:
 * type-preserving; the class itself is passed through unchanged while its own
 * prototype methods are replaced in place.
 */
export type ClassDecoratorOf =
  <Class_ extends abstract new (...args: any[]) => unknown>(
    cls: Class_,
    context: ClassDecoratorContext<Class_>,
  ) => Class_;

/**
 * Applies a fn-first HOF (or a sync/async pair of them) to every OWN prototype
 * method of the decorated class. Constructor, statics, getters/setters and
 * `#private` members are left untouched (`#private` fields are not visible to
 * property enumeration, but each can still be decorated individually with the
 * method/property factories).
 *
 * The HOF's option bag (one object, resolved from the HOF's kind) is declared
 * ONCE at decorate time and forwarded verbatim to every wrapped method.
 *
 * Enhancers resolve per method:
 * - single HOF: applied to every member (any `pick` value is informative
 *   only);
 * - `{ sync?, async? }` pair with `pick: "detect"` (default): `async`
 *   members take `pair.async`, others take `pair.sync`;
 * - pair with `pick: "sync"` / `"async"`: every member goes through that
 *   slot; a missing slot throws at decorate time naming the request.
 *
 * A pair slot missing for a detected member also throws at decorate time
 * naming the member, so partial configurations fail fast.
 * @example
 * ```ts
 * // Hoist the factory so each decoration applies it exactly once.
 * const cached = decorateClass({
 *   sync: withCacheSync,
 *   async: withCacheAsync,
 * });
 *
 * @cached({ cacheStore: new Map() })
 * class Users {
 *   count() { return 42; }
 *   async load(id: string) { return await db.user(id); }
 * }
 * ```
 * @template HS - The sync slot's HOF type.
 * @template HA - The async slot's HOF type.
 * @param enhancers - A `{ sync?, async? }` pair of HOFs.
 * @param options - Slot resolution options.
 * @param options.pick - Slot resolution mode: `"sync"`, `"async"`, or
 * `"detect"` (default).
 * @returns A decorator factory whose options are forwarded to every wrapped
 * member.
 */
export function decorateClass<
  HS extends HofFn<any, "sync"> | HofFn<any, "any">,
  HA extends HofFn<any, "async"> | HofFn<any, "any">,
>(
  enhancers: EnhancerPair<HS, HA>,
  options?: { pick?: ClassPick },
): (hofOptions?: EnhancerOptions<HS, HA>) => ClassDecoratorOf;

/**
 * Single-HOF variant of {@link decorateClass}: the one HOF is applied to
 * every own prototype method. See the primary signature for full details.
 * @template H - The HOF type, recovered from its `__kind` and `__flavor`
 * brands.
 * @param enhancers - The HOF to apply to every member.
 * @param options - Slot resolution options.
 * @param options.pick - Slot resolution mode (informative for a single HOF).
 * @returns A decorator factory whose options are forwarded to every wrapped
 * member.
 */
export function decorateClass<
  H extends HofFn<any, HofFlavor>,
>(
  enhancers: H,
  options?: { pick?: ClassPick },
): (
  hofOptions?: HofOptionsOf<H>,
) => ClassDecoratorOf;

export function decorateClass(
  enhancers: unknown,
  options?: { pick?: ClassPick },
): any {
  assertNotRawApplication(options, "decorateClass");
  return ((...args: unknown[]) => {
    assertNotRawMemberApplication(args, "decorateClass");
    const hofOptions = args[0];
    return <Class_ extends abstract new (...args: any[]) => unknown>(
      cls: Class_,
    ): Class_ => {
      const proto = cls.prototype as Record<
        string | symbol,
        unknown
      >;
      for (const key of [
        ...Object.getOwnPropertyNames(proto),
        ...Object.getOwnPropertySymbols(proto),
      ]) {
        if (key === "constructor") continue;
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (!descriptor) continue;
        if ("get" in descriptor || "set" in descriptor) continue;
        const value = descriptor.value as unknown;
        if (typeof value !== "function") continue;
        const hof = resolveEnhancer(
          enhancers,
          options?.pick ?? "detect",
          value as (...args: any[]) => unknown,
          String(key),
        );
        descriptor.value = hof(value as AnyFunction, hofOptions);
        Object.defineProperty(proto, key, descriptor);
      }
      return cls;
    };
  }) as (hofOptions?: unknown) => ClassDecoratorOf;
}

/**
 * Chooses the HOF for one member under the current pairing mode. Single
 * enhancers bypass mode selection entirely; pair modes select by `pick`
 * (forced) or by the member's async-ness (detected), and absent pair slots are
 * fail-fast errors.
 * @param enhancers - The raw user input (a HOF or a `{ sync?, async? }` bag).
 * @param pick - The requested slot resolution mode.
 * @param fn - The member value being wrapped.
 * @param name - The member's name, for error messages.
 * @returns The HOF to apply.
 */
export function resolveEnhancer(
  enhancers: unknown,
  pick: ClassPick,
  fn: (...args: any[]) => unknown,
  name: string,
): (fn: AnyFunction, hofOptions?: unknown) => AnyFunction {
  if (typeof enhancers === "function") {
    return enhancers as (fn: AnyFunction, hofOptions?: unknown) => AnyFunction;
  }
  const pair = (enhancers as EnhancerPair) ?? {};
  const chosen =
    pick === "async"
      ? pair.async
      : pick === "sync"
        ? pair.sync
        : isAsyncFunction(fn)
          ? pair.async
          : pair.sync;
  if (typeof chosen !== "function") {
    throw new TypeError(
      `decorateClass: method "${name}" needs a ${
        pick === "detect" ? (isAsyncFunction(fn) ? "async" : "sync") : pick
      } enhancer, but the pair does not provide one`,
    );
  }
  return chosen as (fn: AnyFunction, hofOptions?: unknown) => AnyFunction;
}

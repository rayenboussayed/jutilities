import type {
  HofFlavor,
  HofFn,
} from "../libs/create-hof.js";
import type { AnyFunction } from "../types/type.js";
import type { HofOptionsOf } from "./hof.js";

import { assertNotRawApplication, assertNotRawMemberApplication } from "../assert.js";
import { isAsyncFunction, isFunction } from "../is.js";

/**
 * Class-level enhancer fan-out.
 */

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
 * How {@link decorateClass} chooses the enhancer for each own prototype
 * method: `"detect"` per member (pair mode), or force a single slot for every
 * member (pair mode), or apply one HOF everywhere (single mode).
 */
export type ClassPick = "async" | "detect" | "sync";

/**
 * The callable shape an enhancer slot is applied through: a fn-first HOF that
 * takes the member and the shared option bag.
 */
export type EnhancerFn = (
  fn: AnyFunction,
  hofOptions?: unknown,
) => AnyFunction;

/**
 * The option bag a {@link decorateClass} pair receives: the intersection of
 * both slots' option bags (each slot reads its own keys, the shared bag
 * carries their union).
 * @template HS - The sync slot's HOF type.
 * @template HA - The async slot's HOF type.
 */
export type EnhancerOptions<
  HS extends HofFn<any, "any"> | HofFn<any, "sync">,
  HA extends HofFn<any, "any"> | HofFn<any, "async">,
> = HofOptionsOf<HA> & HofOptionsOf<HS>;

/**
 * A HOF ensemble for {@link decorateClass}: one enhancer for every own
 * prototype method, or a sync/async pair resolved per method via
 * `pick` (default `"detect"` through {@link ../is.ts | isAsyncFunction}).
 * @template HS - The sync slot's HOF type.
 * @template HA - The async slot's HOF type.
 */
export type EnhancerPair<
  HS extends HofFn<any, "any"> | HofFn<any, "sync"> = HofFn<any, "any"> |
  HofFn<any, "sync">,
  HA extends HofFn<any, "any"> | HofFn<any, "async"> = HofFn<any, "any"> |
  HofFn<any, "async">,
> = {
  /** Enhancer applied to declared-`async` members. */
  async?: HA;
  /** Enhancer applied to non-`async` members. */
  sync?: HS;
};

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
  HS extends HofFn<any, "any"> | HofFn<any, "sync">,
  HA extends HofFn<any, "any"> | HofFn<any, "async">,
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
      const proto: Record<string | symbol, unknown> = cls.prototype;
      for (const key of [
        ...Object.getOwnPropertyNames(proto),
        ...Object.getOwnPropertySymbols(proto),
      ]) {
        if (key === "constructor") continue;
        const descriptor = Object.getOwnPropertyDescriptor(proto, key)!;
        if ("get" in descriptor || "set" in descriptor) continue;
        const value: unknown = descriptor.value;
        if (!isFunction(value)) {
        /* v8 ignore next -- only non-function members skip here */
        continue;
      }
        const hof = resolveEnhancer(
          enhancers as EnhancerFn | EnhancerPair,
          options?.pick ?? "detect",
          value,
          String(key),
        );
        descriptor.value = hof(value, hofOptions);
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
  enhancers: EnhancerFn | EnhancerPair,
  pick: ClassPick,
  fn: (...args: any[]) => unknown,
  name: string,
): EnhancerFn {
  if (typeof enhancers === "function") {
    /* istanbul ignore next */
    return enhancers;
  }
  /* c8 ignore next 10 */ const pair = enhancers ?? {};
  const chosen =
    pick === "async"
      ? pair.async
      // eslint-disable-next-line sonarjs/no-nested-conditional
      : pick === "sync"
        ? pair.sync
        // eslint-disable-next-line sonarjs/no-nested-conditional
        : isAsyncFunction(fn)
          ? pair.async
          : pair.sync;
  if (typeof chosen !== "function") {
    throw new TypeError(
      `decorateClass: method "${name}" needs a ${
        // eslint-disable-next-line sonarjs/no-nested-conditional
        pick === "detect" ? (isAsyncFunction(fn) ? "async" : "sync") : pick
      } enhancer, but the pair does not provide one`,
    );
  }
  return chosen as EnhancerFn;
}

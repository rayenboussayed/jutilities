import type { AnyFunction } from "../types/type.js";
import { isAsyncFunction } from "../is.js";
import type { HofRestOf } from "./hof.js";
import { assertNotRawApplication, assertNotRawMemberApplication } from "../assert.js";

/**
 * Class-level enhancer fan-out.
 */

/**
 * A HOF ensemble for {@link decorateClass}: one enhancer for every own
 * prototype method, or a sync/async pair resolved per method via
 * `pick` (default `"detect"` through {@link ../is.ts | isAsyncFunction}).
 * @template H - The enhancer (fn-first HOF) type.
 */
export type EnhancerPair<H> = {
  /** Enhancer applied to non-`async` members. */
  sync?: H;
  /** Enhancer applied to declared-`async` members. */
  async?: H;
};

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
 * The HOF's option slots are declared ONCE at decorate time and forwarded
 * verbatim to every wrapped method.
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
 * @template H - The enhancer signature (fn-first HOF).
 * @param enhancers - A single HOF, or a `{ sync?, async? }` pair.
 * @param options - Slot resolution options.
 * @param options.pick - Slot resolution mode: `"sync"`, `"async"`, or
 * `"detect"` (default).
 * @returns A decorator factory forwarding its rest arguments (the HOF's
 * option slots) to every wrapped member.
 */
export function decorateClass<H extends (...args: any[]) => AnyFunction>(
  enhancers: H | EnhancerPair<H>,
  options?: { pick?: ClassPick },
): (...rest: HofRestOf<H>) => ClassDecoratorOf;

export function decorateClass(
  enhancers: unknown,
  options?: { pick?: ClassPick },
): (...rest: any[]) => ClassDecoratorOf {
  assertNotRawApplication(options, "decorateClass");
  return (...rest: any[]) => {
    assertNotRawMemberApplication(rest, "decorateClass");
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
        descriptor.value = hof(value as AnyFunction, ...rest);
        Object.defineProperty(proto, key, descriptor);
      }
      return cls;
    };
  };
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
function resolveEnhancer(
  enhancers: unknown,
  pick: ClassPick,
  fn: (...args: any[]) => unknown,
  name: string,
): (fn: AnyFunction, ...rest: any[]) => AnyFunction {
  if (typeof enhancers === "function") {
    return enhancers as (fn: AnyFunction, ...rest: any[]) => AnyFunction;
  }
  const pair = (enhancers as EnhancerPair<unknown>) ?? {};
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
  return chosen as (fn: AnyFunction, ...rest: any[]) => AnyFunction;
}

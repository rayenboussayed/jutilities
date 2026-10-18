import type { AnyFunction } from "../types/type.js";
import { isAsyncFunction } from "../is.js";
import type { DecoratorGuard, SyncFirstHof } from "./hof.js";
import { assertGuardConsistency, assertNotRawApplication, assertNotRawMemberApplication } from "../assert.js";

/**
 * Getter decorators from fn-first enhancers.
 */

/**
 * Standard Stage 3 getter decorator shape returned by
 * {@link decorateGetter}: replaces the getter's access function with the
 * enhanced (wrapped) one.
 *
 * Note that wrapping a getter shares the HOF's state across all instances
 * (getters live on the prototype) — e.g. caching a getter memoizes once for
 * the whole class.
 */
export type GetterDecoratorOf = <This, Value>(
  getter: (this: This) => Value,
  context: ClassGetterDecoratorContext<This, Value>,
) => (this: This) => Value;

/**
 * Converts a fn-first HOF into a reusable Stage 3 getter decorator factory.
 * The getter's access function runs through the HOF once at class-definition
 * time; every subsequent access calls the wrapped getter with the instance as
 * `this`. The HOF's option slots are declared once at decorate time and
 * forwarded verbatim.
 * @example
 * ```ts
 * // Hoist the factory so each decoration applies it exactly once.
 * const report = decorateGetter(lazy);
 *
 * class Stats {
 *   @report()
 *   get report() { return computeHeavyReport(this); }
 * }
 * ```
 * @template F - The wrapped-function shape, inferred from `hof`.
 * @template R - The option slots, inferred from `hof`.
 * @param hof - The fn-first HOF to convert.
 * @param options - Optional {@link DecoratorGuard} for decorate-time
 * sync/async discipline.
 * @returns A decorator factory forwarding its rest arguments to `hof`.
 */
export function decorateGetter<F extends AnyFunction, R extends any[] = []>(
  hof: (fn: F, ...rest: R) => F,
  options?: DecoratorGuard,
): (...rest: R) => GetterDecoratorOf;

/**
 * Sync-slot variant of {@link decorateGetter} for HOFs typed
 * {@link ../decorators/hof.ts | SyncFirstHof} — e.g.
 * {@link ../cache.ts | withCacheSync}. See the primary signature for full
 * details.
 * @template F - The wrapped-function shape, inferred from `hof`.
 * @template R - The option slots, inferred from `hof`.
 * @param hof - The fn-first (sync-gated) HOF to convert.
 * @param options - Optional {@link DecoratorGuard} for decorate-time
 * sync/async discipline.
 * @returns A decorator factory forwarding its rest arguments to `hof`.
 */
export function decorateGetter<F extends AnyFunction, R extends any[] = []>(
  hof: SyncFirstHof<F, R>,
  options?: DecoratorGuard,
): (...rest: R) => GetterDecoratorOf;

export function decorateGetter(
  hof: (fn: AnyFunction, ...rest: any[]) => AnyFunction,
  options?: DecoratorGuard,
): (...rest: any[]) => GetterDecoratorOf {
  return ((...rest: any[]) => {
    assertNotRawApplication(options, "decorateGetter");
    assertNotRawMemberApplication(rest, "decorateGetter");
    return (
      getter: (this: unknown) => unknown,
      context: ClassGetterDecoratorContext<unknown, unknown>,
    ) => {
      assertGuardConsistency(
        options,
        isAsyncFunction(getter as () => unknown),
        "decorateGetter",
        String(context.name),
      );
      return hof(getter, ...rest) as (this: unknown) => unknown;
    };
  }) as (...rest: any[]) => GetterDecoratorOf;
}

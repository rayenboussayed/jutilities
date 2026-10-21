import type { DecoratorGuard, HofOptionsOf } from "./hof.js";
import { memberEnhancer } from "./hof.js";
import type { HofFlavor, HofFn } from "../libs/create-hof.js";
import { assertNotRawApplication } from "../assert.js";

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
 * `this`. The HOF's option bag (one object, resolved from the HOF's kind) is
 * forwarded verbatim.
 *
 * A getter is always sync, so the HOF's flavor does not narrow the decorated
 * member — an async HOF is accepted and fails at decorate time when the
 * `require: "async"` guard is set.
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
 * @template H - The converted HOF type, recovered from its `__kind` and
 * `__flavor` brands.
 * @param hof - The fn-first HOF to convert.
 * @param options - Optional {@link DecoratorGuard} for decorate-time
 * sync/async discipline.
 * @returns A decorator factory whose options are forwarded to `hof`.
 */
export function decorateGetter<
  H extends HofFn<any, HofFlavor>,
>(
  hof: H,
  options?: DecoratorGuard,
): (
  hofOptions?: HofOptionsOf<H>,
) => GetterDecoratorOf;

export function decorateGetter(
  hof: (fn: any, hofOptions?: any) => any,
  options?: DecoratorGuard,
): any {
  return ((...args: unknown[]) => {
    assertNotRawApplication(options, "decorateGetter");
    const enhance = memberEnhancer("decorateGetter", hof, options, args);
    return (
      getter: (this: unknown) => unknown,
      context: ClassGetterDecoratorContext<unknown, unknown>,
    ) => enhance(getter, String(context.name)) as (this: unknown) => unknown;
  }) as (hofOptions?: unknown) => GetterDecoratorOf;
}

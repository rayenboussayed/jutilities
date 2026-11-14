import type { HofFlavor, HofFn } from "../libs/create-hof.js";
import type { DecoratorGuard, HofOptionsOf } from "./hof.js";

import { assertNotRawApplication } from "../assert.js";
import { memberEnhancer } from "./hof.js";

/**
 * Getter decorators from fn-first enhancers.
 */

/**
 * Legacy (experimentalDecorators) getter decorator shape returned by
 * {@link decorateGetter}: replaces the getter's access function with the
 * enhanced (wrapped) one.
 *
 * Note that wrapping a getter shares the HOF's state across all instances
 * (getters live on the prototype) — e.g. caching a getter memoizes once for
 * the whole class.
 */
export type GetterDecoratorOf = (
  target: unknown,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor;

export function decorateGetter<
  H extends HofFn<any, HofFlavor>,
>(
  hof: H,
  options?: DecoratorGuard,
): (
  hofOptions?: HofOptionsOf<H>,
) => GetterDecoratorOf;
/**
 * Converts a fn-first HOF into a reusable legacy getter decorator factory.
 * The getter's access function runs through the HOF once at class-definition
 * time; every subsequent access calls the wrapped getter with the instance as
 * `this`. The HOF's option bag (one object, resolved from the HOF's kind) is
 * forwarded verbatim.
 *
 * A getter's signature is preserved; sync HOFs rely on runtime guarding (or
 * `require`) rather than rejecting at the type layer. An async HOF is still
 * type-compatible only when the getter's return type is promise-like; the
 * `require: "async"` guard can enforce this at decorate time.
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
export function decorateGetter(
  hof: (fn: any, hofOptions?: any) => any,
  options?: DecoratorGuard,
): any {
  return ((...args: unknown[]) => {
    assertNotRawApplication(options, "decorateGetter");
    const enhance = memberEnhancer("decorateGetter", hof, options, args);
    return (
      _target: unknown,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) => {
      const getter = descriptor.get as ((this: unknown) => unknown) | undefined;
      if (!getter) {
        throw new TypeError(
          `decorateGetter: accessor "${String(propertyKey)}" has no getter to enhance`,
        );
      }
      descriptor.get = enhance(getter, String(propertyKey)) as (this: unknown) => unknown;
      return descriptor;
    };
  }) as (hofOptions?: unknown) => GetterDecoratorOf;
}

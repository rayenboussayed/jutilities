import type { AnyFunction } from "../types/type.js";
import type { DecoratorGuard, HofOptionsOf } from "./hof.js";
import { memberEnhancer } from "./hof.js";
import type { HofFlavor, HofFn } from "../libs/create-hof.js";
import { assertNotRawApplication } from "../assert.js";

/**
 * Field decorators for function-valued state.
 */

/**
 * Standard Stage 3 field decorator shape returned by
 * {@link decorateProperty}: rebinds the field's initializer to wrap its
 * initial function value through the converted HOF.
 *
 * TS does not surface a meaningful member type to field decorators, so the
 * initializer transport is deliberately loose (`any`): the wrapped value keeps
 * whatever type the field was declared to hold.
 */
export type FieldDecoratorOf = (
  value: undefined,
  context: ClassFieldDecoratorContext,
) => (initialValue: any) => any;

/**
 * Converts a fn-first HOF into a reusable Stage 3 field decorator factory for
 * function-valued members (closures, callbacks, injected strategies).
 *
 * The field's initial value runs through the HOF once per instance, at field
 * initialization time — so each instance gets a freshly enhanced function and
 * arrow-function fields keep their lexical `this`. The HOF's option bag (one
 * object, resolved from the HOF's kind) is forwarded verbatim.
 *
 * A field whose initializer value is not a function (or is left uninitialized)
 * throws a `TypeError` naming the field at construction time.
 * @example
 * ```ts
 * // Hoist the factory so each decoration applies it exactly once.
 * const delayed = decorateProperty(withDelayAsync);
 *
 * class Jobs {
 *   @delayed({ delay: 500 })
 *   run = async () => await drain();
 * }
 * ```
 * @template H - The converted HOF type, recovered from its `__kind` and
 * `__flavor` brands.
 * @param hof - The fn-first HOF to convert.
 * @param options - Optional {@link DecoratorGuard} for decorate-time
 * sync/async discipline.
 * @returns A decorator factory whose options are forwarded to `hof`.
 */
export function decorateProperty<
  H extends HofFn<any, HofFlavor>,
>(
  hof: H,
  options?: DecoratorGuard,
): (
  hofOptions?: HofOptionsOf<H>,
) => FieldDecoratorOf;

export function decorateProperty(
  hof: (fn: any, hofOptions?: any) => any,
  options?: DecoratorGuard,
): any {
  return ((...args: unknown[]) => {
    assertNotRawApplication(options, "decorateProperty");
    const enhance = memberEnhancer("decorateProperty", hof, options, args);
    return (_: unknown, context: ClassFieldDecoratorContext) => {
      return (initialValue: unknown) => {
        if (typeof initialValue !== "function") {
          throw new TypeError(
            `decorateProperty: field "${String(context.name)}" must be a function-value initializer, got ${typeof initialValue}`,
          );
        }
        return enhance(initialValue as AnyFunction, String(context.name));
      };
    };
  }) as (hofOptions?: unknown) => FieldDecoratorOf;
}

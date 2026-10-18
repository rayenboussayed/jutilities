import type { AnyFunction } from "../types/type.js";
import { isAsyncFunction } from "../is.js";
import type { DecoratorGuard, SyncFirstHof } from "./hof.js";
import { assertGuardConsistency, assertNotRawApplication, assertNotRawMemberApplication } from "../assert.js";

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
 * arrow-function fields keep their lexical `this`. The HOF's option slots are
 * declared once at decorate time and forwarded verbatim.
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
 * @template F - The wrapped-function shape, inferred from `hof`.
 * @template R - The option slots, inferred from `hof`.
 * @param hof - The fn-first HOF to convert.
 * @param options - Optional {@link DecoratorGuard} for decorate-time
 * sync/async discipline.
 * @returns A decorator factory forwarding its rest arguments to `hof`.
 */
export function decorateProperty<F extends AnyFunction, R extends any[] = []>(
  hof: (fn: F, ...rest: R) => F,
  options?: DecoratorGuard,
): (...rest: R) => FieldDecoratorOf;

/**
 * Sync-slot variant of {@link decorateProperty} for HOFs typed
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
export function decorateProperty<F extends AnyFunction, R extends any[] = []>(
  hof: SyncFirstHof<F, R>,
  options?: DecoratorGuard,
): (...rest: R) => FieldDecoratorOf;

export function decorateProperty(
  hof: (fn: AnyFunction, ...rest: any[]) => AnyFunction,
  options?: DecoratorGuard,
): (...rest: any[]) => FieldDecoratorOf {
  return (...rest: any[]) => {
    assertNotRawApplication(options, "decorateProperty");
    assertNotRawMemberApplication(rest, "decorateProperty");
    return (_, context: ClassFieldDecoratorContext) => {
      return (initialValue: unknown) => {
        if (typeof initialValue !== "function") {
          throw new TypeError(
            `decorateProperty: field "${String(context.name)}" must be a function-value initializer, got ${typeof initialValue}`,
          );
        }
        assertGuardConsistency(
          options,
          isAsyncFunction(initialValue as AnyFunction),
          "decorateProperty",
          String(context.name),
        );
        return (hof as (...args: any[]) => unknown)(
          initialValue,
          ...rest,
        ) as unknown;
      };
    };
  };
}

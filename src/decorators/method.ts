import type { FlavorOf, HofFlavor, HofFn } from "../libs/create-hof.js";
import type { AnyFunction } from "../types/type.js";
import type { DecoratorGuard, GatedMember, HofOptionsOf } from "./hof.js";

import { assertNotRawApplication } from "../hof/assert.js";
import { memberEnhancer } from "./hof.js";

/**
 * Method decorators from fn-first enhancers.
 */

/**
 * Legacy (experimentalDecorators) method decorator shape returned by
 * {@link decorateMethod}. Applies to any member whose value satisfies the
 * converter's gate and replaces the descriptor's value with the enhanced
 * function.
 *
 * The flavor decides what the converted HOF may wrap: an async HOF
 * refuses a non-promise-returning member at compile time; a sync HOF preserves
 * the member signature and relies on runtime guarding (or `require`) to
 * reject promise/generator results.
 * @template F - The HOF flavor the gate follows.
 */
export type MethodDecoratorOf<F extends HofFlavor = "any"> = <
  M extends AnyFunction,
>(
  target: unknown,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<GatedMember<F, M>>,
) => TypedPropertyDescriptor<GatedMember<F, M>>;

export function decorateMethod<
  H extends HofFn<any, HofFlavor>,
>(
  hof: H,
  options?: DecoratorGuard,
): (
  hofOptions?: HofOptionsOf<H>,
) => MethodDecoratorOf<FlavorOf<H>>;
/**
 * Converts a fn-first HOF into a reusable legacy method decorator factory.
 * The HOF's first parameter receives the member value; its option bag (one
 * object, resolved from the HOF's kind) is forwarded verbatim, evaluated once
 * at decorate time and shared by its wrap.
 *
 * Only HOFs built by {@link ../libs/create-hof.ts | createHofSync} /
 * `createHofAsync` are accepted — they carry the kind the converter needs to
 * type the option bag, and the flavor that decides which members may be
 * decorated: a sync HOF preserves the member signature and relies on runtime
 * guarding (or `require`), while an async HOF takes promise-returning members.
 * @example
 * ```ts
 * // Hoist the factory so each decoration applies it exactly once.
 * const cached = decorateMethod(withCacheAsync);
 *
 * class Users {
 *   @cached({ extraKeys: ["users"] })
 *   async loadUser(id: string) { return await db.find(id); }
 * }
 * ```
 * @template H - The converted HOF type, recovered from its `__kind` and
 * `__flavor` brands.
 * @param hof - The fn-first HOF to convert.
 * @param options - Optional {@link DecoratorGuard} (`require: "sync"` or
 * `"async"`) checked against the member at decorate time.
 * @returns A decorator factory whose options are forwarded to `hof` exactly
 * once per decorated member.
 */
export function decorateMethod(
  hof: (fn: any, hofOptions?: any) => any,
  options?: DecoratorGuard,
): any {
  return ((...args: unknown[]) => {
    assertNotRawApplication(options, "decorateMethod");
    const enhance = memberEnhancer("decorateMethod", hof, options, args);
    return (
      _target: unknown,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<AnyFunction>,
    ) => {
      descriptor.value = enhance(descriptor.value as AnyFunction, String(propertyKey));
      return descriptor;
    };
  }) as (hofOptions?: unknown) => MethodDecoratorOf;
}

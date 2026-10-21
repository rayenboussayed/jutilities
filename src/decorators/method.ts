import type { AnyFunction } from "../types/type.js";
import type { DecoratorGuard, GatedMember, HofOptionsOf } from "./hof.js";
import { memberEnhancer } from "./hof.js";
import type { FlavorOf, HofFlavor, HofFn } from "../libs/create-hof.js";
import { assertNotRawApplication } from "../assert.js";

/**
 * Method decorators from fn-first enhancers.
 */

/**
 * Standard Stage 3 method decorator shape returned by
 * {@link decorateMethod}. Applies to any member whose value satisfies the
 * converter's gate and replaces it with the enhanced function.
 *
 * The gate narrows what the converted HOF may wrap: a sync HOF refuses a
 * promise-returning member, an async HOF refuses a non-promise-returning one
 * — both mismatches are compile-time rejections.
 * @template F - The HOF flavor the gate follows.
 */
export type MethodDecoratorOf<F extends HofFlavor = "any"> = <
  M extends AnyFunction,
>(
  method: GatedMember<F, M>,
  context: ClassMethodDecoratorContext<unknown, M>,
) => M | void;

/**
 * Converts a fn-first HOF into a reusable Stage 3 method decorator factory.
 * The HOF's first parameter receives the member value; its option bag (one
 * object, resolved from the HOF's kind) is forwarded verbatim, evaluated once
 * at decorate time and shared by its wrap.
 *
 * Only HOFs built by {@link ../libs/create-hof.ts | createHofSync} /
 * `createHofAsync` are accepted — they carry the kind the converter needs to
 * type the option bag, and the flavor that decides which members may be
 * decorated: a sync HOF takes non-promise-returning members, an async HOF
 * takes promise-returning ones.
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
export function decorateMethod<
  H extends HofFn<any, HofFlavor>,
>(
  hof: H,
  options?: DecoratorGuard,
): (
  hofOptions?: HofOptionsOf<H>,
) => MethodDecoratorOf<FlavorOf<H>>;

export function decorateMethod(
  hof: (fn: any, hofOptions?: any) => any,
  options?: DecoratorGuard,
): any {
  return ((...args: unknown[]) => {
    assertNotRawApplication(options, "decorateMethod");
    const enhance = memberEnhancer("decorateMethod", hof, options, args);
    return (
      method: AnyFunction,
      context: ClassMethodDecoratorContext<unknown, AnyFunction>,
    ) => enhance(method, String(context.name));
  }) as (hofOptions?: unknown) => MethodDecoratorOf;
}

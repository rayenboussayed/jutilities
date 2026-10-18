import type { AnyFunction } from "../types/type.js";
import { isAsyncFunction } from "../is.js";
import type { DecoratorGuard, SyncFirstHof } from "./hof.js";
import { assertGuardConsistency, assertNotRawApplication, assertNotRawMemberApplication } from "../assert.js";

/**
 * Method decorators from fn-first enhancers.
 */

/**
 * Standard Stage 3 method decorator shape returned by
 * {@link decorateMethod}. Applies to any member whose value satisfies `F` and
 * replaces it with the enhanced function.
 * @template F - The wrapped-function shape carried over from the converted
 * HOF; members not assignable to `F` are rejected at compile time when `F` is
 * precise (e.g. a delayed-async enhancer refuses sync-only members).
 */
export type MethodDecoratorOf<F extends AnyFunction = AnyFunction> = <
  M extends F,
>(
  method: M,
  context: ClassMethodDecoratorContext<unknown, M>,
) => M | void;

/**
 * Converts any fn-first HOF into a reusable Stage 3 method decorator
 * factory. The HOF's first parameter receives the member value; every
 * remaining parameter becomes one decorator call's options, forwarded
 * verbatim, evaluated once at decorate time and shared by its wrap.
 *
 * Two slot shapes are recognized: direct first parameters
 * (`(fn: T, ...rest) => T` — e.g. {@link ../cache.ts | withCacheAsync},
 * {@link ../retry.ts | withRetryAsync}, {@link ../delay.ts | withDelayAsync},
 * `lazy`, `withLogger`) and sync-gated first parameters
 * (`(fn: AnySyncFunction<T>, ...rest) => T` — e.g.
 * {@link ../cache.ts | withCacheSync}). For sync/async discipline, pass
 * {@link DecoratorGuard} via `options.require`.
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
 * @template F - The wrapped-function shape, inferred from `hof`.
 * @template R - The option slots, inferred from `hof`.
 * @param hof - The fn-first HOF to convert.
 * @param options - Optional {@link DecoratorGuard} (`require: "sync"` or
 * `"async"`) checked against the member at decorate time.
 * @returns A decorator factory whose rest arguments are forwarded to `hof`
 * exactly once per decorated member.
 */
export function decorateMethod<F extends AnyFunction, R extends any[] = []>(
  hof: (fn: F, ...rest: R) => F,
  options?: DecoratorGuard,
): (...rest: R) => MethodDecoratorOf<F>;

/**
 * Sync-slot variant of {@link decorateMethod} for HOFs typed
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
export function decorateMethod<F extends AnyFunction, R extends any[] = []>(
  hof: SyncFirstHof<F, R>,
  options?: DecoratorGuard,
): (...rest: R) => MethodDecoratorOf<F>;

export function decorateMethod(
  hof: (fn: AnyFunction, ...rest: any[]) => AnyFunction,
  options?: DecoratorGuard,
): (...rest: any[]) => MethodDecoratorOf {
  return ((...rest: any[]) => {
    assertNotRawApplication(options, "decorateMethod");
    assertNotRawMemberApplication(rest, "decorateMethod");
    return (
      method: AnyFunction,
      context: ClassMethodDecoratorContext<unknown, AnyFunction>,
    ) => {
      assertGuardConsistency(
        options,
        isAsyncFunction(method),
        "decorateMethod",
        String(context.name),
      );
      return hof(method, ...rest) as AnyFunction;
    };
  }) as (...rest: any[]) => MethodDecoratorOf;
}

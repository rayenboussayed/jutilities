import type { AnyFunction } from "./types/type.js";

import { djb2 } from "./hash.js";
import {
  type HofFn,
  type HofKind,
} from "./libs/create-hof.js";

/**
 * The {@link HofKind} of {@link lazy}: its options are resolved from the
 * concrete wrapped function type.
 * @template T - The function type upper bound.
 */
export interface LazyKind<T extends AnyFunction = AnyFunction>
  extends HofKind<T> {
  options: LazyOptions<this["fn"]>;
}

/**
 * Options accepted by {@link lazy}.
 * @template T - The memoized function type (sync or async).
 */
export type LazyOptions<T extends AnyFunction = AnyFunction> = {
  /**
   * Per-call bypass switch: `true` resolves the wrapper to `fn` itself at
   * wrap time; a function predicate receives the call arguments and a truthy
   * result invokes `fn` raw for that call (recomputing, writing nothing).
   * The predicate is synchronous — `lazy` is a sync wrapper, so a returned
   * promise counts as truthy and bypasses the call.
   */
  skipHof?: ((...args: Parameters<T>) => boolean) | boolean;
};

/**
 * Memoizes a function's results keyed by a hash of its source and arguments.
 * @template T - The function to memoize (sync or async).
 * @param fn - The initializer whose results should be cached.
 * @param options - Options object.
 * @param options.skipHof - Per-call bypass switch.
 * @returns The cached function.
 */
export const lazy = lazyFactory as (<T extends AnyFunction>(
  fn: T,
  options?: LazyOptions<T>,
) => T) &
  HofFn<LazyKind, "any">;

/**
 * Core lazy factory. `lazy` owns this implementation instead of delegating to
 * a generic `createHofAny` factory, so `src/libs/create-hof.ts` can remain
 * focused on the sync and async HOF families.
 * @param fn - The initializer to memoize.
 * @param options - Wrapper options, especially `skipHof`.
 * @param options.skipHof - Whether to bypass HOF decoration.
 * @returns The wrapped memoizing function or the raw initializer.
 */
function lazyFactory(
  fn: AnyFunction,
  options: { skipHof?: ((...args: any[]) => boolean) | boolean } = {},
) {
  if (options.skipHof === true) return fn;

  const functionString = fn.toString();
  const store = new Map<number, unknown>();

  const enhanced = function (
    this: unknown,
    ...args: any[]
  ) {
    const storeKey = djb2(JSON.stringify({ args, functionString }));

    const storedValue = store.get(storeKey);
    if (storedValue) return storedValue;

    const result = fn.apply(this, args);
    store.set(storeKey, result);

    if (result instanceof Promise) {
      return result.catch((error: unknown) => {
        store.delete(storeKey);
        throw error;
      });
    }

    return result;
  };

  if (typeof options.skipHof !== "function") return enhanced;

  const skipHof = options.skipHof as (...args: readonly unknown[]) => boolean;
  return function (this: unknown, ...args: any[]) {
    return skipHof(...args)
      ? fn.apply(this, args)
      : enhanced.apply(this, args);
  };
}

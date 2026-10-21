import { djb2 } from "./hash.js";
import {
  createHofSync,
  type HofFn,
  type HofKind,
} from "./libs/create-hof.js";
import type { AnyFunction } from "./types/type.js";

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
  skipHof?: boolean | ((...args: Parameters<T>) => boolean);
};

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
 * Memoizes a function's results keyed by a hash of its source and arguments.
 *
 * Behavior notes (locked by tests):
 * - Cache key = `djb2(JSON.stringify({ functionString, args }))` — includes
 *   the function's exact source text, so different initializers never share
 *   entries; `this` is NOT part of the key.
 * - Falsy results (`0`, `""`, `false`, `null`, `undefined`, `NaN`) are never
 *   cached: every call recomputes them (truthiness gate).
 * - Promise results are cached until they reject — a rejected promise is
 *   evicted, so the next call retries.
 * - djb2 is a 32-bit hash, so distinct argument tuples can theoretically
 *   collide.
 * - The memo store lives at wrap time; two `lazy(fn)` wraps of the same `fn`
 *   keep independent stores. Pass `skipHof: true` (or a truthy per-call
 *   predicate) to run `fn` raw, untouched by the memo store.
 * - Sync and async initializers are both accepted (a promise result is
 *   memoized until it rejects) — the one wrapper in this package that takes
 *   either shape.
 * @template T - The function to memoize (sync or async).
 * @param fn - The initializer whose results should be cached.
 * @param options - Options object.
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 *   to `fn` itself at wrap time; a function predicate receives the call
 *   arguments and a truthy result invokes `fn` raw for that call (recomputing,
 *   writing nothing). Omitted by default — the memoizing wrapper is applied.
 * @returns The wrapped function (typeof `fn`) reading/writing the memo store.
 */
export const lazy = createHofSync<LazyKind>(
  (fn) => {
    const functionString = fn.toString();
    const store = new Map<number, unknown>();

    return function (
      this: ThisParameterType<LazyKind["fn"]>,
      ...args: Parameters<LazyKind["fn"]>
    ) {
      const storeKey = djb2(JSON.stringify({ functionString, args }));

      const storedValue = store.get(storeKey);
      if (storedValue) return storedValue;

      const result = fn.apply(this, args);
      store.set(storeKey, result);

      if (result instanceof Promise) {
        return result.catch((error) => {
          store.delete(storeKey);
          throw error;
        });
      }
      return result;
    } as LazyKind["fn"];
  },
) as unknown as (<T extends AnyFunction>(
  fn: T,
  options?: LazyOptions<T>,
) => T) &
  HofFn<LazyKind, "any">;

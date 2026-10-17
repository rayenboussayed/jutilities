import { djb2 } from "./hash.js";
import type { AnyFunction } from "./types/type.js";

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
 * @template T - The function to memoize.
 * @param fn - The initializer whose results should be cached.
 * @returns The wrapped function (typeof `fn`) reading/writing the memo store.
 */
export function lazy<T extends AnyFunction>(fn: T) {
  const functionString = fn.toString();
  const store = new Map<number, ReturnType<T>>();

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
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
  } as T;
}

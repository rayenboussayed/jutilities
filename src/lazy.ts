import type { AnyFunction } from "./types/type.js";

import { djb2 } from "./hash.js";
import { superjson } from "./json.js";

const globalStore = new Map<number, unknown>();

/**
 * Memoizes a function's results keyed by a hash of its source and arguments.
 *
 * The memoization store is process-lifetime and shared across every `lazy()`
 * wrapper of the same initializer — two wrappers built from the same source
 * text and called with the same arguments hit the same entry. Every distinct
 * (function source, arguments) pair is retained until the process exits, so
 * use it for stable, low-cardinality inputs.
 * @template T - The function to memoize (sync or async).
 * @param fn - The initializer whose results should be cached.
 * @returns The cached function.
 */
export function lazy<T extends AnyFunction>(fn: T) {
  const functionString = fn.toString();

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const storeKey = djb2(superjson.stringify({ args, functionString }));

    const storedValue = globalStore.get(storeKey);
    if (storedValue) return storedValue;

    const result = fn.apply(this, args);
    globalStore.set(storeKey, result);

    if (result instanceof Promise) {
      return result.catch((error) => {
        globalStore.delete(storeKey);
        throw error;
      });
    }

    return result;
  } as T;
}

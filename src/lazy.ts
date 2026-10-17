import { djb2 } from "./hash.js";
import type { AnyFunction } from "./types/type.js";

// lazy value initializer
/**
 *
 * @param fn
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

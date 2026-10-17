import type { AnyFunction } from "./types/type.js";

export function withLogger<T extends AnyFunction>(name: string, fn: T): T;
 
export function withLogger<T extends AnyFunction>(fn: T): T;
/**
 *
 * @param argument0
 * @param argument1
 */
export function withLogger<T extends AnyFunction>(
  argument0: string | T,
  argument1?: T,
) {
  const fn = typeof argument0 === "function" ? argument0 : argument1!;
  const name = typeof argument0 === "string" ? argument0 : fn.name;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const label = `[Function ${name || "unknown"}]`;

    console.log(`${label} Execution, Args:`, ...args);
    const startTime =
      typeof window === "undefined" ? performance.now() : Date.now();
    const result = fn.apply(this, args);
    if (result instanceof Promise) {
      return result.then((value) => {
        const endTime =
          typeof window === "undefined" ? performance.now() : Date.now();
        console.log(
          `${label} Execution ${endTime - startTime}ms, Result:`,
          value,
        );
        return value;
      });
    }
    const endTime =
      typeof window === "undefined" ? performance.now() : Date.now();
    console.log(`${label} Execution ${endTime - startTime}ms, Result:`, result);
    return result;
  } as T;
}

import type { AnyFunction } from "./types/type.js";

/**
 * Higher-order logger that traces a function's invocation and result through
 * `console.log`.
 *
 * Two call forms:
 * - `withLogger("name", fn)` — log under an explicit name.
 * - `withLogger(fn)` — log under the function's own `.name` (may be `""` for
 *   anonymous functions, in which case `unknown` is used).
 *
 * Output: one line for invocation (`Execution, Args:` followed by the args as
 * separate console parameters) and one line for completion
 * (`Execution <ms>ms, Result:` followed by the resolved value). Timing uses
 * `performance.now` in Node and `Date.now` where a `window` exists. Async
 * functions log their awaited resolved value.
 *
 * Note: the return type is structurally widened only in the JSDoc sense — at
 * runtime it forwards `this` and returns whatever `fn` returns.
 */

export function withLogger<T extends AnyFunction>(name: string, fn: T): T;

export function withLogger<T extends AnyFunction>(fn: T): T;

/**
 * Logs the invocation arguments and completion (value + duration) of a
 * wrapped function.
 * @template T - The function being wrapped.
 * @param argument0 - Explicit name (string) or the function itself.
 * @param argument1 - The function, required only when `argument0` is the
 * name.
 * @returns The wrapped function (typeof `fn`) with logging around each call.
 */
export function withLogger<T extends AnyFunction>(
  argument0: string | T,
  argument1?: T,
) {
  const fn = typeof argument0 === "function" ? argument0 : argument1!;
  const name = typeof argument0 === "string" ? argument0 : fn.name;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const label = `[Function ${name || "unknown"}]`;

    // eslint-disable-next-line deslint/no-prod-console -- this module's feature *is* console logging (test-pinned output target)
    console.log(`${label} Execution, Args:`, ...args);
    const startTime =
      typeof window === "undefined" ? performance.now() : Date.now();
    const result = fn.apply(this, args);
    if (result instanceof Promise) {
      return result.then((value) => {
        const endTime =
          typeof window === "undefined" ? performance.now() : Date.now();
        // eslint-disable-next-line deslint/no-prod-console -- this module's feature *is* console logging (test-pinned output target)
        console.log(
          `${label} Execution ${endTime - startTime}ms, Result:`,
          value,
        );
        return value;
      });
    }
    const endTime =
      typeof window === "undefined" ? performance.now() : Date.now();
    // eslint-disable-next-line deslint/no-prod-console -- this module's feature *is* console logging (test-pinned output target)
    console.log(`${label} Execution ${endTime - startTime}ms, Result:`, result);
    return result;
  } as T;
}

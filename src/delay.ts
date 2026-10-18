import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
} from "./types/type.js";
import type { WithSignal } from "./types/with.js";
import { sleepAsync, sleepSync } from "./sleep.js";

export type Options = WithSignal<{
  delay?: number;
}>;

/**
 * Higher-order wrappers that sleep before invoking a function.
 */

/**
 * Wraps an async function so every invocation waits `delay` milliseconds first.
 *
 * Behavior notes:
 * - `delay <= 0` (and `undefined`/`NaN`) returns the original function itself.
 * - The wrapper itself is not `async` — the factory returns synchronously
 *   (`withDelayAsync(fn)` is `fn` when there is nothing to do).
 * - Aborting mid-delay cuts the wait short and the wrapped call rejects with
 *   `signal.reason` — the wrapped function never runs mid-wait.
 * @param fn - The async function to wrap.
 * @param root0 - Options object.
 * @param root0.signal - Optional abort signal for the pre-call wait.
 * @param root0.delay - Milliseconds to wait before each call (default `0`).
 * @returns The wrapped function (typeof `fn`), or `fn` itself when there is
 * nothing to delay.
 */
export function withDelayAsync<T extends AnyAsyncFunction>(
  fn: T,
  { signal, delay = 0 }: Options = {},
) {
  if (delay <= 0) return fn;
  return async function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    await sleepAsync({ sleep: delay, signal });
    return fn.apply(this, args);
  } as T;
}

/**
 * Wraps a sync function so every invocation busy-blocks `delay` milliseconds
 * first (see {@link sleepSync} for the blocking caveats).
 *
 * Behavior notes:
 * - `delay <= 0` (and `undefined`/`NaN`) returns the original function itself.
 * - The event loop is blocked during the pre-call wait.
 * @param fn - The sync function to wrap.
 * @param root0 - Options object.
 * @param root0.signal - Optional abort signal for the pre-call wait.
 * @param root0.delay - Milliseconds to block before each call (default `0`).
 * @returns The wrapped function, or `fn` itself when there is nothing to
 * delay.
 */
export function withDelaySync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  { signal, delay = 0 }: Options = {},
) {
  if (delay <= 0) return fn;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    sleepSync({ sleep: delay, signal });
    return fn.apply(this, args);
  };
}

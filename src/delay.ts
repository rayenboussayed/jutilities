import type { AnyFunction } from "./types/type.js";
import type { WithSignal } from "./types/with.js";
import {
  createHofAsync,
  createHofSync,
  type HofKind,
} from "./libs/create-hof.js";
import { sleepAsync, sleepSync } from "./sleep.js";

export type Options = WithSignal<{
  delay?: number;
}>;

export interface DelayKind<T extends AnyFunction = AnyFunction> extends HofKind<T> {
  options: Options;
}


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
 * @template T - The function being wrapped.
 * @param fn - The async function to wrap.
 * @param options - Options object.
 * @param options.signal - Optional abort signal for the pre-call wait.
 * @param options.delay - Milliseconds to wait before each call (default `0`).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (no wait).
 * Defaults to enabled.
 * @returns The wrapped function (typeof `fn`), or `fn` itself when there is
 * nothing to delay.
 */
export const withDelayAsync = createHofAsync<DelayKind>(
  (fn, { signal, delay = 0 }) => {
    if (delay <= 0) return fn;
    return async function (
      this: ThisParameterType<DelayKind["fn"]>,
      ...args: Parameters<DelayKind["fn"]>
    ) {
      await sleepAsync({ sleep: delay, signal });
      return fn.apply(this, args);
    };
  },
);

/**
 * Wraps a sync function so every invocation busy-blocks `delay` milliseconds
 * first (see {@link sleepSync} for the blocking caveats).
 *
 * Behavior notes:
 * - `delay <= 0` (and `undefined`/`NaN`) returns the original function itself.
 * - The event loop is blocked during the pre-call wait.
 * @template T - The function being wrapped.
 * @param fn - The sync function to wrap.
 * @param options - Options object.
 * @param options.signal - Optional abort signal for the pre-call wait.
 * @param options.delay - Milliseconds to block before each call (default `0`).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (no wait).
 * Defaults to enabled.
 * @returns The wrapped function, or `fn` itself when there is nothing to
 * delay.
 */
export const withDelaySync = createHofSync<DelayKind>(
  (fn, { signal, delay = 0 }) => {
    if (delay <= 0) return fn;
    return function (
      this: ThisParameterType<DelayKind["fn"]>,
      ...args: Parameters<DelayKind["fn"]>
    ) {
      sleepSync({ sleep: delay, signal });
      return fn.apply(this, args);
    };
  },
);

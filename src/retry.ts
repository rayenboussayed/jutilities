import { sleepSync } from "./sleep.js";
import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
  MaybePromise,
} from "./types/type.js";

const defaultOnError: OnErrorFn = ({
  totalRetryExecution,
  startFnExecution,
  endFnExecution,
  error,
  retries,
}) => {
  if (retries >= 10) throw error;
  if (totalRetryExecution >= 60_000) throw error;

  const lastAttemptDuration = endFnExecution - startFnExecution;
  const exponentialDelay = 2 ** retries * lastAttemptDuration;
  const remainingBudget = 60_000 - totalRetryExecution;
  const maxDelay = Math.min(exponentialDelay, remainingBudget);
  const jitteredDelay = Math.random() * maxDelay;
  sleepSync({ sleep: jitteredDelay });
};

type OnErrorFn<T extends AnyFunction = AnyFunction> = (options: {
  parameters: Parameters<T>;
  startRetryExecution: number;
  totalRetryExecution: number;
  startFnExecution: number;
  endFnExecution: number;
  retries: number;
  error: unknown;
}) => T extends AnyAsyncFunction ? MaybePromise<void> : void;

/**
 * Higher-order wrappers that retry a function according to a caller-provided
 * policy (`onError` decides whether to retry, throw, or back off).
 *
 * The policy context provides the call arguments, attempt timing, the current
 * `retries` count (starting at `0`), and the thrown error. Throwing inside
 * `onError` stops the retry loop and surfaces that error instead.
 */

/**
 * Wraps an async function in a policy-driven retry loop.
 *
 * The default policy (see above) gives up after 10 retries (11 attempts; the
 * policy throws at `retries === 10`) or once the retry tour has taken
 * `>= 60_000` ms cumulative. It also backs off: between attempts it sleeps an
 * exponential, jittered `2^retries * lastAttemptDuration` wait, capped by the
 * remaining time budget. Pass `onError` to own the whole policy instead.
 * @param fn - The async function to wrap with retries.
 * @param onError - Retry policy callback invoked after each failure; return to
 * retry, throw to stop (defaults to the 10-retry / 60s policy with built-in
 * exponential jittered backoff).
 * @returns The wrapped function (typeof `fn`) that runs until it succeeds or
 * the policy throws.
 */
export function withRetryAsync<T extends AnyAsyncFunction>(
  fn: T,
  onError: OnErrorFn<T> = defaultOnError,
) {
  return async function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    let retries = 0;
    const startRetryExecution =
      typeof window === "undefined" ? performance.now() : Date.now();
    while (true) {
      const startFnExecution =
        typeof window === "undefined" ? performance.now() : Date.now();
      try {
        const result = await fn.apply(this, args);
        return result;
      } catch (error) {
        const endFnExecution =
          typeof window === "undefined" ? performance.now() : Date.now();
        await onError({
          parameters: args,
          startRetryExecution,
          totalRetryExecution: endFnExecution - startRetryExecution,
          startFnExecution,
          endFnExecution,
          error,
          retries,
        });
        retries++;
      }
    }
  } as T;
}

/**
 * Wraps a sync function in a policy-driven retry loop (busy, no awaits).
 *
 * Behavior notes:
 * - Every call argument is forwarded verbatim to `fn` and reported to `onError`
 *   via `parameters` (see {@link OnErrorFn}).
 * - `this` is forwarded to every attempt.
 * @param fn - The sync function to wrap with retries.
 * @param onError - Sync retry policy callback; return to retry, throw to stop
 * (defaults to the 10-retry / 60s policy with built-in exponential jittered
 * backoff).
 * @returns The wrapped function (typeof `fn`) that runs until it succeeds or
 * the policy throws.
 */
export function withRetrySync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  onError: OnErrorFn<AnySyncFunction<T>> = defaultOnError,
) {
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    let retries = 0;
    const startRetryExecution =
      typeof window === "undefined" ? performance.now() : Date.now();
    while (true) {
      const startFnExecution =
        typeof window === "undefined" ? performance.now() : Date.now();
      try {
        const result = fn.apply(this, args);
        return result;
      } catch (error) {
        const endFnExecution =
          typeof window === "undefined" ? performance.now() : Date.now();
        onError({
          parameters: args,
          startRetryExecution,
          totalRetryExecution: endFnExecution - startRetryExecution,
          startFnExecution,
          endFnExecution,
          error,
          retries,
        });
        retries++;
      }
    }
  } as T;
}

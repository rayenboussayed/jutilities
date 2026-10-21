import { sleepSync } from "./sleep.js";
import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
  HandleAsyncFunction,
  MaybePromise,
} from "./types/type.js";
import {
  createHofAsync,
  createHofSync,
  type HofKind,
} from "./libs/create-hof.js";

/**
 * The default `onError` policy: exponential back-off (2^retries × the last
 * attempt's duration) with jitter, bounded by a 60s budget; rethrows past
 * 10 retries or once the budget is exhausted.
 * @param root0 - The retry bookkeeping provided by the wrapper.
 * @param root0.totalRetryExecution - Milliseconds spent retrying so far.
 * @param root0.startFnExecution - When the last attempt started.
 * @param root0.endFnExecution - When the last attempt ended.
 * @param root0.error - The last attempt's error.
 * @param root0.retries - How many retries have run so far.
 */
export const defaultOnError: OnErrorFn = ({
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

export type OnErrorFn<T extends AnyFunction = AnyFunction> = (options: {
  parameters: Parameters<T>;
  startRetryExecution: number;
  totalRetryExecution: number;
  startFnExecution: number;
  endFnExecution: number;
  retries: number;
  error: unknown;
}) => HandleAsyncFunction<T, MaybePromise<void>, void>;

export type Options<T extends AnyFunction = AnyFunction> = {
  onError?: OnErrorFn<T>;
};

interface RetryKind<T extends AnyFunction> extends HofKind<T> {
  options: Options<this["fn"]>;
}

export type RetrySyncKind = RetryKind<AnySyncFunction>;
export type RetryAsyncKind = RetryKind<AnyAsyncFunction>;

/**
 * Higher-order wrappers that retry a function according to a caller-provided
 * policy (`options.onError` decides whether to retry, throw, or back off).
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
 * remaining time budget. Pass `options.onError` to own the whole policy
 * instead.
 * @template T - The function being wrapped.
 * @param fn - The async function to wrap with retries.
 * @param options - Options object.
 * @param options.onError - Retry policy callback invoked after each failure;
 * return to retry, throw to stop (defaults to the 10-retry / 60s policy with
 * built-in exponential jittered backoff; may be async).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (failures
 * propagate without retrying). Defaults to enabled.
 * @returns The wrapped function (typeof `fn`) that runs until it succeeds or
 * the policy throws.
 */
export const withRetryAsync = createHofAsync<RetryAsyncKind>(
  (fn, { onError = defaultOnError } = {}) => {
    return async function (
      this: ThisParameterType<RetryAsyncKind["fn"]>,
      ...args: Parameters<RetryAsyncKind["fn"]>
    ) {
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
    } as RetryAsyncKind["fn"];
  },
);

/**
 * Wraps a sync function in a policy-driven retry loop (busy, no awaits).
 *
 * Behavior notes:
 * - Every call argument is forwarded verbatim to `fn` and reported to
 *   `options.onError` via `parameters` (see {@link OnErrorFn}).
 * - `this` is forwarded to every attempt.
 * @template T - The function being wrapped.
 * @param fn - The sync function to wrap with retries.
 * @param options - Options object.
 * @param options.onError - Sync retry policy callback; return to retry, throw
 * to stop (defaults to the 10-retry / 60s policy with built-in exponential
 * jittered backoff).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (failures
 * propagate without retrying). Defaults to enabled.
 * @returns The wrapped function (typeof `fn`) that runs until it succeeds or
 * the policy throws.
 */
export const withRetrySync = createHofSync<RetrySyncKind>(
  (fn, { onError = defaultOnError } = {}) => {
    return function (
      this: ThisParameterType<RetrySyncKind["fn"]>,
      ...args: Parameters<RetrySyncKind["fn"]>
    ) {
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
    } as RetrySyncKind["fn"];
  },
);

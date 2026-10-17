import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
  MaybePromise,
} from "./types/type.js";

const defaultOnError: OnErrorFn = ({
  startExecution,
  endExecution,
  error,
  retries,
}) => {
  if (retries >= 3) throw error;
  if (endExecution - startExecution >= 60_000) throw error;
};

type OnErrorFn<T extends AnyFunction = AnyFunction> = (options: {
  parameters: Parameters<T>;
  startExecution: number;
  endExecution: number;
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
 * The default policy (see above) gives up after `retries >= 3` (four attempts:
 * 0, 1, 2, 3) or when a single execution took >= 60 seconds. There is no
 * built-in backoff — implement delays/backoff inside `onError`.
 * @param fn - The async function to wrap with retries.
 * @param onError - Retry policy callback invoked after each failure; return to
 * retry, throw to stop (defaults to the ≤3-retries / 60s policy).
 * @returns The wrapped function (typeof `fn`) that runs until it succeeds or
 * the policy throws.
 */
export function withRetryAsync<T extends AnyAsyncFunction>(
  fn: T,
  onError: OnErrorFn<T> = defaultOnError,
) {
  return async function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    let retries = 0;
    while (true) {
      const startExecution =
        typeof window === "undefined" ? performance.now() : Date.now();
      try {
        const result = await fn.apply(this, args);
        return result;
      } catch (error) {
        const endExecution =
          typeof window === "undefined" ? performance.now() : Date.now();
        await onError({
          parameters: args,
          startExecution,
          endExecution,
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
 * ⚠️ Known signature bug (locked by tests): the wrapper declares a single
 * `args` parameter instead of a rest parameter, so calling it
 * `wrapped(1, 2)` passes `1` as the args array and `fn.apply(this, 1)` throws
 * a `TypeError`. Call it with zero arguments, or pass exactly one array
 * argument (it is spread onto `fn`), until this is fixed.
 * @param fn - The sync function to wrap with retries.
 * @param onError - Sync retry policy callback; return to retry, throw to stop
 * (defaults to the ≤3-retries / 60s policy).
 * @returns The wrapped function (typeof `fn`) that runs until it succeeds or
 * the policy throws.
 */
export function withRetrySync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  onError: OnErrorFn<AnySyncFunction<T>> = defaultOnError,
) {
  return function (this: ThisParameterType<T>, args: Parameters<T>) {
    let retries = 0;
    while (true) {
      const startExecution =
        typeof window === "undefined" ? performance.now() : Date.now();
      try {
        const result = fn.apply(this, args);
        return result;
      } catch (error) {
        const endExecution =
          typeof window === "undefined" ? performance.now() : Date.now();
        onError({
          parameters: args,
          startExecution,
          endExecution,
          error,
          retries,
        });
        retries++;
      }
    }
  } as T;
}

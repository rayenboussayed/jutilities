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
 *
 * @param fn
 * @param onError
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
 *
 * @param fn
 * @param onError
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

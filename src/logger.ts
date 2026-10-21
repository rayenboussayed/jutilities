import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
} from "./types/type.js";
import {
  createHofAsync,
  createHofSync,
  type HofKind,
} from "./libs/create-hof.js";

/**
 * Sync and async higher-order loggers that trace a function's invocation and
 * result through `logger.debug`, split exactly like `withCacheSync` /
 * `withCacheAsync` and `withDelaySync` / `withDelayAsync` so neither wrapper
 * body needs runtime promise sniffing.
 *
 * One call form each: `withLoggerSync(fn, options?)` for sync functions and
 * `withLoggerAsync(fn, options?)` for declared-`async` ones — fn-first like
 * every wrapper in this package. Pass `options.name` to log under an explicit
 * label, or omit options to log under the function's own `.name` (may be
 * `""` for anonymous functions, in which case `anonymous` is used).
 *
 * Output (both variants, through the injectable `logger` sink — default
 * `console`): one line for invocation (`Execution, Args:` followed by the
 * args as separate console parameters) and one line for completion
 * (`Execution <ms>ms, Result:` followed by the value). Timing uses
 * `performance.now` in Node and `Date.now` where a `window` exists. The async
 * variant logs its awaited resolved value; a sync function returning a
 * non-`Promise` thenable logs that object without awaiting it.
 */

export type Options = {
  name?: string;
  logger?: {
    debug: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
};

interface LoggerKind<T extends AnyFunction> extends HofKind<T> {
  options: Options;
}

export type LoggerSyncKind = LoggerKind<AnySyncFunction>;
export type LoggerAsyncKind = LoggerKind<AnyAsyncFunction>;

/**
 * Logs the invocation arguments and completion (value + duration) of a
 * wrapped SYNC function.
 *
 * The first parameter is sync-gated (`AnySyncFunction<T>`), so the wrapper
 * feeds the sync slot of the decorator converters exactly like
 * {@link ./cache.ts | withCacheSync} does.
 * @template T - The function being wrapped.
 * @param fn - The sync function being wrapped.
 * @param options - Options object.
 * @param options.name - Explicit label for logs; defaults to `fn.name`, or
 * `anonymous` when that is empty.
 * @param options.logger - Debug/error output sink; defaults to `console`
 * (inject a capturing mock to swap or verify output).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (no log lines).
 * Defaults to enabled.
 * @returns The wrapped function (typeof `fn`) with logging around each call.
 */
export const withLoggerSync = createHofSync<LoggerSyncKind>(
  (fn, { name: fnName, logger = console } = {}) => {
    const label = `[Function ${(fnName ?? fn.name) || "anonymous"}]`;

    return function (
      this: ThisParameterType<LoggerSyncKind["fn"]>,
      ...args: Parameters<LoggerSyncKind["fn"]>
    ) {
      logger.debug(`[${new Date()}] ${label} Execution, Args:`, ...args);
      const startTime =
        typeof window === "undefined" ? performance.now() : Date.now();
      try {
        const result = fn.apply(this, args);
        const endTime =
          typeof window === "undefined" ? performance.now() : Date.now();

        logger.debug(
          `[${new Date()}] ${label} Execution ${endTime - startTime}ms, Result:`,
          result,
        );
        return result;
      } catch (error) {
        const endTime =
          typeof window === "undefined" ? performance.now() : Date.now();
        logger.error(
          `[${new Date()}] ${label} Execution ${endTime - startTime}ms, Error:`,
          error,
        );
        throw error;
      }
    } as LoggerSyncKind["fn"];
  },
);

/**
 * Logs the invocation arguments and completion (awaited value + duration) of
 * a wrapped ASYNC function.
 *
 * The first parameter is `AnyAsyncFunction`, so the wrapper feeds the direct
 * slot of the decorator converters exactly like
 * {@link ./cache.ts | withCacheAsync} does.
 * @template T - The function being wrapped.
 * @param fn - The async function being wrapped.
 * @param options - Options object.
 * @param options.name - Explicit label for logs; defaults to `fn.name`, or
 * `anonymous` when that is empty.
 * @param options.logger - Debug/error output sink; defaults to `console`
 * (inject a capturing mock to swap or verify output).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (no log lines).
 * Defaults to enabled.
 * @returns The wrapped function (typeof `fn`) with logging around each await.
 */
export const withLoggerAsync = createHofAsync<LoggerAsyncKind>(
  (fn, { name: fnName, logger = console } = {}) => {
    const label = `[Function ${(fnName ?? fn.name) || "anonymous"}]`;

    return async function (
      this: ThisParameterType<LoggerAsyncKind["fn"]>,
      ...args: Parameters<LoggerAsyncKind["fn"]>
    ) {
      logger.debug(`[${new Date()}] ${label} Execution, Args:`, ...args);
      const startTime =
        typeof window === "undefined" ? performance.now() : Date.now();
      try {
        const result = await fn.apply(this, args);
        const endTime =
          typeof window === "undefined" ? performance.now() : Date.now();

        logger.debug(
          `[${new Date()}] ${label} Execution ${endTime - startTime}ms, Result:`,
          result,
        );
        return result;
      } catch (error) {
        const endTime =
          typeof window === "undefined" ? performance.now() : Date.now();
        logger.error(
          `[${new Date()}] ${label} Execution ${endTime - startTime}ms, Error:`,
          error,
        );
        throw error;
      }
    } as LoggerAsyncKind["fn"];
  },
);

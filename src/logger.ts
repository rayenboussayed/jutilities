import type { AnyFunction } from "./types/type.js";
import {
  createHofAsync,
  createHofSync,
  type HofKind,
} from "./libs/create-hof.js";
import { now } from "./libs/clock.js";

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

export interface LoggerKind<T extends AnyFunction = AnyFunction> extends HofKind<T> {
  options: Options;
}

/**
 * The sink both wrappers log through: the injectable `options.logger`, or
 * the `console` default.
 */
type LoggerSink = NonNullable<Options["logger"]>;

/**
 * The label a wrapper logs under: the explicit `options.name`, else the
 * function's own name, else `"anonymous"`.
 * @param fn - The wrapped function.
 * @param name - The explicit label, when given.
 * @returns The bracketed label used in every log line.
 */
function labelOf(fn: AnyFunction, name?: string): string {
  return `[Function ${(name ?? fn.name) || "anonymous"}]`;
}

/**
 * Logs the invocation line and starts the duration measurement.
 * @param logger - The sink to log through.
 * @param label - The wrapper's label.
 * @param args - The call arguments.
 * @returns The start timestamp of the measured call.
 */
function logStart(logger: LoggerSink, label: string, args: unknown[]): number {
  logger.debug(`[${new Date()}] ${label} Execution, Args:`, ...args);
  return now();
}

/**
 * Logs the completion line with the elapsed duration.
 * @param logger - The sink to log through.
 * @param label - The wrapper's label.
 * @param startTime - The start timestamp of the measured call.
 * @param result - The call's result.
 */
function logResult(
  logger: LoggerSink,
  label: string,
  startTime: number,
  result: unknown,
): void {
  logger.debug(
    `[${new Date()}] ${label} Execution ${now() - startTime}ms, Result:`,
    result,
  );
}

/**
 * Logs the failure line with the elapsed duration.
 * @param logger - The sink to log through.
 * @param label - The wrapper's label.
 * @param startTime - The start timestamp of the measured call.
 * @param error - The thrown value.
 */
function logError(
  logger: LoggerSink,
  label: string,
  startTime: number,
  error: unknown,
): void {
  logger.error(
    `[${new Date()}] ${label} Execution ${now() - startTime}ms, Error:`,
    error,
  );
}

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
export const withLoggerSync = createHofSync<LoggerKind>(
  (fn, { name: fnName, logger = console } = {}) => {
    const label = labelOf(fn, fnName);

    return function (
      this: ThisParameterType<LoggerKind["fn"]>,
      ...args: Parameters<LoggerKind["fn"]>
    ) {
      const startTime = logStart(logger, label, args);
      try {
        const result = fn.apply(this, args);
        logResult(logger, label, startTime, result);
        return result;
      } catch (error) {
        logError(logger, label, startTime, error);
        throw error;
      }
    } as LoggerKind["fn"];
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
export const withLoggerAsync = createHofAsync<LoggerKind>(
  (fn, { name: fnName, logger = console } = {}) => {
    const label = labelOf(fn, fnName);

    return async function (
      this: ThisParameterType<LoggerKind["fn"]>,
      ...args: Parameters<LoggerKind["fn"]>
    ) {
      const startTime = logStart(logger, label, args);
      try {
        const result = await fn.apply(this, args);
        logResult(logger, label, startTime, result);
        return result;
      } catch (error) {
        logError(logger, label, startTime, error);
        throw error;
      }
    } as LoggerKind["fn"];
  },
);

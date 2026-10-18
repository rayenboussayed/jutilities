import type { AnyFunction, AnySyncFunction } from "../types/type.js";

/**
 * Decorator conversion contract.
 */

/**
 * The canonical decorator-convertible HOF shape: its FIRST parameter is the
 * function being enhanced, every remaining parameter is one decorator call's
 * rest options, and the wrapped function (same shape as the input) is
 * returned. Every fn-first wrapper in this package conforms
 * (`withCacheSync`, `withRetryAsync`, `withDelaySync`, `lazy`, `withLogger`).
 *
 * A Stage 3 decorator factory is produced by
 * {@link ./method.ts | decorateMethod},
 * {@link ./property.ts | decorateProperty},
 * {@link ./getter.ts | decorateGetter} and
 * {@link ./class.ts | decorateClass}; each simply forwards
 * `(member, ...options)` to the HOF.
 * @template F - The wrapped-function shape (usually inferred from a concrete
 * HOF).
 * @template R - The option slots spread verbatim as decorator options.
 */
export type FnFirstHof<F extends AnyFunction = AnyFunction, R extends any[] = []> = (
  fn: F,
  ...rest: R
) => F;

/**
 * Sync-gated variant of {@link FnFirstHof} for HOFs whose first parameter is
 * typed `AnySyncFunction` (the sync flavor of `withCache`,
 * `withDelay`, and `withRetry` forward through here instead).
 * @template F - The wrapped-function shape (usually inferred from a concrete
 * HOF).
 * @template R - The option slots spread verbatim as decorator options.
 */
export type SyncFirstHof<F extends AnyFunction = AnyFunction, R extends any[] = []> = (
  fn: AnySyncFunction<F>,
  ...rest: R
) => F;

/**
 * Extracts the wrapped-function shape from a concrete fn-first HOF. Falls
 * back to `never` when the signature has no fn-first first parameter.
 * @template H - The HOF signature to probe.
 */
export type HofFnOf<H> =
  H extends (fn: infer F, ...rest: unknown[]) => unknown
    ? F extends AnyFunction
      ? F
      : never
    : never;

/**
 * Extracts the option slots of a HOF — everything after its first (the
 * wrapped-function) parameter — as a tuple for decorator spread typing.
 * @template H - The HOF signature to probe.
 */
export type HofRestOf<H> =
  H extends (fn: never, ...rest: infer R) => unknown ? R : never;

/**
 * Optional sync/async discipline knob accepted by `decorateMethod`,
 * `decorateGetter` and `decorateProperty`. When set, the decorator verifies
 * the member value at decorate time (not call time) via
 * {@link ../is.ts | isAsyncFunction} and fails fast with a `TypeError` naming
 * the offending member.
 * @remarks `isAsyncFunction` relies on runtime constructor names, so lowered
 * async functions (transpilers/minifiers) may evade the check.
 */
export type DecoratorGuard = {
  /**
   * Require the member to be `"sync"` (non-`async`) or `"async"` (declared
   * `async`) at decorate time.
   */
  require?: "sync" | "async";
};

/**
 * Runtime guards shared by the converters live elsewhere:
 * {@link ../is.ts | isDecorationContext} and
 * {@link ../is.ts | isRawMemberApplication} probe decoration contexts and
 * paren-less-misfire fingerprints, while their fail-fast wrappers
 * (`assertNotRawApplication`, `assertNotRawMemberApplication`,
 * `assertGuardConsistency`) live in {@link ../assert.ts}.
 */

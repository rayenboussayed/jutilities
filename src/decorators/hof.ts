import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
} from "../types/type.js";
import type {
  ApplyKind,
  HofFlavor,
  KindOf,
  WithSkipHof,
} from "../libs/create-hof.js";

/**
 * Decorator conversion contract.
 */

/**
 * The options bag a converted HOF receives, resolved from the HOF's kind for
 * a concrete wrapped-function type.
 *
 * Every fn-first HOF built by
 * {@link ../libs/create-hof.ts | createHofSync} / `createHofAsync` carries its
 * kind as a type-only `__kind` brand, so a converter recovers the option type
 * from that brand instead of probing the HOF's signature shape. The recovered
 * bag includes the shared `skipHof` bypass slot.
 * @template H - The converted HOF type.
 * @template TF - The wrapped-function type the options are resolved for.
 */
export type HofOptions<
  H,
  TF extends AnyFunction = AnyFunction,
> = WithSkipHof<ApplyKind<KindOf<H>, TF>, TF>;

/**
 * The member shape a converted HOF may wrap, narrowed by its flavor: a sync
 * HOF refuses a promise-returning member, an async HOF refuses a
 * non-promise-returning one. Both mismatches are compile-time rejections.
 * @template F - The HOF flavor.
 * @template M - The member type.
 */
export type GatedMember<F extends HofFlavor, M extends AnyFunction> =
  F extends "sync" ? M & AnySyncFunction<M>
  : F extends "async" ? M & AnyAsyncFunction
  : M;

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

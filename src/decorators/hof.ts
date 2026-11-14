import type {
  ApplyKind,
  FlavorOf,
  HofConstraint,
  HofFlavor,
  KindOf,
  WithSkipHof,
} from "../libs/create-hof.js";
import type {
  AnyAsyncFunction,
  AnyFunction,
} from "../types/type.js";

import {
  assertGuardConsistency,
  assertNotRawMemberApplication,
} from "../assert.js";
import { isAsyncFunction } from "../is.js";

/**
 * Decorator conversion contract.
 */

/**
 * Optional sync/async discipline knob accepted by `decorateMethod` and
 * `decorateGetter`. When set, the decorator verifies
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
  require?: "async" | "sync";
};

/**
 * The member shape a converted HOF may wrap, narrowed by its flavor: an
 * async HOF refuses a non-promise-returning member at compile time; a sync
 * HOF preserves the full member type at compile time and relies on runtime
 * guarding to reject promise-like or generator results.
 * @template F - The HOF flavor.
 * @template M - The member type.
 */
export type GatedMember<F extends HofFlavor, M extends AnyFunction> =
  F extends "async" ? AnyAsyncFunction & M
  : M;

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
 * The options bag a converted HOF of type `H` receives, resolved against the
 * flavor's own constraint level — the shorthand every converter uses.
 * @template H - The converted HOF type.
 */
export type HofOptionsOf<H> = HofOptions<H, HofConstraint<FlavorOf<H>>>;

/**
 * The shared skeleton of a member decorator: it validates the factory call
 * (the paren-less misfire guard), captures the option bag, and returns the
 * function that enhances one member — checking the member's async-ness against
 * the guard before handing it to the HOF.
 *
 * Every member converter (`decorateMethod`, `decorateGetter`) shares this,
 * so the misfire and guard rules are defined once.
 * @param name - The converter's name, used in the error messages.
 * @param hof - The converted HOF.
 * @param options - The converter's guard options.
 * @param args - The arguments the decorator factory received.
 * @returns The function that enhances one member.
 */
export function memberEnhancer(
  name: string,
  hof: (fn: any, hofOptions?: any) => any,
  options: DecoratorGuard | undefined,
  args: unknown[],
): (member: AnyFunction, memberName: string) => AnyFunction {
  assertNotRawMemberApplication(args, name);
  const hofOptions = args[0];

  return (member, memberName) => {
    assertGuardConsistency(
      options,
      isAsyncFunction(member),
      name,
      memberName,
    );
    return hof(member, hofOptions);
  };
}

/**
 * Runtime guards shared by the converters live elsewhere:
 * {@link ../is.ts | isRawMemberApplication} probes the paren-less-misfire
 * fingerprint, while its fail-fast wrappers
 * (`assertNotRawApplication`, `assertNotRawMemberApplication`,
 * `assertGuardConsistency`) live in {@link ../assert.ts}.
 */

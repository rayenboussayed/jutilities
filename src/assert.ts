import {
  isDecorationContext,
  isNil,
  isRawMemberApplication,
} from "./is.js";
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
 * Thrown by every invariant guard in this module. Extends `TypeError` so
 * consumers filtering on `TypeError` keep matching guard failures, as the
 * `assert` and `decorators` test suites pin.
 */
export class AssertError extends TypeError {}

/**
 * Fail-fast invariants: violated preconditions throw immediately with a
 * readable message instead of corrupting downstream state.
 */

/**
 * Enforces a truthy invariant and throws when it fails.
 *
 * Thrown for every falsy value (`false`, `0`, `""`, `null`, `undefined`,
 * `NaN`) — emptiness checks belong to {@link ./is.ts | isEmpty}, truthiness to
 * this guard.
 * @param condition - The value to check; anything falsy fails the assertion.
 * @param message - The failure description, thrown as the error message.
 * @param name - Optional prefix prepended as `` `${name}: ${message}` `` so
 * surface violations can name their subsystem.
 * @throws `AssertError` reporting `message` (prefixed by `name` when provided).
 */
export function assert(
  condition: unknown,
  message = "Assertion failed",
  name?: string,
): asserts condition {
  if (!condition) {
    throw new AssertError(name ? `${name}: ${message}` : message);
  }
}

/**
 * Asserts a non-null, non-undefined value, narrowing it for the rest of the
 * scope.
 *
 * Note: falsy-but-non-nil values (`0`, `""`, `false`, `NaN`) pass — only
 * `null`/`undefined` fail.
 * @param value - The value to check.
 * @param name - The value's description used in the error message.
 * @throws `AssertError` reporting that `name` must not be null or undefined.
 */
export function assertNotNil<T>(
  value: T,
  name = "value",
): asserts value is NonNullable<T> {
  if (isNil(value)) {
    throw new AssertError(`${name}: must not be null or undefined`);
  }
}

/**
 * Asserts TS exhaustive coverage: call it on a `never`-typed leftover (e.g. a
 * `switch`'s `default` on a discriminated union) so adding a case without
 * handling it fails at compile time — and impossible leftovers (e.g. a case
 * radius widening through casts) fail loudly here.
 * @param value - The unreachable remaining value (typed `never`).
 * @param message - The failure description, thrown as the error message.
 * @throws `AssertError` reporting `message` and a rendered preview of `value`
 * (`JSON.stringify`, falling back to `String(value)`, then to `typeof` when
 * both throw).
 */
export function assertNever(
  value: never,
  message = "Non-exhaustive value reached",
): never {
  let rendered: string;
  try {
    rendered = JSON.stringify(value) ?? String(value);
  } catch {
    try {
      rendered = String(value);
    } catch {
      rendered = typeof value;
    }
  }
  throw new AssertError(`${message}: ${rendered}`);
}

/**
 * Contract-enforcing wrappers: gate a wrapped function's result on a
 * caller-provided validator before it escapes to the caller.
 */

/**
 * Per-call validator for the `withAssert*` wrappers, keyed over the wrapped
 * function type: it receives the call arguments and the (possibly awaited)
 * result, returns normally to pass the result through, or throws to replace
 * the result with its error — so validators reuse the module's guards
 * (`assert`, `assertNotNil`).
 * @template T - The wrapped function being gated.
 */
export type OnResultFn<T extends AnyFunction = AnyFunction> = (options: {
  parameters: Parameters<T>;
  result: Awaited<ReturnType<T>>;
}) => HandleAsyncFunction<T, MaybePromise<void>, void>;

export type Options<T extends AnyFunction = AnyFunction> = {
  onResult: OnResultFn<T>;
};

interface AssertKind<T extends AnyFunction> extends HofKind<T> {
  options: Options<this["fn"]>;
}

export type AssertSyncKind = AssertKind<AnySyncFunction>;
export type AssertAsyncKind = AssertKind<AnyAsyncFunction>;

/**
 * Wraps an async function so every resolution is checked by a validator before
 * it is returned.
 *
 * The validator reuses the module's guards (`assert`, `assertNotNil`) and may
 * itself be sync or async — its return is awaited before the checked result is
 * returned. Throwing inside `onResult` surfaces that error instead of the
 * result; a rejected wrapped call never reaches the validator and propagates
 * untouched.
 * @template T - The function being wrapped.
 * @param fn - The async function whose results are gated.
 * @param options - Options object (`onResult` is required).
 * @param options.onResult - Validates each call over the awaited `result` and
 * the call arguments, throwing to reject the call (may be async).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (unvalidated).
 * Defaults to enabled.
 * @returns The wrapped function (typeof `fn`) whose resolutions are gated by
 * `options.onResult`.
 */
export const withAssertAsync = createHofAsync<AssertAsyncKind>(
  (fn, { onResult }) => {
    return async function (
      this: ThisParameterType<AssertAsyncKind["fn"]>,
      ...args: Parameters<AssertAsyncKind["fn"]>
    ) {
      const result = await fn.apply(this, args);
      await onResult({ parameters: args, result });
      return result;
    } as AssertAsyncKind["fn"];
  },
);

/**
 * Wraps a sync function so every call's result is checked by a validator
 * before it is returned.
 *
 * Behavior notes:
 * - Call arguments are forwarded verbatim to `fn` and reported to
 *   `options.onResult` via `parameters` (see {@link OnResultFn}).
 * - `this` is forwarded to `fn`.
 * - The validator is sync-only here; use {@link withAssertAsync} when the
 *   check needs to await.
 * @template T - The function being wrapped.
 * @param fn - The sync function whose results are gated.
 * @param options - Options object (`onResult` is required).
 * @param options.onResult - Validates each call over `result` and the call
 * arguments, throwing to replace the result.
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (unvalidated).
 * Defaults to enabled.
 * @returns The wrapped function (typeof `fn`) whose results are gated by
 * `options.onResult`.
 */
export const withAssertSync = createHofSync<AssertSyncKind>(
  (fn, { onResult }) => {
    return function (
      this: ThisParameterType<AssertSyncKind["fn"]>,
      ...args: Parameters<AssertSyncKind["fn"]>
    ) {
      const result = fn.apply(this, args);
      onResult({ parameters: args, result });
      return result;
    } as AssertSyncKind["fn"];
  },
);

/**
 * Decorator-machinery guards, shared by every `decorators/<kind>` converter.
 */

/**
 * Fails fast when a decorator factory was applied paren-less (the decoration
 * context arrived where options are expected). This turns silent member
 * corruption into a readable `AssertError` at class-definition time.
 * @param options - The second factory argument.
 * @param factoryName - The reporting decorator's name for the error message.
 * @throws `AssertError` naming the factory and the offending misfire.
 */
export function assertNotRawApplication(
  options: unknown,
  factoryName: string,
): void {
  if (isDecorationContext(options)) {
    throw new AssertError(
      `${factoryName}: applied without parentheses — decorate with ${factoryName}(...options) instead`,
    );
  }
}

/**
 * Fails fast when a decorator factory received the member value directly
 * (paren-less application of the converter result). Pairs with
 * {@link assertNotRawApplication} so every misfire path throws a readable
 * `AssertError` instead of silently wrapping members in decorator machinery.
 * @param rest - The rest arguments a factory received.
 * @param factoryName - The reporting decorator's name for the error message.
 * @throws `AssertError` naming the factory and the offending misfire.
 */
export function assertNotRawMemberApplication(
  rest: unknown[],
  factoryName: string,
): void {
  if (isRawMemberApplication(rest)) {
    throw new AssertError(
      `${factoryName}: applied without parentheses — call the factory with its options first, then decorate`,
    );
  }
}

/**
 * Enforces the sync/async discipline knob of
 * {@link ./decorators/hof.ts | DecoratorGuard}: compares the member value's
 * async-ness against `require` and throws a readable `AssertError` naming the
 * member. Called by every converting decorator before touching the member.
 * @param guard - The caller-provided guard (may be undefined).
 * @param isAsync - Whether the member value reports `isAsyncFunction`.
 * @param factoryName - The reporting decorator's name for the error message.
 * @param memberName - The decorated member's name for the error message.
 * @throws `AssertError` when `require` disagrees with the member's async-ness.
 */
export function assertGuardConsistency(
  guard: { require?: "sync" | "async" } | undefined,
  isAsync: boolean,
  factoryName: string,
  memberName: string,
): void {
  if (guard?.require === "sync" && isAsync) {
    throw new AssertError(
      `${factoryName}: member "${memberName}" is an async function, but require: "sync" was requested`,
    );
  }
  if (guard?.require === "async" && !isAsync) {
    throw new AssertError(
      `${factoryName}: member "${memberName}" is not an async function, but require: "async" was requested`,
    );
  }
}

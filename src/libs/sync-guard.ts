import type { AnyFunction } from "../types/type.js";

/**
 * Runtime guard for the sync HOF flavor. Type-level checks are structurally
 * larger tools for this but may not encode a polymorphic generic signature
 * without defeating inference, so the runtime is authoritative.
 */
const violationTags: readonly string[] = [
  "[object Promise]",
  "[object Generator]",
  "[object AsyncGenerator]",
];

/**
 * Checks if a returned value is a native-style promise or generator shape the
 * sync flavor must not leak to callers. Plain thenables without the Promise
 * tag are treated as ordinary sync values, matching the old compile-time gate.
 * @param value - Result of a wrapped sync call.
 * @returns `true` for Promise or generator/async-generator objects.
 */
export function isSyncReturnViolation(value: unknown): boolean {
  if (value == null) return false;

  let tag: string | undefined;
  try {
    tag = Object.prototype.toString.call(value);
  } catch {
    return false;
  }
  if (tag !== undefined && violationTags.includes(tag)) return true;

  // Native async functions in cross-realm environments can tag differently;
  // instanceof catches the local runtime Promise implementation.
  return typeof Promise === "function" && value instanceof Promise;
}

/**
 * Throws a {@link TypeError} when a sync wrapper sees a promise-like or
 * generator value.
 * @param value - The value returned by the wrapped function.
 * @param fnName - Best-effort name for the wrapped function in the message.
 */
export function assertSyncReturn(
  value: unknown,
  fnName = "wrapped function",
): void {
  if (!isSyncReturnViolation(value)) return;

  throw new TypeError(
    `Expected \`${fnName}\` to return a synchronous value; received a promise or generator. Use the async HOF flavor instead.`,
  );
}

/**
 * Creates a call-time guard for a promised/generator-returning wrapped
 * function. The public wrapper retains the raw function's call shape while
 * rejecting non-synchronous results before any enhancer can observe them.
 *
 * The guard copies the raw function's identity metadata so wrapped functions
 * still produce stable `toString`/`name`/`length` values for enhancers that
 * need them (cache-key generation, logging, and so on).
 * @template TF - The wrapped function type, retained unchanged.
 * @param fn - The wrapped function to guard.
 * @returns A thin wrapper with the same public signature.
 */
export function guardSyncFunction<TF extends AnyFunction>(fn: TF): TF {
  const guarded = function (this: unknown, ...args: unknown[]) {
    const result = fn.apply(this, args as Parameters<TF>);
    assertSyncReturn(result, fn.name || "wrapped function");
    return result;
  } as TF;

  for (const key of Reflect.ownKeys(fn)) {
    if (key === "length" || key === "name" || key === "prototype") continue;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(fn, key);
      if (descriptor) Object.defineProperty(guarded, key, descriptor);
    } catch {
      void 0;
    }
  }

  Object.defineProperty(guarded, "length", {
    value: fn.length,
    configurable: true,
  });
  Object.defineProperty(guarded, "name", {
    value: fn.name,
    configurable: true,
  });
  Object.defineProperty(guarded, "toString", {
    value: () => Function.prototype.toString.call(fn),
    configurable: true,
  });
  return guarded;
}

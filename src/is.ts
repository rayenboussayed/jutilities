import type {
  AnyAsyncFunction,
  AnyAsyncGeneratorFunction,
  AnyFunction,
  AnyGeneratorFunction,
} from "./types/type.js";

/**
 * Utilities for checking common runtime values and shapes without throwing.
 */

/**
 * Checks whether a value is exactly `undefined` (also true for `void 0` and
 * declared-but-unassigned variables).
 * @param value - The value to test.
 * @returns `true` when the value is `undefined`.
 */
export function isUndefined(value: unknown): value is undefined {
  return typeof value === "undefined";
}

/**
 * Checks whether a value is exactly `null`.
 * @param value - The value to test.
 * @returns `true` when the value is `null`.
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * Checks whether a value is either `null` or `undefined`.
 * @param value - The value to test.
 * @returns `true` when the value is `null` or `undefined`.
 */
export function isNil(value: unknown) {
  return isUndefined(value) || isNull(value);
}

/**
 * Checks whether a value is the empty string `""`.
 *
 * Note: only string primitives count; boxed strings such as `new String("")`
 * are not strings, so they yield `false`.
 * @param value - The value to test.
 * @returns `true` when the value is a string primitive of length 0.
 */
export function isEmptyString(value: unknown) {
  return typeof value === "string" && value.length === 0;
}

/**
 * Checks whether a value is an actual array with no elements.
 * Array-likes and non-arrays (including `null`/`undefined`) yield `false`.
 * @param value - The value to test.
 * @returns `true` when the value is an empty `Array`.
 */
export function isEmptyArray(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

/**
 * Checks whether a value behaves like an object (any `typeof value ===
 * "object"` value that is not `null`). Arrays and class instances match too;
 * functions and primitives do not.
 * @param value - The value to test.
 * @returns `true` when the value is a non-null object.
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && !isNull(value);
}

/**
 * Checks whether a value is a key/value object and not an array.
 * Arrays are objects, so they are explicitly excluded here.
 * @param value - The value to test.
 * @returns `true` when the value is a non-array object.
 */
export function isRecord(value: unknown): value is Record<any, any> {
  return isObject(value) && !Array.isArray(value);
}

/**
 * Checks whether a record has no enumerable own string keys.
 *
 * Note: `Object.keys` ignores symbol keys, and objects without enumerable own
 * properties count as empty (e.g. `new Date()` or `Object.create(null)`).
 * @param value - The value to test.
 * @returns `true` when the value is a record with zero `Object.keys` entries.
 */
export function isEmptyRecord(value: unknown) {
  return isRecord(value) && Object.keys(value).length === 0;
}

/**
 * Aggregated emptiness check: `null`/`undefined`, the empty string, an empty
 * array, or a record with no keys all count as "empty".
 *
 * Note: falsy primitives such as `0`, `false`, and `NaN` are NOT empty; values
 * without enumerable own keys (like a `Date`) are.
 * @param value - The value to test.
 * @returns `true` when the value is nil, an empty string, an empty array, or
 * an empty record.
 */
export function isEmpty(value: unknown) {
  return (
    isNil(value) ||
    isEmptyString(value) ||
    isEmptyArray(value) ||
    isEmptyRecord(value)
  );
}

/**
 * Duck-typed thenable check: true when the value has a callable `then`.
 *
 * Caveat: a throwing `then` getter propagates the throw.
 * @param v - The value to test.
 * @returns `true` when the value exposes a callable `then` property.
 */
export function isThenable(v: unknown): v is PromiseLike<any> {
  return typeof (v as any)?.then === "function";
}

/**
 * Promise check: native `Promise` instances, or duck-typed thenables that also
 * expose `catch` and `finally`. Thenables missing either method yield `false`.
 * @param v - The value to test.
 * @returns `true` when the value can be treated as a real promise.
 */
export function isPromise(v: unknown): v is Promise<any> {
  return (
    v instanceof Promise ||
    (isThenable(v) &&
      typeof (v as any)?.catch === "function" &&
      typeof (v as any)?.finally === "function")
  );
}

/**
 * Async function check via the function's constructor name.
 *
 * Caveat: relies on `AsyncFunction` constructor names, which can be lost by
 * transpilers/minifiers that lower `async` functions.
 * @param fn - The function to test.
 * @returns `true` when the function is declared with `async`.
 */
export function isAsyncFunction(fn: AnyFunction): fn is AnyAsyncFunction {
  return fn.constructor.name === "AsyncFunction";
}

/**
 * Generator function check via the function's constructor name.
 * @param fn - The function to test.
 * @returns `true` when the function is a `function*` declaration.
 */
export function isGeneratorFunction(
  fn: AnyFunction,
): fn is AnyGeneratorFunction {
  return fn.constructor.name === "GeneratorFunction";
}

/**
 * Async generator function check via the function's constructor name.
 * @param fn - The function to test.
 * @returns `true` when the function is an `async function*` declaration.
 */
export function isAsyncGeneratorFunction(
  fn: AnyFunction,
): fn is AnyAsyncGeneratorFunction {
  return fn.constructor.name === "AsyncGeneratorFunction";
}

/**
 * Detects a paren-less Stage 3 decoration: the runtime hands decorators
 * `(member, context)` where the context carries a string-ish `kind`, so a
 * guard/options object with a `kind` property is a telling misfire instead of
 * an options bag.
 * @param arg - The second argument a factory received (options or context).
 * @returns `true` when the argument looks like a decoration context.
 */
export function isDecorationContext(arg: unknown): arg is { kind: string } {
  return (
    typeof arg === "object" &&
    arg !== null &&
    "kind" in arg &&
    typeof (arg as { kind: unknown }).kind === "string"
  );
}

/**
 * Detects a paren-less application of a decorator-converter RESULT (the
 * decorator factory): Stage 3 invokes it with `(member, context)`, which
 * arrives as the factory's rest options — a leading function followed by a
 * decoration context is the misfire fingerprint. Legit option slots (option
 * bags, keys, delays) cannot mimic both stripes at those positions, so this is
 * a safe heuristic guarded by a documented caveat in the package docs.
 * @param rest - The rest arguments a factory received.
 * @returns `true` when the rest looks like a raw decoration invocation.
 */
export function isRawMemberApplication(rest: unknown[]): boolean {
  return (
    rest.length === 2 &&
    typeof rest[0] === "function" &&
    isDecorationContext(rest[1])
  );
}

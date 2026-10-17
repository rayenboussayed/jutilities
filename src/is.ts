import type {
  AnyAsyncGeneratorFunction,
  AnyFunction,
  AnyGeneratorFunction,
  AnySyncFunction,
} from "./types/type.js";

/**
 *
 * @param value
 */
export function isUndefined(value: unknown): value is undefined {
  return typeof value === "undefined";
}

/**
 *
 * @param value
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 *
 * @param value
 */
export function isNil(value: unknown) {
  return isUndefined(value) || isNull(value);
}

/**
 *
 * @param value
 */
export function isEmptyString(value: unknown) {
  return typeof value === "string" && value.length === 0;
}

/**
 *
 * @param value
 */
export function isEmptyArray(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

/**
 *
 * @param value
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && !isNull(value);
}

/**
 *
 * @param value
 */
export function isRecord(value: unknown): value is Record<any, any> {
  return isObject(value) && !Array.isArray(value);
}

/**
 *
 * @param value
 */
export function isEmptyRecord(value: unknown) {
  return isRecord(value) && Object.keys(value).length === 0;
}

/**
 *
 * @param value
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
 *
 * @param v
 */
export function isThenable(v: unknown): v is PromiseLike<any> {
  return typeof (v as any)?.then === "function";
}

/**
 *
 * @param v
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
 *
 * @param fn
 */
export function isAsyncFunction(fn: AnyFunction): fn is AnySyncFunction {
  return fn.constructor.name === "AsyncFunction";
}

/**
 *
 * @param fn
 */
export function isGeneratorFunction(
  fn: AnyFunction,
): fn is AnyGeneratorFunction {
  return fn.constructor.name === "GeneratorFunction";
}

/**
 *
 * @param fn
 */
export function isAsyncGeneratorFunction(
  fn: AnyFunction,
): fn is AnyAsyncGeneratorFunction {
  return fn.constructor.name === "AsyncGeneratorFunction";
}

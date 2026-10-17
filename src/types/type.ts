/**
 * Shared type utilities used across the package.
 */

/**
 * A value that may be either a promise or a plain value.
 * @template T - The resolved/plains value type.
 */
export type MaybePromise<T> = Promise<T> | T;

/**
 * Object type with all modifiers (`?`, optional dirs) stripped, so the
 * flattened surface stays readable in hover/IDE output.
 * @template T - The object type to "prettify".
 */
export type Prettier<T extends object> = NonNullable<{
  [K in keyof T]: T[K];
}>;

/**
 * Strict `Omit`: forces the omitted keys to actually exist on `T`, giving a
 * compile error for typo'd key names (plain `Omit<T, K>` silently accepts
 * keys that are not in `T`).
 * @template T - The source object type.
 * @template K - The keys to omit (must exist on `T`).
 */
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;

/**
 * Any (sync or async, generator or not) callable type.
 */
export type AnyFunction = (...args: any) => any;

/**
 * Any callable type producing a promise.
 */
export type AnyAsyncFunction = (...args: any) => Promise<any>;

/**
 * Callback type that must NOT return a promise, generator, or async
 * generator (the "sync-only" counterpart of {@link AnyFunction}).
 * @template T - The function being constrained.
 */
export type AnySyncFunction<T extends AnyFunction = AnyFunction> =
  ReturnType<T> extends
    | Promise<any>
    | Generator<any, any, any>
    | AsyncGenerator<any, any, any>
    ? never
    : T;

/**
 * Any callable type producing a `Generator`.
 */
export type AnyGeneratorFunction = (...args: any) => Generator<any, any, any>;

/**
 * Any callable type producing an `AsyncGenerator`.
 */
export type AnyAsyncGeneratorFunction = (
  ...args: any
) => AsyncGenerator<any, any, any>;

/**
 * Shared option-shape utilities for wrapper functions.
 */

/**
 * Mixes an optional `AbortSignal` into an options object, the convention every
 * signal-aware helper in this package follows.
 * @template T - The rest of the options object (an object type by default).
 */
export type WithSignal<T = object> = { signal?: AbortSignal } & T;

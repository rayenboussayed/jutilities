import type { AnyFunction } from "./types/type.js";

export const isServer = typeof window === "undefined";

export const isClient = !isServer;

/**
 * Builds a conditional wrapper that returns `fn` only when `condition` holds.
 * Used to create no-op-safe `serverFn` / `clientFn` helpers.
 * @param condition Static flag or thunk evaluated once per call.
 * @returns A wrapper mapping `fn` to itself or `undefined`.
 */
export function createConditionalFn(condition: (() => boolean) | boolean) {
  return <T extends AnyFunction>(fn: T) => {
    const enabled = typeof condition === "function" ? condition() : condition;
    return enabled ? fn : undefined;
  };
}

/** Returns `fn` on the server, otherwise `undefined`. */
export const serverFn = createConditionalFn(isServer);
/** Returns `fn` in the browser, otherwise `undefined`. */
export const clientFn = createConditionalFn(isClient);

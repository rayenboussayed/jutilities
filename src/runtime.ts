import type { AnyFunction } from "./types/type.js";

/**
 * `true` in every non-browser runtime (Node.js and other server runtimes with
 * no global `window`).
 *
 * Browser Web Workers also have no `window` and report `true`; pair with
 * {@link isBrowserWorker} (or {@link isServerWorker}) to tell workers apart
 * from plain server processes.
 */
export const isServer = typeof window === "undefined";

/**
 * `true` in a classic browser environment (the global `window` exists).
 * Browser workers report `false` — see {@link isBrowserWorker}.
 */
export const isBrowser = !isServer;

/**
 * `true` inside a browser Web Worker (dedicated, shared, or classic service
 * worker): no `window`, but the global scope is `self` and exposes the
 * `importScripts` function.
 *
 * Module service workers have neither `window` nor `importScripts` and report
 * `false`; with globals alone they cannot be told apart from plain servers.
 */
export const isBrowserWorker =
  isServer &&
  (globalThis as { self?: unknown }).self === globalThis &&
  typeof (globalThis as { importScripts?: unknown }).importScripts ===
    "function";

/**
 * The `node:worker_threads` module, or `undefined` where it cannot be loaded
 * synchronously — browsers, edge runtimes and bundled `process` shims. Loaded
 * via `process.getBuiltinModule` so importing this module never pulls Node
 * builtins into a browser bundle.
 */
const nodeWorkerThreads =
  typeof process !== "undefined" && typeof process.getBuiltinModule === "function"
    ? process.getBuiltinModule("node:worker_threads")
    : undefined;

/**
 * `true` inside a Node.js worker thread (`worker_threads`). Always `false` in
 * the browser, in browser Web Workers, and in plain (non-worker) server
 * processes. Evaluated once at module load.
 */
export const isServerWorker =
  isServer &&
  !isBrowserWorker &&
  typeof nodeWorkerThreads !== "undefined" &&
  nodeWorkerThreads.isMainThread === false;

/**
 * Builds a conditional wrapper that returns `fn` only when `condition` holds.
 * Used to create no-op-safe `serverFn` / `browserFn` helpers.
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
export const browserFn = createConditionalFn(isBrowser);

import type { WithSignal } from "./types/with.js";

import { abort } from "./signal.js";

export type Options = WithSignal<{
  sleep?: number;
}>;

/**
 * Promisified sleep helpers.
 */

/**
 * Waits asynchronously for `sleep` milliseconds.
 *
 * Behavior notes:
 * - `sleep <= 0` (and `undefined`/`NaN`) resolves immediately.
 * - Throws synchronously when the signal is already aborted.
 * - Aborting mid-sleep cuts the wait short and rejects with `signal.reason`.
 * - Aborting clears the pending timer and removes the abort listener.
 * @param root0 - Options object.
 * @param root0.signal - Optional abort signal to cancel the wait early.
 * @param root0.sleep - Milliseconds to wait (default `0`).
 * @returns A promise resolving to `undefined` once the wait completes; rejects
 * with `signal.reason` if the signal aborts during the wait.
 */
export function sleepAsync({ signal, sleep = 0 }: Options = {}) {
  const activeSignal = signal ?? { throwIfAborted() {} };
  activeSignal.throwIfAborted();
  if (sleep <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      removeAbort();
      resolve();
    }, Math.round(sleep));
    const removeAbort = abort({
      onAbort: () => {
        clearTimeout(timeout);
        removeAbort();
        reject(signal?.reason);
      },
      signal,
    });
  });
}

/**
 * Waits synchronously by busy-waiting the event loop.
 *
 * Behavior notes:
 * - Blocks the thread: timers and signals CANNOT fire during the wait, so an
 *   abort is only detected when the signal was already aborted before the
 *   call (throws synchronously, like `sleepAsync`).
 * - `sleep <= 0` (and `undefined`/`NaN`) returns immediately.
 * - Prefer `sleepAsync` unless a truly synchronous pause is required.
 * @param root0 - Options object.
 * @param root0.signal - Optional abort signal (checked up-front and on each
 * busy-wait iteration).
 * @param root0.sleep - Milliseconds to block (default `0`).
 */
export function sleepSync({ signal, sleep = 0 }: Options = {}) {
  const activeSignal = signal ?? { throwIfAborted() {} };
  activeSignal.throwIfAborted();
  if (sleep <= 0) return;
  const finish = Math.round(Date.now() + sleep);
  while (Date.now() < finish) {
    const activeSignal = signal ?? { throwIfAborted() {} };
    /* istanbul ignore next 2 -- optional signal only varies on unrelated kinds */
    activeSignal.throwIfAborted();
  }
}

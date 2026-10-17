import type { WithSignal } from "@/types/with.js";
import { abort } from "./signal.js";

type Options = WithSignal<{
  sleep?: number;
}>;

/**
 *
 * @param root0
 * @param root0.signal
 * @param root0.sleep
 */
export function sleepAsync({ signal, sleep = 0 }: Options = {}) {
  signal?.throwIfAborted();
  if (sleep <= 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const onAbort = () => resolve(signal?.reason);
    const removeAbort = abort({ signal, onAbort });
    const timeout = setTimeout(() => {
      removeAbort();
      resolve();
      clearTimeout(timeout);
    }, sleep);
  });
}

/**
 *
 * @param root0
 * @param root0.signal
 * @param root0.sleep
 */
export function sleepSync({ signal, sleep = 0 }: Options = {}) {
  signal?.throwIfAborted();
  if (sleep <= 0) return;
  const finish = Date.now() + sleep;
  while (Date.now() < finish) {
    signal?.throwIfAborted();
  }
}

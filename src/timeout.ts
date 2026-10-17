import type { AnyAsyncFunction } from "@/types/type.js";
import type { WithSignal } from "@/types/with.js";
import { abort } from "./signal.js";

type Options = WithSignal<{ timeoutMs?: number }>;

/**
 *
 * @param fn
 * @param root0
 * @param root0.signal
 * @param root0.timeoutMs
 */
export function withTimeoutAsync<T extends AnyAsyncFunction>(
  fn: T,
  { signal, timeoutMs = 0 }: Options = {},
) {
  if (!signal && timeoutMs <= 0) return fn;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const cleanup: (() => void)[] = [];
    const timeoutPromise = new Promise<void>((_, reject) => {
      if (signal) {
        const onAbort = () => reject(signal?.reason);
        const removeAbort = abort({ signal, onAbort });
        cleanup.push(removeAbort);
      }

      if (timeoutMs > 0) {
        const timeout = setTimeout(() => reject(signal?.reason), timeoutMs);
        cleanup.push(() => clearTimeout(timeout));
      }
    });

    return Promise.race([fn.apply(this, args), timeoutPromise]).finally(() => {
      cleanup.forEach((fn) => fn());
    });
  } as T;
}

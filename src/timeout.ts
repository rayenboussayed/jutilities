import type { AnyAsyncFunction } from "./types/type.js";
import type { WithSignal } from "./types/with.js";
import { abort } from "./signal.js";

type Options = WithSignal<{ timeoutMs?: number }>;

/**
 * Higher-order wrapper that races an async function against a deadline or an
 * abort signal.
 */

/**
 * Wraps an async function so each invocation races against `timeoutMs` and/or
 * an abort signal.
 *
 * Behavior notes:
 * - Without a signal and with `timeoutMs <= 0`, the original function is
 *   returned unchanged.
 * - The rejection value is always `signal?.reason` — this applies to the
 *   wall-clock timeout too when a signal is present (an `AbortError` by
 *   default, or whatever reason was used to abort).
 * - Losing the race does not stop the underlying work; the caller's promise
 *   simply rejects first.
 * - A sync-throwing wrapped function propagates synchronously and may leak the
 *   internal timer.
 * @param fn - The async function to wrap.
 * @param root0 - Options object.
 * @param root0.signal - Optional abort signal to reject early on abort.
 * @param root0.timeoutMs - Wall-clock budget in milliseconds (default `0`,
 * meaning "no wall-clock timeout").
 * @returns The wrapped function (typeof `fn`), or `fn` itself when neither a
 * signal nor a timeout is configured.
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

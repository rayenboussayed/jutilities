/**
 * `AbortSignal` helper: run a callback on abort and be able to detach it.
 */
import type { WithSignal } from "./types/with.js";

/**
 * Registers `onAbort` to run when the signal aborts.
 *
 * Behavior notes:
 * - No-op when `signal` is absent: the remover is still a safe callable.
 * - Adding the listener to an already-aborted signal does NOT fire it
 *   retroactively (same semantics as `EventTarget`).
 * @param root0 - Options object.
 * @param root0.signal - The signal to observe (may be `undefined`).
 * @param root0.onAbort - Callback invoked when the signal aborts (and only
 * then).
 * @returns A remover that detaches the listener (also safe without a
 * signal).
 */
export function abort({ signal, onAbort }: WithSignal<{ onAbort: () => void }>) {
    signal?.addEventListener("abort", onAbort)
    return () => signal?.removeEventListener("abort", onAbort)
}

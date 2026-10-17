import type { WithSignal } from "@/types/with.js";

/**
 *
 * @param root0
 * @param root0.signal
 * @param root0.onAbort
 */
export function abort({ signal, onAbort }: WithSignal<{ onAbort: () => void }>) {
    signal?.addEventListener("abort", onAbort)
    return () => signal?.removeEventListener("abort", onAbort)
}

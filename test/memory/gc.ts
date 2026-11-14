import { setImmediate as tick } from "node:timers/promises";

/**
 * Runs the V8 garbage collector; throws with a clear message when the suite
 * was not started with `--expose-gc`.
 */
export function forceGc() {
  const collect = globalThis.gc;
  if (!collect) {
    throw new Error(
      "Memory tests require the V8 garbage collector: run Vitest with --expose-gc.",
    );
  }
  collect();
}

/**
 * Returns whether `ref` has been collected, after up to three forced GC
 * passes (one per event-loop turn).
 * @param ref - The weak reference to check.
 * @returns `true` once the object behind `ref` is unreachable and collected.
 */
export async function isCollected(ref: WeakRef<object>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    forceGc();
    await tick();
    if (ref.deref() === undefined) return true;
  }
  return false;
}

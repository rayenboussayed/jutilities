/**
 * The clock the timing-sensitive wrappers measure with.
 *
 * Behavior notes:
 * - Outside a browser (Node and every other server runtime) the monotonic,
 *   sub-millisecond `performance.now()` is used.
 * - Where a global `window` exists (the browser branch) the clock falls back
 *   to `Date.now()`.
 *
 * The rule lives here so the wrappers that measure durations — the logger and
 * the retry loop — share one definition instead of repeating the branch.
 * @returns The current timestamp in milliseconds.
 */
export function now(): number {
  return typeof window === "undefined" ? performance.now() : Date.now();
}

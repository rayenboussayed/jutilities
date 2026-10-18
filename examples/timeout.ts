/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withTimeoutAsync`: unwrapping shortcut, wall-clock deadlines,
 * signal-driven rejection (with a custom `reason`), and work continuing after
 * losing the race.
 */
import { withTimeoutAsync } from "jutilities/timeout";

/**
 * Fast noop used to show the zero-overhead unwrap shortcut.
 * @returns The literal `"fast"`.
 */
async function fast(): Promise<string> {
  return "fast";
}

const unwrapped = withTimeoutAsync(fast, {}); // no signal && timeoutMs <= 0
console.log("unwrap shortcut returns the original fn:", unwrapped === fast);

/**
 * Slow producer that (importantly) keeps running even after the caller stops
 * waiting — losing the timeout race does not stop the underlying work, so its
 * `"done"` result is simply never observed by the caller that walked away.
 * @returns `"done"` after a full second.
 */
async function slow(): Promise<string> {
  await new Promise((r) => setTimeout(r, 1000));
  return "done";
}

// ---- wall-clock deadline ----------------------------------------------------
const deadline = withTimeoutAsync(slow, { timeoutMs: 50 });
try {
  await deadline();
} catch (rejection) {
  // No signal was given, so the rejection value is `signal?.reason` itself —
  // i.e. `undefined` — still flagged as a timeout by the aborted promise.
  console.log("wall-clock rejection value (no signal):", rejection);
}

// ---- signal-driven rejection with a custom reason ---------------------------
const controller = new AbortController();
const watched = withTimeoutAsync(slow, { signal: controller.signal });
setTimeout(() => controller.abort(new Error("shutting down")), 20);
try {
  await watched();
} catch (error) {
  console.log("abort rejected with:", (error as Error).message);
}

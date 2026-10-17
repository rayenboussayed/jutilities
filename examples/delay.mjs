/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withDelayAsync` / `withDelaySync`: the unwrap shortcut for
 * `delay <= 0`, delayed execution, and the documented "abort mid-delay still
 * runs the function" behavior.
 */
import { withDelayAsync, withDelaySync } from "jutilities/delay";

/**
 * Identity function used with the zero/negative-delay unwrap shortcut.
 * @param {unknown} x - Value echoed back.
 * @returns {unknown} `x`, unchanged.
 */
async function identity(x) {
  return x;
}

const plain = await withDelayAsync(identity, { delay: 0 });
console.log("delay <= 0 returns the original fn:", plain === identity);

/**
 * Counter-flipping producer used to observe delayed execution and the
 * mid-flight abort behavior.
 * @returns {number} Always `1`, after flipping the `ran` flag.
 */
async function task() {
  task.ran = true;
  return 1;
}

// ---- delay wraps and sleeps before each call ---------------------------------
const delayed = await withDelayAsync(task, { delay: 30 });
const start = performance.now();
await delayed();
console.log("wrapped call took ~ms:", Math.round(performance.now() - start));

// ---- abort mid-delay still runs the function (documented quirk) --------------
task.ran = false;
const controller = new AbortController();
const wary = await withDelayAsync(task, { delay: 50, signal: controller.signal });
setTimeout(() => controller.abort(), 10); // abort during the sleep window
await wary(); // still runs to completion
console.log("fn ran despite mid-delay abort:", task.ran === true);

// ---- sync variant returns the wrapper synchronously --------------------------
const syncDelayed = withDelaySync((x) => x + 1, { delay: 10 });
console.log("sync delayed result (blocks ~10ms):", syncDelayed(41));

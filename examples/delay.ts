/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withDelayAsync` / `withDelaySync`: the unwrap shortcut for
 * `delay <= 0`, delayed execution, and abort-mid-wait rejection.
 */
import { withDelayAsync, withDelaySync } from "jutilities/delay";

/**
 * Identity function used with the zero/negative-delay unwrap shortcut.
 * @param x - Value echoed back.
 * @returns `x`, unchanged.
 */
async function identity(x: unknown): Promise<unknown> {
  return x;
}

const plain = withDelayAsync(identity, { delay: 0 });
console.log("delay <= 0 returns the original fn:", plain === identity);

let taskRuns = 0;

/**
 * Counter-bumping producer used to observe delayed execution and the
 * mid-flight abort behavior.
 * @returns Always `1`, after counting the run.
 */
async function task(): Promise<number> {
  taskRuns += 1;
  return 1;
}

// ---- delay wraps and sleeps before each call ---------------------------------
const delayed = withDelayAsync(task, { delay: 30 });
const start = performance.now();
await delayed();
console.log("wrapped call took ~ms:", Math.round(performance.now() - start));

// ---- abort mid-wait rejects; the wrapped fn never runs ------------------------
taskRuns = 0;
const controller = new AbortController();
const wary = withDelayAsync(task, { delay: 50, signal: controller.signal });
try {
  setTimeout(() => controller.abort(), 10); // abort during the wait window
  await wary();
} catch (error) {
  console.log("mid-wait abort rejected:", (error as Error).name, "fn ran:", taskRuns === 0);
}

// ---- sync variant returns the wrapper synchronously --------------------------
const syncDelayed = withDelaySync((x: number) => x + 1, { delay: 10 });
console.log("sync delayed result (blocks ~10ms):", syncDelayed(41));

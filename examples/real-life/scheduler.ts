/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Real-life scenario: cron-like schedulers — independent tick loops run tasks
 * on fixed intervals, every tick is guarded by a wall-clock deadline, and one
 * shared AbortSignal stops all loops gracefully (in-flight ticks included,
 * through per-loop relayed signals).
 */
import { withLoggerAsync } from "jutilities/hof/logger";
import { withTimeoutAsync } from "jutilities/hof/timeout";
import { abort } from "jutilities/signal";
import { sleepAsync } from "jutilities/sleep";

/** A schedulable task: tick number plus the loop's cancellation signal. */
type Task = (tick: number, signal: AbortSignal) => Promise<string>;

/**
 * Renders a task/scheduler error; the timeout wrapper rejects with
 * `signal?.reason`, which is `undefined` when the wall-clock deadline fires
 * before any abort.
 * @param error - The caught error.
 * @returns A readable one-line description.
 */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : "deadline exceeded";
}

/**
 * Fast task that comfortably fits its deadline.
 * @param tick - The current tick number.
 * @param signal - The loop's cancellation signal.
 * @returns A heartbeat marker.
 */
async function heartbeat(tick: number, signal: AbortSignal): Promise<string> {
  await sleepAsync({ signal, sleep: 20 });
  return `alive at tick ${tick}`;
}

/**
 * Slow task that always overshoots its 200ms deadline — shutdown cancels it.
 * @param tick - The current tick number.
 * @param signal - The loop's cancellation signal.
 * @returns A flush marker (never observed in this demo).
 */
async function metricsFlush(tick: number, signal: AbortSignal): Promise<string> {
  await sleepAsync({ signal, sleep: 300 });
  return `flushed at tick ${tick}`;
}

/**
 * Runs `task` every `intervalMs` until the parent signal aborts; each tick
 * races a 200ms wall-clock deadline. The parent signal is relayed into a
 * per-loop controller so shutdown also cancels the interval sleep and any
 * in-flight task.
 * @param root0 - Scheduler configuration.
 * @param root0.name - Scheduler label used in logs.
 * @param root0.intervalMs - Tick interval in milliseconds.
 * @param root0.task - The task to run on each tick.
 * @param root0.signal - Parent shutdown signal.
 * @returns Resolves once the parent signal aborted.
 */
async function schedule({ intervalMs, name, signal, task }: {
  intervalMs: number;
  name: string;
  signal: AbortSignal;
  task: Task;
}): Promise<void> {
  const loop = new AbortController();
  const removeRelay = abort({ onAbort: () => loop.abort(signal.reason), signal });
  const guarded = withTimeoutAsync(task, { signal: loop.signal, timeoutMs: 200 });
  let tick = 0;
  try {
    while (!signal.aborted) {
      await sleepAsync({ signal: loop.signal, sleep: intervalMs });
      tick += 1;
      try {
        console.log(`${name}:`, await guarded(tick, loop.signal));
      } catch (error) {
        console.log(`${name}: tick ${tick} failed —`, describe(error));
      }
    }
  } catch (error) {
    // Real handling: a pending interval sleep was cut short by shutdown —
    // log it and fall through to the shared exit report below.
    console.log(`${name}: pending tick interrupted by shutdown —`, describe(error));
  }
  removeRelay();
  console.log(`${name}: stopped after ${tick} tick(s) —`, describe(signal.reason));
}

const controller = new AbortController();
const removeAbortLog = abort({
  onAbort: () => console.log("scheduler hub: abort signal received"),
  signal: controller.signal,
});

const loops = Promise.all([
  schedule({
    intervalMs: 60,
    name: "heartbeat",
    signal: controller.signal,
    task: withLoggerAsync(heartbeat, { name: "heartbeat" }),
  }),
  schedule({
    intervalMs: 120,
    name: "metrics-flush",
    signal: controller.signal,
    task: withLoggerAsync(metricsFlush, { name: "metrics" }),
  }),
]);

await sleepAsync({ sleep: 350 }); // let both loops tick
controller.abort(new Error("end of demo"));
await loops;
removeAbortLog();
console.log("schedulers stopped cleanly");

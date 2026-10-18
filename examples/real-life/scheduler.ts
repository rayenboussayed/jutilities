/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Real-life scenario: cron-like schedulers — independent tick loops run tasks
 * on fixed intervals, every tick is guarded by a wall-clock deadline, and one
 * shared AbortSignal stops all loops gracefully (in-flight ticks included,
 * through per-loop relayed signals).
 */
import { withLogger } from "jutilities/logger";
import { sleepAsync } from "jutilities/sleep";
import { abort } from "jutilities/signal";
import { withTimeoutAsync } from "jutilities/timeout";

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
async function schedule({ name, intervalMs, task, signal }: {
  name: string;
  intervalMs: number;
  task: Task;
  signal: AbortSignal;
}): Promise<void> {
  const loop = new AbortController();
  const removeRelay = abort({ signal, onAbort: () => loop.abort(signal.reason) });
  const guarded = withTimeoutAsync(task, { timeoutMs: 200, signal: loop.signal });
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
  signal: controller.signal,
  onAbort: () => console.log("scheduler hub: abort signal received"),
});

const loops = Promise.all([
  schedule({
    name: "heartbeat",
    intervalMs: 60,
    task: withLogger("heartbeat", heartbeat),
    signal: controller.signal,
  }),
  schedule({
    name: "metrics-flush",
    intervalMs: 120,
    task: withLogger("metrics", metricsFlush),
    signal: controller.signal,
  }),
]);

await sleepAsync({ sleep: 350 }); // let both loops tick
controller.abort(new Error("end of demo"));
await loops;
removeAbortLog();
console.log("schedulers stopped cleanly");

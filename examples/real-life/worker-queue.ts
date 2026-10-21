/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Real-life scenario: a tiny background worker pool — two workers drain a
 * shared job queue, poisoned jobs exhaust their retries into a dead-letter
 * list, and shutdown is graceful through an AbortSignal.
 */
import { withLoggerAsync } from "jutilities/logger";
import { withRetryAsync } from "jutilities/retry";
import { sleepAsync } from "jutilities/sleep";
import { abort } from "jutilities/signal";

/** A queued unit of work; `remainingFailures` simulates a flaky worker. */
type Job = { id: number; label: string; remainingFailures: number };

/** A job that exhausted its retries, with the final reason. */
type DeadLetter = { job: Job; reason: string };

/** Shared progress counters for the demo. */
const stats = { settled: 0 };

/**
 * Simulated job execution that fails while `remainingFailures` is positive.
 * @param job - The job to process.
 * @returns A completion marker.
 */
async function process(job: Job): Promise<string> {
  await sleepAsync({ sleep: 20 }); // simulated work
  if (job.remainingFailures > 0) {
    job.remainingFailures -= 1;
    throw new Error(`${job.label} failed (${job.remainingFailures} failures left)`);
  }
  return `${job.label} done`;
}

/**
 * Retry policy: two retries with backoff, then give up (dead-letter).
 * @param root0 - The retry policy context.
 * @param root0.retries - Current retry count.
 * @param root0.error - The attempt's error.
 */
async function onJobError({ retries, error }: { retries: number; error: unknown }): Promise<void> {
  if (retries >= 2) throw error; // poison policy: two retries, then dead-letter
  console.log(`    job backoff after attempt ${retries + 1}:`, (error as Error).message);
  await sleepAsync({ sleep: 30 });
}

const runJob = withRetryAsync(withLoggerAsync(process, { name: "worker.process" }), {
  onError: onJobError,
});

/**
 * Drains the shared queue until the signal aborts.
 * @param name - Worker label used in logs.
 * @param queue - Shared pending queue (shifted in place).
 * @param deadLetter - Shared dead-letter sink.
 * @param signal - Shutdown signal.
 * @returns Resolves once the signal aborts.
 */
async function worker(
  name: string,
  queue: Job[],
  deadLetter: DeadLetter[],
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    const job = queue.shift();
    if (!job) {
      try {
        await sleepAsync({ signal, sleep: 15 }); // idle heartbeat
      } catch {
        return; // shutdown during idle sleep
      }
      continue;
    }
    try {
      console.log(`${name}: picked job #${job.id}`);
      console.log(`${name}:`, await runJob(job));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      deadLetter.push({ job, reason });
      console.log(`${name}: job #${job.id} dead-lettered — ${reason}`);
    } finally {
      stats.settled += 1;
    }
  }
}

// ---- boot the pool ------------------------------------------------------------
const queue: Job[] = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  label: `job-${index + 1}`,
  remainingFailures: index === 3 ? 99 : index % 2, // one poisoned job, half flaky
}));
const total = queue.length; // workers shift() entries — snapshot before draining
const deadLetter: DeadLetter[] = [];
const controller = new AbortController();
abort({ signal: controller.signal, onAbort: () => console.log("shutdown: abort signal received") });

const running = [
  worker("worker-a", queue, deadLetter, controller.signal),
  worker("worker-b", queue, deadLetter, controller.signal),
];

while (stats.settled < total) {
  await sleepAsync({ sleep: 10 });
}
controller.abort(new Error("queue drained"));
await Promise.all(running);

console.log("settled jobs:", stats.settled);
console.log("dead-lettered:", deadLetter.map((entry) => `#${entry.job.id} (${entry.reason})`).join(" | ") || "none");
console.log("pool stopped cleanly");

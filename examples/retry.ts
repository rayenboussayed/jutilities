/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withRetryAsync`: caller-owned retry policy, backoff via
 * `sleepAsync`, and verbatim multi-argument forwarding on both variants.
 */
import { withRetryAsync, withRetrySync } from "jutilities/retry";
import { sleepAsync } from "jutilities/sleep";

let flakyAttempts = 0;

/**
 * Flaky "third party" that fails the first two attempts, then succeeds.
 * @returns The eventual payload after two simulated failures.
 */
async function flaky(): Promise<string> {
  flakyAttempts += 1;
  if (flakyAttempts <= 2) {
    throw new Error(`flaky failure #${flakyAttempts}`);
  }
  return "ok after " + flakyAttempts + " attempts";
}

const resilient = withRetryAsync(flaky, async ({ retries, error }) => {
  console.log(`attempt ${retries + 1} failed:`, (error as Error).message);
  if (retries >= 4) throw error; // give up -> error becomes the rejection
  await sleepAsync({ sleep: 50 }); // exponential backoff belongs in onError
});

console.log("result:", await resilient());

// ---- multi-argument forwarding (sync side) -----------------------------------
let addCalls = 0;

/**
 * Two-argument adder that fails its first attempt.
 * @param a - First addend.
 * @param b - Second addend.
 * @returns The sum `a + b` (second attempt, after the allowed retry).
 */
function add(a: number, b: number): number {
  addCalls += 1;
  if (addCalls === 1) throw new Error("first add attempt");
  return a + b;
}

const retryAdd = withRetrySync(add, ({ parameters }) => {
  console.log("retrying add with", parameters);
});
console.log("withRetrySync(1, 2):", retryAdd(1, 2));

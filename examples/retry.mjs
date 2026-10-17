/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withRetryAsync`: caller-owned retry policy, backoff via
 * `sleepAsync`, and the documented `withRetrySync` args-spreading bug.
 */
import { withRetryAsync, withRetrySync } from "jutilities/retry";
import { sleepAsync } from "jutilities/sleep";

/**
 * Flaky "third party" that fails the first two attempts, then succeeds.
 * @returns {Promise<string>} The eventual payload after two simulated
 * failures.
 */
async function flaky() {
  flaky.attempts = (flaky.attempts ?? 0) + 1;
  if (flaky.attempts <= 2) {
    throw new Error(`flaky failure #${flaky.attempts}`);
  }
  return "ok after " + flaky.attempts + " attempts";
}

const resilient = withRetryAsync(flaky, async ({ retries, error }) => {
  console.log(`attempt ${retries + 1} failed:`, error.message);
  if (retries >= 4) throw error; // give up -> error becomes the rejection
  await sleepAsync({ sleep: 50 }); // exponential backoff belongs in onError
});

console.log("result:", await resilient());

// ---- known sync bug (documented in docs/DOCUMENTATION.md) ------------------
/**
 * Two-argument adder used to show the sync wrapper's spreading bug.
 * @param {number} a - First addend.
 * @param {number} b - Second addend.
 * @returns {number} The sum `a + b` (only reachable with the zero/single-array
 * shapes).
 */
function add(a, b) {
  return a + b;
}

const retryAdd = withRetrySync(add);
try {
  retryAdd(1, 2); // spreads `args = 1` -> CreateListFromArrayLike TypeError
} catch (error) {
  console.log("withRetrySync(1, 2) ->", error.message, "(known bug)");
}

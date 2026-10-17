/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `lazy`: source+args-keyed memoization, falsy results never
 * cached, and rejected promises evicted so the next call retries.
 */
import { lazy } from "jutilities/lazy";

// ---- memoization by source + args -------------------------------------------
/**
 * Doubler used as the memoization subject.
 * @param {number} x - Number to double.
 * @returns {number} `x * 2`, computed at most once per distinct `x` (truthy
 * results).
 */
function doubler(x) {
  doubler.calls = (doubler.calls ?? 0) + 1;
  return x * 2;
}

const memoDoubler = lazy(doubler);
console.log("first :", memoDoubler(21)); // computed
console.log("second:", memoDoubler(21)); // cached (same source + args)
console.log("third :", memoDoubler(22)); // different args -> computed
console.log("total real computations:", doubler.calls); // 2

// ---- falsy results are never cached -----------------------------------------
/**
 * Returning-falsy demo: `0` recomputes on every call.
 * @returns {number} Always `0` — falsy, therefore never stored.
 */
function zeroer() {
  zeroer.calls = (zeroer.calls ?? 0) + 1;
  return 0;
}

const memoZero = lazy(zeroer);
memoZero();
memoZero();
console.log("falsy('0') computations:", zeroer.calls); // 2 (never cached)

// ---- rejected promises are evicted (next call retries) ------------------------
/**
 * Failing-then-succeeding async producer showing failure eviction.
 * @returns {Promise<string>} `"recovered"` after one simulated failed attempt.
 */
async function recoverer() {
  recoverer.attempts = (recoverer.attempts ?? 0) + 1;
  if (recoverer.attempts === 1) throw new Error("transient");
  return "recovered";
}

const memoRecover = lazy(recoverer);
try {
  await memoRecover();
} catch (error) {
  console.log("first async call failed:", error.message);
}
console.log("second async call:", await memoRecover()); // retried, not cached

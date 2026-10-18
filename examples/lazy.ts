/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `lazy`: source+args-keyed memoization, falsy results never
 * cached, and rejected promises evicted so the next call retries.
 */
import { lazy } from "jutilities/lazy";

// ---- memoization by source + args -------------------------------------------
let doublerCalls = 0;

/**
 * Doubler used as the memoization subject.
 * @param x - Number to double.
 * @returns `x * 2`, computed at most once per distinct `x` (truthy results).
 */
function doubler(x: number): number {
  doublerCalls += 1;
  return x * 2;
}

const memoDoubler = lazy(doubler);
console.log("first :", memoDoubler(21)); // computed
console.log("second:", memoDoubler(21)); // cached (same source + args)
console.log("third :", memoDoubler(22)); // different args -> computed
console.log("total real computations:", doublerCalls); // 2

// ---- falsy results are never cached -----------------------------------------
let zeroerCalls = 0;

/**
 * Returning-falsy demo: `0` recomputes on every call.
 * @returns Always `0` — falsy, therefore never stored.
 */
function zeroer(): number {
  zeroerCalls += 1;
  return 0;
}

const memoZero = lazy(zeroer);
memoZero();
memoZero();
console.log("falsy('0') computations:", zeroerCalls); // 2 (never cached)

// ---- rejected promises are evicted (next call retries) ------------------------
let recovererAttempts = 0;

/**
 * Failing-then-succeeding async producer showing failure eviction.
 * @returns `"recovered"` after one simulated failed attempt.
 */
async function recoverer(): Promise<string> {
  recovererAttempts += 1;
  if (recovererAttempts === 1) throw new Error("transient");
  return "recovered";
}

const memoRecover = lazy(recoverer);
try {
  await memoRecover();
} catch (error) {
  console.log("first async call failed:", (error as Error).message);
}
console.log("second async call:", await memoRecover()); // retried, not cached

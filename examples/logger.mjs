/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withLogger`: explicit and inferred names, awaited async
 * results, and the node/browser timing split.
 */
import { withLogger } from "jutilities/logger";

/**
 * Sync adder logged under an explicit label.
 * @param {number} a - First addend.
 * @param {number} b - Second addend.
 * @returns {number} `a + b`.
 */
function add(a, b) {
  return a + b;
}

const tracedAdd = withLogger("math:add", add);
console.log("sync result:", tracedAdd(1, 2)); // two console.log lines above

// ---- name inferred from the function itself ----------------------------------
/**
 * Named generator used to show name inference via the single-arg overload.
 * @returns {string} The literal `"greeted"`.
 */
function greet() {
  return "greeted";
}

const tracedGreet = withLogger(greet);
console.log("inferred-name result:", tracedGreet());

// ---- async wrapper logs the awaited value -------------------------------------
/**
 * Async producer whose resolution value is logged after the await completes.
 * @returns {Promise<string>} The literal `"resolved"` after a short simulated
 * delay.
 */
async function job() {
  await new Promise((r) => setTimeout(r, 10));
  return "resolved";
}

const tracedJob = withLogger("worker:job", job);
console.log("async result:", await tracedJob());

/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withLoggerSync` / `withLoggerAsync`: explicit and inferred
 * names, awaited async results, the error path (invocation logged, result
 * line skipped, `console.error` emitted, error rethrown), and the output
 * contract that mirrors the other Sync/Async wrapper pairs.
 */
import { withLoggerAsync, withLoggerSync } from "jutilities/logger";

/**
 * Sync adder logged under an explicit label.
 * @param a - First addend.
 * @param b - Second addend.
 * @returns `a + b`.
 */
function add(a: number, b: number): number {
  return a + b;
}

const tracedAdd = withLoggerSync(add, { name: "math:add" });
console.log("sync result:", tracedAdd(1, 2)); // two console.debug lines above

// ---- name inferred from the function itself ----------------------------------
/**
 * Named generator used to show name inference when options are omitted.
 * @returns The literal `"greeted"`.
 */
function greet(): string {
  return "greeted";
}

const tracedGreet = withLoggerSync(greet);
console.log("inferred-name result:", tracedGreet());

// ---- async wrapper logs the awaited value -------------------------------------
/**
 * Async producer whose resolution value is logged after the await completes.
 * @returns The literal `"resolved"` after a short simulated delay.
 */
async function job(): Promise<string> {
  await new Promise((r) => setTimeout(r, 10));
  return "resolved";
}

const tracedJob = withLoggerAsync(job, { name: "worker:job" });
console.log("async result:", await tracedJob());

// ---- error path: sync throw ---------------------------------------------------
/**
 * Sync function that always throws, logged under an explicit label.
 * @throws Always a plain {@link Error}.
 */
function boom(): number {
  throw new Error("sync fail");
}

const tracedBoom = withLoggerSync(boom, { name: "math:boom" });
try {
  tracedBoom();
} catch (error) {
  console.log("caught sync error:", (error as Error).message);
}

// ---- error path: async rejection ----------------------------------------------
/**
 * Async function that always rejects, logged under an explicit label.
 * @throws Always a plain {@link Error}.
 */
async function reject(): Promise<string> {
  throw new Error("async fail");
}

const tracedReject = withLoggerAsync(reject, { name: "worker:reject" });
try {
  await tracedReject();
} catch (error) {
  console.log("caught async error:", (error as Error).message);
}

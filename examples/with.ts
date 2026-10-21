/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withAsync` / `withSync`: composing several fn-first HOFs into
 * one wrapper (the first HOF is the outermost layer), with one shared options
 * bag and one shared bypass for the whole stack.
 */
import { withAsync, withSync } from "jutilities/libs/with";
import { withCacheAsync, withCacheSync } from "jutilities/cache";
import { withLoggerAsync } from "jutilities/logger";
import { withRetryAsync } from "jutilities/retry";
import { sleepAsync } from "jutilities/sleep";

let sourceCalls = 0;

/**
 * "Upstream" loader that fails on the first attempt, then succeeds.
 * @param id - The profile id to load.
 * @returns The loaded profile label.
 */
async function loadProfile(id: string): Promise<string> {
  sourceCalls += 1;
  if (sourceCalls === 1) throw new Error("upstream hiccup");
  return `profile:${id}`;
}

// The first HOF is the OUTERMOST layer: logger -> cache -> retry -> fn.
const resilient = withAsync(withLoggerAsync, withCacheAsync, withRetryAsync);

const getProfile = resilient(loadProfile, {
  name: "profile:load", // read by the logger layer
  extraKeys: ["demo"], // read by the cache layer
  onError: async ({ retries, error }) => {
    // read by the retry layer
    console.log(`  attempt ${retries + 1} failed:`, (error as Error).message);
    await sleepAsync({ sleep: 10 });
  },
});

console.log("first call:", await getProfile("u1"));
console.log("second call (served by the cache layer):", await getProfile("u1"));
console.log("upstream calls so far:", sourceCalls);

// ---- one bypass for the whole stack -----------------------------------------
let bypassedCalls = 0;

/**
 * Tracked call used to show the stack-wide bypass.
 * @param id - The id passed through.
 * @returns The echoed id.
 */
async function echo(id: string): Promise<string> {
  bypassedCalls += 1;
  return `echo:${id}`;
}

const bypassable = withAsync(withCacheAsync, withRetryAsync)(echo, {
  skipHof: (id: string) => id === "raw",
});

console.log("bypassed call:", await bypassable("raw"), "| calls:", bypassedCalls);
console.log("cached call:", await bypassable("cached"), "| calls:", bypassedCalls);

// ---- sync stack --------------------------------------------------------------
let syncCalls = 0;

/**
 * Counting increment used to show the sync cache layer.
 * @param value - The value to increment by.
 * @returns The incremented value.
 */
function increment(value: number): number {
  syncCalls += 1;
  return value + 1;
}

const cachedIncrement = withSync(withCacheSync)(increment);

console.log("sync first call:", cachedIncrement(1));
console.log("sync second call (served by the cache layer):", cachedIncrement(1));
console.log("sync source calls:", syncCalls);

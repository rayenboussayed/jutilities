/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withCacheSync` and `withCacheAsync`: TTL-backed default store,
 * hashed argument-keyed memoization (default keys are 32-bit `djb2` numbers),
 * `extraKeys` scoping, custom numeric key factories, and in-flight
 * deduplication.
 */
import { withCacheAsync, withCacheSync } from "jutilities/cache";

let computeCalls = 0;

/**
 * Expensive-to-compute sync function used as the cache subject. The `string |
 * number` parameter also lets the custom numeric-key factory below pass raw
 * ids straight through.
 * @param id - Arbitrary identifier (part of the cache key).
 * @returns A payload recording how many times the real computation ran.
 */
function computeSync(id: string | number): { id: string | number; marker: string } {
  computeCalls += 1;
  return { id, marker: `compute-${computeCalls}` };
}

// ---- sync memoization ------------------------------------------------------
const cached = withCacheSync(computeSync);

console.log("sync first :", cached("u1"));
console.log("sync second:", cached("u1")); // same key -> served from store
console.log("sync third :", cached("u2")); // different key -> recomputed

// ---- extraKeys scoping -----------------------------------------------------
const tenanted = withCacheSync(computeSync, { extraKeys: ["tenant-A"] });
console.log("tenant-A   :", tenanted("u1")); // separate identity from `cached`

// ---- custom key factory (numeric keys are first-class) ---------------------
// Keys may be `string` OR `number`: the default keygen already returns a
// number (the 32-bit hash), and custom factories may do the same — here the
// factory keys each cache entry by a small numeric id instead of a string.
const byNumericId = withCacheSync(computeSync, {
  generateCacheKey: ({ parameters }) => Number(parameters[0]),
});
console.log("key 7 once:", byNumericId(7), "==", byNumericId(7));

// ---- async memoization with in-flight deduplication ------------------------
let loadUserCalls = 0;

const loadUser = withCacheAsync(async (id: string) => {
  loadUserCalls += 1;
  await new Promise((r) => setTimeout(r, 20));
  return { id, phone: "+1-555-0000" };
});

const results = await Promise.all([
  loadUser("u9"),
  loadUser("u9"), // same key -> shares the first in-flight promise
  loadUser("u8"),
]);
console.log("async merged:", results);
console.log("upstream ran", loadUserCalls, "times for 3 requests");

/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `withCacheSync` and `withCacheAsync`: default TTL-backed store,
 * argument-keyed memoization, `extraKeys` scoping, and in-flight deduplication.
 */
import { withCacheAsync, withCacheSync } from "../dist/cache.js";

/**
 * Expensive-to-compute sync function used as the cache subject.
 * @param {string} id - Arbitrary identifier (part of the cache key).
 * @returns {{ id: string, marker: string }} A payload recording how many times
 * the real computation ran.
 */
function computeSync(id) {
  computeSync.calls = (computeSync.calls ?? 0) + 1;
  return { id, marker: `compute-${computeSync.calls}` };
}

// ---- sync memoization ------------------------------------------------------
const cached = withCacheSync(computeSync);

console.log("sync first :", cached("u1"));
console.log("sync second:", cached("u1")); // same key -> served from store
console.log("sync third :", cached("u2")); // different key -> recomputed

// ---- extraKeys scoping -----------------------------------------------------
const tenanted = withCacheSync(computeSync, { extraKeys: ["tenant-A"] });
console.log("tenant-A   :", tenanted("u1")); // separate identity from `cached`

// ---- async memoization with in-flight deduplication ------------------------
const loadUser = withCacheAsync(async (id) => {
  loadUser.calls = ((loadUser.calls ?? 0) + 1);
  await new Promise((r) => setTimeout(r, 20));
  return { id, phone: "+1-555-0000" };
});

const results = await Promise.all([
  loadUser("u9"),
  loadUser("u9"), // same key -> shares the first in-flight promise
  loadUser("u8"),
]);
console.log("async merged:", results);
console.log("upstream ran", loadUser.calls, "times for 3 requests");

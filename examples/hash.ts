/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates the non-cryptographic hash family: `djb2`, `sdbm`, and
 * `fnv1a64`, including seed chaining for namespace separation.
 */
import { djb2, fnv1a64, sdbm } from "jutilities/hash";

console.log("djb2('hello')    :", djb2("hello"));
console.log("sdbm('hello')    :", sdbm("hello"));
console.log("fnv1a64('hello') :", fnv1a64("hello"));

// deterministic for identical inputs, different across algorithms:
console.log("stable:", djb2("cache-key") === djb2("cache-key"));

// ---- seed chaining (domain separation) ---------------------------------------
/**
 * Domain-separated key reducer for namespaced cache entries.
 * @param namespace - Stable domain label hashed first.
 * @param value - Payload hashed on top of the namespace seed.
 * @returns The unsigned 32-bit composite fingerprint.
 */
function namespacedHash(namespace: string, value: string): number {
  return djb2(value, djb2(namespace));
}

console.log("namespaced:", namespacedHash("user", "42") !== djb2("42"));

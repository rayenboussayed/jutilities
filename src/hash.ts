/**
 * Small, fast, non-cryptographic string hashes.
 *
 * These are meant for cache keys, bucketing, and in-memory indexing — never
 * for security (they are fully predictable and collision-prone by design).
 */

/**
 * Hashes a string with the classic DJB2 algorithm.
 *
 * Uses 32-bit arithmetic (`hash << 5 + hash` is `hash * 33`), finalizing to an
 * unsigned 32-bit integer so the result is always non-negative.
 * @param string - The input to hash.
 * @param hash - Starting seed (defaults to the 5381 standard DJB2 seed).
 * @returns The unsigned 32-bit DJB2 hash of the input so far.
 */
export function djb2(string: string, hash = 5381) {
  for (let i = 0; i < string.length; i++) {
    // hash * 33 + charCode (bitwise shift for efficiency: hash << 5 is hash * 32)
    hash = (hash << 5) + hash + string.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer to avoid negative values
  return hash >>> 0;
}

/**
 * Hashes a string with the SDBM algorithm.
 *
 * Equivalent to `hash * 65599 + charCode` (65599 = 2^16 + 2^6 - 1), finalized
 * to an unsigned 32-bit integer.
 * @param string - The input to hash.
 * @param hash - Starting seed (defaults to 0, the standard SDBM seed).
 * @returns The unsigned 32-bit SDBM hash of the input so far.
 */
export function sdbm(string: string, hash = 0) {
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
    // Equivalent to hash * 65599 + charCode (65599 = 2^16 + 2^6 - 1)
  }
  return hash >>> 0; // Unsigned 32-bit
}

const FNV_OFFSET = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;

/**
 * FNV-1a-style string hash implemented with `BigInt`.
 *
 * Note: unlike the canonical 64-bit FNV-1a algorithm, this implementation does
 * NOT wrap with a 2^64 mask, so results grow past 64 bits for longer inputs
 * (deterministic, positive bigint, unique-ish distribution — not a
 * wire-compatible FNV-1a).
 * @param string - The input to hash.
 * @returns The hash as a positive `bigint` (unmasked; larger than 64 bits for
 * longer inputs).
 */
export function fnv1a64(string: string) {
  let hash = FNV_OFFSET;
  for (let i = 0; i < string.length; i++) {
    const charCode = BigInt(string.charCodeAt(i));
    hash ^= charCode; // XOR with char code
    hash *= FNV_PRIME; // Multiply by prime
  }
  return hash; // Returns a BigInt (no precision loss)
}

/**
 *
 * @param string
 * @param hash
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
 *
 * @param string
 * @param hash
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
 *
 * @param string
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

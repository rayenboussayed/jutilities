/**
 * Small conversion helpers.
 */

/**
 * Normalizes a value into an array without copying existing arrays.
 *
 * Note: arrays and array subclasses are returned by reference (no flattening);
 * everything else is wrapped in a fresh single-element array, including
 * `null`/`undefined` and falsy values.
 * @param value - An array, an array subclass, or a scalar (any other value).
 * @returns The original array (same reference), or `[value]`.
 */
export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Encodes bytes to a base64 string, in Node and browsers.
 *
 * Node uses `Buffer.toString("base64")`; browsers build the binary string
 * manually and pass it to `btoa`. Only the viewed slice is encoded when the
 * input is a view with `byteOffset`/`byteLength` (e.g. a `subarray`).
 * @param bytes - The bytes to encode; only the viewed region is used.
 * @returns The base64 representation (`""` for empty input).
 */
export function toBase64(bytes: Uint8Array) {
  if (typeof window === "undefined") {
    return Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).toString("base64");
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

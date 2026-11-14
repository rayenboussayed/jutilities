import { isServer } from "./runtime.js";

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
  if (isServer) {
    return Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).toString("base64");
  }
  let bin = "";
  // eslint-disable-next-line security/detect-object-injection
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * Wraps a chunk into a `Buffer`.
 * @param chunk - The chunk to convert.
 * @returns A `Buffer`.
 */
export function toBuffer(chunk: any) {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
}

/**
 * Converts milliseconds to whole seconds.
 * @param ms - Milliseconds to round.
 * @returns Seconds.
 */
export function toSeconds(ms: number): number {
  return Math.round(ms / 1000);
}

/**
 * Normalizes a string, ArrayBuffer, typed array (including `Buffer` and
 * `DataView`), or number array into a fresh `Uint8Array` over the viewed
 * region (honoring `byteOffset`/`byteLength` for views).
 * @param value - The value to convert.
 * @returns The byte representation.
 */
export function toUint8Array(
  value: ArrayBuffer | ArrayBufferView | number[] | string,
): Uint8Array<ArrayBuffer> {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(
      value.buffer as ArrayBuffer,
      value.byteOffset,
      value.byteLength,
    );
  return new Uint8Array(value);
}


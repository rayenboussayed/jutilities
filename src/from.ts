/**
 * Base64 decoding, working in Node and browsers.
 */

/**
 * Decodes a base64 string into bytes.
 *
 * Returns a `Buffer` view in Node (lenient: invalid characters are skipped by
 * `Buffer.from(..., "base64")`; the pooled view may share/back-offset its
 * backing store so only the decoded slice is valid). In browsers it is strict:
 * invalid input throws from `atob`.
 * @param b64 - The base64 string to decode.
 * @returns A `Buffer` in Node, or a fresh `Uint8Array` in browsers.
 */
export function fromBase64(b64: string) {
  if (typeof window === "undefined") return Buffer.from(b64, "base64");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

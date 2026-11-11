/* eslint-disable n/no-unsupported-features/node-builtins */

import type { ReadableStream as WebReadableStream } from "node:stream/web";

import type { WithSignal } from "../types/with.js";

/**
 * Web Crypto (`crypto.subtle`) digest helper, optionally HMAC. All operations
 * are asynchronous because the Web Crypto API is promise-based.
 */

type BaseHashOptions<T> = T & WithSignal<{ secret?: string }>;

/** Input accepted by {@link Hash.buffer}. */
type HashInput = ArrayBuffer | string | Uint8Array;

const subtle = (globalThis as { crypto: { subtle: SubtleCrypto } }).crypto.subtle;

/** Named digest over buffers/strings (and streams), optionally HMAC. */
export class Hash {
  private static readonly SUPPORTED = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

  /**
   * The algorithm name passed to `crypto.subtle`.
   * @returns The underlying algorithm identifier.
   */
  get name() {
    return this.algorithm;
  }

  constructor(private algorithm: string) {
    if (!Hash.SUPPORTED.includes(this.algorithm))
      throw TypeError(
        `Unsupported hash algorithm (${algorithm}), supported: ${Hash.SUPPORTED.join()}`,
      );
  }

  /**
   * Digests a string, typed array, or ArrayBuffer.
   * @param options - Data to digest, with optional HMAC key.
   * @param options.value - The data to digest.
   * @param options.secret - Optional HMAC key.
   * @returns The digest bytes.
   */
  async buffer({
    secret,
    value,
  }: BaseHashOptions<{ value: HashInput }>): Promise<Uint8Array<ArrayBuffer>> {
    const data = toBytes(value);
    if (secret) {
      const keyData = toBytes(secret);
      const key = await subtle.importKey(
        "raw",
        keyData,
        { hash: this.algorithm, name: "HMAC" },
        false,
        ["sign"],
      );
      const sig = await subtle.sign("HMAC", key, data);
      return new Uint8Array(sig);
    }
    const buf = await subtle.digest(this.algorithm, data);
    return new Uint8Array(buf);
  }

  /**
   * Digests a `ReadableStream`, accumulating chunks then hashing.
   * @param options - Data source, with optional HMAC key and signal.
   * @param options.stream - The stream to consume.
   * @param options.secret - Optional HMAC key.
   * @param options.signal - Optional abort signal.
   * @returns The digest bytes.
   */
  async stream({
    secret,
    signal,
    stream,
  }: BaseHashOptions<{
    stream: WebReadableStream<HashInput>;
  }>): Promise<Uint8Array<ArrayBuffer>> {
    signal?.throwIfAborted();
    const reader = stream.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    try {
      while (true) {
        signal?.throwIfAborted();
        const { done, value } = await reader.read();
        if (done) break;
        const bytes = toBytes(value as HashInput);
        chunks.push(bytes);
        total += bytes.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
    const data = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return this.buffer({ secret, value: data });
  }
}

/**
 * Normalizes a string / typed-array / ArrayBuffer into a fresh `Uint8Array`.
 * @param value - The value to convert.
 * @returns The byte representation.
 */
function toBytes(value: HashInput): Uint8Array<ArrayBuffer> {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value);
}

export const sha1 = new Hash("SHA-1");
export const sha256 = new Hash("SHA-256");
export const sha384 = new Hash("SHA-384");
export const sha512 = new Hash("SHA-512");

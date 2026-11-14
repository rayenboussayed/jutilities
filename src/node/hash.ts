import type { HashOptions, HmacOptions } from "node:crypto";
import type { Readable } from "node:stream";

import * as crypto from "node:crypto";

import type { WithSignal } from "../types/with.js";

import { abort } from "../signal.js";
import { toBuffer } from "../to.js";

type BaseHashOptions<T> = T &
  WithSignal<{
    options?: HashOptions | HmacOptions;
    secret?: string;
  }>;

/** Named digest (`sha512`, …) over streams or buffers, optionally HMAC. */
export class Hash {
  private static readonly SUPPORTED = crypto
    .getHashes()
    .map((h) => h.toLowerCase());

  /**
   * The algorithm name passed to `node:crypto`.
   * @returns The underlying algorithm identifier.
   */
  get name() {
    return this.algorithm;
  }

  constructor(private algorithm: string) {
    this.algorithm = algorithm.toLowerCase();
    if (!Hash.SUPPORTED.includes(this.algorithm))
      throw TypeError(
        `Unsupported hash algorithm (${algorithm}), supported: ${Hash.SUPPORTED.join()}`,
      );
  }

  /**
   * The digest implementation for buffers.
   * @param options - Data to digest, with HMAC key; plain hash when omitted.
   * @returns The digest.
   */
  buffer(options: BaseHashOptions<{ value: Buffer | string }>) {
    const { options: hashOptions, secret, value } = options;
    const sha = secret
      ? crypto.createHmac(this.algorithm, secret, hashOptions)
      : crypto.createHash(this.algorithm, hashOptions);
    return sha.update(value).digest();
  }

  /**
   * Digests a stream. Rejects on stream error.
   * @param options - Data source, with HMAC key; plain hash when omitted.
   * @param options.stream - The source stream.
   * @param options.secret - Optional HMAC key.
   * @param options.options - Hash/HMAC options.
   * @param options.signal - Optional abort signal.
   * @returns The digest.
   */
  stream({
    options,
    secret,
    signal,
    stream,
  }: BaseHashOptions<{
    stream: Readable;
  }>) {
    const sha = secret
      ? crypto.createHmac(this.algorithm, secret, options)
      : crypto.createHash(this.algorithm, options);

    signal?.throwIfAborted();
    return new Promise<Buffer>((resolve, reject) => {
      const clearAbort = abort({
        onAbort: () => reject(signal?.reason),
        signal,
      });
      stream.once("error", reject);

      // `Hash.update` accepts `Buffer | string` — no branch, no cast.
      stream.on("data", (chunk) => {
        signal?.throwIfAborted();
        sha.update(toBuffer(chunk));
      });
      stream.once("end", () => {
        clearAbort();
        resolve(sha.digest());
      });
    });
  }
}

export const md5 = new Hash("md5");
export const sha1 = new Hash("sha1");
export const sha224 = new Hash("sha224");
export const sha256 = new Hash("sha256");
export const sha384 = new Hash("sha384");
export const sha512 = new Hash("sha512");
export const sha512_224 = new Hash("sha512-224");
export const sha512_256 = new Hash("sha512-256");
export const sha3_224 = new Hash("sha3-224");
export const sha3_256 = new Hash("sha3-256");
export const sha3_384 = new Hash("sha3-384");
export const sha3_512 = new Hash("sha3-512");
export const blake2b512 = new Hash("blake2b512");
export const blake2s256 = new Hash("blake2s256");
export const ripemd160 = new Hash("ripemd160");
export const sm3 = new Hash("sm3");
export const shake128 = new Hash("shake128");
export const shake256 = new Hash("shake256");
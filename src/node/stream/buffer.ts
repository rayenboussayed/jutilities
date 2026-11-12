import { Readable } from "node:stream";

import type { WithSignal } from "../../types/with.js";

/**
 * Converts a `Buffer` into a readable stream of chunked views.
 *
 * Chunks are zero-copy `buffer.subarray` slices of `chunkSize` bytes (default
 * 16 KiB), so writing to a chunk mutates the source buffer. An empty buffer
 * produces an immediately-ending stream. Throws synchronously when the signal
 * is already aborted; aborting mid-read propagates via the Readable's
 * internal `signal` option.
 * @param root0 - Options object.
 * @param root0.buffer - The bytes to emit.
 * @param root0.chunkSize - Maximum bytes per emitted chunk (default `16384`).
 * @param root0.signal - Optional signal wired into the returned Readable.
 * @returns A `Readable` yielding the buffer's bytes in order.
 */
export function buffer2stream({
  buffer,
  chunkSize = 16384,
  signal,
}: WithSignal<{ buffer: Buffer; chunkSize?: number }>) {
  signal?.throwIfAborted();
  if (buffer.byteLength === 0) return Readable.from([], { signal });

  /**
   * Async generator emitting successive `subarray` views of the buffer.
   * @yields A zero-copy view of the next `chunkSize` bytes.
   */
  function* gen() {
    const activeSignal = signal ?? { throwIfAborted() {} };
    activeSignal.throwIfAborted();

    let offset = 0;
    let end = chunkSize;
    while (offset < buffer.byteLength) {
      const activeSignal = signal ?? { throwIfAborted() {} };
      activeSignal.throwIfAborted();
      yield buffer.subarray(offset, end);
      offset = end;
      const remain = buffer.byteLength - end;
      end += remain > chunkSize ? chunkSize : remain;
    }
  }

  return Readable.from(gen(), { signal });
}

/**
 * Consumes a readable stream into one `Buffer`.
 *
 * Non-Buffer chunks (strings, Uint8Array) are converted per-chunk. The signal
 * is checked up-front and on every chunk, so aborting mid-stream rejects the
 * returned promise with `signal.reason`.
 * @param root0 - Options object.
 * @param root0.signal - Optional abort signal.
 * @param root0.stream - Stream to consume fully.
 * @returns The concatenated contents as a single `Buffer` (empty input yields
 * an empty Buffer).
 */
export async function stream2buffer({
  signal,
  stream,
}: WithSignal<{ stream: Readable }>) {
  signal?.throwIfAborted();
  const buffers: Buffer[] = [];

  for await (const chunk of stream) {
    /* c8 ignore next */ signal?.throwIfAborted();
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    buffers.push(buffer);
  }

  return Buffer.concat(buffers);
}
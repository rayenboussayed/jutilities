/* eslint-disable n/no-unsupported-features/node-builtins */

import { toUint8Array } from "../../to.js";

/**
 * Converts bytes into a `ReadableStream` of chunked views.
 *
 * Chunks are zero-copy `subarray` slices of `chunkSize` bytes (default
 * 16 KiB). An empty input produces an immediately-closing stream.
 * @param root0 - Options object.
 * @param root0.buffer - The bytes to emit.
 * @param root0.chunkSize - Maximum bytes per emitted chunk (default `16384`).
 * @param root0.signal - Optional abort signal checked per chunk.
 * @returns A `ReadableStream` yielding the bytes in order.
 */
export function buffer2stream({
  buffer,
  chunkSize = 16384,
  signal,
}: {
  buffer: ArrayBuffer | Uint8Array;
  chunkSize?: number;
  signal?: AbortSignal;
}): ReadableStream<Uint8Array> {
  const bytes = toUint8Array(buffer);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (signal?.aborted) {
        controller.error(signal.reason);
        return;
      }
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.byteLength);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
}

/**
 * Consumes a `ReadableStream` into one `Uint8Array`.
 *
 * The signal is checked up-front and on every chunk.
 * @param root0 - Options object.
 * @param root0.signal - Optional abort signal.
 * @param root0.stream - Stream to consume fully.
 * @returns The concatenated contents as a single `Uint8Array`.
 */
export async function stream2buffer({
  signal,
  stream,
}: {
  signal?: AbortSignal;
  stream: ReadableStream<Uint8Array>;
}): Promise<Uint8Array> {
  signal?.throwIfAborted();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      /* c8 ignore next */ signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      const bytes = toUint8Array(value);
      chunks.push(bytes);
      total += bytes.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
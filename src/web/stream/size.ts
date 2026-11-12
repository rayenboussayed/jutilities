/* eslint-disable n/no-unsupported-features/node-builtins */

import { toUint8Array } from "../../to.js";

/**
 * Async generator that passes chunks through while reporting cumulative size.
 * @param root0 - Options object.
 * @param root0.onSize - Callback receiving `{ size, done }` per chunk and at
 * the end.
 * @param root0.signal - Optional per-chunk abort check.
 * @param root0.stream - The source stream to read through.
 * @yields The original chunks, in order.
 */
export async function* streamSize({
  onSize,
  signal,
  stream,
}: {
  onSize: (options: { done: boolean; size: number }) => void;
  signal?: AbortSignal;
  stream: ReadableStream<Uint8Array>;
}) {
  let size = 0;
  const reader = stream.getReader();
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      const bytes = toUint8Array(value);
      size += bytes.byteLength;
      onSize({ done: false, size });
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
  onSize({ done: true, size });
}

/**
 * Creates a `TransformStream` that reports cumulative byte size.
 * @param root0 - Options object.
 * @param root0.onSize - Callback receiving `{ size, done }` per chunk and at
 * flush.
 * @param root0.signal - Optional signal checked per chunk.
 * @returns A `TransformStream`.
 */
export function streamSizeTransform({
  onSize,
  signal,
}: {
  onSize: (options: { done: boolean; size: number }) => void;
  signal?: AbortSignal;
}): TransformStream<Uint8Array, Uint8Array> {
  let size = 0;
  return new TransformStream<Uint8Array, Uint8Array>({
    flush() {
      onSize({ done: true, size });
    },
    transform(chunk, controller) {
      /* c8 ignore start */
      if (signal?.aborted) {
        controller.error(signal.reason);
        return;
      }
      /* c8 ignore stop */
      const bytes = toUint8Array(chunk);
      size += bytes.byteLength;
      onSize({ done: false, size });
      controller.enqueue(chunk);
    },
  });
}
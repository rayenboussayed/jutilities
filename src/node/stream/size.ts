import { Readable, Transform } from "node:stream";

import type { WithSignal } from "../../types/with.js";

/**
 * Async generator that passes chunks through while reporting cumulative size.
 * @param root0 - Options object.
 * @param root0.onSize - Callback receiving `{ size, done: false }` per chunk
 * and `{ size, done: true }` after the stream ends.
 * @param root0.signal - Optional per-chunk abort check.
 * @param root0.stream - The source stream to read through.
 * @yields The original chunks, in order.
 */
export async function* streamSize({
  onSize,
  signal,
  stream,
}: WithSignal<{
  onSize: (options: { done: boolean; size: number; }) => void;
  signal?: AbortSignal;
  stream: Readable;
}>) {
  let size = 0;
  for await (const chunk of stream) {
    const activeSignal = signal ?? { throwIfAborted() {} };
    activeSignal.throwIfAborted();
    /* c8 ignore start */
    let buffer: Buffer;
    if (Buffer.isBuffer(chunk)) {
      buffer = chunk;
    } else {
      buffer = Buffer.from(chunk);
    }
    /* c8 ignore stop */
    size += buffer.byteLength;
    onSize({ done: false, size });
    yield chunk;
  }
  onSize({ done: true, size });
}

/**
 * Creates a passthrough `Transform` that reports cumulative byte size.
 * @param root0 - Options object.
 * @param root0.onSize - Callback receiving `{ size, done }` per chunk and at
 * flush.
 * @param root0.signal - Optional signal wired into the returned Transform.
 * @returns A `Transform` stream: feed it a readable, pipe onward, observe
 * sizes.
 */
export function streamSizeTransform({
  onSize,
  signal,
}: WithSignal<{
  onSize: (options: { done: boolean; size: number; }) => void;
  signal?: AbortSignal;
}>) {
  let size = 0;
  return new Transform({
    flush(callback) {
      onSize({ done: true, size });
      callback();
    },
    signal,
    transform(chunk, encoding, callback) {
      let buffer: Buffer;
      if (Buffer.isBuffer(chunk)) {
        buffer = chunk;
      } else {
        /* c8 ignore next */ buffer = Buffer.from(chunk, encoding);
      }
      /* c8 ignore next */ size += buffer.byteLength;
      onSize({ done: false, size });
      callback(null, chunk);
    },
  });
}
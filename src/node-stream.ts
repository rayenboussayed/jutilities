import { PassThrough, Readable, Transform } from "node:stream";
import type { WithSignal } from "@/types/with.js";

/**
 * Splits a readable into two backpressure-aware branches.
 * @param options - Stream to duplicate, with an optional abort signal.
 * @param options.signal
 * @param options.source
 */
export function tee({
  signal,
  source,
}: WithSignal<{ source: Readable }>): [PassThrough, PassThrough] {
  signal?.throwIfAborted();

  const pt1 = new PassThrough({
    readableHighWaterMark: source.readableHighWaterMark,
    readableObjectMode: source.readableObjectMode,
    writableObjectMode: source.readableObjectMode,
    signal,
  });
  const pt2 = new PassThrough({
    readableHighWaterMark: source.readableHighWaterMark,
    readableObjectMode: source.readableObjectMode,
    writableObjectMode: source.readableObjectMode,
    signal,
  });

  source.on("data", (chunk) => {
    const ok1 = pt1.write(chunk);
    const ok2 = pt2.write(chunk);
    if (!ok1 || !ok2) {
      source.pause();
    }
  });

  pt1.on("drain", () => {
    if (!pt2.writableNeedDrain) {
      source.resume();
    }
  });

  pt2.on("drain", () => {
    if (!pt1.writableNeedDrain) {
      source.resume();
    }
  });

  source.on("end", () => {
    if (!pt1.closed) pt1.end();
    if (!pt2.closed) pt2.end();
  });

  source.on("error", (error) => {
    if (!pt1.destroyed) pt1.destroy(error);
    if (!pt2.destroyed) pt2.destroy(error);
  });

  pt1.on("close", () => {
    if (!pt2.destroyed && !source.destroyed) {
      source.unpipe(pt1);
    }
  });

  pt2.on("close", () => {
    if (!pt1.destroyed && !source.destroyed) {
      source.unpipe(pt2);
    }
  });

  return [pt1, pt2];
}

/**
 *
 * @param readable
 * @param options
 */
export async function stream2buffer(readable: Readable, options?: WithSignal) {
  options?.signal?.throwIfAborted();
  const buffers: Buffer[] = [];

  for await (const chunk of readable) {
    options?.signal?.throwIfAborted();
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    buffers.push(buffer);
  }

  return Buffer.concat(buffers);
}

/**
 *
 * @param buffer
 * @param root0
 * @param root0.signal
 * @param root0.chunkSize
 */
export function buffer2stream(
  buffer: Buffer,
  { signal, chunkSize = 16384 }: WithSignal<{ chunkSize?: number }> = {},
) {
  signal?.throwIfAborted();
  if (buffer.byteLength === 0) return Readable.from([], { signal });

  /**
   *
   */
  function* gen() {
    signal?.throwIfAborted();

    let offset = 0;
    let end = chunkSize;
    while (offset < buffer.byteLength) {
      signal?.throwIfAborted();
      yield buffer.subarray(offset, end);
      offset = end;
      const remain = buffer.byteLength - end;
      end += remain > chunkSize ? chunkSize : remain;
    }
  }

  return Readable.from(gen(), { signal });
}

/**
 *
 * @param root0
 * @param root0.signal
 * @param root0.onSize
 */
export function streamSizeTransform({
  signal,
  onSize,
}: WithSignal<{
  onSize: (options: { size: number; done: boolean }) => void;
}>) {
  let size = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk, encoding);
      size += buffer.byteLength;
      onSize({ size, done: false });
      callback(null, chunk);
    },
    flush(callback) {
      onSize({ size, done: true });
      callback();
    },
    signal,
  });
}

/**
 *
 * @param readable
 * @param root0
 * @param root0.signal
 * @param root0.onSize
 */
export async function* streamSize(
  readable: Readable,
  {
    signal,
    onSize,
  }: WithSignal<{
    onSize: (options: { size: number; done: boolean }) => void;
  }>,
) {
  let size = 0;
  for await (const chunk of readable) {
    signal?.throwIfAborted();
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    onSize({ size, done: false });
    yield chunk;
  }
  onSize({ size, done: true });
}

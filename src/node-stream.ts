import { PassThrough, Readable, Transform } from "node:stream";
import type { WithSignal } from "./types/with.js";

/**
 * Node.js stream utilities: duplication, buffering, and byte counting.
 */

/**
 * Duplicates a readable stream into two backpressure-aware branches.
 *
 * The source is paused as soon as either branch is full and resumed only when
 * neither needs to drain, in both orders. Source `end` ends both branches and
 * source `error` destroys both. Closing one branch (destroying it) does not
 * affect the other.
 *
 * Throws synchronously when the signal is already aborted.
 * @param root0 - Options object.
 * @param root0.source - The readable stream to duplicate.
 * @param root0.signal - Optional signal: pre-aborted throws immediately;
 * aborting mid-flight destroys both branches via the internal `PassThrough`.
 * @returns Exactly two `PassThrough` branches, each receiving every chunk.
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
 * Consumes a readable stream into one `Buffer`.
 *
 * Non-Buffer chunks (strings, Uint8Array) are converted per-chunk. The signal
 * is checked up-front and on every chunk, so aborting mid-stream rejects the
 * returned promise with `signal.reason`.
 * @param readable - Stream to consume fully.
 * @param options - Optionally `{ signal }` for mid-stream abort checks.
 * @returns The concatenated contents as a single `Buffer` (empty input yields
 * an empty Buffer).
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
 * Converts a `Buffer` into a readable stream of chunked views.
 *
 * Chunks are zero-copy `buffer.subarray` slices of `chunkSize` bytes (default
 * 16 KiB), so writing to a chunk mutates the source buffer. An empty buffer
 * produces an immediately-ending stream. Throws synchronously when the signal
 * is already aborted; aborting mid-read propagates via the Readable's
 * internal `signal` option.
 * @param buffer - The bytes to emit.
 * @param root0 - Options object.
 * @param root0.signal - Optional signal wired into the returned Readable.
 * @param root0.chunkSize - Maximum bytes per emitted chunk (default `16384`).
 * @returns A `Readable` yielding the buffer's bytes in order.
 */
export function buffer2stream(
  buffer: Buffer,
  { signal, chunkSize = 16384 }: WithSignal<{ chunkSize?: number }> = {},
) {
  signal?.throwIfAborted();
  if (buffer.byteLength === 0) return Readable.from([], { signal });

  /**
   * Async generator emitting successive `subarray` views of the buffer.
   * @yields A zero-copy view of the next `chunkSize` bytes.
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
 * Creates a passthrough `Transform` that reports cumulative byte size.
 *
 * Every chunk is counted (converting strings via the given encoding), the
 * running size is reported after each chunk with `done: false`, and the final
 * total is reported with `done: true` on flush. Data passes through unchanged.
 * @param root0 - Options object.
 * @param root0.signal - Optional signal wired into the returned Transform.
 * @param root0.onSize - Callback receiving `{ size, done }` per chunk and at
 * flush.
 * @returns A `Transform` stream: feed it a readable, pipe onward, observe
 * sizes.
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
 * Async generator that passes chunks through while reporting cumulative size.
 *
 * Unlike {@link streamSizeTransform} this is not a pipeline stage: you iterate
 * the generator directly. The signal is checked per chunk, so aborting
 * mid-iteration throws `signal.reason` (in that case the final `done: true`
 * report never fires; the underlying stream error also skips it).
 * @param readable - The source stream to read through.
 * @param root0 - Options object.
 * @param root0.signal - Optional per-chunk abort check.
 * @param root0.onSize - Callback receiving `{ size, done: false }` per chunk
 * and `{ size, done: true }` after the stream ends.
 * @yields The original chunks, in order.
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

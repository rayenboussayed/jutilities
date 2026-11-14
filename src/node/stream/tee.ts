import { PassThrough, Readable } from "node:stream";

import type { WithSignal } from "../../types/with.js";

/**
 * Duplicates a readable stream into two backpressure-aware branches.
 *
 * The source is paused as soon as either branch is full and resumed only when
 * neither needs to drain, in both orders. Source `end` ends both branches,
 * `close` (e.g. a source destroyed without `end`/`error`) ends both branches
 * the same way, and source `error` destroys both. Closing one branch
 * (destroying it) does not affect the other.
 *
 * Throws synchronously when the signal is already aborted.
 * @param root0 - Options object.
 * @param root0.stream - The readable stream to duplicate.
 * @param root0.signal - Optional signal: pre-aborted throws immediately;
 * aborting mid-flight destroys both branches via the internal `PassThrough`.
 * @returns Exactly two `PassThrough` branches, each receiving every chunk.
 */
export function tee({
  signal,
  stream,
}: WithSignal<{ stream: Readable }>): [PassThrough, PassThrough] {
  signal?.throwIfAborted();

  const pt1 = new PassThrough({
    readableHighWaterMark: stream.readableHighWaterMark,
    readableObjectMode: stream.readableObjectMode,
    signal,
    writableObjectMode: stream.readableObjectMode,
  });
  const pt2 = new PassThrough({
    readableHighWaterMark: stream.readableHighWaterMark,
    readableObjectMode: stream.readableObjectMode,
    signal,
    writableObjectMode: stream.readableObjectMode,
  });

  /**
   * Detaches every source listener so the source no longer retains the branches.
   */
  function cleanup() {
    stream.off("data", onData);
    stream.off("end", onEnd);
    stream.off("close", onEnd);
    stream.off("error", onError);
  }

  /**
   * Writes one chunk to both branches, pausing the source on backpressure.
   * @param chunk - Chunk emitted by the source.
   */
  function onData(chunk: unknown) {
    const ok1 = pt1.write(chunk);
    const ok2 = pt2.write(chunk);
    if (!ok1 || !ok2) {
      stream.pause();
    }
  }

  /**
   * Ends the branches that are still open and detaches the source listeners.
   */
  function onEnd() {
    cleanup();
    if (!pt1.closed) pt1.end();
    if (!pt2.closed) pt2.end();
  }

  /**
   * Destroys the branches that are still open and detaches the source listeners.
   * @param error - Error emitted by the source.
   */
  function onError(error: Error) {
    cleanup();
    if (!pt1.destroyed) pt1.destroy(error);
    if (!pt2.destroyed) pt2.destroy(error);
  }

  stream.on("data", onData);

  pt1.on("drain", () => {
    if (!pt2.writableNeedDrain) {
      /* c8 ignore next */ stream.resume();
    }
  });

  pt2.on("drain", () => {
    if (!pt1.writableNeedDrain) {
      /* c8 ignore next */ stream.resume();
    }
  });

  stream.on("end", onEnd);

  // A source destroyed without `end`/`error` emits only `close`; the branches
  // still need to be ended gracefully and the source listeners detached.
  stream.on("close", onEnd);

  stream.on("error", onError);

  pt1.on("close", () => {
    if (!pt2.destroyed && !stream.destroyed) {
      /* c8 ignore next */ stream.unpipe(pt1);
    }
  });

  pt2.on("close", () => {
    if (!pt1.destroyed && !stream.destroyed) {
      /* c8 ignore next */ stream.unpipe(pt2);
    }
  });

  return [pt1, pt2];
}
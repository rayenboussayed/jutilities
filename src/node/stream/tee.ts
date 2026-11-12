import { PassThrough, Readable } from "node:stream";

import type { WithSignal } from "../../types/with.js";

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

  stream.on("data", (chunk) => {
    const ok1 = pt1.write(chunk);
    const ok2 = pt2.write(chunk);
    if (!ok1 || !ok2) {
      stream.pause();
    }
  });

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

  stream.on("end", () => {
    if (!pt1.closed) pt1.end();
    if (!pt2.closed) pt2.end();
  });

  stream.on("error", (error) => {
    if (!pt1.destroyed) pt1.destroy(error);
    if (!pt2.destroyed) pt2.destroy(error);
  });

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
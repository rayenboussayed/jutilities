import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
/* eslint-disable security/detect-non-literal-fs-filename */
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { WithSignal } from "../../types/with.js";

/**
 * Options for {@link StreamCache}.
 */
export type StreamCacheOptions = {
  /** Remove the cache directory when the process is about to exit. */
  deleteBeforeExit?: boolean;
  /** Directory holding the cached files. Created on first write. */
  directory: string;
  /** Maximum bytes per entry (default unlimited). */
  maxFileSize?: number;
  /** Receives every background failure; `write` itself never throws. */
  onError?: (error: unknown) => void;
  /** Entry lifetime in milliseconds (default unlimited, `<= 0` disables caching). */
  timeToLive?: number;
};

type Fill = { append: boolean; tail: Promise<void> };

/**
 * Filesystem-backed stream cache with resumable (append) writes.
 *
 * One file per key. A full write goes to a temporary file that is renamed
 * into place when complete, so readers only ever see whole entries (a miss
 * while a replacement is in flight). The file size is the entry size and its
 * modification time is the entry age, so no metadata is stored. Fills for
 * the same key run one after another; a second full write while one is
 * already running is dropped.
 */
export class StreamCache {
  private readonly directory: string;
  private readonly fills = new Map<string, Fill>();
  private readonly maxFileSize: number;
  private readonly onError?: (error: unknown) => void;
  private readonly timeToLive: number;

  /**
   * Create a cache rooted at `options.directory`.
   * @param options - Directory and limits.
   */
  constructor(options: StreamCacheOptions) {
    this.directory = options.directory;
    this.maxFileSize = options.maxFileSize ?? Infinity;
    this.onError = options.onError;
    this.timeToLive = options.timeToLive ?? Infinity;

    if (options.deleteBeforeExit) {
      /* c8 ignore next 3 -- the callback only runs during the real beforeExit */
      process.once("beforeExit", () => {
        fs.rmSync(this.directory, { force: true, recursive: true });
      });
    }
  }

  /**
   * Absolute on-disk path for `key` (a hash, so any key is a safe file name).
   * @param key - Cache key.
   * @returns File path.
   */
  createCachePath(key: number | string) {
    const name = createHash("sha256").update(String(key)).digest("hex");
    return path.join(this.directory, `${name}.bin`);
  }

  /**
   * Wait until every queued write has finished.
   */
  async flush() {
    await Promise.all([...this.fills.values()].map((fill) => fill.tail));
  }

  /**
   * Size of the cached entry, or `undefined` on miss or expiry.
   * @param key - Cache key.
   * @returns Size in bytes.
   */
  async getOriginalSize(key: number | string) {
    const cachePath = this.createCachePath(key);
    const stats = await fs.promises.stat(cachePath).catch(() => undefined);
    if (!stats) return undefined;
    if (Date.now() - stats.mtimeMs >= this.timeToLive) {
      await fs.promises.rm(cachePath, { force: true });
      return undefined;
    }
    return stats.size;
  }

  /**
   * Open a readable over a byte range of an entry.
   * @param options - Key, range and signal.
   * @param options.end - Inclusive end offset (default: last byte).
   * @param options.key - Cache key.
   * @param options.signal - Optional abort signal.
   * @param options.start - Inclusive start offset (default 0).
   * @returns Readable, empty when the range is empty, or `undefined` on miss.
   */
  async read({
    end = Infinity,
    key,
    signal,
    start = 0,
  }: WithSignal<{ end?: number; key: number | string; start?: number }>) {
    signal?.throwIfAborted();
    const size = await this.getOriginalSize(key);
    if (size === undefined) return undefined;

    const first = Math.max(start, 0);
    const last = Math.min(end, size - 1);
    if (first > last) return Readable.from([], { objectMode: false, signal });
    return fs.createReadStream(this.createCachePath(key), {
      end: last,
      signal,
      start: first,
    });
  }

  /**
   * Remove one cached entry.
   * @param key - Cache key.
   * @returns Resolves once the entry is removed.
   */
  unlink(key: number | string) {
    return fs.promises.rm(this.createCachePath(key), { force: true });
  }

  /**
   * Cache `readable` at `key`.
   *
   * Returns immediately and never throws; failures go to `onError` and
   * leave no partial entry behind.
   * @param options - Key, source and flags.
   * @param options.append - Extend an existing entry instead of replacing it.
   * @param options.key - Cache key.
   * @param options.readable - Source bytes.
   * @param options.signal - Optional abort signal.
   */
  write({
    append = false,
    key,
    readable,
    signal,
  }: WithSignal<{
    append?: boolean;
    key: number | string;
    readable: Readable;
  }>) {
    const id = String(key);
    const running = this.fills.get(id);
    if (!append && running && !running.append) {
      readable.destroy();
      return;
    }

    const fill: Fill = {
      append,
      tail: (running?.tail ?? Promise.resolve())
        .then(() =>
          this.fill(this.createCachePath(key), readable, append, signal),
        )
        .catch((error: unknown) => this.onError?.(error))
        .finally(() => {
          if (this.fills.get(id) === fill) this.fills.delete(id);
        }),
    };
    this.fills.set(id, fill);
  }

  private async fill(
    target: string,
    readable: Readable,
    append: boolean,
    signal?: AbortSignal,
  ) {
    const base = append ? await this.sizeOf(target) : 0;
    if (
      base === undefined ||
      signal?.aborted ||
      this.timeToLive <= 0 ||
      !readable.readable
    ) {
      readable.destroy();
      return;
    }

    await fs.promises.mkdir(this.directory, { mode: 0o700, recursive: true });
    const destination = append ? target : `${target}.${randomUUID()}.tmp`;
    let total = base;
    const limit = async function* (
      this: StreamCache,
      source: AsyncIterable<Buffer>,
    ) {
      for await (const chunk of source) {
        total += chunk.length;
        if (total > this.maxFileSize) throw new Error("max file size exceeded");
        yield chunk;
      }
    }.bind(this);

    try {
      await pipeline(
        readable,
        limit,
        fs.createWriteStream(destination, {
          flags: append ? "a" : "w",
          mode: 0o600,
        }),
        { signal },
      );
      if (!append) await fs.promises.rename(destination, target);
    } catch (error) {
      // Roll back to the last complete state.
      await (
        append
          ? fs.promises.truncate(target, base)
          : fs.promises.rm(destination, { force: true })
      ).catch(() => {});
      throw error;
    }
  }

  private sizeOf(filePath: string) {
    return fs.promises.stat(filePath).then(
      (stats) => stats.size,
      () => undefined,
    );
  }
}

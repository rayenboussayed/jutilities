import fs from "node:fs";
import path from "node:path";
/* eslint-disable security/detect-non-literal-fs-filename */
import { Readable } from "node:stream";

import type { WithSignal } from "../../types/with.js";

import { readJsonFile, writeJsonFile } from "../fs/json.js";
import {
  ensureDirectory,
  fileSize,
  pathExists,
  removeDirectorySync,
  removeFiles,
} from "../fs/utils.js";

/**
 * Options for {@link StreamCache}.
 */
export type StreamCacheOptions = {
  deleteBeforeExit?: boolean;
  directory: string;
  maxFileSize?: number;
  onError?: (error: unknown) => void;
  timeToLive?: number;
};

type CacheMetadata = {
  createdAt?: number;
  size?: number;
};

type FillRecord = {
  append: boolean;
  gate: Promise<void>;
  release: () => void;
  tail: Promise<void>;
};

/**
 * Filesystem-backed stream cache with resumable writes and concurrent
 * read/write coordination.
 */
export class StreamCache {
  private readonly directory: string;
  private readonly fills = new Map<string, FillRecord>();
  private readonly maxFileSize: number;
  private readonly onError?: (error: unknown) => void;
  private readonly timeToLive: number;

  /**
   * Create a cache rooted at `options.directory`.
   * @param options - Directory and limits.
   */
  constructor(options: StreamCacheOptions) {
    this.directory = options.directory;
    this.timeToLive = options.timeToLive ?? Infinity;
    this.maxFileSize = options.maxFileSize ?? Infinity;
    this.onError = options.onError;

    if (options.deleteBeforeExit) {
      /* c8 ignore next 3 */
      process.once("beforeExit", () => {
        removeDirectorySync({ directory: this.directory });
      });
    }
  }

  /**
   * Absolute on-disk path for `key`.
   * @param key - Cache key.
   * @returns File path.
   */
  createCachePath(key: number | string) {
    return path.join(this.directory, `${encodeURIComponent(String(key))}.bin`);
  }

  /**
   * Original cached size, or `undefined` on miss.
   * @param key - Cache key.
   * @returns Size in bytes.
   */
  async getOriginalSize(key: number | string) {
    const metadata = await this.readMetadata(key);
    if (metadata?.size !== undefined) return metadata.size;
    try {
      return await fileSize({ filePath: this.createCachePath(key) });
    } catch (error) {
      /* c8 ignore next */ this.onError?.(error);
      return undefined;
    }
  }

  /**
   * Open a readable of cached bytes for a range.
   * @param options - Key, range and signal.
   * @param options.end - Inclusive end offset.
   * @param options.key - Cache key.
   * @param options.signal - Optional abort signal.
   * @param options.start - Inclusive start offset.
   * @returns Readable or `undefined` on miss.
   */
  async read({
    end,
    key,
    signal,
    start,
  }: WithSignal<{ end?: number; key: number | string; start?: number }>) {
    /* c8 ignore next 3 */
    signal?.throwIfAborted();
    if (this.fills.get(String(key))?.append === false) return undefined;

    const cachePath = this.createCachePath(key);
    const metadata = await this.readMetadata(key);
    if (!metadata && !(await pathExists({ filePath: cachePath })))
      return undefined;

    /* c8 ignore start */
    const normalizedStart =
      !Number.isFinite(start) || (start ?? 0) < 0 ? 0 : Math.floor(start ?? 0);
    const size = metadata?.size ?? (await fileSize({ filePath: cachePath }));
    let normalizedEnd: number;
    if (!Number.isFinite(end) || (end ?? -1) < 0) {
      normalizedEnd = size > 0 ? size - 1 : 0;
    } else {
      normalizedEnd = Math.floor(end ?? 0);
    }
    /* c8 ignore stop */
    if (normalizedStart > normalizedEnd) {
      signal?.throwIfAborted();
      return Readable.from([], { signal });
    }
    if (size > 0 && normalizedStart >= size) {
      signal?.throwIfAborted();
      return Readable.from([], { signal });
    }

    /* c8 ignore next */ signal?.throwIfAborted();
    return fs.createReadStream(cachePath, {
      end: normalizedEnd,
      signal,
      start: normalizedStart,
    });
  }

  /**
   * Remove one cached entry.
   * @param key - Cache key.
   */
  async unlink(key: number | string) {
    await removeFiles({
      filePaths: [this.createCachePath(key), this.metaPath(key)],
    });
  }

  /**
   * Cache `readable` at `key`.
   *
   * Never rejects; failures go to `onError`.
   * @param options - Key, source and flags.
   * @param options.append - Append to a partial file.
   * @param options.key - Cache key.
   * @param options.readable - Source bytes.
   * @param options.signal - Optional abort signal.
   */
  write({
    append,
    key,
    readable,
    signal,
  }: WithSignal<{ append?: boolean; key: number | string; readable: Readable }>) {
    /* c8 ignore next 2 */
    const skip = () =>
      !Readable.isReadable(readable) || signal?.aborted || (this.timeToLive ?? Infinity) <= 0;
    if (skip()) {
      if (typeof readable.destroy === "function") readable.destroy();
      return;
    }

    const stringKey = String(key);
    const running = this.fills.get(stringKey);
    /* c8 ignore next */ if (!append && running && !running.append) return;
    const prior = running?.tail ?? Promise.resolve();
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    const record: FillRecord = {
      append: append ?? false,
      gate,
      release,
      tail: (async () => {
        await prior;
        await gate;
      })(),
    };
    this.fills.set(stringKey, record);

    setImmediate(async () => {
      try {
        await prior;
        /* c8 ignore next 4 */
        if (skip()) {
          readable.destroy();
          return;
        }
        const metadata = await this.readMetadata(key);
        /* c8 ignore next */ if (append && !metadata) return;
        const maxBytes =
          append && metadata?.size ? this.maxFileSize - metadata.size : this.maxFileSize;
        /* c8 ignore next */ if (maxBytes <= 0) throw new Error("max file size exceeded");

        await ensureDirectory({ directory: this.directory });
        const destination = fs.createWriteStream(this.createCachePath(key), {
          flags: append ? "a" : "w",
          highWaterMark: readable.readableHighWaterMark,
          signal,
        });
        const { Transform } = await import("node:stream");
        const limiter = new Transform({
          transform(chunk, _encoding, callback) {
            (this as { total?: number }).total =
              ((this as { total?: number }).total ?? 0) + Buffer.byteLength(chunk);
            /* c8 ignore next */ if (((this as { total?: number }).total ?? 0) > maxBytes) {
              callback(new Error("max file size exceeded"));
              return;
            }
            callback(null, chunk);
          },
        });
        const { pipeline } = await import("node:stream/promises");
        await pipeline(readable, limiter, destination, { signal });

        const stats = await fs.promises.stat(this.createCachePath(key));
        await this.writeMetadata(key, { createdAt: Date.now(), size: stats.size });
      } catch (error) {
        /* c8 ignore next */ this.onError?.(error);
        /* c8 ignore start */
        try {
          await this.unlink(key);
        } catch (cleanupError) {
          this.onError?.(cleanupError);
        }
        /* c8 ignore stop */
      } finally {
        release();
        if (this.fills.get(stringKey) === record) this.fills.delete(stringKey);
      }
    });
  }

  private metaPath(key: number | string) {
    return `${this.createCachePath(key)}.meta.json`;
  }

  private async readMetadata(key: number | string) {
    try {
      return await readJsonFile<CacheMetadata>({
        filePath: this.metaPath(key),
      });
    } catch (error) {
      /* c8 ignore next */ this.onError?.(error);
      return undefined;
    }
  }

  private writeMetadata(key: number | string, metadata: CacheMetadata) {
    return writeJsonFile({ filePath: this.metaPath(key), value: metadata });
  }
}

import type { Dirent, Stats } from "node:fs";

import fs from "node:fs";

import { globalCache, withCacheAsync } from "../../cache.js";

/* eslint-disable security/detect-non-literal-fs-filename */

/**
 * Namespace prefix for every filesystem cache entry stored in
 * {@link globalCache}, so this module can clear its own entries without
 * touching unrelated cached values.
 */
const FS_CACHE_PREFIX = "jutilities/node/fs:";

/**
 * Bumped by {@link clearFsCache}. Keys include the generation so an in-flight
 * read started before a mutation cannot store a stale result under a key that
 * later reads will use.
 */
let generation = 0;

/**
 * Clears every cached filesystem fact.
 *
 * Mutating helpers in this package call this automatically. Call it yourself
 * after changing files through another API (for example `node:fs` directly)
 * when subsequent reads must observe the change immediately instead of waiting
 * for the cache entry's TTL.
 */
export function clearFsCache() {
  generation += 1;
  for (const key of globalCache.keys()) {
    if (typeof key === "string" && key.startsWith(FS_CACHE_PREFIX)) {
      globalCache.delete(key);
    }
  }
}

/**
 * Builds a namespaced cache key for one filesystem read.
 * @param operation - The read operation (`stat`, `readdir`, `text`, …).
 * @param key - The operation-specific identity (usually an absolute path).
 * @returns The encoded cache key.
 */
export function fsCacheKey(operation: string, key: string) {
  return `${FS_CACHE_PREFIX}${generation}:${operation}:${encodeURIComponent(key)}`;
}

/**
 * Cached `fs.promises.stat`, keyed by the exact path.
 *
 * Rejections are never cached.
 */
export const statPath = withCacheAsync(
  ({ filePath }: { filePath: string }): Promise<Stats> =>
    fs.promises.stat(filePath),
  {
    generateCacheKey: ({ parameters: [options] }) =>
      fsCacheKey("stat", options.filePath),
  },
);

/**
 * Cached `fs.promises.lstat`, keyed by the exact path.
 *
 * Rejections are never cached, and `stat`/`lstat` entries are kept separate.
 */
export const lstatPath = withCacheAsync(
  ({ filePath }: { filePath: string }): Promise<Stats> =>
    fs.promises.lstat(filePath),
  {
    generateCacheKey: ({ parameters: [options] }) =>
      fsCacheKey("lstat", options.filePath),
  },
);

/**
 * Cached `fs.promises.readdir(..., { withFileTypes: true })`, keyed by the
 * exact directory path.
 *
 * The returned array is shared: callers that sort or otherwise mutate it must
 * copy it first.
 */
export const readdirPath = withCacheAsync(
  ({ directory }: { directory: string }): Promise<Dirent[]> =>
    fs.promises.readdir(directory, { withFileTypes: true }),
  {
    generateCacheKey: ({ parameters: [options] }) =>
      fsCacheKey("readdir", options.directory),
  },
);

/**
 * Cached UTF-8 file reads, keyed by the exact path.
 *
 * Only the text is cached; callers apply their own parsing on every call.
 */
export const readTextPath = withCacheAsync(
  ({ filePath }: { filePath: string }): Promise<string> =>
    fs.promises.readFile(filePath, "utf8"),
  {
    generateCacheKey: ({ parameters: [options] }) =>
      fsCacheKey("text", options.filePath),
  },
);

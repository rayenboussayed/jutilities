import fs from "node:fs";

import { clearFsCache, statPath } from "./cache.js";

/* eslint-disable security/detect-non-literal-fs-filename */

/**
 * Creates a directory and any missing parents.
 *
 * Idempotent: resolves without error when the directory already exists.
 * Cached filesystem facts are invalidated, including after a failure.
 * @param root0 - Options object.
 * @param root0.directory - Directory to create.
 * @returns Resolves once the directory exists.
 */
export async function ensureDirectory({
  directory,
}: {
  directory: string;
}) {
  try {
    await fs.promises.mkdir(directory, { recursive: true });
  } finally {
    clearFsCache();
  }
}

/**
 * Reads a path's size with `stat`.
 *
 * Stat failures are thrown. Successful stats are cached until the entry
 * expires, a mutating helper runs, or {@link clearFsCache} is called.
 * @param root0 - Options object.
 * @param root0.filePath - Path to stat.
 * @returns Size in bytes.
 */
export async function fileSize({ filePath }: { filePath: string }) {
  const stats = await statPath({ filePath });
  return stats.size;
}

/**
 * Checks whether a path exists.
 *
 * A missing path resolves to `false`; any other stat failure is thrown.
 * Successful stats share the cache used by {@link fileSize}.
 * @param root0 - Options object.
 * @param root0.filePath - Path to check.
 * @returns `true` when the path exists, `false` when it is missing.
 */
export async function pathExists({ filePath }: { filePath: string }) {
  try {
    await statPath({ filePath });
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * Synchronously removes a directory tree, ignoring a missing directory.
 *
 * Synchronous so it can run from `process.beforeExit` handlers. Cached
 * filesystem facts are invalidated, including after a failure.
 * @param root0 - Options object.
 * @param root0.directory - Directory to remove.
 */
export function removeDirectorySync({ directory }: { directory: string }) {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } finally {
    clearFsCache();
  }
}

/**
 * Removes files concurrently, ignoring missing paths.
 *
 * Missing paths are ignored via `force`; every other removal failure rejects.
 * Cached filesystem facts are invalidated, including after a failure.
 * @param root0 - Options object.
 * @param root0.filePaths - Paths to remove.
 * @returns Resolves after every file is removed.
 */
export async function removeFiles({
  filePaths,
}: {
  filePaths: readonly string[];
}) {
  try {
    await Promise.all(
      filePaths.map((filePath) => fs.promises.rm(filePath, { force: true })),
    );
  } finally {
    clearFsCache();
  }
}


import fs from "node:fs";

/**
 * Removes files concurrently, ignoring missing paths.
 *
 * Missing paths are ignored via `force`; every other removal failure rejects.
 * @param root0 - Options object.
 * @param root0.filePaths - Paths to remove.
 * @returns Resolves after every file is removed.
 */
export function removeFiles({ filePaths }: { filePaths: readonly string[] }) {
  return Promise.all(
    filePaths.map((filePath) => fs.promises.rm(filePath, { force: true })),
  );
}

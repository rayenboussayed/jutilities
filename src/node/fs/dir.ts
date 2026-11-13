import type { Dirent } from "node:fs";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { WithSignal } from "../../types/with.js";

/* eslint-disable security/detect-non-literal-fs-filename */

/**
 * The kind of a filesystem entry, as reported by {@link directoryTree}.
 */
export type DirectoryEntryKind = "directory" | "file" | "symlink";

/**
 * Aggregate facts about a directory tree, returned by
 * {@link directoryMetadata}.
 *
 * Counts cover descendants only; the root directory is not counted in
 * `directories` or `entries`.
 */
export type DirectoryMetadata = {
  createdAt: number;
  directories: number;
  directory: string;
  entries: number;
  files: number;
  modifiedAt: number;
  size: number;
  symlinks: number;
};

/**
 * One node of the tree returned by {@link directoryTree}.
 *
 * Every node carries a `children` array (empty for files and symlinks) so
 * consumers can recurse without branching on the node kind.
 */
export type DirectoryTree = {
  children: DirectoryTree[];
  kind: DirectoryEntryKind;
  name: string;
  path: string;
  /**
   * Size in bytes. Present for files and symlinks only. File and symlink sizes
   * come from `stat`, so a symlink reports the size of its target; directories
   * are not given a size.
   */
  size?: number;
};

/**
 * Options for the recursive directory scanners.
 */
type ScanOptions = WithSignal<{ directory: string }>;

/**
 * Builds the sorted tree for one directory level and its descendants.
 * @param root0 - Options object.
 * @param root0.directory - Directory to read.
 * @param root0.name - Name to give the node.
 * @param root0.signal - Optional abort signal checked between entries.
 * @returns The directory node.
 */
export async function buildTree({
  directory,
  name,
  signal,
}: ScanOptions & { name: string }): Promise<DirectoryTree> {
  const node: DirectoryTree = {
    children: [],
    kind: "directory",
    name,
    path: directory,
  };

  const entries = await readEntries({ directory });

  for (const entry of entries) {
    signal?.throwIfAborted();
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      node.children.push(
        await buildTree({
          directory: entryPath,
          name: entry.name,
          signal,
        }),
      );
      continue;
    }

    const stats = await fs.promises.stat(entryPath);
    node.children.push({
      children: [],
      kind: entry.isSymbolicLink() ? "symlink" : "file",
      name: entry.name,
      path: entryPath,
      size: stats.size,
    });
  }

  return node;
}

/**
 * Copies a directory tree, including symlinks as symlinks.
 *
 * The destination parent is created when missing. Relative symlink targets are
 * preserved verbatim rather than rewritten to absolute paths. Real copy
 * failures are thrown.
 * @param root0 - Options object.
 * @param root0.source - Directory to copy.
 * @param root0.destination - Destination path.
 * @param root0.overwrite - Replace an existing destination (default `false`).
 */
export async function copyDirectory({
  destination,
  overwrite = false,
  source,
}: {
  destination: string;
  overwrite?: boolean;
  source: string;
}) {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await fs.promises.cp(source, destination, {
    dereference: false,
    errorOnExist: !overwrite,
    force: overwrite,
    recursive: true,
    verbatimSymlinks: true,
  });
}

/**
 * Creates a unique temporary directory.
 *
 * The parent directory is created when missing.
 * @param root0 - Options object.
 * @param root0.directory - Parent directory (default `os.tmpdir()`).
 * @param root0.prefix - Name prefix (default `"jutilities-"`).
 * @returns The created directory path.
 */
export async function createTempDirectory({
  directory = os.tmpdir(),
  prefix = "jutilities-",
}: {
  directory?: string;
  prefix?: string;
} = {}) {
  await fs.promises.mkdir(directory, { recursive: true });
  return fs.promises.mkdtemp(path.join(directory, prefix));
}

/**
 * Lists regular files below a directory, recursively by default.
 *
 * Symlinks are never followed and are not reported as files. With
 * `recursive: false` only immediate children are considered. Read failures are
 * thrown.
 * @param root0 - Options object.
 * @param root0.directory - Directory to scan.
 * @param root0.recursive - Recurse into subdirectories (default `true`).
 * @param root0.signal - Optional abort signal checked between entries.
 * @returns Sorted regular-file paths, in depth-first order.
 */
export async function directoryFiles({
  directory,
  recursive = true,
  signal,
}: ScanOptions & { recursive?: boolean }): Promise<string[]> {
  signal?.throwIfAborted();

  if (!recursive) {
    const entries = await readEntries({ directory });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(directory, entry.name));
  }

  const files: string[] = [];
  for await (const item of walkEntries({ directory, signal })) {
    if (item.entry.isFile()) files.push(item.path);
  }
  return files;
}

/**
 * Computes aggregate facts about a directory tree.
 *
 * The root and every descendant are statted, so an explicitly passed symlink
 * to a directory is accepted and a symlink contributes the size of its target.
 * Symlinks are never traversed. File and symlink sizes contribute to `size`;
 * directory sizes do not. Counts cover descendants only. Read and stat
 * failures are thrown.
 * @param root0 - Options object.
 * @param root0.directory - Directory to inspect.
 * @param root0.signal - Optional abort signal checked between entries.
 * @returns Metadata, or `undefined` when the root is not a directory.
 */
export async function directoryMetadata({
  directory,
  signal,
}: ScanOptions): Promise<DirectoryMetadata | undefined> {
  signal?.throwIfAborted();

  const rootStats = await fs.promises.stat(directory);
  if (!rootStats.isDirectory()) return undefined;

  let directories = 0;
  let files = 0;
  let size = 0;
  let symlinks = 0;

  for await (const item of walkEntries({ directory, signal })) {
    if (item.entry.isDirectory()) {
      directories += 1;
      continue;
    }
    const stats = await fs.promises.stat(item.path);
    size += stats.size;
    if (item.entry.isSymbolicLink()) {
      symlinks += 1;
    } else {
      files += 1;
    }
  }

  return {
    createdAt: rootStats.birthtimeMs,
    directories,
    directory,
    entries: directories + files + symlinks,
    files,
    modifiedAt: rootStats.mtimeMs,
    size,
    symlinks,
  };
}

/**
 * Total size of the regular files and symlinks below a directory.
 *
 * Symlinks contribute their own link length and are never followed. Read and
 * stat failures are thrown.
 * @param root0 - Options object.
 * @param root0.directory - Directory to measure.
 * @param root0.signal - Optional abort signal checked between entries.
 * @returns Size in bytes, or `undefined` when the root is not a directory.
 */
export async function directorySize({
  directory,
  signal,
}: ScanOptions): Promise<number | undefined> {
  return (await directoryMetadata({ directory, signal }))?.size;
}

/**
 * Builds a nested tree of a directory, sorted by name.
 *
 * The root is accepted even when it is a symlink to a directory; descendants
 * are never followed through symlinks. Read and stat failures are thrown.
 * @param root0 - Options object.
 * @param root0.directory - Directory to scan.
 * @param root0.signal - Optional abort signal checked between entries.
 * @returns The tree, or `undefined` when the root is not a directory.
 */
export async function directoryTree({
  directory,
  signal,
}: ScanOptions): Promise<DirectoryTree | undefined> {
  signal?.throwIfAborted();

  const stats = await fs.promises.stat(directory);
  if (!stats.isDirectory()) return undefined;

  return buildTree({
    directory,
    name: path.basename(directory),
    signal,
  });
}

/**
 * Removes every child of a directory while keeping the directory itself.
 *
 * The directory is created when missing. Real removal failures are thrown.
 * @param root0 - Options object.
 * @param root0.directory - Directory to empty.
 */
export async function emptyDirectory({ directory }: { directory: string }) {
  await fs.promises.mkdir(directory, { recursive: true });
  const entries = await fs.promises.readdir(directory);
  await Promise.all(
    entries.map((name) =>
      fs.promises.rm(path.join(directory, name), {
        force: true,
        recursive: true,
      }),
    ),
  );
}

/**
 * Creates a directory and any missing parents.
 *
 * Idempotent: resolves without error when the directory already exists.
 * @param root0 - Options object.
 * @param root0.directory - Directory to create.
 * @returns Resolves once the directory exists.
 */
export function ensureDirectory({ directory }: { directory: string }) {
   
  return fs.promises.mkdir(directory, { recursive: true });
}

/**
 * Detects the `EXDEV` error raised when a rename crosses filesystems.
 * @param error - The caught value.
 * @returns `true` for an `Error` whose `code` is `"EXDEV"`.
 */
export function isCrossDeviceError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EXDEV";
}

/**
 * Moves a directory, falling back to copy-and-remove across filesystems.
 *
 * The destination parent is created when missing. Renames are attempted
 * first; only `EXDEV` triggers the copy fallback. Other rename, copy, and
 * removal failures are thrown.
 * @param root0 - Options object.
 * @param root0.source - Directory to move.
 * @param root0.destination - Destination path.
 */
export async function moveDirectory({
  destination,
  source,
}: {
  destination: string;
  source: string;
}) {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.promises.rename(source, destination);
  } catch (error) {
    if (!isCrossDeviceError(error)) throw error;
    await copyDirectory({ destination, source });
    await fs.promises.rm(source, { force: true, recursive: true });
  }
}


/**
 * Depth-first walk over the entries below `directory`.
 *
 * Entries are visited in name order. Symlinks are yielded but never
 * traversed, so a link cycle cannot hang the scan. Read failures are thrown.
 * @param root0 - Options object.
 * @param root0.directory - Directory to scan.
 * @param root0.signal - Optional abort signal checked between entries.
 * @yields Each descendant entry together with its absolute path.
 */
export async function* walkEntries({
  directory,
  signal,
}: ScanOptions): AsyncGenerator<{ entry: Dirent; path: string }> {
  signal?.throwIfAborted();
  const entries = await readEntries({ directory });

  for (const entry of entries) {
    signal?.throwIfAborted();

    const entryPath = path.join(directory, entry.name);
    yield { entry, path: entryPath };

    if (entry.isDirectory()) {
      yield* walkEntries({ directory: entryPath, signal });
    }
  }
}

/**
 * Reads one directory level, sorted by name.
 *
 * Read failures are thrown.
 * @param root0 - Options object.
 * @param root0.directory - Directory to read.
 * @returns Sorted entries.
 */
async function readEntries({ directory }: { directory: string }) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

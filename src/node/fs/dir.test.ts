/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  copyDirectory,
  createTempDirectory,
  directoryEntries,
  directoryFiles,
  directoryMetadata,
  directorySize,
  directoryTree,
  emptyDirectory,
  moveDirectory,
  removeDirectory,
  walkDirectory,
} from "./dir.js";
import { fileSize } from "./utils.js";

/**
 * Consumes an async iterable into an array.
 * @param iterable - The iterable to drain.
 * @returns Every yielded value, in order.
 */
async function collect<T>(iterable: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

/**
 * Builds the shared fixture:
 *
 * ```text
 * root/
 *   a.txt        ("aaa")
 *   b/
 *     c.txt      ("cc")
 *     d/
 *       e.txt    ("e")
 *   link.txt     -> a.txt
 *   link-dir     -> b
 * ```
 * @returns The fixture root path.
 */
function createFixture() {
  const directory = tempDir();
  fs.writeFileSync(path.join(directory, "a.txt"), "aaa");
  fs.mkdirSync(path.join(directory, "b", "d"), { recursive: true });
  fs.writeFileSync(path.join(directory, "b", "c.txt"), "cc");
  fs.writeFileSync(path.join(directory, "b", "d", "e.txt"), "e");
  fs.symlinkSync("a.txt", path.join(directory, "link.txt"));
  fs.symlinkSync("b", path.join(directory, "link-dir"));
  return directory;
}

/**
 * Creates an isolated temporary directory for one test.
 * @returns The created directory path.
 */
function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jfs-dir-"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("directoryEntries", () => {
  it("returns immediate entries sorted by name", async () => {
    const directory = createFixture();
    const entries = await directoryEntries({ directory });
    expect(entries.map((entry) => entry.name)).toStrictEqual([
      "a.txt",
      "b",
      "link-dir",
      "link.txt",
    ]);
    expect(entries[1]?.isDirectory()).toBeTruthy();
    expect(entries[3]?.isSymbolicLink()).toBeTruthy();
  });

  it("rejects for missing directories", async () => {
    const directory = path.join(tempDir(), "missing");
    await expect(directoryEntries({ directory })).rejects.toThrow();
  });

  it("rejects when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      directoryEntries({ directory: tempDir(), signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("walkDirectory", () => {
  it("yields descendants in sorted depth-first order without following links", async () => {
    const directory = createFixture();
    expect(await collect(walkDirectory({ directory }))).toStrictEqual([
      path.join(directory, "a.txt"),
      path.join(directory, "b"),
      path.join(directory, "b", "c.txt"),
      path.join(directory, "b", "d"),
      path.join(directory, "b", "d", "e.txt"),
      path.join(directory, "link-dir"),
      path.join(directory, "link.txt"),
    ]);
  });

  it("rejects when a subdirectory cannot be read", async () => {
    const directory = createFixture();
    const blocked = path.join(directory, "b");
    const iterator = walkDirectory({ directory });

    expect((await iterator.next()).value).toBe(path.join(directory, "a.txt"));
    expect((await iterator.next()).value).toBe(blocked);
    fs.rmSync(blocked, { recursive: true });

    await expect(iterator.next()).rejects.toThrow();
  });

  it("rejects when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      collect(walkDirectory({ directory: tempDir(), signal: controller.signal })),
    ).rejects.toThrow();
  });

  it("stops when aborted between entries", async () => {
    const directory = createFixture();
    const controller = new AbortController();
    const iterator = walkDirectory({ directory, signal: controller.signal });

    await iterator.next();
    controller.abort();
    await expect(iterator.next()).rejects.toThrow();
  });
});

describe("directoryFiles", () => {
  it("lists regular files recursively and skips symlinks", async () => {
    const directory = createFixture();
    expect(await directoryFiles({ directory })).toStrictEqual([
      path.join(directory, "a.txt"),
      path.join(directory, "b", "c.txt"),
      path.join(directory, "b", "d", "e.txt"),
    ]);
  });

  it("limits the scan to immediate children when recursive is false", async () => {
    const directory = createFixture();
    expect(await directoryFiles({ directory, recursive: false })).toStrictEqual(
      [path.join(directory, "a.txt")],
    );
  });

  it("rejects for missing directories", async () => {
    const directory = path.join(tempDir(), "missing");
    await expect(directoryFiles({ directory })).rejects.toThrow();
    await expect(
      directoryFiles({ directory, recursive: false }),
    ).rejects.toThrow();
  });

  it("rejects when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      directoryFiles({ directory: tempDir(), signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("directoryMetadata", () => {
  it("counts descendants and sums file and symlink sizes", async () => {
    const directory = createFixture();
    const rootStats = fs.statSync(directory);
    const expectedSize =
      3 +
      2 +
      1 +
      fs.lstatSync(path.join(directory, "link.txt")).size +
      fs.lstatSync(path.join(directory, "link-dir")).size;

    expect(
      await directoryMetadata({ directory, signal: new AbortController().signal }),
    ).toStrictEqual({
      createdAt: rootStats.birthtimeMs,
      directories: 2,
      directory,
      entries: 7,
      files: 3,
      modifiedAt: rootStats.mtimeMs,
      size: expectedSize,
      symlinks: 2,
    });
  });

  it("throws when an entry cannot be lstat'ed", async () => {
    const directory = createFixture();
    vi.spyOn(fs.promises, "lstat").mockRejectedValueOnce(
      new Error("vanished"),
    );

    await expect(directoryMetadata({ directory })).rejects.toThrow("vanished");
  });

  it("throws for missing roots and returns undefined for non-directories", async () => {
    const directory = tempDir();
    const missing = path.join(directory, "missing");
    const filePath = path.join(directory, "x.txt");
    fs.writeFileSync(filePath, "x");

    await expect(directoryMetadata({ directory: missing })).rejects.toThrow();
    expect(await directoryMetadata({ directory: filePath })).toBeUndefined();
  });

  it("rejects when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      directoryMetadata({ directory: tempDir(), signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("directorySize", () => {
  it("returns the summed size from metadata", async () => {
    const directory = createFixture();
    const metadata = await directoryMetadata({ directory });
    expect(await directorySize({ directory })).toBe(metadata?.size);
  });

  it("throws for missing roots and returns undefined for non-directories", async () => {
    const directory = tempDir();
    const filePath = path.join(directory, "x.txt");
    fs.writeFileSync(filePath, "x");
    await expect(
      directorySize({ directory: path.join(directory, "missing") }),
    ).rejects.toThrow();
    expect(await directorySize({ directory: filePath })).toBeUndefined();
  });
});

describe("directoryTree", () => {
  it("builds a sorted tree with kinds and sizes", async () => {
    const directory = createFixture();
    const tree = await directoryTree({
      directory,
      signal: new AbortController().signal,
    });
    expect(tree).toBeDefined();
    if (!tree) throw new Error("tree missing");
    expect(tree.kind).toBe("directory");
    expect(tree.name).toBe(path.basename(directory));
    expect(tree.children.map((child) => child.name)).toStrictEqual([
      "a.txt",
      "b",
      "link-dir",
      "link.txt",
    ]);

    const [file, folder, linkDir, linkFile] = tree.children;
    expect(file).toMatchObject({ kind: "file", size: 3 });
    expect(folder?.kind).toBe("directory");
    expect(folder?.children.map((child) => child.name)).toStrictEqual([
      "c.txt",
      "d",
    ]);
    expect(folder?.children[1]?.children[0]).toMatchObject({
      kind: "file",
      name: "e.txt",
      size: 1,
    });
    expect(linkDir?.kind).toBe("symlink");
    expect(linkFile?.kind).toBe("symlink");
  });

  it("accepts an explicit symlink to a directory as the root", async () => {
    const directory = createFixture();
    const link = path.join(tempDir(), "root-link");
    fs.symlinkSync(directory, link);
    const tree = await directoryTree({ directory: link });
    expect(tree?.kind).toBe("directory");
    expect(tree?.children.map((child) => child.name)).toStrictEqual([
      "a.txt",
      "b",
      "link-dir",
      "link.txt",
    ]);
  });

  it("rejects when the root cannot be read", async () => {
    const directory = createFixture();
    vi.spyOn(fs.promises, "readdir").mockRejectedValueOnce(
      new Error("blocked"),
    );

    await expect(directoryTree({ directory })).rejects.toThrow("blocked");
  });

  it("rejects when an entry cannot be lstat'ed", async () => {
    const directory = createFixture();
    vi.spyOn(fs.promises, "lstat").mockRejectedValueOnce(
      new Error("vanished"),
    );

    await expect(directoryTree({ directory })).rejects.toThrow("vanished");
  });

  it("throws for missing roots and returns undefined for non-directories", async () => {
    const directory = tempDir();
    const missing = path.join(directory, "missing");
    const filePath = path.join(directory, "x.txt");
    fs.writeFileSync(filePath, "x");

    await expect(directoryTree({ directory: missing })).rejects.toThrow();
    expect(await directoryTree({ directory: filePath })).toBeUndefined();
  });

  it("rejects when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      directoryTree({ directory: tempDir(), signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("copyDirectory", () => {
  it("copies a tree, creating the destination parent and preserving links", async () => {
    const source = createFixture();
    const destination = path.join(tempDir(), "nested", "copy");

    await copyDirectory({ destination, source });

    expect(fs.readFileSync(path.join(destination, "a.txt"), "utf8")).toBe("aaa");
    expect(
      fs.readFileSync(path.join(destination, "b", "d", "e.txt"), "utf8"),
    ).toBe("e");
    expect(
      fs.lstatSync(path.join(destination, "link-dir")).isSymbolicLink(),
    ).toBeTruthy();
    expect(fs.readlinkSync(path.join(destination, "link-dir"))).toBe("b");
  });

  it("refuses to overwrite by default and overwrites when asked", async () => {
    const source = createFixture();
    const destination = tempDir();
    fs.writeFileSync(path.join(destination, "a.txt"), "old");

    await expect(copyDirectory({ destination, source })).rejects.toThrow();

    await copyDirectory({ destination, overwrite: true, source });
    expect(fs.readFileSync(path.join(destination, "a.txt"), "utf8")).toBe("aaa");
  });

  it("throws when the source is missing", async () => {
    await expect(
      copyDirectory({
        destination: path.join(tempDir(), "copy"),
        source: path.join(tempDir(), "missing"),
      }),
    ).rejects.toThrow();
  });

  it("invalidates cached destination entries", async () => {
    const source = createFixture();
    const destination = tempDir();
    fs.writeFileSync(path.join(destination, "old.txt"), "old");
    expect(await directoryEntries({ directory: destination })).toHaveLength(1);

    await copyDirectory({ destination, overwrite: true, source });

    expect(
      (await directoryEntries({ directory: destination })).map(
        (entry) => entry.name,
      ),
    ).toContain("a.txt");
  });
});

describe("moveDirectory", () => {
  it("renames within a filesystem and creates the destination parent", async () => {
    const source = createFixture();
    const destination = path.join(tempDir(), "nested", "moved");

    await moveDirectory({ destination, source });

    expect(fs.existsSync(source)).toBeFalsy();
    expect(fs.readFileSync(path.join(destination, "a.txt"), "utf8")).toBe("aaa");
  });

  it("falls back to copy-and-remove on EXDEV", async () => {
    const source = createFixture();
    const destination = path.join(tempDir(), "moved");
    const rename = vi
      .spyOn(fs.promises, "rename")
      .mockRejectedValueOnce(
        Object.assign(new Error("cross-device"), { code: "EXDEV" }),
      );

    await moveDirectory({ destination, source });

    expect(rename).toHaveBeenCalledOnce();
    expect(fs.existsSync(source)).toBeFalsy();
    expect(fs.readFileSync(path.join(destination, "a.txt"), "utf8")).toBe("aaa");
    expect(
      fs.lstatSync(path.join(destination, "link-dir")).isSymbolicLink(),
    ).toBeTruthy();
  });

  it("rethrows errors that are not EXDEV", async () => {
    const source = createFixture();

    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(
      Object.assign(new Error("permission denied"), { code: "EACCES" }),
    );
    await expect(
      moveDirectory({ destination: path.join(tempDir(), "moved"), source }),
    ).rejects.toThrow("permission denied");
    expect(fs.existsSync(source)).toBeTruthy();

    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(new Error("plain"));
    await expect(
      moveDirectory({ destination: path.join(tempDir(), "moved"), source }),
    ).rejects.toThrow("plain");

    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce("not an error");
    await expect(
      moveDirectory({ destination: path.join(tempDir(), "moved"), source }),
    ).rejects.toBe("not an error");
  });

  it("invalidates cached stats for the source", async () => {
    const source = createFixture();
    const filePath = path.join(source, "a.txt");
    expect(await fileSize({ filePath })).toBe(3);

    await moveDirectory({ destination: path.join(tempDir(), "moved"), source });

    await expect(fileSize({ filePath })).rejects.toThrow();
  });
});

describe("emptyDirectory", () => {
  it("removes every child but keeps the directory", async () => {
    const directory = createFixture();
    await emptyDirectory({ directory });
    expect(fs.existsSync(directory)).toBeTruthy();
    expect(fs.readdirSync(directory)).toStrictEqual([]);
  });

  it("creates the directory when missing", async () => {
    const directory = path.join(tempDir(), "nested", "empty");
    await emptyDirectory({ directory });
    expect(fs.existsSync(directory)).toBeTruthy();
  });

  it("surfaces removal failures", async () => {
    const directory = createFixture();
    vi.spyOn(fs.promises, "rm").mockRejectedValueOnce(new Error("locked"));
    await expect(emptyDirectory({ directory })).rejects.toThrow("locked");
  });

  it("invalidates cached entries", async () => {
    const directory = createFixture();
    expect(await directoryEntries({ directory })).not.toHaveLength(0);

    await emptyDirectory({ directory });

    expect(await directoryEntries({ directory })).toHaveLength(0);
  });

  it("invalidates cached entries even when a removal fails", async () => {
    const directory = createFixture();
    expect(await directoryEntries({ directory })).not.toHaveLength(0);
    vi.spyOn(fs.promises, "rm").mockRejectedValueOnce(new Error("locked"));

    await expect(emptyDirectory({ directory })).rejects.toThrow("locked");

    fs.rmSync(path.join(directory, "a.txt"));
    expect(
      (await directoryEntries({ directory })).map((entry) => entry.name),
    ).not.toContain("a.txt");
  });
});

describe("removeDirectory", () => {
  it("removes a tree and ignores missing directories", async () => {
    const directory = createFixture();
    await removeDirectory({ directory });
    expect(fs.existsSync(directory)).toBeFalsy();
    await expect(removeDirectory({ directory })).resolves.toBeUndefined();
  });

  it("surfaces removal failures", async () => {
    vi.spyOn(fs.promises, "rm").mockRejectedValueOnce(new Error("locked"));
    await expect(
      removeDirectory({ directory: createFixture() }),
    ).rejects.toThrow("locked");
  });

  it("invalidates cached stats", async () => {
    const directory = createFixture();
    const filePath = path.join(directory, "a.txt");
    expect(await fileSize({ filePath })).toBe(3);

    await removeDirectory({ directory });

    await expect(fileSize({ filePath })).rejects.toThrow();
  });
});

describe("createTempDirectory", () => {
  it("uses the OS temp directory and default prefix", async () => {
    const created = await createTempDirectory();
    expect(fs.existsSync(created)).toBeTruthy();
    expect(path.basename(created).startsWith("jutilities-")).toBeTruthy();
  });

  it("honors a custom parent and prefix, creating the parent", async () => {
    const parent = path.join(tempDir(), "nested", "tmp");
    const created = await createTempDirectory({
      directory: parent,
      prefix: "demo-",
    });
    expect(path.dirname(created)).toBe(parent);
    expect(path.basename(created).startsWith("demo-")).toBeTruthy();
  });

  it("invalidates cached parent entries", async () => {
    const parent = tempDir();
    fs.writeFileSync(path.join(parent, "seed.txt"), "x");
    expect(await directoryEntries({ directory: parent })).toHaveLength(1);

    const created = await createTempDirectory({ directory: parent });

    expect(fs.existsSync(created)).toBeTruthy();
    expect(await directoryEntries({ directory: parent })).toHaveLength(2);
  });
});

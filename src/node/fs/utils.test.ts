/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { directoryEntries } from "./dir.js";
import {
  ensureDirectory,
  fileSize,
  pathExists,
  removeDirectorySync,
  removeFiles,
} from "./utils.js";

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Creates an isolated temporary directory for one test.
 * @returns The created directory path.
 */
function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jfs-"));
}

describe("ensureDirectory", () => {
  it("creates nested directories idempotently", async () => {
    const directory = path.join(tempDir(), "a", "b");
    await ensureDirectory({ directory });
    expect(fs.existsSync(directory)).toBeTruthy();
    await ensureDirectory({ directory });
    expect(fs.existsSync(directory)).toBeTruthy();
  });

  it("invalidates cached entries when creating a directory", async () => {
    const parent = tempDir();
    fs.writeFileSync(path.join(parent, "seed.txt"), "x");
    expect(await directoryEntries({ directory: parent })).toHaveLength(1);

    await ensureDirectory({ directory: path.join(parent, "nested") });

    expect(
      (await directoryEntries({ directory: parent })).map(
        (entry) => entry.name,
      ),
    ).toStrictEqual(["nested", "seed.txt"]);
  });
});

describe("removeDirectorySync", () => {
  it("removes a directory tree and ignores missing paths", () => {
    const directory = tempDir();
    fs.writeFileSync(path.join(directory, "x.txt"), "x");
    removeDirectorySync({ directory });
    expect(fs.existsSync(directory)).toBeFalsy();
    expect(() => removeDirectorySync({ directory })).not.toThrow();
  });

  it("invalidates cached stats after removal", async () => {
    const directory = tempDir();
    const filePath = path.join(directory, "x.txt");
    fs.writeFileSync(filePath, "x");
    expect(await fileSize({ filePath })).toBe(1);

    removeDirectorySync({ directory });

    expect(await pathExists({ filePath })).toBeFalsy();
  });
});

describe("pathExists", () => {
  it("returns true for an existing path", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    fs.writeFileSync(filePath, "x");
    expect(await pathExists({ filePath })).toBeTruthy();
  });

  it("returns false for missing paths", async () => {
    const filePath = path.join(tempDir(), "missing");
    expect(await pathExists({ filePath })).toBeFalsy();
  });

  it("throws for failures other than a missing path", async () => {
    vi.spyOn(fs.promises, "stat").mockRejectedValueOnce(
      Object.assign(new Error("denied"), { code: "EACCES" }),
    );
    await expect(
      pathExists({ filePath: path.join(tempDir(), "x") }),
    ).rejects.toThrow("denied");
  });
});

describe("fileSize", () => {
  it("returns the size of an existing file", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    fs.writeFileSync(filePath, "hello");
    expect(await fileSize({ filePath })).toBe(5);
  });

  it("throws for missing paths", async () => {
    const filePath = path.join(tempDir(), "missing");
    await expect(fileSize({ filePath })).rejects.toThrow();
  });
});

describe("removeFiles", () => {
  it("removes existing files", async () => {
    const directory = tempDir();
    const first = path.join(directory, "a.txt");
    const second = path.join(directory, "b.txt");
    fs.writeFileSync(first, "a");
    fs.writeFileSync(second, "b");

    await removeFiles({ filePaths: [first, second] });
    expect(fs.existsSync(first)).toBeFalsy();
    expect(fs.existsSync(second)).toBeFalsy();
  });

  it("ignores missing files", async () => {
    const filePath = path.join(tempDir(), "missing");
    await expect(
      removeFiles({ filePaths: [filePath] }),
    ).resolves.toBeUndefined();
  });

  it("rejects real removal failures", async () => {
    vi.spyOn(fs.promises, "rm").mockRejectedValueOnce(new Error("locked"));
    await expect(
      removeFiles({ filePaths: [path.join(tempDir(), "x.txt")] }),
    ).rejects.toThrow("locked");
  });

  it("invalidates cached stats after removal", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    fs.writeFileSync(filePath, "x");
    expect(await fileSize({ filePath })).toBe(1);

    await removeFiles({ filePaths: [filePath] });

    expect(await pathExists({ filePath })).toBeFalsy();
  });

  it("invalidates cached facts even when a removal fails", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    fs.writeFileSync(filePath, "x");
    expect(await fileSize({ filePath })).toBe(1);
    vi.spyOn(fs.promises, "rm").mockRejectedValueOnce(new Error("locked"));

    await expect(removeFiles({ filePaths: [filePath] })).rejects.toThrow(
      "locked",
    );

    fs.rmSync(filePath);
    expect(await pathExists({ filePath })).toBeFalsy();
  });
});

/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { removeFiles } from "./file.js";

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

describe("removeFiles", () => {
  it("removes existing files", async () => {
    const directory = tempDir();
    const first = path.join(directory, "a.txt");
    const second = path.join(directory, "b.txt");
    fs.writeFileSync(first, "a");
    fs.writeFileSync(second, "b");

    await expect(
      removeFiles({ filePaths: [first, second] }),
    ).resolves.toStrictEqual([undefined, undefined]);
    expect(fs.existsSync(first)).toBeFalsy();
    expect(fs.existsSync(second)).toBeFalsy();
  });

  it("ignores missing files", async () => {
    const filePath = path.join(tempDir(), "missing");

    await expect(
      removeFiles({ filePaths: [filePath] }),
    ).resolves.toStrictEqual([undefined]);
  });

  it("rejects real removal failures", async () => {
    vi.spyOn(fs.promises, "rm").mockRejectedValueOnce(new Error("locked"));

    await expect(
      removeFiles({ filePaths: [path.join(tempDir(), "x.txt")] }),
    ).rejects.toThrow("locked");
  });
});

/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { globalCache } from "../../cache.js";
import {
  clearFsCache,
  fsCacheKey,
  lstatPath,
  readdirPath,
  readTextPath,
  statPath,
} from "./cache.js";
import { directoryEntries } from "./dir.js";

afterEach(() => {
  vi.restoreAllMocks();
  globalCache.delete("fs-cache-test:keep");
  globalCache.delete(987_654_321);
});

/**
 * Creates an isolated temporary directory for one test.
 * @returns The created directory path.
 */
function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jfs-cache-"));
}

describe("statPath", () => {
  it("caches successful stats", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    fs.writeFileSync(filePath, "hello");
    const stat = vi.spyOn(fs.promises, "stat");

    expect((await statPath({ filePath })).size).toBe(5);
    expect((await statPath({ filePath })).size).toBe(5);
    expect(stat).toHaveBeenCalledOnce();
  });

  it("does not cache rejections", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    vi.spyOn(fs.promises, "stat").mockRejectedValueOnce(
      Object.assign(new Error("missing"), { code: "ENOENT" }),
    );

    await expect(statPath({ filePath })).rejects.toThrow("missing");
    fs.writeFileSync(filePath, "x");
    expect((await statPath({ filePath })).size).toBe(1);
  });

  it("does not reuse a result computed before an invalidation", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    fs.writeFileSync(filePath, "x");
    const original = fs.promises.stat.bind(fs.promises);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stat = vi
      .spyOn(fs.promises, "stat")
      .mockImplementationOnce(async (target) => {
        await gate;
        return original(target);
      });

    const inFlight = statPath({ filePath });
    clearFsCache();
    release();
    await inFlight;
    await statPath({ filePath });

    expect(stat).toHaveBeenCalledTimes(2);
  });
});

describe("lstatPath", () => {
  it("keeps symlink stats separate from followed stats", async () => {
    const directory = tempDir();
    const target = path.join(directory, "target.txt");
    const link = path.join(directory, "link.txt");
    fs.writeFileSync(target, "hello");
    fs.symlinkSync("target.txt", link);

    expect((await statPath({ filePath: link })).size).toBe(5);
    expect((await lstatPath({ filePath: link })).size).toBe("target.txt".length);
    expect((await statPath({ filePath: link })).size).toBe(5);
    expect((await lstatPath({ filePath: link })).size).toBe("target.txt".length);
  });
});

describe("readdirPath", () => {
  it("caches the raw entries and sorts a copy", async () => {
    const directory = tempDir();
    fs.writeFileSync(path.join(directory, "b.txt"), "b");
    fs.writeFileSync(path.join(directory, "a.txt"), "a");

    const cached = await readdirPath({ directory });
    const rawNames = cached.map((entry) => entry.name);
    expect(await readdirPath({ directory })).toBe(cached);

    const sorted = await directoryEntries({ directory });

    expect(sorted).not.toBe(cached);
    expect(sorted.map((entry) => entry.name)).toStrictEqual(
      [...rawNames].sort((left, right) => left.localeCompare(right)),
    );
    expect(cached.map((entry) => entry.name)).toStrictEqual(rawNames);
  });
});

describe("readTextPath", () => {
  it("caches text until the entry is cleared", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    fs.writeFileSync(filePath, "first");
    const read = vi.spyOn(fs.promises, "readFile");

    expect(await readTextPath({ filePath })).toBe("first");
    fs.writeFileSync(filePath, "second");
    expect(await readTextPath({ filePath })).toBe("first");
    expect(read).toHaveBeenCalledOnce();

    clearFsCache();
    expect(await readTextPath({ filePath })).toBe("second");
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("fsCacheKey", () => {
  it("namespaces, encodes, and separates generations", () => {
    const target = path.join(os.tmpdir(), "a b");
    const before = fsCacheKey("stat", target);
    clearFsCache();
    const after = fsCacheKey("stat", target);

    expect(before).toContain("jutilities/node/fs:");
    expect(before).toContain("stat:");
    expect(before).toContain(encodeURIComponent(target));
    expect(before).not.toBe(after);
  });
});

describe("clearFsCache", () => {
  it("removes only namespaced entries", () => {
    globalCache.set("fs-cache-test:keep", "keep");
    globalCache.set(987_654_321, "number");
    globalCache.set("jutilities/node/fs:stale", "stale");

    clearFsCache();

    expect(globalCache.get("fs-cache-test:keep")).toBe("keep");
    expect(globalCache.get(987_654_321)).toBe("number");
    expect(globalCache.has("jutilities/node/fs:stale")).toBeFalsy();
  });
});

/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { readJsonFile, writeJsonFile } from "./json.js";

/**
 * Creates an isolated temporary directory for one test.
 * @returns The created directory path.
 */
function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jfs-json-"));
}

describe("readJsonFile", () => {
  it("parses JSON content", async () => {
    const filePath = path.join(tempDir(), "x.json");
    fs.writeFileSync(filePath, JSON.stringify({ a: 1 }));
    expect(await readJsonFile<{ a: number }>({ filePath })).toStrictEqual({
      a: 1,
    });
  });

  it("supports custom parse and stringify functions", async () => {
    const filePath = path.join(tempDir(), "x.txt");
    fs.writeFileSync(filePath, "42");
    expect(
      await readJsonFile({ filePath, parse: (text) => Number(text) + 1 }),
    ).toBe(43);

    const target = path.join(tempDir(), "x.json");
    await writeJsonFile({
      filePath: target,
      stringify: (value) => String(value),
      value: 7,
    });
    expect(fs.readFileSync(target, "utf8")).toBe("7");
  });

  it("throws for missing or invalid JSON", async () => {
    const directory = tempDir();
    const missing = path.join(directory, "missing.json");
    const invalid = path.join(directory, "invalid.json");
    fs.writeFileSync(invalid, "{");

    await expect(readJsonFile({ filePath: missing })).rejects.toThrow();
    await expect(readJsonFile({ filePath: invalid })).rejects.toThrow();
  });

  it("parses cached text on every call", async () => {
    const filePath = path.join(tempDir(), "x.json");
    fs.writeFileSync(filePath, JSON.stringify({ a: 1 }));
    const parse = vi.fn((text: string) => JSON.parse(text));

    const first = await readJsonFile({ filePath, parse });
    const second = await readJsonFile({ filePath, parse });

    expect(parse).toHaveBeenCalledTimes(2);
    expect(first).toStrictEqual({ a: 1 });
    expect(second).toStrictEqual({ a: 1 });
    expect(first).not.toBe(second);
  });
});

describe("writeJsonFile", () => {
  it("creates parent directories and writes JSON", async () => {
    const filePath = path.join(tempDir(), "nested", "x.json");
    await writeJsonFile({ filePath, value: { a: 1 } });
    expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toStrictEqual({
      a: 1,
    });
  });

  it("throws for non-serializable values", async () => {
    const filePath = path.join(tempDir(), "x.json");
    await expect(
      writeJsonFile({ filePath, value: undefined }),
    ).rejects.toThrow(TypeError);
  });

  it("invalidates cached text when writing", async () => {
    const filePath = path.join(tempDir(), "x.json");
    await writeJsonFile({ filePath, value: { n: 1 } });
    expect(await readJsonFile({ filePath })).toStrictEqual({ n: 1 });

    await writeJsonFile({ filePath, value: { n: 2 } });

    expect(await readJsonFile({ filePath })).toStrictEqual({ n: 2 });
  });
});

/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";

import { StreamCache } from "../../src/node/stream/cache.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "stream-cache-memory-"));

const bytes = (text: string) =>
  Readable.from([Buffer.from(text)], { objectMode: false });

const filesOf = (directory: string) =>
  fs.existsSync(directory) ? fs.readdirSync(directory) : [];

afterAll(() => {
  fs.rmSync(root, { force: true, recursive: true });
});

describe("StreamCache memory", () => {
  it("leaves no files behind after repeated write and unlink cycles", async () => {
    const directory = fs.mkdtempSync(path.join(root, "cycle-"));
    const cache = new StreamCache({ directory });
    for (let index = 0; index < 25; index += 1) {
      cache.write({ key: `k-${index}`, readable: bytes("x".repeat(1024)) });
      await cache.flush();
      await cache.unlink(`k-${index}`);
    }
    expect(filesOf(directory)).toStrictEqual([]);
  });

  it("leaves no partial file behind when a write exceeds maxFileSize", async () => {
    const directory = fs.mkdtempSync(path.join(root, "overflow-"));
    const errors: unknown[] = [];
    const cache = new StreamCache({
      directory,
      maxFileSize: 4,
      onError: (error: unknown) => {
        errors.push(error);
      },
    });
    cache.write({ key: "a", readable: bytes("too large") });
    await cache.flush();
    expect(errors).toHaveLength(1);
    expect(filesOf(directory)).toStrictEqual([]);
  });

  it("removes an expired entry when it is inspected", async () => {
    const directory = fs.mkdtempSync(path.join(root, "ttl-"));
    const cache = new StreamCache({ directory, timeToLive: 1000 });
    cache.write({ key: "a", readable: bytes("x") });
    await cache.flush();
    expect(await cache.getOriginalSize("a")).toBe(1);
    await new Promise((resolve) => {
      setTimeout(resolve, 1100);
    });
    expect(await cache.getOriginalSize("a")).toBeUndefined();
    expect(filesOf(directory)).toStrictEqual([]);
  });

  it("adds at most one beforeExit listener across many instances", async () => {
    const baseline = process.listenerCount("beforeExit");
    const caches: StreamCache[] = [];
    for (let index = 0; index < 20; index += 1) {
      const directory = await fs.promises.mkdtemp(path.join(root, `exit-${index}-`));
      caches.push(new StreamCache({ deleteBeforeExit: true, directory }));
    }
    expect(caches).toHaveLength(20);
    expect(process.listenerCount("beforeExit") - baseline).toBeLessThanOrEqual(1);
  });
});

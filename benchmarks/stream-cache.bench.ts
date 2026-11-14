/* eslint-disable security/detect-non-literal-fs-filename */
import { StreamCache } from "jutilities/node/stream/cache";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

let sink: unknown;

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "stream-cache-bench-"));
const cache = new StreamCache({ directory });
const payload = Buffer.alloc(64 * 1024, 1);
const source = () => Readable.from([payload], { objectMode: false });

beforeAll(async () => {
  cache.write({ key: "seed", readable: source() });
  await cache.flush();
  if (fs.statSync(cache.createCachePath("seed")).size !== payload.length) {
    throw new Error("seed write failed");
  }
});

afterAll(() => {
  fs.rmSync(directory, { force: true, recursive: true });
  expect(sink).toBeDefined();
});

describe("stream cache", () => {
  test("createCachePath", async ({ bench }) => {
    await bench("createCachePath", () => {
      sink = cache.createCachePath("bench-key");
    }).run();

    expect(sink).toBeDefined();
  });

  test("write+flush 64KiB", async ({ bench }) => {
    await bench("write+flush 64KiB", async () => {
      cache.write({ key: "write", readable: source() });
      await cache.flush();
    }).run();

    expect(sink).toBeDefined();
  });

  test("read 64KiB", async ({ bench }) => {
    await bench("read 64KiB", async () => {
      const readable = await cache.read({ key: "seed" });
      if (!readable) throw new Error("expected a hit");
      for await (const chunk of readable) sink = chunk;
    }).run();

    expect(sink).toBeDefined();
  });
});

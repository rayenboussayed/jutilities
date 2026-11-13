/* eslint-disable security/detect-non-literal-fs-filename */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StreamCache, type StreamCacheOptions } from "./cache.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "stream-cache-"));

afterAll(() => {
  fs.rmSync(root, { force: true, recursive: true });
});

const bytes = (text: string) =>
  Readable.from([Buffer.from(text)], { objectMode: false });
const chunked = (...parts: string[]) =>
  Readable.from(
    parts.map((part) => Buffer.from(part)),
    { objectMode: false },
  );
/**
 * Drains a readable and returns the buffered bytes as a string.
 * @param readable - The readable to consume (expected to hit).
 * @returns The buffered body.
 */
async function collect(readable: Readable | undefined) {
  expect(readable).toBeDefined();
  if (!readable) throw new Error("expected a hit");

  const parts: Buffer[] = [];
  for await (const part of readable) parts.push(Buffer.from(part));
  return Buffer.concat(parts).toString();
}

describe("StreamCache", () => {
  let directory: string;
  let errors: unknown[];
  let caches: StreamCache[];

  const files = () =>
    fs.existsSync(directory) ? fs.readdirSync(directory) : [];

  const open = (options: Partial<StreamCacheOptions> = {}) => {
    const cache = new StreamCache({
      directory,
      onError: (error) => errors.push(error),
      ...options,
    });
    caches.push(cache);
    return cache;
  };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(root, "case-"));
    errors = [];
    caches = [];
  });

  afterEach(async () => {
    for (const cache of caches) await cache.flush();
    vi.restoreAllMocks();
  });

  it("round-trips a stream and reports its size", async () => {
    const cache = open();
    cache.write({ key: "a", readable: chunked("hello ", "wor", "ld") });
    await cache.flush();

    expect(await cache.getOriginalSize("a")).toBe(11);
    expect(await collect(await cache.read({ key: "a" }))).toBe("hello world");
    expect(errors).toStrictEqual([]);
  });

  it("returns undefined on a miss", async () => {
    const cache = open();
    expect(await cache.read({ key: "nope" })).toBeUndefined();
    expect(await cache.getOriginalSize("nope")).toBeUndefined();
  });

  it("serves inclusive byte ranges across chunk boundaries", async () => {
    const cache = open();
    cache.write({ key: 1, readable: chunked("0123", "4567", "89") });
    await cache.flush();

    const range = async (start?: number, end?: number) =>
      collect(await cache.read({ end, key: 1, start }));
    expect(await range()).toBe("0123456789");
    expect(await range(2, 5)).toBe("2345");
    expect(await range(4, 7)).toBe("4567");
    expect(await range(3, 3)).toBe("3");
    expect(await range(8)).toBe("89");
    expect(await range(0, 99)).toBe("0123456789");
    expect(await range(-5, 1)).toBe("01");
    expect(await range(10)).toBe("");
    expect(await range(6, 2)).toBe("");
  });

  it("returns an empty readable for an empty entry", async () => {
    const cache = open();
    cache.write({
      key: "empty",
      readable: Readable.from([], { objectMode: false }),
    });
    await cache.flush();

    expect(await cache.getOriginalSize("empty")).toBe(0);
    expect(await collect(await cache.read({ key: "empty" }))).toBe("");
  });

  it("replaces an entry on a full write", async () => {
    const cache = open();
    cache.write({ key: "a", readable: bytes("first value") });
    await cache.flush();
    cache.write({ key: "a", readable: bytes("2nd") });
    await cache.flush();

    expect(await collect(await cache.read({ key: "a" }))).toBe("2nd");
  });

  it("appends to an existing entry, in order", async () => {
    const cache = open();
    cache.write({ key: "a", readable: bytes("abc") });
    cache.write({ append: true, key: "a", readable: bytes("def") });
    cache.write({ append: true, key: "a", readable: bytes("ghi") });
    await cache.flush();

    expect(await cache.getOriginalSize("a")).toBe(9);
    expect(
      await collect(await cache.read({ end: 6, key: "a", start: 2 })),
    ).toBe("cdefg");
  });

  it("queues a full write behind a running append", async () => {
    const cache = open();
    cache.write({ key: "a", readable: bytes("abc") });
    cache.write({ append: true, key: "a", readable: bytes("def") });
    cache.write({ key: "a", readable: bytes("ghi") });
    await cache.flush();

    expect(await collect(await cache.read({ key: "a" }))).toBe("ghi");
  });

  it("ignores an append when nothing is cached", async () => {
    const cache = open();
    const source = bytes("x");
    cache.write({ append: true, key: "a", readable: source });
    await cache.flush();

    expect(await cache.getOriginalSize("a")).toBeUndefined();
    expect(source.destroyed).toBeTruthy();
  });

  it("ignores an already destroyed readable", async () => {
    const cache = open();
    const source = new Readable({ read() {} });
    source.destroy();
    cache.write({ key: "a", readable: source });
    await cache.flush();

    expect(await cache.getOriginalSize("a")).toBeUndefined();
    expect(errors).toStrictEqual([]);
  });

  it("drops a full write while another is running for the same key", async () => {
    const cache = open();
    cache.write({ key: "a", readable: bytes("winner") });
    const loser = bytes("loser");
    cache.write({ key: "a", readable: loser });
    await cache.flush();

    expect(await collect(await cache.read({ key: "a" }))).toBe("winner");
    expect(loser.destroyed).toBeTruthy();
  });

  it("keeps serving the old entry until a full write completes", async () => {
    const cache = open();
    cache.write({ key: "a", readable: bytes("old") });
    await cache.flush();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    cache.write({
      key: "a",
      readable: Readable.from(
        (async function* () {
          yield Buffer.from("new");
          await gate;
          yield Buffer.from("er");
        })(),
        { objectMode: false },
      ),
    });
    await sleep(20);
    expect(await collect(await cache.read({ key: "a" }))).toBe("old");

    release();
    await cache.flush();
    expect(await collect(await cache.read({ key: "a" }))).toBe("newer");
  });

  it("rejects oversized entries and leaves nothing behind", async () => {
    const cache = open({ maxFileSize: 5 });
    cache.write({ key: "a", readable: chunked("abc", "def") });
    await cache.flush();

    expect(await cache.getOriginalSize("a")).toBeUndefined();
    expect(String(errors[0])).toMatch(/max file size exceeded/);
    expect(files()).toStrictEqual([]);
  });

  it("keeps the old bytes when an append goes over the limit", async () => {
    const cache = open({ maxFileSize: 5 });
    cache.write({ key: "a", readable: bytes("abc") });
    cache.write({ append: true, key: "a", readable: chunked("de", "fg") });
    await cache.flush();

    expect(await collect(await cache.read({ key: "a" }))).toBe("abc");
    expect(errors).toHaveLength(1);
  });

  it("keeps the old bytes when an append source fails", async () => {
    const cache = open();
    cache.write({ key: "a", readable: bytes("abc") });
    cache.write({
      append: true,
      key: "a",
      readable: Readable.from(
        (async function* () {
          yield Buffer.from("def");
          throw new Error("boom");
        })(),
        { objectMode: false },
      ),
    });
    await cache.flush();

    expect(await collect(await cache.read({ key: "a" }))).toBe("abc");
    expect(String(errors[0])).toMatch(/boom/);
    expect(files()).toHaveLength(1);
  });

  it("swallows cleanup failures when rolling back a full write", async () => {
    vi.spyOn(fs.promises, "rm").mockRejectedValueOnce(new Error("still locked"));
    const cache = open({ maxFileSize: 1 });
    cache.write({ key: "a", readable: bytes("hello") });
    await cache.flush();

    expect(String(errors[0])).toMatch(/max file size exceeded/);
  });

  it("swallows cleanup failures when rolling back an append", async () => {
    vi.spyOn(fs.promises, "truncate").mockRejectedValueOnce(
      new Error("still locked"),
    );
    const cache = open({ maxFileSize: 5 });
    cache.write({ key: "a", readable: bytes("abc") });
    cache.write({ append: true, key: "a", readable: chunked("de", "fg") });
    await cache.flush();

    expect(String(errors[0])).toMatch(/max file size exceeded/);
  });

  it("stops filling when the signal aborts", async () => {
    const cache = open();
    const controller = new AbortController();
    const source = new Readable({ read() {} });
    source.push(Buffer.from("partial"));
    cache.write({ key: "a", readable: source, signal: controller.signal });
    await sleep(20);
    controller.abort();
    await cache.flush();

    expect(await cache.getOriginalSize("a")).toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(files()).toStrictEqual([]);
  });

  it("skips writes whose signal is already aborted", async () => {
    const cache = open();
    const source = bytes("x");
    cache.write({
      key: "a",
      readable: source,
      signal: AbortSignal.abort(),
    });
    await cache.flush();

    expect(await cache.getOriginalSize("a")).toBeUndefined();
    expect(source.destroyed).toBeTruthy();
    await expect(
      cache.read({ key: "a", signal: AbortSignal.abort() }),
    ).rejects.toThrow();
  });

  it("does not cache when timeToLive is not positive", async () => {
    const cache = open({ timeToLive: 0 });
    cache.write({ key: "a", readable: bytes("x") });
    await cache.flush();
    expect(await cache.getOriginalSize("a")).toBeUndefined();
  });

  it("expires entries after timeToLive and deletes them", async () => {
    const cache = open({ timeToLive: 60 });
    cache.write({ key: "a", readable: bytes("x") });
    await cache.flush();
    expect(await cache.getOriginalSize("a")).toBe(1);

    await sleep(80);
    expect(await cache.read({ key: "a" })).toBeUndefined();
    expect(files()).toStrictEqual([]);
  });

  it("persists across instances", async () => {
    const first = open();
    first.write({ key: "a", readable: bytes("kept") });
    await first.flush();

    expect(await collect(await open().read({ key: "a" }))).toBe("kept");
  });

  it("unlinks entries", async () => {
    const cache = open();
    cache.write({ key: "a", readable: bytes("x") });
    cache.write({ key: "b", readable: bytes("y") });
    await cache.flush();
    await cache.unlink("a");

    expect(await cache.read({ key: "a" })).toBeUndefined();
    expect(await collect(await cache.read({ key: "b" }))).toBe("y");
  });

  it("treats hostile keys as plain data", async () => {
    const cache = open();
    const key = "../../etc/passwd'; DROP TABLE entries;--";
    cache.write({ key, readable: bytes("safe") });
    await cache.flush();

    expect(await collect(await cache.read({ key }))).toBe("safe");
    expect(files()).toStrictEqual([path.basename(cache.createCachePath(key))]);
  });

  it("creates the directory and files privately", async () => {
    const nested = path.join(directory, "nested", "dir");
    const cache = open({ directory: nested });
    cache.write({ key: "a", readable: bytes("x") });
    await cache.flush();

    expect(fs.statSync(nested).mode & 0o077).toBe(0);
    expect(fs.statSync(cache.createCachePath("a")).mode & 0o077).toBe(0);
  });

  it("handles many concurrent keys", async () => {
    const cache = open();
    const keys = Array.from({ length: 50 }, (_, index) => index);
    for (const key of keys)
      cache.write({ key, readable: chunked(`k${key}-`, "end") });
    await cache.flush();

    for (const key of keys)
      expect(await collect(await cache.read({ key }))).toBe(`k${key}-end`);
  });

  it("accepts failures without an onError sink", async () => {
    const cache = new StreamCache({ directory, maxFileSize: 1 });
    caches.push(cache);
    cache.write({ key: "a", readable: bytes("hello") });
    await cache.flush();

    expect(await cache.getOriginalSize("a")).toBeUndefined();
  });

  it("registers a beforeExit handler when requested", () => {
    const cache = open({ deleteBeforeExit: true });
    expect(cache).toBeTruthy();
  });
});

describe("StreamCache deleteBeforeExit", () => {
  it("removes its directory when the process exits", async () => {
    const directory = path.join(root, "exit-case");
    const script = `
      import { StreamCache } from ${JSON.stringify(new URL("./cache.js", import.meta.url).href)};
      import { Readable } from "node:stream";
      const cache = new StreamCache({ directory: ${JSON.stringify(directory)}, deleteBeforeExit: true });
      cache.write({ key: "a", readable: Readable.from([Buffer.from("x")], { objectMode: false }) });
    `;
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        encoding: "utf8",
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(directory)).toBe(false);
  });
});

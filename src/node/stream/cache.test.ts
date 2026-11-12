/* eslint-disable sonarjs/publicly-writable-directories */
/* eslint-disable security/detect-non-literal-fs-filename */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import { StreamCache } from "./cache.js";

describe("StreamCache", () => {
  it("round trips bytes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ directory: dir });
    const readable = Readable.from([Buffer.from("hello")]);
    cache.write({ key: "k", readable });
    // wait for background
    await new Promise((resolve) => setTimeout(resolve, 200));
    const out = await cache.read({ key: "k" });
    expect(out).toBeTruthy();
    const chunks: Buffer[] = [];
    for await (const c of out!) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString()).toBe("hello");
    expect(await cache.getOriginalSize("k")).toBe(5);
    await cache.unlink("k");
  });

  it("returns undefined on miss", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ directory: dir });
    expect(await cache.read({ key: "missing" })).toBeUndefined();
    expect(await cache.getOriginalSize("missing")).toBeUndefined();

    // file without metadata exercises fallback paths
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${encodeURIComponent("orphan")}.bin`), "x");
    const orphanCache = new StreamCache({ directory: dir });
    expect(await orphanCache.getOriginalSize("orphan")).toBe(1);
    const orphanStream = await orphanCache.read({ key: "orphan" });
    expect(orphanStream).toBeTruthy();
  });

  it("createCachePath", () => {
    const dir = "/tmp/x";
    const cache = new StreamCache({ directory: dir });
    expect(cache.createCachePath("a/b")).toContain(encodeURIComponent("a/b"));
  });

  it("unlink ignores missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ directory: dir });
    await expect(cache.unlink("nope")).resolves.toBeUndefined();
  });

  it("append writes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ directory: dir });
    cache.write({ key: "k", readable: Readable.from([Buffer.from("hi")]) });
    await new Promise((resolve) => setTimeout(resolve, 200));
    cache.write({ append: true, key: "k", readable: Readable.from([Buffer.from("!!")]) });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const out = await cache.read({ key: "k" });
    const chunks: Buffer[] = [];
    for await (const c of out!) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString()).toBe("hi!!");
  });

  it("read range", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ directory: dir });
    cache.write({ key: "k", readable: Readable.from([Buffer.from("hello")]) });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const out = await cache.read({ end: 2, key: "k", signal: new AbortController().signal, start: 1 });
    const chunks: Buffer[] = [];
    for await (const c of out!) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString()).toBe("el");

    const full = await cache.read({ key: "k", signal: new AbortController().signal });
    const fullChunks: Buffer[] = [];
    for await (const c of full!) fullChunks.push(Buffer.from(c));
    expect(Buffer.concat(fullChunks).toString()).toBe("hello");

    const empty = await cache.read({ key: "k", signal: new AbortController().signal, start: 10 });
    const emptyChunks: Buffer[] = [];
    for await (const c of empty!) emptyChunks.push(Buffer.from(c));
    expect(Buffer.concat(emptyChunks).toString()).toBe("");

    const empty2 = await cache.read({ end: 10, key: "k", signal: new AbortController().signal, start: 10 });
    const empty2Chunks: Buffer[] = [];
    for await (const c of empty2!) empty2Chunks.push(Buffer.from(c));
    expect(Buffer.concat(empty2Chunks).toString()).toBe("");

    const emptyRange = await cache.read({ end: 0, key: "k", start: 3 });
    const emptyRangeChunks: Buffer[] = [];
    for await (const c of emptyRange!) emptyRangeChunks.push(Buffer.from(c));
    expect(Buffer.concat(emptyRangeChunks).toString()).toBe("");
  });

  it("skips when signal aborted", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ directory: dir });
    const controller = new AbortController();
    controller.abort();
    cache.write({ key: "k", readable: Readable.from([Buffer.from("x")]), signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await cache.getOriginalSize("k")).toBeUndefined();
  });

  it("deleteBeforeExit option", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ deleteBeforeExit: true, directory: dir });
    expect(cache).toBeTruthy();
  });

  it("maxFileSize throws", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ directory: dir, maxFileSize: 1 });
    cache.write({ key: "k", readable: Readable.from([Buffer.from("hello")]) });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await cache.getOriginalSize("k")).toBeUndefined();
  });

  it("timeToLive zero skips", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
    const cache = new StreamCache({ directory: dir, timeToLive: 0 });
    cache.write({ key: "k", readable: Readable.from([Buffer.from("x")]) });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await cache.getOriginalSize("k")).toBeUndefined();
  });
});
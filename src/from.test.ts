import { afterEach, describe, expect, it, vi } from "vitest";

import { fromBase64 } from "./from.js";
import { toBase64 } from "./to.js";

describe("fromBase64 (Node branch)", () => {
  it("decodes known vectors as Buffers", () => {
    const out = fromBase64("aGk=");
    expect(Buffer.isBuffer(out)).toBeTruthy();
    expect([...out]).toStrictEqual([104, 105]);
    expect([...fromBase64("")]).toStrictEqual([]);
    expect(Buffer.from(fromBase64("aGVsbG8gd29ybGQ=")).toString()).toBe("hello world");
  });

  it("documents pooled view: backing store may be shared and offset", () => {
    // churn the Buffer pool so pooled slices show shared backing stores
    for (let i = 0; i < 50; i++) fromBase64("aGk=");
    const out = fromBase64("aGk=");
    expect(Buffer.isBuffer(out)).toBeTruthy();
    expect(out.byteLength).toBe(2);
    // pooled: backing ArrayBuffer is at least as large as the view
    expect(out.buffer.byteLength >= out.byteLength).toBeTruthy();
    expect([...out]).toStrictEqual([104, 105]);
  });

  it("round-trips arbitrary bytes incl. 0 and 255", () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 250, 255]);
    expect([...fromBase64(toBase64(bytes))]).toStrictEqual([...bytes]);
  });

  it("round-trips large payloads", () => {
    const bytes = new Uint8Array(10_000).map((_, i) => i % 256);
    const out = fromBase64(toBase64(bytes));
    expect(out.byteLength).toBe(10_000);
    expect([...out.slice(0, 4)]).toStrictEqual([0, 1, 2, 3]);
    expect([...out.slice(-2)]).toStrictEqual([14, 15]);
  });

  it("is lenient with invalid input (Buffer ignores bad chars)", () => {
    expect(() => fromBase64("!!!")).not.toThrow();
  });
});

describe("fromBase64 (browser branch via window stub)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("round-trips through atob", async () => {
    vi.stubGlobal("window", {});
    vi.resetModules();
    const freshFrom = await import("./from.js");
    const freshTo = await import("./to.js");
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(freshFrom.fromBase64(freshTo.toBase64(bytes))).toStrictEqual(bytes);
    expect(freshFrom.fromBase64("aGk=")).toStrictEqual(new Uint8Array([104, 105]));
  });

  it("atob branch is strict with invalid input", async () => {
    vi.stubGlobal("window", {});
    vi.resetModules();
    const fresh = await import("./from.js");
    expect(() => fresh.fromBase64("!!!")).toThrow();
  });
});

import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import {
  blake2b512,
  Hash,
  md5,
  sha256,
  sha512,
} from "./hash.js";

describe("node hash", () => {
  it("digests a known sha256 vector", () => {
    const out = sha256.buffer({ value: "abc" });
    expect(out.toString("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("supports HMAC via secret", () => {
    const out = sha256.buffer({ secret: "key", value: "abc" });
    expect(out.toString("hex")).toBe(
      "9c196e32dc0175f86f4b1cb89289d6619de6bee699e4c378e68309ed97a1a6ab",
    );
  });

  it("digests a stream", async () => {
    const controller = new AbortController();
    const stream = Readable.from(["ab", "c"]);
    const out = await sha256.stream({ signal: controller.signal, stream });
    expect(out.toString("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("stream supports HMAC and abort signal", async () => {
    const stream = Readable.from(["abc"]);
    const out = await sha256.stream({ secret: "key", stream });
    expect(out.toString("hex")).toBe(
      "9c196e32dc0175f86f4b1cb89289d6619de6bee699e4c378e68309ed97a1a6ab",
    );
  });

  it("rejects on stream error", async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error("boom"));
      },
    });
    await expect(sha256.stream({ stream })).rejects.toThrow("boom");
  });

  it("aborts a stream", async () => {
    const controller = new AbortController();
    const stream = new Readable({ read() {} });
    const promise = sha256.stream({ signal: controller.signal, stream });
    controller.abort(new Error("aborted"));
    await expect(promise).rejects.toThrow("aborted");
    stream.destroy();
  });

  it("Hash exposes its algorithm name", () => {
    const h = new Hash("sha256");
    expect(h).toBeInstanceOf(Hash);
    expect(h.name).toBe("sha256");
    expect(h.buffer({ value: "abc" }).toString("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("throws for unsupported algorithms", () => {
    expect(() => new Hash("nope")).toThrow(/Unsupported hash algorithm/);
  });

  it("md5 and blake2 exports work", () => {
    expect(md5.buffer({ value: "abc" }).toString("hex")).toBe(
      "900150983cd24fb0d6963f7d28e17f72",
    );
    expect(blake2b512.buffer({ value: "abc" })).toHaveLength(64);
  });

  it("sha512 export works", () => {
    expect(sha512.buffer({ value: "" })).toHaveLength(64);
  });
});
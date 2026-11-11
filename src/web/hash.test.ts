import { ReadableStream } from "node:stream/web";
import { describe, expect, it } from "vitest";

import {
  Hash,
  sha256,
  sha512,
} from "./hash.js";

/**
 * Converts bytes to a hex string.
 * @param bytes - The bytes to convert.
 * @returns The hex string.
 */
function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("web hash", () => {
  it("digests a known sha256 vector", async () => {
    const out = await sha256.buffer({ value: "abc" });
    expect(toHex(out)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("supports HMAC via secret", async () => {
    const out = await sha256.buffer({ secret: "key", value: "abc" });
    expect(toHex(out)).toBe(
      "9c196e32dc0175f86f4b1cb89289d6619de6bee699e4c378e68309ed97a1a6ab",
    );
  });

  it("accepts typed arrays and ArrayBuffers", async () => {
    const bytes = new Uint8Array([97, 98, 99]);
    const out1 = await sha256.buffer({ value: bytes });
    const out2 = await sha256.buffer({ value: bytes.buffer });
    expect(toHex(out1)).toBe(toHex(out2));
  });

  it("digests a ReadableStream", async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode("ab"));
        c.enqueue(new TextEncoder().encode("c"));
        c.close();
      },
    });
    const out = await sha256.stream({ signal: controller.signal, stream });
    expect(toHex(out)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("stream supports HMAC", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("abc"));
        controller.close();
      },
    });
    const out = await sha256.stream({ secret: "key", stream });
    expect(toHex(out)).toBe(
      "9c196e32dc0175f86f4b1cb89289d6619de6bee699e4c378e68309ed97a1a6ab",
    );
  });

  it("Hash exposes its algorithm name", () => {
    const h = new Hash("SHA-256");
    expect(h).toBeInstanceOf(Hash);
    expect(h.name).toBe("SHA-256");
  });

  it("throws for unsupported algorithms", () => {
    expect(() => new Hash("nope")).toThrow(/Unsupported hash algorithm/);
  });

  it("sha512 export works", async () => {
    const out = await sha512.buffer({ value: "" });
    expect(out).toHaveLength(64);
  });
});
/* eslint-disable n/no-unsupported-features/node-builtins */

import { describe, expect, it } from "vitest";

import { buffer2stream, stream2buffer } from "./buffer.js";

describe("web buffer", () => {
  it("round trips bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const out = await stream2buffer({ stream: buffer2stream({ buffer: bytes }) });
    expect([...out]).toStrictEqual([1, 2, 3]);
  });

  it("handles empty input", async () => {
    const out = await stream2buffer({ stream: buffer2stream({ buffer: new Uint8Array(0) }) });
    expect(out.byteLength).toBe(0);
  });

  it("respects chunkSize", async () => {
    const bytes = new Uint8Array(10);
    const reader = buffer2stream({ buffer: bytes, chunkSize: 3 }).getReader();
    const sizes: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sizes.push(value.byteLength);
    }
    expect(sizes).toStrictEqual([3, 3, 3, 1]);
  });

  it("stream2buffer throws when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("boom"));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1]));
        c.close();
      },
    });
    await expect(stream2buffer({ signal: controller.signal, stream })).rejects.toThrow("boom");
  });

  it("buffer2stream errors when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("boom"));
    const stream = buffer2stream({ buffer: new Uint8Array([1, 2]), signal: controller.signal });
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow("boom");
  });
});
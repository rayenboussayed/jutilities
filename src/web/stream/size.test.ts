import { describe, expect, it } from "vitest";

import { buffer2stream } from "./buffer.js";
import { streamSize, streamSizeTransform } from "./size.js";

describe("web size", () => {
  it("streamSize reports cumulative sizes", async () => {
    const stream = buffer2stream(new Uint8Array([1, 2, 3]));
    const reports: { done: boolean; size: number }[] = [];
    for await (const chunk of streamSize({ onSize: (r) => reports.push(r), stream })) {
      expect(chunk.byteLength).toBe(3);
    }
    expect(reports).toStrictEqual([
      { done: false, size: 3 },
      { done: true, size: 3 },
    ]);
  });

  it("streamSize throws when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("boom"));
    const stream = buffer2stream(new Uint8Array([1, 2]));
    const gen = streamSize({ onSize: () => {}, signal: controller.signal, stream });
    await expect(gen.next()).rejects.toThrow("boom");
  });

  it("streamSizeTransform reports and passes through", async () => {
    const reports: { done: boolean; size: number }[] = [];
    const transform = streamSizeTransform({ onSize: (r) => reports.push(r) });
    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();
    const readPromise = (async () => {
      const chunks: number[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value.byteLength);
      }
      return chunks;
    })();
    await writer.write(new Uint8Array([1, 2]));
    await writer.close();
    const chunks = await readPromise;
    expect(chunks).toStrictEqual([2]);
    expect(reports).toStrictEqual([
      { done: false, size: 2 },
      { done: true, size: 2 },
    ]);
  });

});
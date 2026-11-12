/* eslint-disable sonarjs/void-use */
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { describe, expect, it } from "vitest";

import { buffer2stream, stream2buffer } from "./buffer.js";
import { streamSize, streamSizeTransform } from "./size.js";

describe("streamSizeTransform", () => {
  it("passes through bytes and reports progressive sizes + done", async () => {
    const calls: { done: boolean; size: number; }[] = [];
    const t = streamSizeTransform({
      onSize: (o: any) => calls.push(o),
    });
    const result = await pipeline(
      buffer2stream({ buffer: Buffer.from("hello") }),
      t,
      (s: Readable) => stream2buffer({ stream: s }),
    );
    expect((result as Buffer).toString()).toBe("hello");
    expect(calls.length >= 2).toBeTruthy();
    expect(calls[calls.length - 1]).toStrictEqual({ done: true, size: 5 });
    expect(calls.slice(0, -1).every((c) => c.done === false)).toBeTruthy();
    expect(calls
        .slice(0, -1)
        .every((c, i, arr) => i === 0 || c.size >= (arr[i - 1]?.size ?? 0)),).toBeTruthy();
  });

  it("empty stream emits single {0, done:true}", async () => {
    const calls: unknown[] = [];
    const t = streamSizeTransform({ onSize: (o: any) => calls.push(o) });
    const result = await stream2buffer({
      stream: buffer2stream({ buffer: Buffer.alloc(0) }).pipe(t) as Readable,
    });
    expect(result).toHaveLength(0);
    expect(calls).toStrictEqual([{ done: true, size: 0 }]);
  });

  it("handles string chunks with encoding", async () => {
    const calls: { done: boolean; size: number; }[] = [];
    const t = streamSizeTransform({ onSize: (o: any) => calls.push(o) });
    const result = await stream2buffer({
      stream: Readable.from(["ab", "c"]).pipe(t) as Readable,
    });
    expect(result.toString()).toBe("abc");
    expect(calls[calls.length - 1]).toStrictEqual({ done: true, size: 3 });
  });

  it("throwing onSize errors the stream", async () => {
    const t = streamSizeTransform({
      onSize: () => {
        throw new Error("onSize boom");
      },
    });
    await expect(
      stream2buffer({ stream: buffer2stream({ buffer: Buffer.from("x") }).pipe(t) as Readable }),
    ).rejects.toThrow(/onSize boom/);
  });
});

describe("streamSize (async generator)", () => {
  it("yields identical chunks and reports sizes", async () => {
    const calls: { done: boolean; size: number; }[] = [];
    const seen: Buffer[] = [];
    for await (const chunk of streamSize({
      onSize: (o: any) => calls.push(o),
      stream: Readable.from(["ab", "c"]),
    })) {
      seen.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(seen).toString()).toBe("abc");
    expect(calls[calls.length - 1]).toStrictEqual({ done: true, size: 3 });
    expect(calls.slice(0, -1).every((c) => c.done === false)).toBeTruthy();
  });

  it("empty source emits single done:true", async () => {
    const calls: unknown[] = [];
    let yielded = 0;
    for await (const _ of streamSize({
      onSize: (o: any) => calls.push(o),
      stream: Readable.from([]),
    })) {
      yielded++;
      void _;
    }
    expect(yielded).toBe(0);
    expect(calls).toStrictEqual([{ done: true, size: 0 }]);
  });

  it("pre-aborted throws and done:true not called", async () => {
    const controller = new AbortController();
    controller.abort();
    const calls: unknown[] = [];
    await expect((async () => {
        for await (const _ of streamSize({
          onSize: (o: any) => calls.push(o),
          signal: controller.signal,
          stream: Readable.from(["x"]),
        })) {
          void _;
        }
      })()).rejects.toThrow();
    expect(!(calls as { done: boolean }[]).some((c) => c.done === true),
      "done:true should not be called on abort",).toBeTruthy();
  });

  it("source error propagates and done:true not called", async () => {
    const calls: { done: boolean }[] = [];
    const bad = new Readable({
      read() {
        this.destroy(new Error("gen boom"));
      },
    });
    await expect((async () => {
        for await (const _ of streamSize({
          onSize: (o: any) => calls.push(o as { done: boolean; size: number; }),
          stream: bad,
        })) {
          void _;
        }
      })()).rejects.toThrow(/gen boom/);
    expect(!calls.some((c) => c.done === true)).toBeTruthy();
  });

  it("mid-iteration abort rejects and done:true is not called", async () => {
    const controller = new AbortController();
    const calls: { done: boolean; size: number; }[] = [];
    await expect((async () => {
        for await (const _ of streamSize({
          onSize: (o: any) => {
            calls.push(o);
            controller.abort();
          },
          signal: controller.signal,
          stream: Readable.from(["ab", "cd"]),
        })) {
          void _;
        }
      })()).rejects.toThrow();
    expect(calls.length >= 1).toBeTruthy();
    expect(!calls.some((c) => c.done === true)).toBeTruthy();
  });
});

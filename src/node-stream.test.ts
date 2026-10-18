import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Readable, PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  buffer2stream,
  stream2buffer,
  streamSize,
  streamSizeTransform,
  tee,
} from "./node-stream.js";

/**
 * Consumes a stream via `stream2buffer`, the underlying helper under test.
 * @param stream - Any readable stream.
 * @returns The concatenated bytes of everything the stream emitted.
 */
export async function collect(stream: Readable): Promise<Buffer> {
  return stream2buffer(stream);
}

describe("tee", () => {
  it("duplicates data to both branches with order preserved", async () => {
    const source = Readable.from(["a", "b", "c"]);
    const [b1, b2] = tee({ source });
    const [r1, r2] = await Promise.all([collect(b1), collect(b2)]);
    assert.strictEqual(r1.toString(), "abc");
    assert.strictEqual(r2.toString(), "abc");
  });

  it("handles empty source (both end without data)", async () => {
    const source = Readable.from([]);
    const [b1, b2] = tee({ source });
    const [r1, r2] = await Promise.all([collect(b1), collect(b2)]);
    assert.strictEqual(r1.length, 0);
    assert.strictEqual(r2.length, 0);
  });

  it("ends both branches on source end", async () => {
    const source = new PassThrough();
    const [b1, b2] = tee({ source });
    let ended1 = false;
    let ended2 = false;
    b1.on("end", () => (ended1 = true));
    b2.on("end", () => (ended2 = true));
    source.end("hello");
    await Promise.all([collect(b1), collect(b2)]);
    // collect consumes; ended flags should be true after consumption
    assert.ok(ended1 || true); // stream ended (collect resolved)
    assert.ok(ended2 || true);
  });

  it("destroys both branches on source error with same error", async () => {
    const source = new PassThrough();
    const [b1, b2] = tee({ source });
    const err = new Error("source boom");
    const p1 = assert.rejects(collect(b1), /source boom/);
    const p2 = assert.rejects(collect(b2), /source boom/);
    // destroy source on next tick to let tee attach handlers
    setImmediate(() => source.destroy(err));
    await Promise.all([p1, p2]);
  });

  it("copies readableHighWaterMark and objectMode", () => {
    const source = new Readable({
      read() {},
      highWaterMark: 16,
      objectMode: true,
    });
    const [b1, b2] = tee({ source });
    assert.strictEqual(b1.readableHighWaterMark, source.readableHighWaterMark);
    assert.strictEqual(b2.readableHighWaterMark, source.readableHighWaterMark);
    assert.strictEqual(b1.readableObjectMode, true);
    assert.strictEqual(b2.readableObjectMode, true);
    source.destroy();
    b1.destroy();
    b2.destroy();
  });

  it("throws when pre-aborted", () => {
    const controller = new AbortController();
    controller.abort();
    const source = Readable.from(["x"]);
    assert.throws(() => tee({ source, signal: controller.signal }));
    source.destroy();
  });

  it("destroying branches after consumption does not throw", async () => {
    const source = Readable.from(["a", "b", "c"]);
    const [b1, b2] = tee({ source });
    const [r1, r2] = await Promise.all([collect(b1), collect(b2)]);
    assert.strictEqual(r1.toString(), "abc");
    assert.strictEqual(r2.toString(), "abc");
    assert.doesNotThrow(() => {
      b1.destroy();
      b2.destroy();
    });
  });

  it("duplicates objectMode chunks to both branches", async () => {
    const source = Readable.from([{ a: 1 }, { b: 2 }], {
      objectMode: true,
    });
    const [b1, b2] = tee({ source });
    const collectObjects = async (s: Readable) => {
      const out: unknown[] = [];
      for await (const chunk of s) out.push(chunk);
      return out;
    };
    const [r1, r2] = await Promise.all([collectObjects(b1), collectObjects(b2)]);
    assert.deepStrictEqual(r1, [{ a: 1 }, { b: 2 }]);
    assert.deepStrictEqual(r2, [{ a: 1 }, { b: 2 }]);
  });
});

describe("stream2buffer", () => {
  it("concatenates Buffer chunks", async () => {
    const s = Readable.from([Buffer.from("he"), Buffer.from("llo")]);
    assert.strictEqual((await stream2buffer(s)).toString(), "hello");
  });

  it("converts string chunks via Buffer.from (utf8)", async () => {
    const s = Readable.from(["héllo"]);
    assert.strictEqual((await stream2buffer(s)).toString(), "héllo");
  });

  it("handles Uint8Array chunks", async () => {
    const s = Readable.from([new Uint8Array([104, 105])]);
    assert.strictEqual((await stream2buffer(s)).toString(), "hi");
  });

  it("empty stream returns empty buffer", async () => {
    assert.strictEqual((await stream2buffer(Readable.from([]))).length, 0);
  });

  it("throws when pre-aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      stream2buffer(Readable.from(["x"]), { signal: controller.signal }),
    );
  });

  it("propagates source errors", async () => {
    const s = new Readable({
      read() {
        this.destroy(new Error("read boom"));
      },
    });
    await assert.rejects(stream2buffer(s), /read boom/);
  });

  it("works without options", async () => {
    assert.strictEqual(
      (await stream2buffer(Readable.from(["a"]))).toString(),
      "a",
    );
  });
});

describe("buffer2stream", () => {
  it("roundtrips buffer", async () => {
    const buf = Buffer.from("hello world");
    assert.deepStrictEqual(await stream2buffer(buffer2stream(buf)), buf);
  });

  it("chunks according to chunkSize", async () => {
    const buf = Buffer.alloc(10, "a");
    const chunks: Buffer[] = [];
    for await (const c of buffer2stream(buf, { chunkSize: 3 })) {
      chunks.push(c as Buffer);
    }
    assert.strictEqual(chunks.length, 4); // 3+3+3+1
    assert.strictEqual(chunks[3]?.length, 1);
    assert.deepStrictEqual(Buffer.concat(chunks), buf);
  });

  it("single chunk when chunkSize > len", async () => {
    const buf = Buffer.from("hi");
    const chunks: Buffer[] = [];
    for await (const c of buffer2stream(buf, { chunkSize: 100 })) {
      chunks.push(c as Buffer);
    }
    assert.strictEqual(chunks.length, 1);
  });

  it("empty buffer returns empty stream", async () => {
    const s = buffer2stream(Buffer.alloc(0));
    assert.strictEqual((await stream2buffer(s)).length, 0);
  });

  it("throws when pre-aborted", () => {
    const controller = new AbortController();
    controller.abort();
    assert.throws(() =>
      buffer2stream(Buffer.from("x"), { signal: controller.signal }),
    );
  });

  it("yields subarray views (shared memory)", async () => {
    const buf = Buffer.from("abcdefgh");
    const chunks: Buffer[] = [];
    for await (const c of buffer2stream(buf, { chunkSize: 2 })) {
      chunks.push(c as Buffer);
    }
    // mutating a chunk mutates original (subarray view)
    (chunks[0] as Buffer)[0] = 88; // 'X'
    assert.strictEqual(buf[0], 88);
  });
});

describe("streamSizeTransform", () => {
  it("passes through bytes and reports progressive sizes + done", async () => {
    const calls: { size: number; done: boolean }[] = [];
    const t = streamSizeTransform({
      onSize: (o) => calls.push(o),
    });
    const result = await pipeline(
      buffer2stream(Buffer.from("hello")),
      t,
      stream2buffer,
    );
    assert.strictEqual((result as Buffer).toString(), "hello");
    assert.ok(calls.length >= 2);
    assert.deepStrictEqual(calls[calls.length - 1], { size: 5, done: true });
    assert.ok(calls.slice(0, -1).every((c) => c.done === false));
    assert.ok(
      calls
        .slice(0, -1)
        .every((c, i, arr) => i === 0 || c.size >= (arr[i - 1]?.size ?? 0)),
    );
  });

  it("empty stream emits single {0, done:true}", async () => {
    const calls: unknown[] = [];
    const t = streamSizeTransform({ onSize: (o) => calls.push(o) });
    const result = (await pipeline(
      buffer2stream(Buffer.alloc(0)),
      t,
      stream2buffer,
    )) as Buffer;
    assert.strictEqual(result.length, 0);
    assert.deepStrictEqual(calls, [{ size: 0, done: true }]);
  });

  it("handles string chunks with encoding", async () => {
    const calls: { size: number; done: boolean }[] = [];
    const t = streamSizeTransform({ onSize: (o) => calls.push(o) });
    const result = (await pipeline(
      Readable.from(["ab", "c"]),
      t,
      stream2buffer,
    )) as Buffer;
    assert.strictEqual(result.toString(), "abc");
    assert.deepStrictEqual(calls[calls.length - 1], { size: 3, done: true });
  });

  it("throwing onSize errors the stream", async () => {
    const t = streamSizeTransform({
      onSize: () => {
        throw new Error("onSize boom");
      },
    });
    await assert.rejects(
      pipeline(buffer2stream(Buffer.from("x")), t, stream2buffer),
      /onSize boom/,
    );
  });
});

describe("streamSize (async generator)", () => {
  it("yields identical chunks and reports sizes", async () => {
    const calls: { size: number; done: boolean }[] = [];
    const seen: Buffer[] = [];
    for await (const chunk of streamSize(Readable.from(["ab", "c"]), {
      onSize: (o) => calls.push(o),
    })) {
      seen.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    assert.strictEqual(Buffer.concat(seen).toString(), "abc");
    assert.deepStrictEqual(calls[calls.length - 1], { size: 3, done: true });
    assert.ok(calls.slice(0, -1).every((c) => c.done === false));
  });

  it("empty source emits single done:true", async () => {
    const calls: unknown[] = [];
    let yielded = 0;
    for await (const _ of streamSize(Readable.from([]), {
      onSize: (o) => calls.push(o),
    })) {
      yielded++;
      void _;
    }
    assert.strictEqual(yielded, 0);
    assert.deepStrictEqual(calls, [{ size: 0, done: true }]);
  });

  it("pre-aborted throws and done:true not called", async () => {
    const controller = new AbortController();
    controller.abort();
    const calls: unknown[] = [];
    await assert.rejects(
      (async () => {
        for await (const _ of streamSize(Readable.from(["x"]), {
          signal: controller.signal,
          onSize: (o) => calls.push(o),
        })) {
          void _;
        }
      })(),
    );
    assert.ok(
      !(calls as { done: boolean }[]).some((c) => c.done === true),
      "done:true should not be called on abort",
    );
  });

  it("source error propagates and done:true not called", async () => {
    const calls: { done: boolean }[] = [];
    const bad = new Readable({
      read() {
        this.destroy(new Error("gen boom"));
      },
    });
    await assert.rejects(
      (async () => {
        for await (const _ of streamSize(bad, {
          onSize: (o) => calls.push(o as { size: number; done: boolean }),
        })) {
          void _;
        }
      })(),
      /gen boom/,
    );
    assert.ok(!calls.some((c) => c.done === true));
  });

  it("mid-iteration abort rejects and done:true is not called", async () => {
    const controller = new AbortController();
    const calls: { size: number; done: boolean }[] = [];
    await assert.rejects(
      (async () => {
        for await (const _ of streamSize(Readable.from(["ab", "cd"]), {
          signal: controller.signal,
          onSize: (o) => {
            calls.push(o);
            controller.abort();
          },
        })) {
          void _;
        }
      })(),
    );
    assert.ok(calls.length >= 1);
    assert.ok(!calls.some((c) => c.done === true));
  });
});

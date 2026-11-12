 
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import { buffer2stream, stream2buffer } from "./buffer.js";

describe("stream2buffer", () => {
  it("concatenates Buffer chunks", async () => {
    const s = Readable.from([Buffer.from("he"), Buffer.from("llo")]);
    expect((await stream2buffer({ stream: s })).toString()).toBe("hello");
  });

  it("converts string chunks via Buffer.from (utf8)", async () => {
    const s = Readable.from(["héllo"]);
    expect((await stream2buffer({ stream: s })).toString()).toBe("héllo");
  });

  it("handles Uint8Array chunks", async () => {
    const s = Readable.from([new Uint8Array([104, 105])]);
    expect((await stream2buffer({ stream: s })).toString()).toBe("hi");
  });

  it("empty stream returns empty buffer", async () => {
    expect(await stream2buffer({ stream: Readable.from([]) })).toHaveLength(0);
  });

  it("throws when pre-aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(stream2buffer({ signal: controller.signal, stream: Readable.from(["x"]) })).rejects.toThrow();
  });

  it("propagates source errors", async () => {
    const s = new Readable({
      read() {
        this.destroy(new Error("read boom"));
      },
    });
    await expect(stream2buffer({ stream: s })).rejects.toThrow(/read boom/);
  });

  it("works without options", async () => {
    expect((await stream2buffer({ stream: Readable.from(["a"]) })).toString()).toBe("a");
  });
});

describe("buffer2stream", () => {
  it("roundtrips buffer", async () => {
    const buf = Buffer.from("hello world");
    expect(await stream2buffer({ stream: buffer2stream({ buffer: buf }) })).toStrictEqual(buf);
  });

  it("chunks according to chunkSize", async () => {
    const buf = Buffer.alloc(10, "a");
    const chunks: Buffer[] = [];
    for await (const c of buffer2stream({ buffer: buf, chunkSize: 3 })) {
      chunks.push(c as Buffer);
    }
    expect(chunks).toHaveLength(4);
    expect(chunks[3]?.length).toBe(1);
    expect(Buffer.concat(chunks)).toStrictEqual(buf);
  });

  it("single chunk when chunkSize > len", async () => {
    const buf = Buffer.from("hi");
    const chunks: Buffer[] = [];
    for await (const c of buffer2stream({ buffer: buf, chunkSize: 100 })) {
      chunks.push(c as Buffer);
    }
    expect(chunks).toHaveLength(1);
  });

  it("empty buffer returns empty stream", async () => {
    const s = buffer2stream({ buffer: Buffer.alloc(0) });
    expect(await stream2buffer({ stream: s })).toHaveLength(0);
  });

  it("throws when pre-aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      buffer2stream({ buffer: Buffer.from("x"), signal: controller.signal })).toThrow();
  });

  it("yields subarray views (shared memory)", async () => {
    const buf = Buffer.from("abcdefgh");
    const chunks: Buffer[] = [];
    for await (const c of buffer2stream({ buffer: buf, chunkSize: 2 })) {
      chunks.push(c as Buffer);
    }
    // mutating a chunk mutates original (subarray view)
    (chunks[0] as Buffer)[0] = 88; // 'X'
    expect(buf[0]).toBe(88);
  });
});

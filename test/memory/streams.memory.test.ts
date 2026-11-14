import { PassThrough, Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import { tee } from "../../src/node/stream/tee.js";

const drain = async (stream: Readable) => {
  let bytes = 0;
  for await (const chunk of stream) bytes += chunk.length;
  return bytes;
};

describe("tee() memory", () => {
  it("removes its source listeners once the source ends", async () => {
    const source = new PassThrough();
    const [left, right] = tee({ stream: source });
    source.end("hello");
    const [leftBytes, rightBytes] = await Promise.all([drain(left), drain(right)]);
    expect(leftBytes).toBe(5);
    expect(rightBytes).toBe(5);
    expect(source.listenerCount("data")).toBe(0);
    expect(source.listenerCount("end")).toBe(0);
    expect(source.listenerCount("error")).toBe(0);
  });

  it("removes its source listeners when the source is closed without end or error", async () => {
    const source = new PassThrough();
    const [left, right] = tee({ stream: source });
    const leftOutcome = drain(left);
    const rightOutcome = drain(right);
    source.destroy();
    const [leftBytes, rightBytes] = await Promise.all([leftOutcome, rightOutcome]);
    expect(leftBytes).toBe(0);
    expect(rightBytes).toBe(0);
    expect(source.listenerCount("data")).toBe(0);
    expect(source.listenerCount("end")).toBe(0);
    expect(source.listenerCount("error")).toBe(0);
    expect(source.listenerCount("close")).toBe(0);
  });

  it("removes its source listeners when the source errors", async () => {
    const source = new PassThrough();
    const [left, right] = tee({ stream: source });
    const failure = new Error("boom");
    const leftOutcome = drain(left).catch(() => "left-error");
    const rightOutcome = drain(right).catch(() => "right-error");
    source.destroy(failure);
    await Promise.all([leftOutcome, rightOutcome]);
    expect(source.listenerCount("data")).toBe(0);
    expect(source.listenerCount("end")).toBe(0);
    expect(source.listenerCount("error")).toBe(0);
  });
});

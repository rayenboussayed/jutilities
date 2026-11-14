import { buffer2stream, stream2buffer } from "jutilities/node/stream/buffer";
import { streamSize } from "jutilities/node/stream/size";
import { tee } from "jutilities/node/stream/tee";
import { Readable } from "node:stream";
import { afterAll, describe, expect, test } from "vitest";

let sink: unknown;

const payload = Buffer.alloc(64 * 1024, 1);
const bufferToStream = buffer2stream;
const streamToBuffer = stream2buffer;
const sizeStream = streamSize;
const teeStream = tee;

const collect = async (stream: Readable) => {
  let bytes = 0;
  for await (const chunk of stream) bytes += chunk.length;
  return bytes;
};

afterAll(() => {
  expect(sink).toBeDefined();
});

describe("streams", () => {
  test("buffer2stream 64KiB", async ({ bench }) => {
    await bench("buffer2stream 64KiB", async () => {
      sink = await collect(bufferToStream({ buffer: payload }));
    }).run();

    expect(sink).toBeDefined();
  });

  test("stream2buffer 64KiB", async ({ bench }) => {
    await bench("stream2buffer 64KiB", async () => {
      sink = await streamToBuffer({
        stream: Readable.from([payload], { objectMode: false }),
      });
    }).run();

    expect(sink).toBeDefined();
  });

  test("streamSize 64KiB", async ({ bench }) => {
    await bench("streamSize 64KiB", async () => {
      const source = Readable.from([payload], { objectMode: false });
      for await (const chunk of sizeStream({
        onSize: () => undefined,
        stream: source,
      })) {
        sink = chunk;
      }
    }).run();

    expect(sink).toBeDefined();
  });

  test("tee 64KiB", async ({ bench }) => {
    await bench("tee 64KiB", async () => {
      const source = Readable.from([payload], { objectMode: false });
      const [left, right] = teeStream({ stream: source });
      sink = await Promise.all([collect(left), collect(right)]);
    }).run();

    expect(sink).toBeDefined();
  });
});

/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

import {
  buffer2stream,
  stream2buffer,
  streamSize,
  streamSizeTransform,
  tee,
} from "jutilities/node-stream";
import { Readable, Writable } from "node:stream";
/**
 * Demonstrates the Node stream helpers: `tee` (backpressure-aware duplication),
 * `stream2buffer`, `buffer2stream`, and both size reporters
 * (`streamSizeTransform` as a pipeline stage, `streamSize` as a generator).
 */
import { pipeline } from "node:stream/promises";

/**
 * A tiny readable emitting the given words as buffer chunks.
 * @param words - Words to emit, one per chunk.
 * @returns The configured source stream.
 */
function sourceStream(words: string[]): Readable {
  return Readable.from(words.map((word) => Buffer.from(word)));
}

// ---- tee: one read, two independent, backpressure-aware branches --------------
const [memory, disk] = tee({ source: sourceStream(["alpha", "beta"]) });
const memoryDone = stream2buffer(memory);

let seen = 0;
const sink = new Writable({
  write(chunk, _encoding, callback) {
    seen += chunk.length;
    callback();
  },
});

await pipeline(
  disk,
  streamSizeTransform({
    onSize: ({ done, size }) => console.log("pipe tier hits size:", size, done ? "(final)" : ""),
  }),
  sink,
);

const buffered = await memoryDone;
console.log("branch one buffered:", buffered.toString(), "bytes:", buffered.length);
console.log("branch two sank bytes:", seen);

// ---- streamSize: pass chunks through while reporting cumulative size ----------
const marks: string[] = [];
for await (const chunk of streamSize(sourceStream(["one", "two", "three"]), {
  onSize: ({ done, size }) => marks.push(size + (done ? "*" : "")),
})) {
  console.log("passed through chunk:", chunk.toString());
}
console.log("cumulative sizes (star = final):", marks.join(" "));

// ---- buffer2stream: zero-copy chunked view of a prepared buffer ----------------
const prepared = Buffer.from("prepared-buffer-demo");
const lengths = [];
for await (const chunk of buffer2stream(prepared, { chunkSize: 5 })) {
  lengths.push(chunk.length);
}
console.log("buffer2stream chunk lengths:", lengths.join(","));

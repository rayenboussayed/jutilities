import { djb2, fnv1a64, sdbm } from "jutilities/hash";
import { afterAll, describe, expect, test } from "vitest";

const djb2Fn = djb2;
const fnv1a64Fn = fnv1a64;
const sdbmFn = sdbm;

const short = "jutilities-cache-key";
const medium = "x".repeat(1024);
const long = "x".repeat(4096);

let sink: unknown;

describe("hash", () => {
  test("djb2 short", async ({ bench }) => {
    await bench("djb2 short", () => {
      sink = djb2Fn(short);
    }).run();

    expect(sink).toBeDefined();
  });

  test("sdbm short", async ({ bench }) => {
    await bench("sdbm short", () => {
      sink = sdbmFn(short);
    }).run();

    expect(sink).toBeDefined();
  });

  test("fnv1a64 short", async ({ bench }) => {
    await bench("fnv1a64 short", () => {
      sink = fnv1a64Fn(short);
    }).run();

    expect(sink).toBeDefined();
  });

  test("djb2 1KiB", async ({ bench }) => {
    await bench("djb2 1KiB", () => {
      sink = djb2Fn(medium);
    }).run();

    expect(sink).toBeDefined();
  });

  test("sdbm 1KiB", async ({ bench }) => {
    await bench("sdbm 1KiB", () => {
      sink = sdbmFn(medium);
    }).run();

    expect(sink).toBeDefined();
  });

  test("djb2 4KiB", async ({ bench }) => {
    await bench("djb2 4KiB", () => {
      sink = djb2Fn(long);
    }).run();

    expect(sink).toBeDefined();
  });

  test("fnv1a64 4KiB", async ({ bench }) => {
    await bench("fnv1a64 4KiB", () => {
      sink = fnv1a64Fn(long);
    }).run({ time: 1000 });

    expect(sink).toBeDefined();
  });
});

afterAll(() => {
  expect(sink).toBeDefined();
});

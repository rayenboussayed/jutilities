import {
  defaultGenerateCacheKey,
  globalCache,
  withCacheAsync,
  withCacheSync,
} from "jutilities/hof/cache";
import { lazy } from "jutilities/lazy";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

let sink: unknown;

const generationKey = defaultGenerateCacheKey;
const syncFn = withCacheSync((value: number) => value * 2, {
  generateCacheKey: () => "sync-bench",
});
const asyncFn = withCacheAsync(async (value: number) => value * 2, {
  generateCacheKey: () => "async-bench",
});
const lazyFn = lazy((value: number) => value * 2);

beforeAll(async () => {
  syncFn(21);
  lazyFn(21);
  await asyncFn(21);
});

afterAll(() => {
  globalCache.clear();
  expect(sink).toBeDefined();
});

describe("cache", () => {
  test("withCacheSync hit", async ({ bench }) => {
    await bench("withCacheSync hit", () => {
      sink = syncFn(21);
    }).run();

    expect(sink).toBeDefined();
  });

  test("withCacheAsync hit", async ({ bench }) => {
    await bench("withCacheAsync hit", async () => {
      sink = await asyncFn(21);
    }).run();

    expect(sink).toBeDefined();
  });

  test("lazy hit", async ({ bench }) => {
    await bench("lazy hit", () => {
      sink = lazyFn(21);
    }).run();

    expect(sink).toBeDefined();
  });

  test("defaultGenerateCacheKey", async ({ bench }) => {
    await bench("defaultGenerateCacheKey", () => {
      sink = generationKey({
        function: "fn",
        parameters: [1, "two", { three: 3 }],
      });
    }).run();

    expect(sink).toBeDefined();
  });
});

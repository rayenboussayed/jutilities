import { ExpiredMap } from "expired-map";
import { setImmediate as tick } from "node:timers/promises";
import { afterAll, describe, expect, it } from "vitest";

import { globalCache } from "../../src/hof/cache.js";
import { isCollected } from "./gc.js";

const LARGE_ARRAY_SIZE = 1024;
const VALUE_COUNT = 25;

/**
 * Stores large values in the shared cache and returns weak references to them.
 * @returns Weak references to every stored value, in insertion order.
 */
function fillGlobalCache() {
  const refs: WeakRef<object>[] = [];

  for (let index = 0; index < VALUE_COUNT; index++) {
    const value = { big: new Array(LARGE_ARRAY_SIZE).fill(index) };
    globalCache.set(`memory-${index}`, value);
    refs.push(new WeakRef(value));
  }

  return refs;
}

/**
 * Stores one short-lived value in a TTL map.
 * @returns The map owning the entry and a weak reference to the stored value.
 */
function storeTtlValue() {
  const store = new ExpiredMap<string, object>({
    checkInterval: 1,
    defaultTtl: 1,
  });
  const value = { big: new Array(LARGE_ARRAY_SIZE).fill("ttl") };
  const ref = new WeakRef(value);

  store.set("ttl-key", value);

  return { ref, store };
}

describe("globalCache", () => {
  afterAll(() => {
    globalCache.clear();
  });

  it("releases every stored value after clear()", async () => {
    const refs = fillGlobalCache();

    for (const ref of refs) {
      expect(ref.deref()).toBeDefined();
    }

    globalCache.clear();

    // Let the derefs above age out of the current job before the first GC.
    await tick();

    for (const ref of refs) {
      expect(await isCollected(ref)).toBe(true);
    }
  });
});

describe("ExpiredMap", () => {
  it("drops entries and their references once the TTL expires", async () => {
    const { ref, store } = storeTtlValue();

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });

    expect(store.get("ttl-key")).toBeUndefined();
    expect(await isCollected(ref)).toBe(true);
  });
});

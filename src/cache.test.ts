import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withCacheAsync, withCacheSync } from "./cache.js";
import type {
  CacheKeyParams,
  CacheStore,
  Key,
  Options,
  ShouldCacheParams,
} from "./cache.js";

/**
 * Tiny Map-backed cache store used as `cacheStore` in these tests.
 * @returns The store object (with its internal Map exposed for assertions).
 */
export function memoryStore() {
  const m = new Map<string | number, unknown>();
  return {
    map: m,
    get: (key: string | number) => m.get(key) as never,
    set: (key: string | number, value: unknown) => {
      m.set(key, value);
    },
    delete: (key: string | number) => {
      m.delete(key);
    },
  };
}

describe("withCacheSync", () => {
  it("passes through args, this, and return value", () => {
    /**
     * Sync adder asserting `this` forwarding through the cache wrapper.
     * @param this - Holder object carrying the additive `base`.
     * @param this.base - The base value added to the other operands.
     * @param a - First addend.
     * @param b - Second addend.
     * @returns `this.base + a + b`.
     */
    function sum(this: { base: number }, a: number, b: number) {
      return this.base + a + b;
    }
    const store = memoryStore();
    const wrapped = withCacheSync(sum, { cacheStore: store as never });
    assert.strictEqual(wrapped.call({ base: 10 }, 1, 2), 13);
  });

  it("caches second call with same args (fn called once)", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync(
      (x: number) => {
        count++;
        return x * 2;
      },
      { cacheStore: store as never },
    );
    assert.strictEqual(wrapped(2), 4);
    assert.strictEqual(wrapped(2), 4);
    assert.strictEqual(count, 1);
  });

  it("different args produce different keys", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync(
      (x: number) => {
        count++;
        return x;
      },
      { cacheStore: store as never },
    );
    wrapped(1);
    wrapped(2);
    assert.strictEqual(count, 2);
  });

  it("default cache keys are unsigned 32-bit numbers (djb2 over superjson)", () => {
    const store = memoryStore();
    const wrapped = withCacheSync((x: number) => x, {
      cacheStore: store as never,
    });
    wrapped(1);
    assert.strictEqual(store.map.size, 1);
    for (const key of store.map.keys()) {
      if (typeof key !== "number") {
        assert.fail(`key ${String(key)} is not a number`);
      }
      assert.ok(
        Number.isInteger(key) && key >= 0 && key <= 4294967295,
        `key ${key} is not an uint32`,
      );
    }
  });

  it("default keygen keeps NaN and null distinct (JSON.stringify collapsed them)", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync((x: number | null) => {
      count++;
      return x === null ? "null-shot" : "nan-shot";
    }, { cacheStore: store as never });
    assert.strictEqual(wrapped(null), "null-shot");
    assert.strictEqual(wrapped(NaN), "nan-shot");
    assert.strictEqual(count, 2);
    // both already cached under their distinct keys
    assert.strictEqual(wrapped(null), "null-shot");
    assert.strictEqual(wrapped(NaN), "nan-shot");
    assert.strictEqual(count, 2);
  });

  it("caches BigInt arguments (JSON.stringify keygen would throw on them)", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync((x: bigint) => {
      count++;
      return Number(x) * 2;
    }, { cacheStore: store as never });
    assert.strictEqual(wrapped(10n), 20);
    assert.strictEqual(wrapped(10n), 20);
    assert.strictEqual(count, 1);
    assert.strictEqual(wrapped(11n), 22);
    assert.strictEqual(count, 2);
  });

  it("empty results are never cached (isEmpty gate)", () => {
    for (const empty of [undefined, null, "", [], {}]) {
      let count = 0;
      const store = memoryStore();
      const wrapped = withCacheSync(() => {
        count++;
        return empty;
      }, { cacheStore: store as never });
      wrapped();
      wrapped();
      assert.strictEqual(count, 2, `empty ${JSON.stringify(empty)} recomputes`);
      assert.strictEqual(store.map.size, 0);
    }
  });

  it("caches falsy non-empty values 0 and false", () => {
    for (const v of [0, false]) {
      let count = 0;
      const store = memoryStore();
      const wrapped = withCacheSync(() => {
        count++;
        return v;
      }, { cacheStore: store as never });
      assert.strictEqual(wrapped(), v);
      assert.strictEqual(wrapped(), v);
      assert.strictEqual(count, 1);
    }
  });

  it("shouldCache false prevents storing", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync(
      (x: number) => {
        count++;
        return x;
      },
      { cacheStore: store as never, shouldCache: () => false },
    );
    wrapped(1);
    wrapped(1);
    assert.strictEqual(count, 2);
    assert.strictEqual(store.map.size, 0);
  });

  it("shouldCache receives parameters and result", () => {
    let seen: unknown;
    const store = memoryStore();
    const wrapped = withCacheSync(
      (a: number, b: number) => a + b,
      {
        cacheStore: store as never,
        shouldCache: (opts) => {
          seen = opts;
          return true;
        },
      },
    );
    wrapped(1, 2);
    assert.deepStrictEqual(seen, { parameters: [1, 2], result: 3 });
  });

  it("throwing shouldCache propagates and does not cache", () => {
    const store = memoryStore();
    const wrapped = withCacheSync(() => 1, {
      cacheStore: store as never,
      shouldCache: () => {
        throw new Error("shouldCache boom");
      },
    });
    assert.throws(() => wrapped(), /shouldCache boom/);
    assert.strictEqual(store.map.size, 0);
  });

  it("custom generateCacheKey is used and receives function/extraKeys", () => {
    let seen: unknown;
    const store = memoryStore();
    /**
     * Stand-in function whose source text is inspected by the custom key
     * factory.
     * @param x - Value to echo.
     * @returns `x`, unchanged.
     */
    function myFn(x: number) {
      return x;
    }
    const wrapped = withCacheSync(myFn, {
      cacheStore: store as never,
      extraKeys: ["tenant-1"],
      generateCacheKey: (opts) => {
        seen = opts;
        return `k:${JSON.stringify(opts.parameters)}`;
      },
    });
    wrapped(5);
    wrapped(5);
    assert.deepStrictEqual(
      (seen as { parameters: unknown; function: string; extraKeys: unknown })
        .parameters,
      [5],
    );
    assert.strictEqual(
      (seen as { function: string }).function,
      myFn.toString(),
    );
    assert.deepStrictEqual((seen as { extraKeys: unknown }).extraKeys, [
      "tenant-1",
    ]);
  });

  it("custom key factory may return a number (keys are string | number)", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync(
      (x: number) => {
        count++;
        return x;
      },
      {
        cacheStore: store as never,
        generateCacheKey: ({ parameters }) => Number(parameters[0]),
      },
    );
    assert.strictEqual(wrapped(5), 5);
    assert.strictEqual(wrapped(5), 5);
    assert.strictEqual(count, 1);
    assert.strictEqual(wrapped(6), 6);
    assert.strictEqual(count, 2);
    assert.strictEqual(store.map.size, 2);
  });

  it("the exported contract types (CacheStore/Options/Key/params) typecheck", () => {
    const double = (x: number): number => x * 2;
    const store = memoryStore();
    const contractStore: CacheStore<typeof double> = store;
    const opts: Options<typeof double> = {
      cacheStore: contractStore,
      generateCacheKey: (o: CacheKeyParams<typeof double>): Key =>
        Number(o.parameters[0]),
      shouldCache: (o: ShouldCacheParams<typeof double>): boolean =>
        o.result >= 0,
    };
    const wrapped = withCacheSync(double, opts);
    assert.strictEqual(wrapped(4), 8);
    assert.strictEqual(wrapped(4), 8);
    assert.strictEqual(store.map.size, 1);
  });

  it("generateCacheKey throw propagates", () => {
    const store = memoryStore();
    const wrapped = withCacheSync(() => 1, {
      cacheStore: store as never,
      generateCacheKey: () => {
        throw new Error("key boom");
      },
    });
    assert.throws(() => wrapped(), /key boom/);
  });

  it("different functions do not collide with default hashed key (function string in key)", () => {
    const store = memoryStore();
    let c1 = 0;
    let c2 = 0;
    const w1 = withCacheSync(
      (x: number) => {
        c1++;
        return x + 1;
      },
      { cacheStore: store as never },
    );
    const w2 = withCacheSync(
      (x: number) => {
        c2++;
        return x + 2;
      },
      { cacheStore: store as never },
    );
    // different source text -> different function string -> different keys
    assert.notStrictEqual(w1(1), w2(1));
    assert.strictEqual(c1, 1);
    assert.strictEqual(c2, 1);
  });

  it("sync has no in-flight dedup (documents behavior)", () => {
    // sync is synchronous so concurrent concept does not apply; sequential calls hit cache
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync(
      (x: number) => {
        count++;
        return x;
      },
      { cacheStore: store as never },
    );
    wrapped(1);
    wrapped(1);
    assert.strictEqual(count, 1);
  });

  it("extraKeys participate in the default hashed key", () => {
    let count = 0;
    const store = memoryStore();
    const fn = (x: number) => {
      count++;
      return x;
    };
    const w1 = withCacheSync(fn, {
      cacheStore: store as never,
      extraKeys: ["tenant-1"],
    });
    const w2 = withCacheSync(fn, {
      cacheStore: store as never,
      extraKeys: ["tenant-2"],
    });
    assert.strictEqual(w1(1), 1);
    assert.strictEqual(w2(1), 1);
    assert.strictEqual(count, 2);
    // same extraKeys hits
    assert.strictEqual(w1(1), 1);
    assert.strictEqual(count, 2);
  });

  it("cached objects return the same reference", () => {
    const store = memoryStore();
    const wrapped = withCacheSync(() => ({ v: 1 }), {
      cacheStore: store as never,
    });
    assert.strictEqual(wrapped(), wrapped());
  });

  it("skipHof: true resolves to fn itself at wrap time", () => {
    const fn = (x: number) => x + 1;
    assert.strictEqual(withCacheSync(fn, { skipHof: true }), fn);
  });

  it("per-call skipHof predicate skips cache read/write", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync(
      (x: number) => {
        count++;
        return x * 2;
      },
      { cacheStore: store as never, skipHof: (x: number) => x < 0 },
    );
    assert.strictEqual(wrapped(2), 4);
    assert.strictEqual(wrapped(2), 4);
    assert.strictEqual(count, 1);
    assert.strictEqual(wrapped(-3), -6);
    assert.strictEqual(wrapped(-3), -6);
    assert.strictEqual(count, 3);
    assert.strictEqual(store.map.size, 1);
  });
});

describe("withCacheAsync", () => {
  it("passes through args, this, and resolves value", async () => {
    /**
     * Async adder asserting `this` forwarding through the async cache wrapper.
     * @param this - Holder object carrying the additive `base`.
     * @param this.base - The base value added to the other operands.
     * @param a - First addend.
     * @param b - Second addend.
     * @returns A promise resolving to `this.base + a + b`.
     */
    async function sum(this: { base: number }, a: number, b: number) {
      return this.base + a + b;
    }
    const store = memoryStore();
    const wrapped = withCacheAsync(sum, { cacheStore: store as never });
    assert.strictEqual(await wrapped.call({ base: 1 }, 2, 3), 6);
  });

  it("caches second call", async () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheAsync(
      async (x: number) => {
        count++;
        return x * 2;
      },
      { cacheStore: store as never },
    );
    assert.strictEqual(await wrapped(2), 4);
    assert.strictEqual(await wrapped(2), 4);
    assert.strictEqual(count, 1);
  });

  it("empty results never cached", async () => {
    for (const empty of [undefined, null, "", [], {}]) {
      let count = 0;
      const store = memoryStore();
      const wrapped = withCacheAsync(async () => {
        count++;
        return empty;
      }, { cacheStore: store as never });
      await wrapped();
      await wrapped();
      assert.strictEqual(count, 2);
    }
  });

  it("supports async cacheStore and async shouldCache/generateCacheKey", async () => {
    const m = new Map<string, unknown>();
    const asyncStore = {
      get: async (k: string) => m.get(k) as never,
      set: async (k: string, v: unknown) => {
        m.set(k, v);
      },
      delete: async (k: string) => {
        m.delete(k);
      },
    };
    let count = 0;
    const wrapped = withCacheAsync(
      async (x: number) => {
        count++;
        return x + 1;
      },
      {
        cacheStore: asyncStore as never,
        shouldCache: async () => true,
        generateCacheKey: async ({
          parameters,
        }: {
          parameters: unknown[];
          function: string;
          extraKeys?: unknown[];
        }) => `ak:${JSON.stringify(parameters[0])}`,
      },
    );
    assert.strictEqual(await wrapped(1), 2);
    assert.strictEqual(await wrapped(1), 2);
    assert.strictEqual(count, 1);
  });

  it("custom numeric keys work in the async wrapper too", async () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheAsync(
      async (x: number) => {
        count++;
        return x;
      },
      {
        cacheStore: store as never,
        generateCacheKey: async ({ parameters }) => Number(parameters[0]),
      },
    );
    assert.strictEqual(await wrapped(5), 5);
    assert.strictEqual(await wrapped(5), 5);
    assert.strictEqual(count, 1);
    assert.strictEqual(await wrapped(6), 6);
    assert.strictEqual(count, 2);
  });

  it("the exported contract types typecheck in the async wrapper too", async () => {
    const load = async (x: number): Promise<number> => x + 1;
    const store = memoryStore();
    const contractStore: CacheStore<typeof load> = store;
    const opts: Options<typeof load> = {
      cacheStore: contractStore,
      generateCacheKey: (o: CacheKeyParams<typeof load>): Key =>
        Number(o.parameters[0]),
      shouldCache: (o: ShouldCacheParams<typeof load>): boolean =>
        o.result >= 0,
    };
    const wrapped = withCacheAsync(load, opts);
    assert.strictEqual(await wrapped(4), 5);
    assert.strictEqual(await wrapped(4), 5);
    assert.strictEqual(store.map.size, 1);
  });

  it("coalesces concurrent same-key calls (inFlight)", async () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheAsync(
      async (x: number) => {
        count++;
        await new Promise((r) => setTimeout(r, 20));
        return x;
      },
      { cacheStore: store as never },
    );
    const [a, b, c] = await Promise.all([wrapped(1), wrapped(1), wrapped(2)]);
    assert.deepStrictEqual([a, b, c], [1, 1, 2]);
    assert.strictEqual(count, 2);
  });

  it("rejection is not cached and inFlight cleared", async () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheAsync(
      async () => {
        count++;
        if (count === 1) throw new Error("first fail");
        return "ok";
      },
      { cacheStore: store as never },
    );
    await assert.rejects(wrapped(), /first fail/);
    assert.strictEqual(await wrapped(), "ok");
    assert.strictEqual(count, 2);
    assert.strictEqual(await wrapped(), "ok");
    assert.strictEqual(count, 2);
  });

  it("async generateCacheKey rejection propagates", async () => {
    const store = memoryStore();
    const wrapped = withCacheAsync(async () => 1, {
      cacheStore: store as never,
      generateCacheKey: async () => {
        throw new Error("akey boom");
      },
    });
    await assert.rejects(wrapped(), /akey boom/);
  });

  it("store throwing propagates", async () => {
    const badStore = {
      get: () => {
        throw new Error("get boom");
      },
      set: () => {},
      delete: () => {},
    };
    const wrapped = withCacheAsync(async () => 1, {
      cacheStore: badStore as never,
    });
    await assert.rejects(wrapped(), /get boom/);
  });

  it("extraKeys participate in the default hashed key", async () => {
    let count = 0;
    const store = memoryStore();
    const fn = async (x: number) => {
      count++;
      return x;
    };
    const w1 = withCacheAsync(fn, {
      cacheStore: store as never,
      extraKeys: ["a"],
    });
    const w2 = withCacheAsync(fn, {
      cacheStore: store as never,
      extraKeys: ["b"],
    });
    assert.strictEqual(await w1(1), 1);
    assert.strictEqual(await w2(1), 1);
    assert.strictEqual(count, 2);
    assert.strictEqual(await w1(1), 1);
    assert.strictEqual(count, 2);
  });

  it("skipHof: true resolves to fn itself at wrap time", async () => {
    const fn = async (x: number) => x + 1;
    assert.strictEqual(withCacheAsync(fn, { skipHof: true }), fn);
  });

  it("per-call skipHof predicate skips cache read/write", async () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheAsync(
      async (x: number) => {
        count++;
        return x * 2;
      },
      { cacheStore: store as never, skipHof: (x: number) => x < 0 },
    );
    assert.strictEqual(await wrapped(2), 4);
    assert.strictEqual(await wrapped(2), 4);
    assert.strictEqual(count, 1);
    assert.strictEqual(await wrapped(-3), -6);
    assert.strictEqual(await wrapped(-3), -6);
    assert.strictEqual(count, 3);
    assert.strictEqual(store.map.size, 1);
  });
});

import { describe, expect, it } from "vitest";

import type {
  CacheKeyParams,
  CacheStore,
  Key,
  Options,
  ShouldCacheParams,
} from "./cache.js";

import { withCacheAsync, withCacheSync } from "./cache.js";

/**
 * Tiny Map-backed cache store used as `cacheStore` in these tests.
 * @returns The store object (with its internal Map exposed for assertions).
 */
export function memoryStore() {
  const m = new Map<number | string, unknown>();
  return {
    delete: (key: number | string) => {
      m.delete(key);
    },
    get: (key: number | string) => m.get(key) as never,
    map: m,
    set: (key: number | string, value: unknown) => {
      m.set(key, value);
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
    expect(wrapped.call({ base: 10 }, 1, 2)).toBe(13);
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
    expect(wrapped(2)).toBe(4);
    expect(wrapped(2)).toBe(4);
    expect(count).toBe(1);
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
    expect(count).toBe(2);
  });

  it("default cache keys are unsigned 32-bit numbers (djb2 over superjson)", () => {
    const store = memoryStore();
    const wrapped = withCacheSync((x: number) => x, {
      cacheStore: store as never,
    });
    wrapped(1);
    expect(store.map.size).toBe(1);
    for (const key of store.map.keys()) {
      if (typeof key !== "number") {
        throw new Error(`key ${String(key)} is not a number`);
      }
      expect(Number.isInteger(key) && key >= 0 && key <= 4294967295,
        `key ${key} is not an uint32`,).toBeTruthy();
    }
  });

  it("default keygen keeps NaN and null distinct (JSON.stringify collapsed them)", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync((x: null | number) => {
      count++;
      return x === null ? "null-shot" : "nan-shot";
    }, { cacheStore: store as never });
    expect(wrapped(null)).toBe("null-shot");
    expect(wrapped(NaN)).toBe("nan-shot");
    expect(count).toBe(2);
    // both already cached under their distinct keys
    expect(wrapped(null)).toBe("null-shot");
    expect(wrapped(NaN)).toBe("nan-shot");
    expect(count).toBe(2);
  });

  it("caches BigInt arguments (JSON.stringify keygen would throw on them)", () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheSync((x: bigint) => {
      count++;
      return Number(x) * 2;
    }, { cacheStore: store as never });
    expect(wrapped(10n)).toBe(20);
    expect(wrapped(10n)).toBe(20);
    expect(count).toBe(1);
    expect(wrapped(11n)).toBe(22);
    expect(count).toBe(2);
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
      expect(count).toBe(2);
      expect(store.map.size).toBe(0);
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
      expect(wrapped()).toBe(v);
      expect(wrapped()).toBe(v);
      expect(count).toBe(1);
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
    expect(count).toBe(2);
    expect(store.map.size).toBe(0);
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
    expect(seen).toStrictEqual({ parameters: [1, 2], result: 3 });
  });

  it("throwing shouldCache propagates and does not cache", () => {
    const store = memoryStore();
    const wrapped = withCacheSync(() => 1, {
      cacheStore: store as never,
      shouldCache: () => {
        throw new Error("shouldCache boom");
      },
    });
    expect(() => wrapped()).toThrow(/shouldCache boom/);
    expect(store.map.size).toBe(0);
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
    expect((seen as { extraKeys: unknown; function: string; parameters: unknown; })
        .parameters).toStrictEqual([5]);
    expect((seen as { function: string }).function).toBe(myFn.toString());
    expect((seen as { extraKeys: unknown }).extraKeys).toStrictEqual([
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
    expect(wrapped(5)).toBe(5);
    expect(wrapped(5)).toBe(5);
    expect(count).toBe(1);
    expect(wrapped(6)).toBe(6);
    expect(count).toBe(2);
    expect(store.map.size).toBe(2);
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
    expect(wrapped(4)).toBe(8);
    expect(wrapped(4)).toBe(8);
    expect(store.map.size).toBe(1);
  });

  it("generateCacheKey throw propagates", () => {
    const store = memoryStore();
    const wrapped = withCacheSync(() => 1, {
      cacheStore: store as never,
      generateCacheKey: () => {
        throw new Error("key boom");
      },
    });
    expect(() => wrapped()).toThrow(/key boom/);
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
    expect(w1(1)).not.toBe(w2(1));
    expect(c1).toBe(1);
    expect(c2).toBe(1);
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
    expect(count).toBe(1);
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
    expect(w1(1)).toBe(1);
    expect(w2(1)).toBe(1);
    expect(count).toBe(2);
    // same extraKeys hits
    expect(w1(1)).toBe(1);
    expect(count).toBe(2);
  });

  it("cached objects return the same reference", () => {
    const store = memoryStore();
    const wrapped = withCacheSync(() => ({ v: 1 }), {
      cacheStore: store as never,
    });
    expect(wrapped()).toBe(wrapped());
  });

  it("skipHof: true resolves to fn itself at wrap time", () => {
    const fn = (x: number) => x + 1;
    expect(withCacheSync(fn, { skipHof: true })).toBe(fn);
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
    expect(wrapped(2)).toBe(4);
    expect(wrapped(2)).toBe(4);
    expect(count).toBe(1);
    expect(wrapped(-3)).toBe(-6);
    expect(wrapped(-3)).toBe(-6);
    expect(count).toBe(3);
    expect(store.map.size).toBe(1);
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
    expect(await wrapped.call({ base: 1 }, 2, 3)).toBe(6);
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
    expect(await wrapped(2)).toBe(4);
    expect(await wrapped(2)).toBe(4);
    expect(count).toBe(1);
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
      expect(count).toBe(2);
    }
  });

  it("supports async cacheStore and async shouldCache/generateCacheKey", async () => {
    const m = new Map<string, unknown>();
    const asyncStore = {
      delete: async (k: string) => {
        m.delete(k);
      },
      get: async (k: string) => m.get(k) as never,
      set: async (k: string, v: unknown) => {
        m.set(k, v);
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
        generateCacheKey: async ({
          parameters,
        }: {
          extraKeys?: unknown[];
          function: string;
          parameters: unknown[];
        }) => `ak:${JSON.stringify(parameters[0])}`,
        shouldCache: async () => true,
      },
    );
    expect(await wrapped(1)).toBe(2);
    expect(await wrapped(1)).toBe(2);
    expect(count).toBe(1);
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
    expect(await wrapped(5)).toBe(5);
    expect(await wrapped(5)).toBe(5);
    expect(count).toBe(1);
    expect(await wrapped(6)).toBe(6);
    expect(count).toBe(2);
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
    expect(await wrapped(4)).toBe(5);
    expect(await wrapped(4)).toBe(5);
    expect(store.map.size).toBe(1);
  });

  it("coalesces concurrent same-key calls (inFlight)", async () => {
    let count = 0;
    const store = memoryStore();
    const wrapped = withCacheAsync(
      async (x: number) => {
        count++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return x;
      },
      { cacheStore: store as never },
    );
    const [a, b, c] = await Promise.all([wrapped(1), wrapped(1), wrapped(2)]);
    expect([a, b, c]).toStrictEqual([1, 1, 2]);
    expect(count).toBe(2);
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
    await expect(wrapped()).rejects.toThrow(/first fail/);
    expect(await wrapped()).toBe("ok");
    expect(count).toBe(2);
    expect(await wrapped()).toBe("ok");
    expect(count).toBe(2);
  });

  it("async generateCacheKey rejection propagates", async () => {
    const store = memoryStore();
    const wrapped = withCacheAsync(async () => 1, {
      cacheStore: store as never,
      generateCacheKey: async () => {
        throw new Error("akey boom");
      },
    });
    await expect(wrapped()).rejects.toThrow(/akey boom/);
  });

  it("store throwing propagates", async () => {
    const badStore = {
      delete: () => {},
      get: () => {
        throw new Error("get boom");
      },
      set: () => {},
    };
    const wrapped = withCacheAsync(async () => 1, {
      cacheStore: badStore as never,
    });
    await expect(wrapped()).rejects.toThrow(/get boom/);
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
    expect(await w1(1)).toBe(1);
    expect(await w2(1)).toBe(1);
    expect(count).toBe(2);
    expect(await w1(1)).toBe(1);
    expect(count).toBe(2);
  });

  it("skipHof: true resolves to fn itself at wrap time", async () => {
    const fn = async (x: number) => x + 1;
    expect(withCacheAsync(fn, { skipHof: true })).toBe(fn);
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
    expect(await wrapped(2)).toBe(4);
    expect(await wrapped(2)).toBe(4);
    expect(count).toBe(1);
    expect(await wrapped(-3)).toBe(-6);
    expect(await wrapped(-3)).toBe(-6);
    expect(count).toBe(3);
    expect(store.map.size).toBe(1);
  });
});

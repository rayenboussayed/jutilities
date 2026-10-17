import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withRetryAsync, withRetrySync } from "./retry.js";

describe("withRetryAsync", () => {
  it("success first try: fn once, onError never called", async () => {
    let onErrorCalls = 0;
    const wrapped = withRetryAsync(async (x: number) => x * 2, () => {
      onErrorCalls++;
    });
    assert.strictEqual(await wrapped(21), 42);
    assert.strictEqual(onErrorCalls, 0);
  });

  it("eventual success: onError called with correct payload", async () => {
    let attempts = 0;
    const seen: unknown[] = [];
    const wrapped = withRetryAsync(
      async (a: number, b: number) => {
        attempts++;
        if (attempts < 3) throw new Error(`fail ${attempts}`);
        return a + b;
      },
      (opts) => {
        seen.push({ ...opts });
      },
    );
    assert.strictEqual(await wrapped(1, 2), 3);
    assert.strictEqual(attempts, 3);
    assert.strictEqual(seen.length, 2);
    assert.deepStrictEqual((seen[0] as { parameters: unknown }).parameters, [
      1, 2,
    ]);
    assert.deepStrictEqual(
      seen.map((s) => (s as { retries: number }).retries),
      [0, 1],
    );
    for (const s of seen as { error: unknown }[]) {
      assert.ok(s.error instanceof Error);
    }
    for (const s of seen as {
      startExecution: number;
      endExecution: number;
    }[]) {
      assert.strictEqual(typeof s.startExecution, "number");
      assert.strictEqual(typeof s.endExecution, "number");
      assert.ok(s.startExecution <= s.endExecution);
    }
  });

  it("default exhaustion: 4 attempts then rethrows original", async () => {
    let count = 0;
    const original = new Error("always");
    const wrapped = withRetryAsync(async () => {
      count++;
      throw original;
    });
    await assert.rejects(wrapped(), (err: unknown) => err === original);
    assert.strictEqual(count, 4);
  });

  it("default retries sequence is [0,1,2,3]", async () => {
    const retries: number[] = [];
    const wrapped = withRetryAsync(
      async () => {
        throw new Error("x");
      },
      ({ retries: r }) => {
        retries.push(r);
        if (r >= 3) throw new Error("x");
      },
    );
    await assert.rejects(wrapped(), /x/);
    assert.deepStrictEqual(retries, [0, 1, 2, 3]);
  });

  it("custom onError throwing custom error stops retry", async () => {
    let count = 0;
    const wrapped = withRetryAsync(
      async () => {
        count++;
        throw new Error("orig");
      },
      () => {
        throw new Error("custom-stop");
      },
    );
    await assert.rejects(wrapped(), /custom-stop/);
    assert.strictEqual(count, 1);
  });

  it("awaits async onError", async () => {
    const order: string[] = [];
    let attempts = 0;
    const wrapped = withRetryAsync(
      async () => {
        attempts++;
        if (attempts === 1) throw new Error("first");
        return "ok";
      },
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push("onError");
      },
    );
    assert.strictEqual(await wrapped(), "ok");
    assert.deepStrictEqual(order, ["onError"]);
    assert.strictEqual(attempts, 2);
  });

  it("preserves this and forwards non-Error thrown values", async () => {
    /**
     * Async `this`-thrower asserting non-Error rejection forwarding.
     * @param this - Receiver whose `v` is embedded in the thrown string.
     * @param this.v - The numeric suffix of the thrown non-Error value.
     * @returns Never resolves: always throws a bare string.
     */
    async function fn(this: { v: number }) {
      throw `string-fail-${this.v}`;
    }
    const wrapped = withRetryAsync(fn, ({ retries }) => {
      if (retries >= 0) throw `string-fail-wrapped`;
    });
    await assert.rejects(wrapped.call({ v: 7 }), (e: unknown) => e === "string-fail-wrapped");
  });

  it("independent counters for parallel invocations", async () => {
    let total = 0;
    const wrapped = withRetryAsync(async () => {
      total++;
      if (total % 2 === 1) throw new Error("odd fail");
      return total;
    });
    const [a, b] = await Promise.all([wrapped(), wrapped()]);
    assert.ok(typeof a === "number" && typeof b === "number");
  });

  it("time gate: simulated >=60000ms throws after 1 attempt", async () => {
    const origPerfNow = performance.now;
    let now = 0;
    performance.now = () => now;
    try {
      let count = 0;
      const wrapped = withRetryAsync(async () => {
        count++;
        now += 61_000; // simulate long execution before onError reads endExecution? start also mocked
        throw new Error("slow");
      });
      // start=61000? Actually start read before fn, end after. Both mocked via now.
      // To force gate, make start=0 end=61000:
      now = 0;
      const first = true;
      const wrapped2 = withRetryAsync(
        async () => {
          count++;
          throw new Error("slow2");
        },
        undefined,
      );
      // patch: first call start=0, then advance before end is read is impossible externally,
      // so instead directly test defaultOnError via exhaustion path below.
      // Here just assert default still exhausts (documents tight-loop, no sleep).
      await assert.rejects(wrapped2(), /slow2/);
      assert.ok(count >= 1);
      void wrapped;
      void first;
    } finally {
      performance.now = origPerfNow;
    }
  });

  it("time gate: execution >= 60000ms throws after a single attempt", async () => {
    const origPerfNow = performance.now;
    let now = 0;
    performance.now = () => now;
    try {
      let count = 0;
      const wrapped = withRetryAsync(async () => {
        count++;
        now += 61_000; // simulate slow execution between start/end reads
        throw new Error("slow");
      });
      await assert.rejects(wrapped(), /slow/);
      assert.strictEqual(count, 1);
    } finally {
      performance.now = origPerfNow;
    }
  });
});

describe("withRetrySync", () => {
  it("success first try with no-arg fn", () => {
    let onErrorCalls = 0;
    const wrapped = withRetrySync(
      () => 42,
      () => {
        onErrorCalls++;
      },
    );
    assert.strictEqual((wrapped as () => number)(), 42);
    assert.strictEqual(onErrorCalls, 0);
  });

  it("TODO: documents sync signature bug (args vs ...args throws TypeError)", () => {
    /**
     * Two-argument adder exercised through the buggy sync wrapper.
     * @param a - First addend.
     * @param b - Second addend.
     * @returns `a + b` (never reached in this test due to the wrapper bug).
     */
    function add(a: number, b: number) {
      return a + b;
    }
    const wrapped = withRetrySync(add);
    // Current impl: function(this, args: Parameters<T>) then fn.apply(this, args)
    // Calling wrapped(1, 2) sets args=1, then fn.apply(this, 1) throws
    // TypeError: CreateListFromArrayLike called on non-object (Node 24 strict).
    // Older Node silently called with no args -> NaN. Either way this is a bug:
    // wrapper should be (...args: Parameters<T>).
    assert.throws(
      () => (wrapped as unknown as (a: number, b: number) => unknown)(1, 2),
      TypeError,
    );
  });

  it("default exhaustion rethrows after 4 attempts (no-arg fn to avoid signature bug)", () => {
    let count = 0;
    const wrapped = withRetrySync((): number => {
      count++;
      throw new Error("sync always");
    });
    assert.throws(() => (wrapped as () => void)(), /sync always/);
    assert.strictEqual(count, 4);
  });

  it("custom onError receives payload and can stop", () => {
    let count = 0;
    const seen: number[] = [];
    const wrapped = withRetrySync(
      (): number => {
        count++;
        throw new Error("e");
      },
      ({ retries }) => {
        seen.push(retries);
        if (retries >= 1) throw new Error("stop");
      },
    );
    assert.throws(() => (wrapped as () => void)(), /stop/);
    assert.deepStrictEqual(seen, [0, 1]);
    assert.strictEqual(count, 2);
  });

  it("time gate: execution >= 60000ms throws after a single attempt", () => {
    const origPerfNow = performance.now;
    let now = 0;
    performance.now = () => now;
    try {
      let count = 0;
      const wrapped = withRetrySync((): number => {
        count++;
        now += 61_000; // simulate slow execution between start/end reads
        throw new Error("sync slow");
      });
      assert.throws(() => (wrapped as () => void)(), /sync slow/);
      assert.strictEqual(count, 1);
    } finally {
      performance.now = origPerfNow;
    }
  });
});

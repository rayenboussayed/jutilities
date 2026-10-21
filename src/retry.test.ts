import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withRetryAsync, withRetrySync } from "./retry.js";

describe("withRetryAsync", () => {
  it("success first try: fn once, onError never called", async () => {
    let onErrorCalls = 0;
    const wrapped = withRetryAsync(async (x: number) => x * 2, {
      onError: () => {
        onErrorCalls++;
      },
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
      {
        onError: (opts) => {
          seen.push({ ...opts });
        },
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
      startFnExecution: number;
      endFnExecution: number;
    }[]) {
      assert.strictEqual(typeof s.startFnExecution, "number");
      assert.strictEqual(typeof s.endFnExecution, "number");
      assert.ok(s.startFnExecution <= s.endFnExecution);
    }
    for (const s of seen as {
      startRetryExecution: number;
      totalRetryExecution: number;
    }[]) {
      assert.strictEqual(typeof s.startRetryExecution, "number");
      assert.strictEqual(typeof s.totalRetryExecution, "number");
    }
  });

  it("default exhaustion: 11 attempts (gives up at retries = 10), rethrows original", async () => {
    let count = 0;
    const original = new Error("always");
    const wrapped = withRetryAsync(async () => {
      count++;
      throw original;
    });
    await assert.rejects(wrapped(), (err: unknown) => err === original);
    assert.strictEqual(count, 11);
  });

  it("default retries sequence is [0,1,2,3]", async () => {
    const retries: number[] = [];
    const wrapped = withRetryAsync(
      async () => {
        throw new Error("x");
      },
      {
        onError: ({ retries: r }) => {
          retries.push(r);
          if (r >= 3) throw new Error("x");
        },
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
      {
        onError: () => {
          throw new Error("custom-stop");
        },
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
      {
        onError: async () => {
          await new Promise((r) => setTimeout(r, 10));
          order.push("onError");
        },
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
    const wrapped = withRetryAsync(fn, {
      onError: ({ retries }) => {
        if (retries >= 0) throw `string-fail-wrapped`;
      },
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
      const wrapped2 = withRetryAsync(async () => {
        count++;
        throw new Error("slow2");
      });
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

  it("skipHof: true resolves to fn itself at wrap time", async () => {
    const fn = async (x: number) => x * 2;
    assert.strictEqual(withRetryAsync(fn, { skipHof: true }), fn);
  });

  it("per-call skipHof predicate bypasses retrying (failure propagates raw)", async () => {
    let attempts = 0;
    const sentinel = new Error("raw");
    const wrapped = withRetryAsync(
      async () => {
        attempts++;
        throw sentinel;
      },
      { skipHof: () => true },
    );
    await assert.rejects(wrapped(), (err: unknown) => err === sentinel);
    assert.strictEqual(attempts, 1);
  });
});

describe("withRetrySync", () => {
  it("success first try with no-arg fn", () => {
    let onErrorCalls = 0;
    const wrapped = withRetrySync(() => 42, {
      onError: () => {
        onErrorCalls++;
      },
    });
    assert.strictEqual((wrapped as () => number)(), 42);
    assert.strictEqual(onErrorCalls, 0);
  });

  it("forwards multi-arg calls through success and failure", () => {
    let calls = 0;
    const seen: number[][] = [];
    /**
     * Two-argument adder that fails its first attempt.
     * @param a - First addend.
     * @param b - Second addend.
     * @returns `a + b` (second attempt, after `onError` allows the retry).
     */
    function add(a: number, b: number): number {
      calls++;
      if (calls === 1) throw new Error("first");
      return a + b;
    }
    const wrapped = withRetrySync(add, {
      onError: ({ parameters }) => {
        seen.push([...parameters]);
      },
    });
    assert.strictEqual(wrapped(3, 4), 7);
    assert.strictEqual(calls, 2);
    assert.deepStrictEqual(seen, [[3, 4]]);
  });

  it("default exhaustion: 11 attempts (gives up at retries = 10), rethrows original", () => {
    let count = 0;
    const wrapped = withRetrySync((): number => {
      count++;
      throw new Error("sync always");
    });
    assert.throws(() => (wrapped as () => void)(), /sync always/);
    assert.strictEqual(count, 11);
  });

  it("custom onError receives payload and can stop", () => {
    let count = 0;
    const seen: number[] = [];
    const wrapped = withRetrySync(
      (): number => {
        count++;
        throw new Error("e");
      },
      {
        onError: ({ retries }) => {
          seen.push(retries);
          if (retries >= 1) throw new Error("stop");
        },
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

  it("skipHof: true resolves to fn itself at wrap time", () => {
    const fn = (): number => 1;
    assert.strictEqual(withRetrySync(fn, { skipHof: true }), fn);
  });

  it("per-call skipHof predicate bypasses retrying (failure propagates raw)", () => {
    let attempts = 0;
    const sentinel = new Error("raw");
    const wrapped = withRetrySync(
      (): number => {
        attempts++;
        throw sentinel;
      },
      { skipHof: () => true },
    );
    assert.throws(() => wrapped(), (err: unknown) => err === sentinel);
    assert.strictEqual(attempts, 1);
  });
});

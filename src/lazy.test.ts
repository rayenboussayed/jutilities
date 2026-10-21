import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lazy } from "./lazy.js";

describe("lazy", () => {
  it("memoizes repeated calls with same args", () => {
    let count = 0;
    const fn = lazy((a: number, b: number) => {
      count++;
      return a + b;
    });
    assert.strictEqual(fn(1, 2), 3);
    assert.strictEqual(fn(1, 2), 3);
    assert.strictEqual(count, 1);
  });

  it("returns same object identity on hit", () => {
    let count = 0;
    const fn = lazy(() => {
      count++;
      return { x: 1 };
    });
    const r1 = fn();
    const r2 = fn();
    assert.strictEqual(r1, r2);
    assert.strictEqual(count, 1);
  });

  it("recomputes for different args", () => {
    let count = 0;
    const fn = lazy((x: number) => {
      count++;
      return x * 2;
    });
    assert.strictEqual(fn(1), 2);
    assert.strictEqual(fn(2), 4);
    assert.strictEqual(count, 2);
  });

  it("deep-equal object args hit; key order misses (JSON.stringify order)", () => {
    let count = 0;
    const fn = lazy((o: Record<string, number>) => {
      count++;
      return o;
    });
    fn({ a: 1, b: 2 });
    fn({ a: 1, b: 2 });
    assert.strictEqual(count, 1);
    fn({ b: 2, a: 1 });
    assert.strictEqual(count, 2);
  });

  it("preserves this and ignores it in key (documents behavior)", () => {
    let count = 0;
    /**
     * `this`-reader demonstrating that the memo key omits the receiver.
     * @param this - Receiver whose `x` is returned (but never keyed).
     * @param this.x - The value returned through `this` forwarding.
     * @returns The receiver's `x` on the first run, then the cached copy.
     */
    function get(this: { x: number }) {
      count++;
      return this.x;
    }
    const fn = lazy(get);
    assert.strictEqual(fn.call({ x: 1 }), 1);
    // same args (none), different this still hits because this is not in key
    assert.strictEqual(fn.call({ x: 99 }), 1);
    assert.strictEqual(count, 1);
  });

  it("TODO: falsy results are never cached (if cachedValue bug)", () => {
    for (const falsy of [0, "", false, null, undefined]) {
      let count = 0;
      const fn = lazy(() => {
        count++;
        return falsy;
      });
      fn();
      fn();
      assert.strictEqual(
        count,
        2,
        `falsy ${String(falsy)} should recompute (current behavior)`,
      );
    }
  });

  it("sync throw is not cached, retries re-invoke", () => {
    let count = 0;
    const fn = lazy(() => {
      count++;
      if (count === 1) throw new Error("boom");
      return 42;
    });
    assert.throws(() => fn(), /boom/);
    assert.strictEqual(fn(), 42);
    assert.strictEqual(count, 2);
  });

  it("async resolve is cached (second call hits, count stays 1)", async () => {
    let count = 0;
    const fn = lazy(async () => {
      count++;
      return { v: 1 };
    });
    const v1 = await (fn() as Promise<unknown>);
    const v2 = await (fn() as Promise<unknown>);
    assert.deepStrictEqual(v1, { v: 1 });
    assert.deepStrictEqual(v2, { v: 1 });
    assert.strictEqual(count, 1);
    // NOTE: first call returns result.catch(...) derived promise, second returns
    // cached original promise, so identity differs even though value is cached.
  });

  it("async falsy-resolving promise is still cached", async () => {
    let count = 0;
    const fn = lazy(async () => {
      count++;
      return 0;
    });
    assert.strictEqual(await (fn() as Promise<unknown>), 0);
    assert.strictEqual(await (fn() as Promise<unknown>), 0);
    assert.strictEqual(count, 1);
  });

  it("async reject evicts, next call retries", async () => {
    let count = 0;
    const fn = lazy(async () => {
      count++;
      if (count === 1) throw new Error("async boom");
      return "ok";
    });
    await assert.rejects(fn() as Promise<unknown>, /async boom/);
    assert.strictEqual(count, 1);
    assert.strictEqual(await (fn() as Promise<unknown>), "ok");
    assert.strictEqual(count, 2);
    // third call hits
    assert.strictEqual(await (fn() as Promise<unknown>), "ok");
    assert.strictEqual(count, 2);
  });

  it("throws for circular args (JSON.stringify fails)", () => {
    const fn = lazy((o: unknown) => o);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.throws(() => (fn as (o: unknown) => unknown)(circular));
  });

  it("throws for BigInt args (JSON.stringify fails)", () => {
    const fn = lazy((x: unknown) => x);
    assert.throws(() => (fn as (x: unknown) => unknown)(10n));
  });

  it("separate lazy instances do not share cache", () => {
    let count = 0;
    const make = () =>
      lazy((x: number) => {
        count++;
        return x * 2;
      });
    const f1 = make();
    const f2 = make();
    assert.strictEqual(f1(1), 2);
    assert.strictEqual(f2(1), 2);
    assert.strictEqual(count, 2);
  });

  it("skipHof: true resolves to fn itself at wrap time", () => {
    /**
     * Named initializer reaching the bypass switch unenhanced.
     * @returns Always `1`.
     */
    function initializer() {
      return 1;
    }
    assert.strictEqual(lazy(initializer, { skipHof: true }), initializer);
  });

  it("per-call skipHof predicate evaluates fresh (no memo store involved)", () => {
    let count = 0;
    const fn = lazy((x: number) => {
      count++;
      return x * 2;
    }, { skipHof: () => true });

    assert.strictEqual(fn(2), 4);
    assert.strictEqual(fn(2), 4);
    assert.strictEqual(count, 2);
  });

  it("TODO: NaN result is never cached (falsy check)", () => {
    let count = 0;
    const fn = lazy(() => {
      count++;
      return NaN;
    });
    fn();
    fn();
    assert.strictEqual(count, 2);
  });
});

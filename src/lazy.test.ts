import { describe, expect, it } from "vitest";

import { lazy } from "./lazy.js";

describe("lazy", () => {
  it("memoizes repeated calls with same args", () => {
    let count = 0;
    const fn = lazy((a: number, b: number) => {
      count++;
      return a + b;
    });
    expect(fn(1, 2)).toBe(3);
    expect(fn(1, 2)).toBe(3);
    expect(count).toBe(1);
  });

  it("returns same object identity on hit", () => {
    let count = 0;
    const fn = lazy(() => {
      count++;
      return { x: 1 };
    });
    const r1 = fn();
    const r2 = fn();
    expect(r1).toBe(r2);
    expect(count).toBe(1);
  });

  it("recomputes for different args", () => {
    let count = 0;
    const fn = lazy((x: number) => {
      count++;
      return x * 2;
    });
    expect(fn(1)).toBe(2);
    expect(fn(2)).toBe(4);
    expect(count).toBe(2);
  });

  it("deep-equal object args hit; key order misses (JSON.stringify order)", () => {
    let count = 0;
    const fn = lazy((o: Record<string, number>) => {
      count++;
      return o;
    });
    fn({ a: 1, b: 2 });
    fn({ a: 1, b: 2 });
    expect(count).toBe(1);
    // eslint-disable-next-line perfectionist/sort-objects
    fn({ b: 2, a: 1 });
    expect(count).toBe(2);
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
    expect(fn.call({ x: 1 })).toBe(1);
    // same args (none), different this still hits because this is not in key
    expect(fn.call({ x: 99 })).toBe(1);
    expect(count).toBe(1);
  });

  it("falsy results are never cached (truthy result cache gate)", () => {
    for (const falsy of [0, "", false, null, undefined]) {
      let count = 0;
      const fn = lazy(() => {
        count++;
        return falsy;
      });
      fn();
      fn();
      expect(count).toBe(2);
    }
  });

  it("sync throw is not cached, retries re-invoke", () => {
    let count = 0;
    const fn = lazy(() => {
      count++;
      if (count === 1) throw new Error("boom");
      return 42;
    });
    expect(() => fn()).toThrow(/boom/);
    expect(fn()).toBe(42);
    expect(count).toBe(2);
  });

  it("async resolve is cached (second call hits, count stays 1)", async () => {
    let count = 0;
    const fn = lazy(async () => {
      count++;
      return { v: 1 };
    });
    const v1 = await (fn() as Promise<unknown>);
    const v2 = await (fn() as Promise<unknown>);
    expect(v1).toStrictEqual({ v: 1 });
    expect(v2).toStrictEqual({ v: 1 });
    expect(count).toBe(1);
    // NOTE: first call returns result.catch(...) derived promise, second returns
    // cached original promise, so identity differs even though value is cached.
  });

  it("async falsy-resolving promise is still cached", async () => {
    let count = 0;
    const fn = lazy(async () => {
      count++;
      return 0;
    });
    expect(await (fn() as Promise<unknown>)).toBe(0);
    expect(await (fn() as Promise<unknown>)).toBe(0);
    expect(count).toBe(1);
  });

  it("async reject evicts, next call retries", async () => {
    let count = 0;
    const fn = lazy(async () => {
      count++;
      if (count === 1) throw new Error("async boom");
      return "ok";
    });
    await expect(fn() as Promise<unknown>).rejects.toThrow(/async boom/);
    expect(count).toBe(1);
    expect(await (fn() as Promise<unknown>)).toBe("ok");
    expect(count).toBe(2);
    // third call hits
    expect(await (fn() as Promise<unknown>)).toBe("ok");
    expect(count).toBe(2);
  });

  it("throws for circular args (JSON.stringify fails)", () => {
    const fn = lazy((o: unknown) => o);
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    expect(() => (fn as (o: unknown) => unknown)(circular)).toThrow();
  });

  it("throws for BigInt args (JSON.stringify fails)", () => {
    const fn = lazy((x: unknown) => x);
    expect(() => (fn as (x: unknown) => unknown)(10n)).toThrow();
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
    expect(f1(1)).toBe(2);
    expect(f2(1)).toBe(2);
    expect(count).toBe(2);
  });

  it("skipHof: true resolves to fn itself at wrap time", () => {
    /**
     * Named initializer reaching the bypass switch unenhanced.
     * @returns Always `1`.
     */
    function initializer() {
      return 1;
    }
    expect(lazy(initializer, { skipHof: true })).toBe(initializer);
  });

  it("per-call skipHof predicate evaluates fresh (no memo store involved)", () => {
    let count = 0;
    const fn = lazy((x: number) => {
      count++;
      return x * 2;
    }, { skipHof: () => true });

    expect(fn(2)).toBe(4);
    expect(fn(2)).toBe(4);
    expect(count).toBe(2);
  });

  it("per-call skipHof predicate false uses memoized enhanced", () => {
    let count = 0;
    const fn = lazy((x: number) => {
      count++;
      return x * 2;
    }, { skipHof: () => false });

    expect(fn(2)).toBe(4);
    expect(fn(2)).toBe(4);
    expect(count).toBe(1);
  });

  it("NaN result is never cached (falsy result cache gate)", () => {
    let count = 0;
    const fn = lazy(() => {
      count++;
      return NaN;
    });
    fn();
    fn();
    expect(count).toBe(2);
  });
});

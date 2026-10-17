import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withDelayAsync, withDelaySync } from "./delay.js";

describe("withDelayAsync", () => {
  it("returns identical fn when delay <= 0", async () => {
    /**
     *
     * @param x
     */
    async function fn(x: number) {
      return x;
    }
    assert.strictEqual(await withDelayAsync(fn, { delay: 0 }), fn);
    assert.strictEqual(await withDelayAsync(fn, { delay: -5 }), fn);
  });

  it("options omitted defaults to no delay (returns identical fn)", async () => {
    /**
     *
     */
    async function fn() {
      return 1;
    }
    assert.strictEqual(await withDelayAsync(fn), fn);
    assert.strictEqual(await withDelayAsync(fn, undefined), fn);
  });

  it("wraps when delay > 0 and delays execution", async () => {
    /**
     *
     * @param x
     */
    async function fn(x: number) {
      return x * 2;
    }
    const wrapped = await withDelayAsync(fn, { delay: 20 });
    assert.notStrictEqual(wrapped, fn);
    const start = performance.now();
    assert.strictEqual(await (wrapped as typeof fn)(21), 42);
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 15, `elapsed ${elapsed} >= 15`);
    assert.ok(elapsed < 500, `elapsed ${elapsed} < 500`);
  });

  it("forwards args, return, this, and propagates rejection", async () => {
    /**
     *
     * @param this
     * @param this.m
     * @param a
     * @param b
     */
    async function fn(this: { m: number }, a: number, b: number) {
      return this.m + a + b;
    }
    const wrapped = (await withDelayAsync(fn, { delay: 5 })) as typeof fn;
    assert.strictEqual(await wrapped.call({ m: 1 }, 2, 3), 6);

    const failing = await withDelayAsync(
      async () => {
        throw new Error("delayed fail");
      },
      { delay: 5 },
    );
    await assert.rejects(failing(), /delayed fail/);
  });

  it("pre-aborted signal throws before fn is called", async () => {
    let called = 0;
    /**
     *
     */
    async function fn() {
      called++;
      return 1;
    }
    const controller = new AbortController();
    controller.abort();
    const wrapped = (await withDelayAsync(fn, {
      delay: 20,
      signal: controller.signal,
    })) as typeof fn;
    await assert.rejects(wrapped());
    assert.strictEqual(called, 0);
  });

  it("NaN delay takes delay path (NaN <= 0 is false)", async () => {
    /**
     *
     */
    async function fn() {
      return 1;
    }
    const wrapped = await withDelayAsync(fn, { delay: NaN });
    assert.notStrictEqual(wrapped, fn);
  });

  it("parallel calls each sleep independently (~delay not 3*delay)", async () => {
    /**
     *
     * @param x
     */
    async function fn(x: number) {
      return x;
    }
    const wrapped = (await withDelayAsync(fn, { delay: 20 })) as typeof fn;
    const start = performance.now();
    const results = await Promise.all([wrapped(1), wrapped(2), wrapped(3)]);
    const elapsed = performance.now() - start;
    assert.deepStrictEqual(results, [1, 2, 3]);
    assert.ok(elapsed < 200, `parallel should be ~20ms, took ${elapsed}`);
  });

  it("abort mid-delay resolves early and fn still runs (sleepAsync resolves on abort)", async () => {
    let called = 0;
    /**
     *
     */
    async function fn() {
      called++;
      return 1;
    }
    const controller = new AbortController();
    const wrapped = (await withDelayAsync(fn, {
      delay: 1000,
      signal: controller.signal,
    })) as typeof fn;
    const start = performance.now();
    const p = wrapped();
    setTimeout(() => controller.abort(), 10);
    assert.strictEqual(await p, 1);
    assert.strictEqual(called, 1);
    assert.ok(performance.now() - start < 500, "delay cut short by abort");
  });
});

describe("withDelaySync", () => {
  it("returns identical fn when delay <= 0", () => {
    /**
     *
     * @param x
     */
    function fn(x: number) {
      return x;
    }
    assert.strictEqual(withDelaySync(fn, { delay: 0 }), fn);
    assert.strictEqual(withDelaySync(fn, { delay: -1 }), fn);
  });

  it("options omitted defaults to no delay (returns identical fn)", () => {
    /**
     *
     */
    function fn() {
      return 1;
    }
    assert.strictEqual(withDelaySync(fn), fn);
    assert.strictEqual(withDelaySync(fn, undefined), fn);
  });

  it("wraps and blocks for delay", () => {
    /**
     *
     * @param x
     */
    function fn(x: number) {
      return x + 1;
    }
    const wrapped = withDelaySync(fn, { delay: 20 });
    assert.notStrictEqual(wrapped, fn);
    const start = Date.now();
    assert.strictEqual(wrapped(1), 2);
    assert.ok(Date.now() - start >= 15);
  });

  it("forwards this and throws propagate after delay", () => {
    /**
     *
     * @param this
     * @param this.x
     */
    function fn(this: { x: number }) {
      return this.x;
    }
    const wrapped = withDelaySync(fn, { delay: 1 });
    assert.strictEqual(wrapped.call({ x: 5 }), 5);

    const failing = withDelaySync(
      (): number => {
        throw new Error("sync delayed fail");
      },
      { delay: 1 },
    );
    assert.throws(() => failing(), /sync delayed fail/);
  });

  it("pre-aborted signal throws before fn", () => {
    let called = 0;
    /**
     *
     */
    function fn() {
      called++;
      return 1;
    }
    const controller = new AbortController();
    controller.abort();
    const wrapped = withDelaySync(fn, {
      delay: 10,
      signal: controller.signal,
    });
    assert.throws(() => wrapped());
    assert.strictEqual(called, 0);
  });

  it("NaN delay takes delay path but returns immediately (NaN <= 0 is false)", () => {
    /**
     *
     */
    function fn() {
      return 1;
    }
    const wrapped = withDelaySync(fn, { delay: NaN });
    assert.notStrictEqual(wrapped, fn);
    const start = Date.now();
    assert.strictEqual(wrapped(), 1);
    assert.ok(Date.now() - start < 100);
  });
});

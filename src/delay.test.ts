import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withDelayAsync, withDelaySync } from "./delay.js";

describe("withDelayAsync", () => {
  it("returns identical fn when delay <= 0", async () => {
    /**
     * Identity function under the zero/negative-delay shortcut.
     * @param x - Value echoed back.
     * @returns `x`, unchanged.
     */
    async function fn(x: number) {
      return x;
    }
    assert.strictEqual(await withDelayAsync(fn, { delay: 0 }), fn);
    assert.strictEqual(await withDelayAsync(fn, { delay: -5 }), fn);
  });

  it("options omitted defaults to no delay (returns identical fn)", async () => {
    /**
     * Constant producer under the no-options shortcut.
     * @returns Always `1`.
     */
    async function fn() {
      return 1;
    }
    assert.strictEqual(await withDelayAsync(fn), fn);
    assert.strictEqual(await withDelayAsync(fn, undefined), fn);
  });

  it("wraps when delay > 0 and delays execution", async () => {
    /**
     * Doubler whose call timing is measured around the pre-call delay.
     * @param x - Value to double.
     * @returns `x * 2`.
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
     * `this`-aware adder whose result depends on the receiver.
     * @param this - Receiver carrying the addition basis `m`.
     * @param this.m - Stored base added to the operands.
     * @param a - First addend.
     * @param b - Second addend.
     * @returns A promise resolving to `this.m + a + b`.
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
     * Counter incrementing on every actual invocation (sync throw check body).
     * @returns Always `1`, after counting the invocation.
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
     * Constant producer used to probe NaN delay handling.
     * @returns Always `1`.
     */
    async function fn() {
      return 1;
    }
    const wrapped = await withDelayAsync(fn, { delay: NaN });
    assert.notStrictEqual(wrapped, fn);
  });

  it("parallel calls each sleep independently (~delay not 3*delay)", async () => {
    /**
     * Identity function called three times concurrently under one delay.
     * @param x - Value echoed back.
     * @returns `x`, unchanged.
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
     * Counter verifying that abort mid-delay still reaches the wrapped fn.
     * @returns Always `1`, after counting the invocation.
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
     * Identity function under the zero/negative-delay shortcut (sync side).
     * @param x - Value echoed back.
     * @returns `x`, unchanged.
     */
    function fn(x: number) {
      return x;
    }
    assert.strictEqual(withDelaySync(fn, { delay: 0 }), fn);
    assert.strictEqual(withDelaySync(fn, { delay: -1 }), fn);
  });

  it("options omitted defaults to no delay (returns identical fn)", () => {
    /**
     * Constant producer under the no-options shortcut (sync side).
     * @returns Always `1`.
     */
    function fn() {
      return 1;
    }
    assert.strictEqual(withDelaySync(fn), fn);
    assert.strictEqual(withDelaySync(fn, undefined), fn);
  });

  it("wraps and blocks for delay", () => {
    /**
     * Incrementer whose call timing is measured around the blocking delay.
     * @param x - Value to add 1 to.
     * @returns `x + 1`.
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
     * `this`-reader verifying receiver forwarding after the blocking delay.
     * @param this - Receiver carrying the value to read.
     * @param this.x - The stored value returned through `this` forwarding.
     * @returns The receiver's `x`.
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
     * Counter verifying the pre-aborted signal prevents invocation.
     * @returns Always `1`, after counting the invocation.
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
     * Constant producer used to probe NaN delay (blocks zero time on return).
     * @returns Always `1`.
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

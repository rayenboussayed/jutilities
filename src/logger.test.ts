import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { withLogger } from "./logger.js";

describe("withLogger", () => {
  const originalLog = console.log;
  const originalPerfNow = performance.now.bind(performance);
  let logs: unknown[][];

  afterEach(() => {
    console.log = originalLog;
    performance.now = originalPerfNow;
    // @ts-expect-error cleanup browser stub
    if (typeof globalThis.window !== "undefined") delete globalThis.window;
  });

  /**
   * Swaps `console.log` for a capturing stub and resets the log buffer.
   */
  function capture() {
    logs = [];
    console.log = (...args: unknown[]) => {
      logs.push(args);
    };
  }

  it("logs sync execution with explicit name and returns value", () => {
    capture();
    /**
     * Sync adder logged under the explicit name `myAdd`.
     * @param a - First addend.
     * @param b - Second addend.
     * @returns `a + b`.
     */
    function add(a: number, b: number) {
      return a + b;
    }
    const wrapped = withLogger("myAdd", add);
    assert.strictEqual(wrapped(1, 2), 3);
    assert.strictEqual(logs.length, 2);
    assert.match(String(logs[0]?.[0]), /\[Function myAdd\]/);
    assert.match(String(logs[0]?.[0]), /Execution, Args:/);
    assert.deepStrictEqual(logs[0]?.slice(1), [1, 2]);
    assert.match(String(logs[1]?.[0]), /\[Function myAdd\]/);
    assert.match(String(logs[1]?.[0]), /ms, Result:/);
    assert.strictEqual(logs[1]?.[logs[1].length - 1], 3);
  });

  it("infers name from fn.name with single-arg overload", () => {
    capture();
    /**
     * Named function whose `fn.name` should appear in log labels.
     * @returns Always `1`.
     */
    function foo() {
      return 1;
    }
    withLogger(foo)();
    assert.match(String(logs[0]?.[0]), /\[Function foo\]/);
  });

  it("uses unknown for anonymous or empty name", () => {
    capture();
    withLogger(() => 1)();
    assert.match(String(logs[0]?.[0]), /\[Function unknown\]/);

    capture();
    withLogger("", () => 2)();
    assert.match(String(logs[0]?.[0]), /\[Function unknown\]/);
  });

  it("explicit name wins over fn.name", () => {
    capture();
    /**
     * Named function whose real name must NOT appear when a custom one is set.
     * @returns Always `1`.
     */
    function realName() {
      return 1;
    }
    withLogger("custom", realName)();
    assert.match(String(logs[0]?.[0]), /\[Function custom\]/);
    assert.doesNotMatch(String(logs[0]?.[0]), /realName/);
  });

  it("preserves this and forwards args", () => {
    capture();
    /**
     * `this`-aware getter demonstrating receiver + arg forwarding through
     * the logger wrapper.
     * @param this - Receiver carrying the base value.
     * @param this.x - The base value added to the increment.
     * @param inc - Increment amount (also visible in the args log line).
     * @returns `this.x + inc`.
     */
    function get(this: { x: number }, inc: number) {
      return this.x + inc;
    }
    const wrapped = withLogger("get", get);
    assert.strictEqual(wrapped.call({ x: 10 }, 5), 15);
    assert.deepStrictEqual(logs[0]?.slice(1), [5]);
  });

  it("sync throw: first log emitted, second not, error propagates", () => {
    capture();
    const wrapped = withLogger("boom", () => {
      throw new Error("sync fail");
    });
    assert.throws(() => wrapped(), /sync fail/);
    assert.strictEqual(logs.length, 1);
  });

  it("async resolve: logs twice with resolved value", async () => {
    capture();
    const wrapped = withLogger("asyncFn", async (x: number) => x * 2);
    const result = await wrapped(21);
    assert.strictEqual(result, 42);
    assert.strictEqual(logs.length, 2);
    assert.strictEqual(logs[1]?.[logs[1].length - 1], 42);
  });

  it("async reject: only one log, rejection propagates", async () => {
    capture();
    const wrapped = withLogger("areject", async () => {
      throw new Error("async fail");
    });
    await assert.rejects(wrapped(), /async fail/);
    assert.strictEqual(logs.length, 1);
  });

  it("non-Promise thenable takes sync path (logs thenable object)", () => {
    capture();
    const thenable = { then: () => {} };
    const wrapped = withLogger("t", () => thenable);
    const result = wrapped();
    assert.strictEqual(result, thenable);
    assert.strictEqual(logs.length, 2);
  });

  it("uses performance.now timing in Node", () => {
    capture();
    const times = [10, 25];
    globalThis.performance.now = () => times.shift() ?? 0;
    withLogger("timed", () => 1)();
    assert.match(String(logs[1]?.[0]), /15ms/);
  });

  it("uses Date.now when window is defined (browser branch)", () => {
    capture();
    // @ts-expect-error stub browser env
    globalThis.window = {};
    const times = [100, 130];
    let i = 0;
    const origNow = Date.now;
    Date.now = () => times[i++] ?? 0;
    try {
      withLogger("b", () => 1)();
      assert.match(String(logs[1]?.[0]), /30ms/);
    } finally {
      Date.now = origNow;
    }
  });

  it("handles zero args", () => {
    capture();
    const wrapped = withLogger("z", () => 7);
    assert.strictEqual(wrapped(), 7);
    assert.deepStrictEqual(logs[0], ["[Function z] Execution, Args:"]);
  });

  it("async log includes elapsed ms", async () => {
    capture();
    const times = [10, 40];
    globalThis.performance.now = () => times.shift() ?? 0;
    const wrapped = withLogger("atimed", async () => "done");
    assert.strictEqual(await wrapped(), "done");
    assert.strictEqual(logs.length, 2);
    assert.match(String(logs[1]?.[0]), /30ms/);
  });

  it("preserves object result identity (sync and async)", async () => {
    capture();
    const obj = { v: 1 };
    const syncWrapped = withLogger("o", () => obj);
    assert.strictEqual(syncWrapped(), obj);

    capture();
    const asyncWrapped = withLogger("ao", async () => obj);
    assert.strictEqual(await asyncWrapped(), obj);
  });
});

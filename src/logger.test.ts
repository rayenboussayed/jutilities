import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { withLoggerAsync, withLoggerSync } from "./logger.js";

describe("withLoggerSync", () => {
  const originalDebug = console.debug;
  const originalPerfNow = performance.now.bind(performance);
  let logs: unknown[][];

  afterEach(() => {
    console.debug = originalDebug;
    performance.now = originalPerfNow;
    // @ts-expect-error cleanup browser stub
    if (typeof globalThis.window !== "undefined") delete globalThis.window;
  });

  /**
   * Swaps `console.debug` for a capturing stub and resets the log buffer.
   */
  function capture() {
    logs = [];
    console.debug = (...args: unknown[]) => {
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
    const wrapped = withLoggerSync(add, { name: "myAdd" });
    assert.strictEqual(wrapped(1, 2), 3);
    assert.strictEqual(logs.length, 2);
    assert.match(String(logs[0]?.[0]), /\[Function myAdd\]/);
    assert.match(String(logs[0]?.[0]), /Execution, Args:/);
    assert.deepStrictEqual(logs[0]?.slice(1), [1, 2]);
    assert.match(String(logs[1]?.[0]), /\[Function myAdd\]/);
    assert.match(String(logs[1]?.[0]), /ms, Result:/);
    assert.strictEqual(logs[1]?.[logs[1].length - 1], 3);
  });

  it("infers name from fn.name when options omitted", () => {
    capture();
    /**
     * Named function whose `fn.name` should appear in log labels.
     * @returns Always `1`.
     */
    function foo() {
      return 1;
    }
    withLoggerSync(foo)();
    assert.match(String(logs[0]?.[0]), /\[Function foo\]/);
  });

  it("uses anonymous for anonymous or empty name", () => {
    capture();
    withLoggerSync(() => 1)();
    assert.match(String(logs[0]?.[0]), /\[Function anonymous\]/);

    capture();
    withLoggerSync(() => 2, { name: "" })();
    assert.match(String(logs[0]?.[0]), /\[Function anonymous\]/);
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
    withLoggerSync(realName, { name: "custom" })();
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
    const wrapped = withLoggerSync(get, { name: "get" });
    assert.strictEqual(wrapped.call({ x: 10 }, 5), 15);
    assert.deepStrictEqual(logs[0]?.slice(1), [5]);
  });

  it("sync throw: first log emitted, second not, error propagates", () => {
    capture();
    const wrapped = withLoggerSync(
      (): number => {
        throw new Error("sync fail");
      },
      { name: "boom" },
    );
    assert.throws(() => wrapped(), /sync fail/);
    assert.strictEqual(logs.length, 1);
  });

  it("non-Promise thenable takes sync path (logs thenable object)", () => {
    capture();
    const thenable = { then: () => {} };
    const wrapped = withLoggerSync(() => thenable, { name: "t" });
    const result = wrapped();
    assert.strictEqual(result, thenable);
    assert.strictEqual(logs.length, 2);
  });

  it("uses performance.now timing in Node", () => {
    capture();
    const times = [10, 25];
    globalThis.performance.now = () => times.shift() ?? 0;
    withLoggerSync(() => 1, { name: "timed" })();
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
      withLoggerSync(() => 1, { name: "b" })();
      assert.match(String(logs[1]?.[0]), /30ms/);
    } finally {
      Date.now = origNow;
    }
  });

  it("handles zero args", () => {
    capture();
    const wrapped = withLoggerSync(() => 7, { name: "z" });
    assert.strictEqual(wrapped(), 7);
    assert.strictEqual(String(logs[0]?.[0]).endsWith("[Function z] Execution, Args:"), true);
    assert.deepStrictEqual(logs[0]?.slice(1), []);
  });

  it("preserves object result identity", () => {
    capture();
    const obj = { v: 1 };
    const syncWrapped = withLoggerSync(() => obj, { name: "o" });
    assert.strictEqual(syncWrapped(), obj);
  });

  it("skipHof: true resolves to fn itself at wrap time", () => {
    const fn = (x: number) => x + 1;
    assert.strictEqual(
      withLoggerSync(fn, { skipHof: true, name: "never" }),
      fn,
    );
  });

  it("per-call skipHof predicate bypasses logging entirely", () => {
    capture();
    let count = 0;
    const wrapped = withLoggerSync((x: number) => {
      count++;
      return x * 2;
    }, { name: "bypass", skipHof: () => true });

    assert.strictEqual(wrapped(3), 6);
    assert.strictEqual(count, 1);
    assert.strictEqual(logs.length, 0);
  });
});

describe("withLoggerAsync", () => {
  const originalDebug = console.debug;
  const originalPerfNow = performance.now.bind(performance);
  let logs: unknown[][];

  afterEach(() => {
    console.debug = originalDebug;
    performance.now = originalPerfNow;
  });

  /**
   * Swaps `console.debug` for a capturing stub and resets the log buffer.
   */
  function capture() {
    logs = [];
    console.debug = (...args: unknown[]) => {
      logs.push(args);
    };
  }

  it("logs async execution with explicit name and resolved value", async () => {
    capture();
    const wrapped = withLoggerAsync(async (x: number) => x * 2, { name: "asyncFn" });
    const result = await wrapped(21);
    assert.strictEqual(result, 42);
    assert.strictEqual(logs.length, 2);
    assert.match(String(logs[0]?.[0]), /\[Function asyncFn\]/);
    assert.match(String(logs[0]?.[0]), /Execution, Args:/);
    assert.deepStrictEqual(logs[0]?.slice(1), [21]);
    assert.match(String(logs[1]?.[0]), /\[Function asyncFn\]/);
    assert.match(String(logs[1]?.[0]), /ms, Result:/);
    assert.strictEqual(logs[1]?.[logs[1].length - 1], 42);
  });

  it("infers name from fn.name when options omitted", async () => {
    capture();
    /**
     * Named async function whose `fn.name` should appear in log labels.
     * @returns Always `1`.
     */
    async function afoo() {
      return 1;
    }
    await withLoggerAsync(afoo)();
    assert.match(String(logs[0]?.[0]), /\[Function afoo\]/);
  });

  it("uses anonymous for anonymous or empty name", async () => {
    capture();
    await withLoggerAsync(async () => 1)();
    assert.match(String(logs[0]?.[0]), /\[Function anonymous\]/);

    capture();
    await withLoggerAsync(async () => 2, { name: "" })();
    assert.match(String(logs[0]?.[0]), /\[Function anonymous\]/);
  });

  it("preserves this and forwards args", async () => {
    capture();
    /**
     * `this`-aware async getter demonstrating receiver + arg forwarding
     * through the logger wrapper.
     * @param this - Receiver carrying the base value.
     * @param this.x - The base value added to the increment.
     * @param inc - Increment amount (also visible in the args log line).
     * @returns `Promise<`this.x + inc`>`.
     */
    async function get(this: { x: number }, inc: number) {
      return this.x + inc;
    }
    const wrapped = withLoggerAsync(get, { name: "get" });
    assert.strictEqual(await wrapped.call({ x: 10 }, 5), 15);
    assert.deepStrictEqual(logs[0]?.slice(1), [5]);
  });

  it("async reject: only one log, rejection propagates", async () => {
    capture();
    const wrapped = withLoggerAsync(async () => {
      throw new Error("async fail");
    }, { name: "areject" });
    await assert.rejects(wrapped(), /async fail/);
    assert.strictEqual(logs.length, 1);
  });

  it("async log includes elapsed ms", async () => {
    capture();
    const times = [10, 40];
    globalThis.performance.now = () => times.shift() ?? 0;
    const wrapped = withLoggerAsync(async () => "done", { name: "atimed" });
    assert.strictEqual(await wrapped(), "done");
    assert.strictEqual(logs.length, 2);
    assert.match(String(logs[1]?.[0]), /30ms/);
  });

  it("preserves object result identity", async () => {
    capture();
    const obj = { v: 1 };
    const asyncWrapped = withLoggerAsync(async () => obj, { name: "ao" });
    assert.strictEqual(await asyncWrapped(), obj);
  });

  it("skipHof: true resolves to fn itself at wrap time", async () => {
    const fn = async (x: number) => x + 1;
    assert.strictEqual(
      withLoggerAsync(fn, { skipHof: true, name: "never" }),
      fn,
    );
  });

  it("per-call skipHof predicate bypasses logging entirely", async () => {
    capture();
    let count = 0;
    const wrapped = withLoggerAsync(async (x: number) => {
      count++;
      return x * 2;
    }, { name: "bypass", skipHof: () => true });

    assert.strictEqual(await wrapped(3), 6);
    assert.strictEqual(count, 1);
    assert.strictEqual(logs.length, 0);
  });
});

import { afterEach, describe, expect, it } from "vitest";

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
    expect(wrapped(1, 2)).toBe(3);
    expect(logs).toHaveLength(2);
    expect(String(logs[0]?.[0])).toMatch(/\[Function myAdd\]/);
    expect(String(logs[0]?.[0])).toMatch(/Execution, Args:/);
    expect(logs[0]?.slice(1)).toStrictEqual([1, 2]);
    expect(String(logs[1]?.[0])).toMatch(/\[Function myAdd\]/);
    expect(String(logs[1]?.[0])).toMatch(/ms, Result:/);
    expect(logs[1]?.[logs[1].length - 1]).toBe(3);
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
    expect(String(logs[0]?.[0])).toMatch(/\[Function foo\]/);
  });

  it("uses anonymous for anonymous or empty name", () => {
    capture();
    withLoggerSync(() => 1)();
    expect(String(logs[0]?.[0])).toMatch(/\[Function anonymous\]/);

    capture();
    withLoggerSync(() => 2, { name: "" })();
    expect(String(logs[0]?.[0])).toMatch(/\[Function anonymous\]/);
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
    expect(String(logs[0]?.[0])).toMatch(/\[Function custom\]/);
    expect(String(logs[0]?.[0])).not.toMatch(/realName/);
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
    expect(wrapped.call({ x: 10 }, 5)).toBe(15);
    expect(logs[0]?.slice(1)).toStrictEqual([5]);
  });

  it("sync throw: first log emitted, second not, error propagates", () => {
    capture();
    const wrapped = withLoggerSync(
      (): number => {
        throw new Error("sync fail");
      },
      { name: "boom" },
    );
    expect(() => wrapped()).toThrow(/sync fail/);
    expect(logs).toHaveLength(1);
  });

  it("non-Promise thenable takes sync path (logs thenable object)", () => {
    capture();
    const thenable = { then: () => {} };
    const wrapped = withLoggerSync(() => thenable, { name: "t" });
    const result = wrapped();
    expect(result).toBe(thenable);
    expect(logs).toHaveLength(2);
  });

  it("uses performance.now timing in Node", () => {
    capture();
    const times = [10, 25];
    globalThis.performance.now = () => times.shift() ?? 0;
    withLoggerSync(() => 1, { name: "timed" })();
    expect(String(logs[1]?.[0])).toMatch(/15ms/);
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
      expect(String(logs[1]?.[0])).toMatch(/30ms/);
    } finally {
      Date.now = origNow;
    }
  });

  it("handles zero args", () => {
    capture();
    const wrapped = withLoggerSync(() => 7, { name: "z" });
    expect(wrapped()).toBe(7);
    expect(String(logs[0]?.[0]).endsWith("[Function z] Execution, Args:")).toBe(true);
    expect(logs[0]?.slice(1)).toStrictEqual([]);
  });

  it("preserves object result identity", () => {
    capture();
    const obj = { v: 1 };
    const syncWrapped = withLoggerSync(() => obj, { name: "o" });
    expect(syncWrapped()).toBe(obj);
  });

  it("skipHof: true resolves to fn itself at wrap time", () => {
    const fn = (x: number) => x + 1;
    expect(withLoggerSync(fn, { name: "never", skipHof: true })).toBe(fn);
  });

  it("per-call skipHof predicate bypasses logging entirely", () => {
    capture();
    let count = 0;
    const wrapped = withLoggerSync((x: number) => {
      count++;
      return x * 2;
    }, { name: "bypass", skipHof: () => true });

    expect(wrapped(3)).toBe(6);
    expect(count).toBe(1);
    expect(logs).toHaveLength(0);
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
  // eslint-disable-next-line sonarjs/no-identical-functions
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
    expect(result).toBe(42);
    expect(logs).toHaveLength(2);
    expect(String(logs[0]?.[0])).toMatch(/\[Function asyncFn\]/);
    expect(String(logs[0]?.[0])).toMatch(/Execution, Args:/);
    expect(logs[0]?.slice(1)).toStrictEqual([21]);
    expect(String(logs[1]?.[0])).toMatch(/\[Function asyncFn\]/);
    expect(String(logs[1]?.[0])).toMatch(/ms, Result:/);
    expect(logs[1]?.[logs[1].length - 1]).toBe(42);
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
    expect(String(logs[0]?.[0])).toMatch(/\[Function afoo\]/);
  });

  it("uses anonymous for anonymous or empty name", async () => {
    capture();
    await withLoggerAsync(async () => 1)();
    expect(String(logs[0]?.[0])).toMatch(/\[Function anonymous\]/);

    capture();
    await withLoggerAsync(async () => 2, { name: "" })();
    expect(String(logs[0]?.[0])).toMatch(/\[Function anonymous\]/);
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
    expect(await wrapped.call({ x: 10 }, 5)).toBe(15);
    expect(logs[0]?.slice(1)).toStrictEqual([5]);
  });

  it("async reject: only one log, rejection propagates", async () => {
    capture();
    const wrapped = withLoggerAsync(async () => {
      throw new Error("async fail");
    }, { name: "areject" });
    await expect(wrapped()).rejects.toThrow(/async fail/);
    expect(logs).toHaveLength(1);
  });

  it("async log includes elapsed ms", async () => {
    capture();
    const times = [10, 40];
    globalThis.performance.now = () => times.shift() ?? 0;
    const wrapped = withLoggerAsync(async () => "done", { name: "atimed" });
    expect(await wrapped()).toBe("done");
    expect(logs).toHaveLength(2);
    expect(String(logs[1]?.[0])).toMatch(/30ms/);
  });

  it("preserves object result identity", async () => {
    capture();
    const obj = { v: 1 };
    const asyncWrapped = withLoggerAsync(async () => obj, { name: "ao" });
    expect(await asyncWrapped()).toBe(obj);
  });

  it("skipHof: true resolves to fn itself at wrap time", async () => {
    const fn = async (x: number) => x + 1;
    expect(withLoggerAsync(fn, { name: "never", skipHof: true })).toBe(fn);
  });

  it("per-call skipHof predicate bypasses logging entirely", async () => {
    capture();
    let count = 0;
    const wrapped = withLoggerAsync(async (x: number) => {
      count++;
      return x * 2;
    }, { name: "bypass", skipHof: () => true });

    expect(await wrapped(3)).toBe(6);
    expect(count).toBe(1);
    expect(logs).toHaveLength(0);
  });
});

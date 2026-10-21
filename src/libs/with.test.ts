import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withCacheAsync, withCacheSync } from "../cache.js";
import {
  createHofAsync,
  createHofSync,
  type HofAsyncFn,
  type HofKind,
} from "./create-hof.js";
import { withAsync, withSync, type MergeOptions } from "./with.js";

interface TraceKind extends HofKind {
  options: { tag?: string };
}

interface AlphaKind extends HofKind {
  options: { alpha?: string };
}

interface BetaKind extends HofKind {
  options: { beta?: string };
}

/**
 * Builds a sync tracing HOF: the wrap records `build:<tag>`, every call
 * records `call:<tag>` before delegating to the wrapped function.
 * @param trace - Collector receiving the trace entries.
 * @param tag - Tag identifying the layer.
 * @returns The tracing HOF.
 */
function tracerSync(trace: string[], tag: string) {
  return createHofSync<TraceKind>((fn, options) => {
    const label = options.tag ?? tag;
    trace.push(`build:${label}`);
    return function (
      this: ThisParameterType<TraceKind["fn"]>,
      ...args: Parameters<TraceKind["fn"]>
    ) {
      trace.push(`call:${label}`);
      return fn.apply(this, args);
    } as TraceKind["fn"];
  });
}

/**
 * Builds an async tracing HOF: the wrap records `build:<tag>`, every call
 * records `call:<tag>` before delegating to the wrapped function.
 * @param trace - Collector receiving the trace entries.
 * @param tag - Tag identifying the layer.
 * @returns The tracing HOF.
 */
function tracerAsync(trace: string[], tag: string) {
  return createHofAsync<TraceKind>((fn, options) => {
    const label = options.tag ?? tag;
    trace.push(`build:${label}`);
    return async function (
      this: ThisParameterType<TraceKind["fn"]>,
      ...args: Parameters<TraceKind["fn"]>
    ) {
      trace.push(`call:${label}`);
      return fn.apply(this, args);
    } as TraceKind["fn"];
  });
}

describe("withAsync", () => {
  it("applies the first hof as the outermost layer", async () => {
    const trace: string[] = [];
    const fn = async (value: number) => {
      trace.push("call:fn");
      return value;
    };

    const wrapped = withAsync(
      tracerAsync(trace, "outer"),
      tracerAsync(trace, "inner"),
    )(fn);

    assert.strictEqual(await wrapped(1), 1);
    assert.deepStrictEqual(trace.slice(-3), [
      "call:outer",
      "call:inner",
      "call:fn",
    ]);
  });

  it("builds every layer once per wrap, not per call", async () => {
    const trace: string[] = [];
    const fn = async (value: number) => value;

    const wrapped = withAsync(
      tracerAsync(trace, "outer"),
      tracerAsync(trace, "inner"),
    )(fn);

    assert.deepStrictEqual(trace, ["build:inner", "build:outer"]);

    await wrapped(1);
    await wrapped(2);

    assert.deepStrictEqual(trace, [
      "build:inner",
      "build:outer",
      "call:outer",
      "call:inner",
      "call:outer",
      "call:inner",
    ]);
  });

  it("shares one flat options bag — every layer reads its own keys", async () => {
    const trace: string[] = [];
    const alpha = createHofAsync<AlphaKind>((fn, options) => {
      trace.push(`alpha:${options.alpha}`);
      return fn;
    });
    const beta = createHofAsync<BetaKind>((fn, options) => {
      trace.push(`beta:${options.beta}`);
      return fn;
    });

    const fn = async (value: number) => value;
    const wrapped = withAsync(alpha, beta)(fn, { alpha: "A", beta: "B" });

    await wrapped(1);
    assert.deepStrictEqual(trace, ["beta:B", "alpha:A"]);
  });

  it("skipHof: true resolves to fn itself and builds no layer", async () => {
    const trace: string[] = [];
    const fn = async (value: number) => value;

    const wrapped = withAsync(tracerAsync(trace, "outer"))(fn, {
      skipHof: true,
    });

    assert.strictEqual(wrapped, fn);
    assert.deepStrictEqual(trace, []);
  });

  it("per-call predicate bypasses the whole stack and runs fn raw", async () => {
    const trace: string[] = [];
    const fn = async (value: number) => {
      trace.push("call:fn");
      return value;
    };

    const wrapped = withAsync(
      tracerAsync(trace, "outer"),
      tracerAsync(trace, "inner"),
    )(fn, { skipHof: () => true });

    assert.strictEqual(await wrapped(1), 1);
    assert.ok(!trace.includes("call:outer"));
    assert.ok(!trace.includes("call:inner"));
    assert.ok(trace.includes("call:fn"));
  });

  it("evaluates the per-call predicate once per call, not once per layer", async () => {
    let predicateCalls = 0;
    const trace: string[] = [];
    const fn = async (value: number) => value;

    const wrapped = withAsync(
      tracerAsync(trace, "outer"),
      tracerAsync(trace, "inner"),
    )(fn, {
      skipHof: () => {
        predicateCalls += 1;
        return false;
      },
    });

    await wrapped(1);
    assert.strictEqual(predicateCalls, 1);
  });

  it("awaits an async predicate before deciding (false enhances, true bypasses)", async () => {
    const trace: string[] = [];
    const fn = async (value: number) => value;

    const enhancing = withAsync(tracerAsync(trace, "outer"))(fn, {
      skipHof: async () => {
        await Promise.resolve();
        return false;
      },
    });
    await enhancing(1);
    assert.ok(trace.includes("call:outer"));

    const bypassing = withAsync(tracerAsync(trace, "other"))(fn, {
      skipHof: async () => {
        await Promise.resolve();
        return true;
      },
    });
    await bypassing(1);
    assert.ok(!trace.includes("call:other"));
  });

  it("forwards this and args through the stack", async () => {
    const trace: string[] = [];
    /**
     * Receiver-reading async initializer.
     * @param this - Receiver whose `salt` is added to the argument.
     * @param this.salt - Addend read from the receiver.
     * @param value - The call argument.
     * @returns `this.salt + value`.
     */
    async function fn(this: { salt: number }, value: number) {
      trace.push("call:fn");
      return this.salt + value;
    }

    const wrapped = withAsync(tracerAsync(trace, "outer"))(fn);
    assert.strictEqual(await wrapped.call({ salt: 40 }, 2), 42);
    assert.ok(trace.includes("call:fn"));
  });

  it("returns fn unchanged for an empty stack", async () => {
    const fn = async (value: number) => value;
    assert.strictEqual(withAsync()(fn), fn);
  });

  it("keeps a real HOF's own behavior inside the stack", async () => {
    let calls = 0;
    const fn = async (value: number) => {
      calls += 1;
      return value * 2;
    };

    const cached = withAsync(withCacheAsync)(fn);
    assert.strictEqual(await cached(2), 4);
    assert.strictEqual(await cached(2), 4);
    assert.strictEqual(calls, 1);
  });
});

describe("withSync", () => {
  it("applies the first hof as the outermost layer", () => {
    const trace: string[] = [];
    const fn = (value: number) => {
      trace.push("call:fn");
      return value;
    };

    const wrapped = withSync(
      tracerSync(trace, "outer"),
      tracerSync(trace, "inner"),
    )(fn);

    assert.strictEqual(wrapped(1), 1);
    assert.deepStrictEqual(trace.slice(-3), [
      "call:outer",
      "call:inner",
      "call:fn",
    ]);
  });

  it("skipHof: true resolves to fn itself and builds no layer", () => {
    const trace: string[] = [];
    const fn = (value: number) => value;

    const wrapped = withSync(tracerSync(trace, "outer"))(fn, {
      skipHof: true,
    });

    assert.strictEqual(wrapped, fn);
    assert.deepStrictEqual(trace, []);
  });

  it("per-call predicate bypasses the whole stack and runs fn raw", () => {
    const trace: string[] = [];
    const fn = (value: number) => {
      trace.push("call:fn");
      return value;
    };

    const wrapped = withSync(
      tracerSync(trace, "outer"),
      tracerSync(trace, "inner"),
    )(fn, { skipHof: () => true });

    assert.strictEqual(wrapped(1), 1);
    assert.ok(!trace.includes("call:outer"));
    assert.ok(!trace.includes("call:inner"));
    assert.ok(trace.includes("call:fn"));
  });

  it("evaluates the per-call predicate once per call, not once per layer", () => {
    let predicateCalls = 0;
    const trace: string[] = [];
    const fn = (value: number) => value;

    const wrapped = withSync(
      tracerSync(trace, "outer"),
      tracerSync(trace, "inner"),
    )(fn, {
      skipHof: () => {
        predicateCalls += 1;
        return false;
      },
    });

    wrapped(1);
    assert.strictEqual(predicateCalls, 1);
  });

  it("forwards this and args through the stack", () => {
    const trace: string[] = [];
    /**
     * Receiver-reading initializer.
     * @param this - Receiver whose `salt` is added to the argument.
     * @param this.salt - Addend read from the receiver.
     * @param value - The call argument.
     * @returns `this.salt + value`.
     */
    function fn(this: { salt: number }, value: number) {
      trace.push("call:fn");
      return this.salt + value;
    }

    const wrapped = withSync(tracerSync(trace, "outer"))(fn);
    assert.strictEqual(wrapped.call({ salt: 40 }, 2), 42);
    assert.ok(trace.includes("call:fn"));
  });

  it("returns fn unchanged for an empty stack", () => {
    const fn = (value: number) => value;
    assert.strictEqual(withSync()(fn), fn);
  });

  it("keeps a real HOF's own behavior inside the stack", () => {
    let calls = 0;
    const fn = (value: number) => {
      calls += 1;
      return value * 2;
    };

    const cached = withSync(withCacheSync)(fn);
    assert.strictEqual(cached(2), 4);
    assert.strictEqual(cached(2), 4);
    assert.strictEqual(calls, 1);
  });
});

describe("type-level contracts", () => {
  it("merges the options of every layer into one bag", () => {
    const options: MergeOptions<
      [HofAsyncFn<AlphaKind>, HofAsyncFn<BetaKind>],
      (value: number) => number
    > = { alpha: "A", beta: "B" };

    assert.deepStrictEqual(options, { alpha: "A", beta: "B" });
  });

  it("rejects an async function in the sync composer", () => {
    // @ts-expect-error - a sync composer must not accept an async function.
    withSync(tracerSync([], "outer"))(async () => 1);
  });

  it("accepts an async function in the async composer", async () => {
    const fn = async (value: number) => value;
    const wrapped = withAsync(tracerAsync([], "outer"))(fn);
    assert.strictEqual(await wrapped(1), 1);
  });
});

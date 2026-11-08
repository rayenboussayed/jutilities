import { describe, expect, it } from "vitest";

import { withCacheAsync, withCacheSync } from "../cache.js";
import {
  createHofAsync,
  createHofSync,
  type HofFn,
  type HofKind,
} from "./create-hof.js";
import { type MergeOptions, withAsync, withSync } from "./with.js";

interface AlphaKind extends HofKind {
  options: { alpha?: string };
}

interface BetaKind extends HofKind {
  options: { beta?: string };
}

interface TraceKind extends HofKind {
  options: { tag?: string };
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

    expect(await wrapped(1)).toBe(1);
    expect(trace.slice(-3)).toStrictEqual([
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

    expect(trace).toStrictEqual(["build:inner", "build:outer"]);

    await wrapped(1);
    await wrapped(2);

    expect(trace).toStrictEqual([
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
    expect(trace).toStrictEqual(["beta:B", "alpha:A"]);
  });

  it("skipHof: true resolves to fn itself and builds no layer", async () => {
    const trace: string[] = [];
    const fn = async (value: number) => value;

    const wrapped = withAsync(tracerAsync(trace, "outer"))(fn, {
      skipHof: true,
    });

    expect(wrapped).toBe(fn);
    expect(trace).toStrictEqual([]);
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

    expect(await wrapped(1)).toBe(1);
    expect(!trace.includes("call:outer")).toBeTruthy();
    expect(!trace.includes("call:inner")).toBeTruthy();
    expect(trace.includes("call:fn")).toBeTruthy();
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
    expect(predicateCalls).toBe(1);
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
    expect(trace.includes("call:outer")).toBeTruthy();

    const bypassing = withAsync(tracerAsync(trace, "other"))(fn, {
      skipHof: async () => {
        await Promise.resolve();
        return true;
      },
    });
    await bypassing(1);
    expect(!trace.includes("call:other")).toBeTruthy();
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
    expect(await wrapped.call({ salt: 40 }, 2)).toBe(42);
    expect(trace.includes("call:fn")).toBeTruthy();
  });

  it("returns fn unchanged for an empty stack", async () => {
    const fn = async (value: number) => value;
    expect(withAsync()(fn)).toBe(fn);
  });

  it("keeps a real HOF's own behavior inside the stack", async () => {
    let calls = 0;
    const fn = async (value: number) => {
      calls += 1;
      return value * 2;
    };

    const cached = withAsync(withCacheAsync)(fn);
    expect(await cached(2)).toBe(4);
    expect(await cached(2)).toBe(4);
    expect(calls).toBe(1);
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

    expect(wrapped(1)).toBe(1);
    expect(trace.slice(-3)).toStrictEqual([
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

    expect(wrapped).toBe(fn);
    expect(trace).toStrictEqual([]);
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

    expect(wrapped(1)).toBe(1);
    expect(!trace.includes("call:outer")).toBeTruthy();
    expect(!trace.includes("call:inner")).toBeTruthy();
    expect(trace.includes("call:fn")).toBeTruthy();
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
    expect(predicateCalls).toBe(1);
  });

  it("uses the fallback diagnostic name for an anonymous function", () => {
    const wrapped = withSync(tracerSync([], "outer"))(
      function () {
        return 7;
      },
      { skipHof: () => false },
    );

    expect(wrapped()).toBe(7);
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
    expect(wrapped.call({ salt: 40 }, 2)).toBe(42);
    expect(trace.includes("call:fn")).toBeTruthy();
  });

  it("returns fn unchanged for an empty stack", () => {
    const fn = (value: number) => value;
    expect(withSync()(fn)).toBe(fn);
  });

  it("returns fn unchanged when the whole stack echoes it", () => {
    const echo = createHofSync<TraceKind>((fn) => fn);
    const fn = (value: number) => value;

    expect(withSync(echo)(fn)).toBe(fn);
  });

  it("rejects an asynchronous per-call predicate at call time", () => {
    const fn = (value: number) => value;
    const wrapped = withSync(tracerSync([], "outer"))(fn, {
      // @ts-expect-error: sync composers accept synchronous skip predicates.
      skipHof: async () => false,
    });

    expect(() => wrapped(1)).toThrow(/skipHof predicate/);
  });

  it("keeps a real HOF's own behavior inside the stack", () => {
    let calls = 0;
    const fn = (value: number) => {
      calls += 1;
      return value * 2;
    };

    const cached = withSync(withCacheSync)(fn);
    expect(cached(2)).toBe(4);
    expect(cached(2)).toBe(4);
    expect(calls).toBe(1);
  });
});

describe("type-level contracts", () => {
  it("merges the options of every layer into one bag", () => {
    const options: MergeOptions<
      [HofFn<AlphaKind, "async">, HofFn<BetaKind, "async">],
      (value: number) => number
    > = { alpha: "A", beta: "B" };

    expect(options).toStrictEqual({ alpha: "A", beta: "B" });
  });

  it("guards an async function in the sync composer at call time", () => {
    const wrapped = withSync(tracerSync([], "outer"))(async () => 1);
    expect(() => wrapped()).toThrow();
  });

  it("accepts an async function in the async composer", async () => {
    const fn = async (value: number) => value;
    const wrapped = withAsync(tracerAsync([], "outer"))(fn);
    expect(await wrapped(1)).toBe(1);
  });
});

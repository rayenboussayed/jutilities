import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createHofAsync,
  createHofSync,
  type ApplyKind,
  type HofKind,
} from "./create-hof.js";

interface MarkerKind extends HofKind {
  options: object;
}

describe("createHofSync", () => {
  it("carries the declared kind as a type-only brand (never set at runtime)", () => {
    const hof = createHofSync<MarkerKind>((fn) => fn);

    // Type-level pin: `__kind` resolves to the declared kind, so composers
    // can recover the kind from a HOF value.
    const kind: MarkerKind = hof.__kind;
    assert.strictEqual(kind, undefined);
  });

  it("rejects an async predicate on the sync factory", () => {
    const hof = createHofSync<MarkerKind>((fn) => fn);

    // @ts-expect-error - a sync wrapper's predicate must stay synchronous.
    hof((x: number) => x, { skipHof: async () => true });
  });

  it("resolves a kind's options for the concrete function type", () => {
    const options: ApplyKind<MarkerKind, (x: number) => number> = {};
    assert.deepStrictEqual(options, {});
  });

  it("calls the handler exactly once per wrap, not per call", () => {
    let builds = 0;
    const hof = createHofSync<MarkerKind>((fn) => {
      builds++;
      return function (
        this: ThisParameterType<MarkerKind["fn"]>,
        ...args: Parameters<MarkerKind["fn"]>
      ) {
        return fn.apply(this, args);
      } as MarkerKind["fn"];
    });

    const wrapped = hof((x: number) => x * 2);
    assert.strictEqual(wrapped(21), 42);
    assert.strictEqual(wrapped(2), 4);
    assert.strictEqual(builds, 1);
  });

  it("returns fn itself for skipHof: true without calling the handler", () => {
    let builds = 0;
    const hof = createHofSync<MarkerKind>((fn) => {
      builds++;
      return fn;
    });

    const fn = (x: number) => x + 1;
    assert.strictEqual(hof(fn, { skipHof: true }), fn);
    assert.strictEqual(builds, 0);
  });

  it("echoes fn when the handler returns it (no dispatch layer added)", () => {
    const hof = createHofSync<MarkerKind>((fn) => fn);
    const fn = (x: number) => x + 1;
    assert.strictEqual(hof(fn), fn);
  });

  it("per-call predicate: truthy bypasses, falsy applies the enhancement", () => {
    const hof = createHofSync<MarkerKind>(
      (fn) =>
        function (...args: Parameters<MarkerKind["fn"]>) {
          return ["enhanced", fn(...args)];
        } as MarkerKind["fn"],
    );

    const wrapped = hof((x: number) => x * 2, {
      skipHof: (x: number) => x > 10,
    });
    assert.deepStrictEqual(wrapped(5), ["enhanced", 10]);
    assert.strictEqual(wrapped(50), 100);
  });

  it("forwards this and args on a predicate bypass", () => {
    const hof = createHofSync<MarkerKind>(
      (fn) =>
        function (
          this: ThisParameterType<MarkerKind["fn"]>,
          ...args: Parameters<MarkerKind["fn"]>
        ) {
          return ["enhanced", fn.apply(this, args)];
        } as MarkerKind["fn"],
    );

    /**
     * Receiver-reading adder exercising the raw-bypass `this` forwarding.
     * @param this - Receiver whose `salt` is added to the call argument.
     * @param this.salt - Addend read from the receiver on the raw bypass.
     * @param x - The call argument.
     * @returns `this.salt + x`.
     */
    function fn(this: { salt: number }, x: number) {
      return this.salt + x;
    }

    const wrapped = hof(fn, { skipHof: () => true });
    assert.strictEqual(wrapped.call({ salt: 9 }, 5), 14);
  });

  it("passes the full options object to the handler", () => {
    let seen: unknown;
    const hof = createHofSync<MarkerKind>((fn, options) => {
      seen = options;
      return fn;
    });

    hof((x: number) => x, { skipHof: false });
    assert.deepStrictEqual(seen, { skipHof: false });
  });
});

describe("createHofAsync", () => {
  it("calls the handler exactly once per wrap, not per call", async () => {
    let builds = 0;
    const hof = createHofAsync<MarkerKind>((fn) => {
      builds++;
      return async function (
        this: ThisParameterType<MarkerKind["fn"]>,
        ...args: Parameters<MarkerKind["fn"]>
      ) {
        return fn.apply(this, args);
      } as MarkerKind["fn"];
    });

    const wrapped = hof(async (x: number) => x * 2);
    assert.strictEqual(await wrapped(21), 42);
    assert.strictEqual(await wrapped(2), 4);
    assert.strictEqual(builds, 1);
  });

  it("returns fn itself for skipHof: true without calling the handler", async () => {
    let builds = 0;
    const hof = createHofAsync<MarkerKind>((fn) => {
      builds++;
      return fn;
    });

    const fn = async (x: number) => x + 1;
    assert.strictEqual(hof(fn, { skipHof: true }), fn);
    assert.strictEqual(builds, 0);
  });

  it("echoes fn when the handler returns it (no dispatch layer added)", () => {
    const hof = createHofAsync<MarkerKind>((fn) => fn);
    const fn = async (x: number) => x + 1;
    assert.strictEqual(hof(fn), fn);
  });

  it("per-call predicate: awaited truthy bypasses, falsy applies the enhancement", async () => {
    const hof = createHofAsync<MarkerKind>(
      (fn) =>
        async function (...args: Parameters<MarkerKind["fn"]>) {
          return ["enhanced", await fn(...args)];
        } as MarkerKind["fn"],
    );

    const wrapped = hof(async (x: number) => x * 2, {
      skipHof: async (x: number) => x > 10,
    });
    assert.deepStrictEqual(await wrapped(5), ["enhanced", 10]);
    assert.strictEqual(await wrapped(50), 100);
  });
});

import { describe, expect, it } from "vitest";

import {
  assertGuardConsistency,
  assertNever,
  assertNotNil,
  assertNotRawApplication,
  assertNotRawMemberApplication,
  assert as assertTruthy,
  withAssertAsync,
  withAssertSync,
} from "./assert.js";

describe("assert", () => {
  it("passes for truthy values", () => {
    expect(() => assertTruthy(true)).not.toThrow();
    expect(() => assertTruthy(1)).not.toThrow();
    expect(() => assertTruthy("x")).not.toThrow();
    expect(() => assertTruthy({})).not.toThrow();
    expect(() => assertTruthy([])).not.toThrow();
  });

  it("throws a TypeError for falsy values with the default message", () => {
    expect(() => assertTruthy(0)).toThrow(TypeError);
    expect(() => assertTruthy(false)).toThrow(TypeError);
    expect(() => assertTruthy("")).toThrow(/Assertion failed/);
    expect(() => assertTruthy(NaN)).toThrow(/Assertion failed/);
  });

  it("throws the custom message, prefixed by the subsystem name", () => {
    expect(() => assertTruthy(false, "store must be provided")).toThrow(/store must be provided/);
    expect(() => assertTruthy(0, "store must be provided", "withCache")).toThrow(/withCache: store must be provided/);
    // `undefined` message falls back to the default while the name still applies:
    expect(() => assertTruthy(null, undefined, "withCache")).toThrow(/withCache: Assertion failed/);
  });
});

describe("assertNotNil", () => {
  it("passes falsy-but-non-nil values", () => {
    expect(() => assertNotNil(0)).not.toThrow();
    expect(() => assertNotNil("")).not.toThrow();
    expect(() => assertNotNil(false)).not.toThrow();
    expect(() => assertNotNil(NaN)).not.toThrow();
  });

  it("throws for null and undefined, naming the value", () => {
    expect(() => assertNotNil(null)).toThrow(/value: must not be null or undefined/);
    expect(() => assertNotNil(undefined)).toThrow(/value: must not be null or undefined/);
    expect(() => assertNotNil(undefined, "config")).toThrow(/config: must not be null or undefined/);
  });
});

describe("assertNever", () => {
  it("throws with the default message and a JSON preview", () => {
    expect(() => assertNever("leftover" as never)).toThrow(/Non-exhaustive value reached: "leftover"/);
    expect(() => assertNever({ kind: "x" } as never)).toThrow(/Non-exhaustive value reached: \{"kind":"x"\}/);
    expect(() => assertNever(undefined as never)).toThrow(/Non-exhaustive value reached: undefined/);
  });

  it("renders BigInt payloads through the String fallback", () => {
    // JSON.stringify cannot serialize BigInt, so the String fallback engages:
    expect(() => assertNever({ amount: 1n } as never)).toThrow(/Non-exhaustive value reached: \[object Object\]/);
  });

  it("renders a payload whose toJSON and toString both throw (typeof fallback)", () => {
    class Revolting {
      toJSON() {
        throw new Error("json boom");
      }
      toString() {
        throw new Error("string boom");
      }
    }
    expect(() => assertNever(new Revolting() as never)).toThrow(/Non-exhaustive value reached: object/);
  });

  it("honors a custom message", () => {
    expect(() => assertNever(1 as never, "unreachable kind")).toThrow(/unreachable kind: 1/);
  });
});

describe("assertNotRawApplication", () => {
  it("throws a readable TypeError for raw decoration contexts", () => {
    expect(() =>
        assertNotRawApplication(
          { addInitializer() {}, kind: "method", name: "load" },
          "decorateMethod",
        )).toThrow(/decorateMethod: applied without parentheses — decorate with decorateMethod\(...options\) instead/);
  });

  it("passes regular option bags", () => {
    expect(() => assertNotRawApplication(undefined, "x")).not.toThrow();
    expect(() => assertNotRawApplication({}, "x")).not.toThrow();
    expect(() => assertNotRawApplication({ require: "sync" }, "x"),).not.toThrow();
  });
});

describe("assertNotRawMemberApplication", () => {
  it("throws for the (member, context) rest fingerprint", () => {
    const wrap = (x: unknown): unknown => x;
    expect(() => assertNotRawMemberApplication([wrap, { kind: "method" }], "decorateMethod")).toThrow(/decorateMethod: applied without parentheses/);
  });

  it("passes legit option rests", () => {
    const wrap = (x: unknown): unknown => x;
    expect(() => assertNotRawMemberApplication([{}], "x")).not.toThrow();
    expect(() => assertNotRawMemberApplication([wrap], "x")).not.toThrow();
    expect(() => assertNotRawMemberApplication([wrap, {}], "x")).not.toThrow();
    expect(() => assertNotRawMemberApplication([{}, { kind: "method" }], "x"),).not.toThrow();
    expect(() => assertNotRawMemberApplication([wrap, { kind: "method" }, 1], "x"),).not.toThrow();
  });
});

describe("assertGuardConsistency", () => {
  it("throws when require: sync meets an async member", () => {
    expect(() =>
        assertGuardConsistency({ require: "sync" }, true, "decorateMethod", "load")).toThrow(/member "load" is an async function, but require: "sync" was requested/);
  });

  it("throws when require: async meets a sync member", () => {
    expect(() =>
        assertGuardConsistency({ require: "async" }, false, "decorateGetter", "picked")).toThrow(/member "picked" is not an async function, but require: "async" was requested/);
  });

  it("accepts agreements and undefined guards", () => {
    expect(() =>
      assertGuardConsistency({ require: "sync" }, false, "decorateMethod", "load"),).not.toThrow();
    expect(() =>
      assertGuardConsistency({ require: "async" }, true, "decorateMethod", "load"),).not.toThrow();
    expect(() =>
      assertGuardConsistency(undefined, true, "decorateMethod", "load"),).not.toThrow();
    expect(() =>
      assertGuardConsistency(undefined, false, "decorateMethod", "load"),).not.toThrow();
  });
});

describe("withAssertSync", () => {
  it("validates the result and reports the call parameters", () => {
    const seen: { parameters: number[]; result: number }[] = [];
    const wrapped = withAssertSync(
      (a: number, b: number) => a + b,
      {
        onResult: ({ parameters, result }) => {
          seen.push({ parameters, result });
        },
      },
    );

    expect(wrapped(2, 3)).toBe(5);
    expect(seen).toStrictEqual([{ parameters: [2, 3], result: 5 }]);
  });

  it("replaces an invalid result with the validator's thrown error", () => {
    const wrapped = withAssertSync(() => undefined, {
      onResult: ({ result }) => assertNotNil(result, "user"),
    });

    expect(() => wrapped()).toThrow(TypeError);
  });

  it("skipHof: true resolves to fn itself at wrap time", () => {
    const fn = (x: number) => x + 1;
    expect(withAssertSync(fn, {
        onResult: ({ result }) => assertNotNil(result, "never-called"),
        skipHof: true,
      })).toBe(fn);
  });

  it("per-call skipHof predicate skips validation (raw result passes through)", () => {
    const wrapped = withAssertSync(
      () => undefined,
      {
        onResult: ({ result }) => assertNotNil(result, "must-not-run"),
        skipHof: () => true,
      },
    );

    expect(wrapped()).toBeUndefined();
  });
});

describe("withAssertAsync", () => {
  it("validates the awaited result and returns it", async () => {
    let checked = 0;
    const wrapped = withAssertAsync(
      async (id: number) => ({ id }),
      {
        onResult: ({ parameters, result }) => {
          checked++;
          expect(parameters).toStrictEqual([7]);
          expect(result).toStrictEqual({ id: 7 });
        },
      },
    );

    expect(await wrapped(7)).toStrictEqual({ id: 7 });
    expect(checked).toBe(1);
  });

  it("awaits an async validator and rejects the call when it throws", async () => {
    const wrapped = withAssertAsync(
      async () => null,
      {
        onResult: async ({ result }) => {
          await Promise.resolve();
          assertNotNil(result, "user");
        },
      },
    );

    await expect(wrapped()).rejects.toThrow(/user: must not be null or undefined/);
  });

  it("propagates wrapped rejections untouched without invoking the validator", async () => {
    let called = 0;
    const sentinel = new Error("network down");
    const wrapped = withAssertAsync(
      async () => {
        throw sentinel;
      },
      {
        onResult: () => {
          called++;
        },
      },
    );

    await expect(wrapped()).rejects.toSatisfy((error: unknown): boolean => error === sentinel);
    expect(called).toBe(0);
  });

  it("skipHof: true resolves to fn itself at wrap time", async () => {
    const fn = async (x: number) => x + 1;
    expect(withAssertAsync(fn, {
        onResult: ({ result }) => assertNotNil(result, "never-called"),
        skipHof: true,
      })).toBe(fn);
  });

  it("per-call skipHof predicate skips validation (raw result passes through)", async () => {
    const wrapped = withAssertAsync(
      async () => null,
      {
        onResult: ({ result }) => assertNotNil(result, "must-not-run"),
        skipHof: () => true,
      },
    );

    expect(await wrapped()).toBeNull();
  });
});

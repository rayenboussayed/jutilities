import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assert as assertTruthy,
  assertGuardConsistency,
  assertNever,
  assertNotNil,
  assertNotRawApplication,
  assertNotRawMemberApplication,
  withAssertAsync,
  withAssertSync,
} from "./assert.js";

describe("assert", () => {
  it("passes for truthy values", () => {
    assert.doesNotThrow(() => assertTruthy(true));
    assert.doesNotThrow(() => assertTruthy(1));
    assert.doesNotThrow(() => assertTruthy("x"));
    assert.doesNotThrow(() => assertTruthy({}));
    assert.doesNotThrow(() => assertTruthy([]));
  });

  it("throws a TypeError for falsy values with the default message", () => {
    assert.throws(
      () => assertTruthy(0),
      { name: "TypeError", message: /Assertion failed/ },
    );
    assert.throws(() => assertTruthy(false), { name: "TypeError" });
    assert.throws(() => assertTruthy(""), /Assertion failed/);
    assert.throws(() => assertTruthy(NaN), /Assertion failed/);
  });

  it("throws the custom message, prefixed by the subsystem name", () => {
    assert.throws(
      () => assertTruthy(false, "store must be provided"),
      /store must be provided/,
    );
    assert.throws(
      () => assertTruthy(0, "store must be provided", "withCache"),
      /withCache: store must be provided/,
    );
    // `undefined` message falls back to the default while the name still applies:
    assert.throws(
      () => assertTruthy(null, undefined, "withCache"),
      /withCache: Assertion failed/,
    );
  });
});

describe("assertNotNil", () => {
  it("passes falsy-but-non-nil values", () => {
    assert.doesNotThrow(() => assertNotNil(0));
    assert.doesNotThrow(() => assertNotNil(""));
    assert.doesNotThrow(() => assertNotNil(false));
    assert.doesNotThrow(() => assertNotNil(NaN));
  });

  it("throws for null and undefined, naming the value", () => {
    assert.throws(
      () => assertNotNil(null),
      /value: must not be null or undefined/,
    );
    assert.throws(() => assertNotNil(undefined), /value: must not be null or undefined/);
    assert.throws(
      () => assertNotNil(undefined, "config"),
      /config: must not be null or undefined/,
    );
  });
});

describe("assertNever", () => {
  it("throws with the default message and a JSON preview", () => {
    assert.throws(
      () => assertNever("leftover" as never),
      /Non-exhaustive value reached: "leftover"/,
    );
    assert.throws(() => assertNever({ kind: "x" } as never), /Non-exhaustive value reached: \{"kind":"x"\}/);
  });

  it("renders BigInt payloads through the String fallback", () => {
    // JSON.stringify cannot serialize BigInt, so the String fallback engages:
    assert.throws(
      () => assertNever({ amount: 1n } as never),
      /Non-exhaustive value reached: \[object Object\]/,
    );
  });

  it("honors a custom message", () => {
    assert.throws(
      () => assertNever(1 as never, "unreachable kind"),
      /unreachable kind: 1/,
    );
  });
});

describe("assertNotRawApplication", () => {
  it("throws a readable TypeError for raw decoration contexts", () => {
    assert.throws(
      () =>
        assertNotRawApplication(
          { kind: "method", name: "load", addInitializer() {} },
          "decorateMethod",
        ),
      /decorateMethod: applied without parentheses — decorate with decorateMethod\(...options\) instead/,
    );
  });

  it("passes regular option bags", () => {
    assert.doesNotThrow(() => assertNotRawApplication(undefined, "x"));
    assert.doesNotThrow(() => assertNotRawApplication({}, "x"));
    assert.doesNotThrow(
      () => assertNotRawApplication({ require: "sync" }, "x"),
    );
  });
});

describe("assertNotRawMemberApplication", () => {
  it("throws for the (member, context) rest fingerprint", () => {
    const wrap = (x: unknown): unknown => x;
    assert.throws(
      () => assertNotRawMemberApplication([wrap, { kind: "method" }], "decorateMethod"),
      /decorateMethod: applied without parentheses/,
    );
  });

  it("passes legit option rests", () => {
    const wrap = (x: unknown): unknown => x;
    assert.doesNotThrow(() => assertNotRawMemberApplication([{}], "x"));
    assert.doesNotThrow(() => assertNotRawMemberApplication([wrap], "x"));
    assert.doesNotThrow(() => assertNotRawMemberApplication([wrap, {}], "x"));
    assert.doesNotThrow(
      () => assertNotRawMemberApplication([{}, { kind: "method" }], "x"),
    );
    assert.doesNotThrow(
      () => assertNotRawMemberApplication([wrap, { kind: "method" }, 1], "x"),
    );
  });
});

describe("assertGuardConsistency", () => {
  it("throws when require: sync meets an async member", () => {
    assert.throws(
      () =>
        assertGuardConsistency({ require: "sync" }, true, "decorateMethod", "load"),
      /member "load" is an async function, but require: "sync" was requested/,
    );
  });

  it("throws when require: async meets a sync member", () => {
    assert.throws(
      () =>
        assertGuardConsistency({ require: "async" }, false, "decorateGetter", "picked"),
      /member "picked" is not an async function, but require: "async" was requested/,
    );
  });

  it("accepts agreements and undefined guards", () => {
    assert.doesNotThrow(() =>
      assertGuardConsistency({ require: "sync" }, false, "decorateMethod", "load"),
    );
    assert.doesNotThrow(() =>
      assertGuardConsistency({ require: "async" }, true, "decorateMethod", "load"),
    );
    assert.doesNotThrow(() =>
      assertGuardConsistency(undefined, true, "decorateMethod", "load"),
    );
    assert.doesNotThrow(() =>
      assertGuardConsistency(undefined, false, "decorateMethod", "load"),
    );
  });
});

describe("withAssertSync", () => {
  it("validates the result and reports the call parameters", () => {
    const seen: { parameters: number[]; result: number }[] = [];
    const wrapped = withAssertSync(
      (a: number, b: number) => a + b,
      ({ parameters, result }) => {
        seen.push({ parameters, result });
      },
    );

    assert.strictEqual(wrapped(2, 3), 5);
    assert.deepStrictEqual(seen, [{ parameters: [2, 3], result: 5 }]);
  });

  it("replaces an invalid result with the validator's thrown error", () => {
    const wrapped = withAssertSync(
      () => undefined,
      ({ result }) => assertNotNil(result, "user"),
    );

    assert.throws(() => wrapped(), {
      name: "TypeError",
      message: /user: must not be null or undefined/,
    });
  });
});

describe("withAssertAsync", () => {
  it("validates the awaited result and returns it", async () => {
    let checked = 0;
    const wrapped = withAssertAsync(
      async (id: number) => ({ id }),
      ({ parameters, result }) => {
        checked++;
        assert.deepStrictEqual(parameters, [7]);
        assert.deepStrictEqual(result, { id: 7 });
      },
    );

    assert.deepStrictEqual(await wrapped(7), { id: 7 });
    assert.strictEqual(checked, 1);
  });

  it("awaits an async validator and rejects the call when it throws", async () => {
    const wrapped = withAssertAsync(
      async () => null,
      async ({ result }) => {
        await Promise.resolve();
        assertNotNil(result, "user");
      },
    );

    await assert.rejects(wrapped(), /user: must not be null or undefined/);
  });

  it("propagates wrapped rejections untouched without invoking the validator", async () => {
    let called = 0;
    const sentinel = new Error("network down");
    const wrapped = withAssertAsync(
      async () => {
        throw sentinel;
      },
      () => {
        called++;
      },
    );

    await assert.rejects(
      wrapped(),
      (error: unknown): boolean => error === sentinel,
    );
    assert.strictEqual(called, 0);
  });
});

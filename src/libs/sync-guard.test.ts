import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { createHofSync, type HofKind } from "./create-hof.js";
import {
  assertSyncReturn,
  guardSyncFunction,
  isSyncReturnViolation,
} from "./sync-guard.js";

interface MarkerKind extends HofKind {
  options: object;
}

/**
 * Builds a function whose Symbol.toStringTag getter throws.
 * @returns Object with a hostile tag getter.
 */
function hostileToStringTag() {
  return {
    get [Symbol.toStringTag]() {
      throw new Error("tag getter failed");
    },
  };
}

describe("isSyncReturnViolation", () => {
  it("rejects nullish, generator and async-generator values", () => {
    assert.strictEqual(isSyncReturnViolation(null), false);
    assert.strictEqual(isSyncReturnViolation(undefined), false);
    assert.strictEqual(isSyncReturnViolation((function* () {})()), true);
    assert.strictEqual(isSyncReturnViolation((async function* () {})()), true);
  });

  it("treats ordinary objects and thenables without the Promise tag as sync", () => {
    assert.strictEqual(isSyncReturnViolation({}), false);
    assert.strictEqual(isSyncReturnViolation({ then: () => {} }), false);
  });

  it("treats a hostile tag getter as not-yet-a-violation", () => {
    assert.strictEqual(isSyncReturnViolation(hostileToStringTag()), false);
  });

  it("detects promises even when customized by a subclass tag", () => {
    class TaggedPromise extends Promise<number> {
      override get [Symbol.toStringTag](): string {
        return "NotPromise";
      }
    }

    assert.strictEqual(
      isSyncReturnViolation(new TaggedPromise((resolve) => resolve(1))),
      true,
    );
  });
});

describe("assertSyncReturn", () => {
  it("passes for ordinary values and throws TypeError otherwise", () => {
    assert.doesNotThrow(() => assertSyncReturn(0));
    assert.throws(
      () => assertSyncReturn(Promise.resolve(1)),
      (error) =>
        error instanceof TypeError &&
        /promise or generator/.test((error as Error).message),
    );
    assert.throws(
      () => assertSyncReturn((function* () {})(), "custom worker"),
      /custom worker/,
    );
  });
});

describe("guardSyncFunction", () => {
  it("copies identity metadata onto the guarded wrapper", () => {
    /**
     * Representative wrapper fixture.
     * @param left - Left operand.
     * @param right - Right operand.
     * @returns The sum of the operands.
     */
    function source(left: number, right: number) {
      return left + right;
    }
    const decorated = Object.assign(source, { custom: "metadata" });
    Reflect.defineProperty(decorated, "customSymbol", {
      value: "symbol metadata",
    });

    const guarded = guardSyncFunction(decorated);
    assert.strictEqual(guarded(2, 3), 5);
    assert.strictEqual(guarded.name, "source");
    assert.strictEqual(guarded.length, 2);
    assert.strictEqual((guarded as typeof decorated).custom, "metadata");
    assert.strictEqual(
      (guarded as typeof decorated & { customSymbol: unknown }).customSymbol,
      "symbol metadata",
    );
    assert.match(guarded.toString(), /function source/);
  });

  it("survives hostile proxy own-key layouts without throwing", () => {
    const target = () => "safe";
    const withoutDescriptor = new Proxy(target, {
      getOwnPropertyDescriptor: () => undefined,
      ownKeys: () => ["ghost"],
    });
    const explodingDescriptor = new Proxy(target, {
      getOwnPropertyDescriptor: () => {
        throw new TypeError("hostile descriptor");
      },
      ownKeys: () => ["ghost"],
    });

    assert.doesNotThrow(() => guardSyncFunction(withoutDescriptor));
    assert.doesNotThrow(() => guardSyncFunction(explodingDescriptor));
    assert.strictEqual(guardSyncFunction(withoutDescriptor)(), "safe");
  });
});

describe("createHofSync guard integration", () => {
  it("rejects enhancers that return promises when no predicate is configured", () => {
    const hof = createHofSync<MarkerKind>(() => () =>
      Promise.resolve("forbidden"),
    );
    const wrapped = hof(() => 1);

    assert.throws(() => wrapped(), /promise or generator/);
  });

  it("rejects an asynchronous skipHof predicate", () => {
    const hof = createHofSync<MarkerKind>(
      (fn) =>
        function (...args: Parameters<typeof fn>) {
          return fn(...args);
        } as typeof fn,
    );
    const wrapped = hof(() => 1, {
      // @ts-expect-error: async predicates belong to the async HOF flavor.
      skipHof: async () => true,
    });

    assert.throws(() => wrapped(), /skipHof predicate/);
  });
});

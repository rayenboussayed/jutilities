import { describe, expect, it } from "vitest";

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
    expect(isSyncReturnViolation(null)).toBe(false);
    expect(isSyncReturnViolation(undefined)).toBe(false);
    expect(isSyncReturnViolation((function* () {})())).toBe(true);
    expect(isSyncReturnViolation((async function* () {})())).toBe(true);
  });

  it("treats ordinary objects and thenables without the Promise tag as sync", () => {
    expect(isSyncReturnViolation({})).toBe(false);
    expect(isSyncReturnViolation({ then: () => {} })).toBe(false);
  });

  it("treats a hostile tag getter as not-yet-a-violation", () => {
    expect(isSyncReturnViolation(hostileToStringTag())).toBe(false);
  });

  it("detects promises even when customized by a subclass tag", () => {
    class TaggedPromise extends Promise<number> {
      override get [Symbol.toStringTag](): string {
        return "NotPromise";
      }
    }

    expect(isSyncReturnViolation(new TaggedPromise((resolve) => resolve(1)))).toBe(true);
  });
});

describe("assertSyncReturn", () => {
  it("passes for ordinary values and throws TypeError otherwise", () => {
    expect(() => assertSyncReturn(0)).not.toThrow();
    expect(() => assertSyncReturn(Promise.resolve(1))).toThrow();
    expect(() => assertSyncReturn((function* () {})(), "custom worker")).toThrow(/custom worker/);
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
    expect(guarded(2, 3)).toBe(5);
    expect(guarded.name).toBe("source");
    expect(guarded).toHaveLength(2);
    expect((guarded as typeof decorated).custom).toBe("metadata");
    expect((guarded as typeof decorated & { customSymbol: unknown }).customSymbol).toBe("symbol metadata");
    expect(guarded.toString()).toMatch(/function source/);
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

    expect(() => guardSyncFunction(withoutDescriptor)).not.toThrow();
    expect(() => guardSyncFunction(explodingDescriptor)).not.toThrow();
    expect(guardSyncFunction(withoutDescriptor)()).toBe("safe");
  });
});

describe("createHofSync guard integration", () => {
  it("rejects enhancers that return promises when no predicate is configured", () => {
    const hof = createHofSync<MarkerKind>(() => () =>
      Promise.resolve("forbidden"),
    );
    const wrapped = hof(() => 1);

    expect(() => wrapped()).toThrow(/promise or generator/);
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

    expect(() => wrapped()).toThrow(/skipHof predicate/);
  });
});

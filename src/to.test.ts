import { describe, expect, it } from "vitest";

import { fromBase64 } from "./from.js";
import { toArray, toBase64, toSeconds } from "./to.js";

describe("toArray", () => {
  it("wraps scalars in a single-element array", () => {
    expect(toArray(1)).toStrictEqual([1]);
    expect(toArray("a")).toStrictEqual(["a"]);
    expect(toArray({})).toStrictEqual([{}]);
  });

  it("wraps null and undefined instead of returning empty", () => {
    expect(toArray(null)).toStrictEqual([null]);
    expect(toArray(undefined)).toStrictEqual([undefined]);
  });

  it("wraps falsy scalars", () => {
    expect(toArray(0)).toStrictEqual([0]);
    expect(toArray("")).toStrictEqual([""]);
    expect(toArray(false)).toStrictEqual([false]);
    expect(toArray(NaN)).toStrictEqual([NaN]);
  });

  it("returns arrays by identity (same reference)", () => {
    const arr: number[] = [];
    expect(toArray(arr)).toBe(arr);
    const nested = [[1]];
    expect(toArray(nested)).toBe(nested);
    const two = [1, 2];
    expect(toArray(two)).toBe(two);
    // does not flatten
    expect(toArray([[1]])).toStrictEqual([[1]]);
  });

  it("returns a fresh array for each scalar call", () => {
    expect(toArray(1)).not.toBe(toArray(1));
  });

  it("mutation of array input reflects in original, scalar does not", () => {
    const arr = [1];
    const out = toArray(arr);
    out.push(2);
    expect(arr).toStrictEqual([1, 2]);

    const scalarOut = toArray(1);
    scalarOut.push(2);
    expect(scalarOut).toStrictEqual([1, 2]);
    // scalar itself unaffected (primitives immutable)
    // eslint-disable-next-line sonarjs/no-trivial-assertions
    expect(1).toBe(1);
  });

  it("preserves subclass arrays via Array.isArray", () => {
    class MyArray<T> extends Array<T> {}
    const sub = new MyArray<number>();
    expect(toArray(sub)).toBe(sub);
  });

  it("wraps array-likes that are not real arrays", () => {
    const typed = new Uint8Array([1, 2]);
    const wrapped = toArray(typed);
    expect(wrapped).toHaveLength(1);
    expect(wrapped[0]).toBe(typed);

    const arrayLike = { 0: "a", length: 1 };
    expect(toArray(arrayLike)).toStrictEqual([arrayLike]);
  });

  it("passes through frozen arrays by identity", () => {
    const frozen = Object.freeze([1, 2]) as unknown as number[];
    expect(toArray(frozen)).toBe(frozen);
  });
});

describe("toBase64 (Node branch)", () => {
  it("encodes known vectors", () => {
    expect(toBase64(new Uint8Array([104, 105]))).toBe("aGk=");
    expect(toBase64(new Uint8Array(0))).toBe("");
  });

  it("encodes only the viewed slice (byteOffset/byteLength respected)", () => {
    const view = new Uint8Array([9, 104, 105, 9]).subarray(1, 3);
    expect(view.byteOffset).toBe(1);
    expect(toBase64(view)).toBe("aGk=");
  });

  it("round-trips arbitrary bytes incl. 0 and 255", () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 250, 255]);
    expect([...fromBase64(toBase64(bytes))]).toStrictEqual([...bytes]);
  });

  it("handles large payloads", () => {
    const bytes = new Uint8Array(10_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(bytes)).byteLength).toBe(10_000);
  });
});

describe("toBase64 (browser branch via window stub)", () => {
  it("encodes through btoa", () => {
    const g = globalThis as { window?: unknown };
    g.window = {};
    try {
      expect(toBase64(new Uint8Array([104, 105]))).toBe("aGk=");
    } finally {
      delete g.window;
    }
  });
});


describe("toSeconds", () => {
  it("rounds milliseconds to whole seconds", () => {
    expect(toSeconds(0)).toBe(0);
    expect(toSeconds(499)).toBe(0);
    expect(toSeconds(1000)).toBe(1);
  });
});

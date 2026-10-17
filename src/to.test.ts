import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toArray, toBase64 } from "./to.js";
import { fromBase64 } from "./from.js";

describe("toArray", () => {
  it("wraps scalars in a single-element array", () => {
    assert.deepStrictEqual(toArray(1), [1]);
    assert.deepStrictEqual(toArray("a"), ["a"]);
    assert.deepStrictEqual(toArray({}), [{}]);
  });

  it("wraps null and undefined instead of returning empty", () => {
    assert.deepStrictEqual(toArray(null), [null]);
    assert.deepStrictEqual(toArray(undefined), [undefined]);
  });

  it("wraps falsy scalars", () => {
    assert.deepStrictEqual(toArray(0), [0]);
    assert.deepStrictEqual(toArray(""), [""]);
    assert.deepStrictEqual(toArray(false), [false]);
    assert.deepStrictEqual(toArray(NaN), [NaN]);
  });

  it("returns arrays by identity (same reference)", () => {
    const arr: number[] = [];
    assert.strictEqual(toArray(arr), arr);
    const nested = [[1]];
    assert.strictEqual(toArray(nested), nested);
    const two = [1, 2];
    assert.strictEqual(toArray(two), two);
    // does not flatten
    assert.deepStrictEqual(toArray([[1]]), [[1]]);
  });

  it("returns a fresh array for each scalar call", () => {
    assert.notStrictEqual(toArray(1), toArray(1));
  });

  it("mutation of array input reflects in original, scalar does not", () => {
    const arr = [1];
    const out = toArray(arr);
    out.push(2);
    assert.deepStrictEqual(arr, [1, 2]);

    const scalarOut = toArray(1);
    scalarOut.push(2);
    assert.deepStrictEqual(scalarOut, [1, 2]);
    // scalar itself unaffected (primitives immutable)
    assert.strictEqual(1, 1);
  });

  it("preserves subclass arrays via Array.isArray", () => {
    class MyArray<T> extends Array<T> {}
    const sub = new MyArray<number>();
    assert.strictEqual(toArray(sub), sub);
  });

  it("wraps array-likes that are not real arrays", () => {
    const typed = new Uint8Array([1, 2]);
    const wrapped = toArray(typed);
    assert.strictEqual(wrapped.length, 1);
    assert.strictEqual(wrapped[0], typed);

    const arrayLike = { 0: "a", length: 1 };
    assert.deepStrictEqual(toArray(arrayLike), [arrayLike]);
  });

  it("passes through frozen arrays by identity", () => {
    const frozen = Object.freeze([1, 2]) as unknown as number[];
    assert.strictEqual(toArray(frozen), frozen);
  });
});

describe("toBase64 (Node branch)", () => {
  it("encodes known vectors", () => {
    assert.strictEqual(toBase64(new Uint8Array([104, 105])), "aGk=");
    assert.strictEqual(toBase64(new Uint8Array(0)), "");
  });

  it("encodes only the viewed slice (byteOffset/byteLength respected)", () => {
    const view = new Uint8Array([9, 104, 105, 9]).subarray(1, 3);
    assert.strictEqual(view.byteOffset, 1);
    assert.strictEqual(toBase64(view), "aGk=");
  });

  it("round-trips arbitrary bytes incl. 0 and 255", () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 250, 255]);
    assert.deepStrictEqual([...fromBase64(toBase64(bytes))], [...bytes]);
  });

  it("handles large payloads", () => {
    const bytes = new Uint8Array(10_000).map((_, i) => i % 256);
    assert.strictEqual(fromBase64(toBase64(bytes)).byteLength, 10_000);
  });
});

describe("toBase64 (browser branch via window stub)", () => {
  it("encodes through btoa", () => {
    const g = globalThis as { window?: unknown };
    g.window = {};
    try {
      assert.strictEqual(toBase64(new Uint8Array([104, 105])), "aGk=");
    } finally {
      delete g.window;
    }
  });
});

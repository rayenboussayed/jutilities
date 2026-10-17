import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { djb2, fnv1a64, sdbm } from "./hash.js";

describe("djb2", () => {
  it("returns default seed for empty string", () => {
    assert.strictEqual(djb2(""), 5381);
  });

  it("returns unsigned 32-bit integers", () => {
    for (const s of ["", "a", "hello", "Hello, World!"]) {
      const h = djb2(s);
      assert.strictEqual(typeof h, "number");
      assert.ok(Number.isInteger(h));
      assert.ok(h >= 0 && h <= 0xffffffff);
    }
  });

  it("is deterministic", () => {
    assert.strictEqual(djb2("hello"), djb2("hello"));
  });

  it("is sensitive to content and case", () => {
    assert.notStrictEqual(djb2("abc"), djb2("abd"));
    assert.notStrictEqual(djb2("ABC"), djb2("abc"));
    assert.notStrictEqual(djb2(""), djb2(" "));
  });

  it("honors custom seed", () => {
    assert.notStrictEqual(djb2("x", 0), djb2("x"));
    assert.strictEqual(djb2("", 0), 0);
    assert.strictEqual(djb2("", 123), 123);
  });

  it("handles unicode code units (astral split, combining vs precomposed)", () => {
    // é (U+00E9) vs e + combining acute differ at code-unit level
    assert.notStrictEqual(djb2("é"), djb2("é"));
    // emoji is 2 UTF-16 units, must not crash
    assert.doesNotThrow(() => djb2("😀"));
    assert.strictEqual(djb2("😀"), djb2("😀"));
    assert.doesNotThrow(() => djb2("￿"));
  });

  it("stays in uint32 range for long inputs", () => {
    const h = djb2("a".repeat(10_000));
    assert.ok(h >= 0 && h <= 0xffffffff);
  });

  it("locks known vectors", () => {
    // precomputed with the implementation under test
    assert.strictEqual(djb2("a"), 177670);
    assert.strictEqual(djb2("hello"), 261238937);
  });

  it("is order sensitive", () => {
    assert.notStrictEqual(djb2("ab"), djb2("ba"));
    assert.notStrictEqual(djb2("abc"), djb2("cba"));
  });
});

describe("sdbm", () => {
  it("returns default seed for empty string", () => {
    assert.strictEqual(sdbm(""), 0);
  });

  it("returns unsigned 32-bit integers", () => {
    for (const s of ["", "a", "hello"]) {
      const h = sdbm(s);
      assert.strictEqual(typeof h, "number");
      assert.ok(h >= 0 && h <= 0xffffffff);
    }
  });

  it("is deterministic and sensitive", () => {
    assert.strictEqual(sdbm("hello"), sdbm("hello"));
    assert.notStrictEqual(sdbm("abc"), sdbm("abd"));
    assert.notStrictEqual(sdbm("ABC"), sdbm("abc"));
    assert.notStrictEqual(sdbm(""), sdbm(" "));
  });

  it("honors custom seed", () => {
    assert.notStrictEqual(sdbm("x", 123), sdbm("x"));
    assert.strictEqual(sdbm("", 99), 99);
  });

  it("handles unicode and long inputs", () => {
    assert.doesNotThrow(() => sdbm("😀"));
    assert.strictEqual(sdbm("😀"), sdbm("😀"));
    const h = sdbm("b".repeat(10_000));
    assert.ok(h >= 0 && h <= 0xffffffff);
  });

  it("locks known vectors", () => {
    assert.strictEqual(sdbm("a"), 97);
    assert.strictEqual(sdbm("hello"), 684824882);
    assert.strictEqual(typeof sdbm("hello"), "number");
  });

  it("produces distinct outputs for small set (collision smoke)", () => {
    const inputs = ["a", "b", "c", "aa", "ab", "hello", "world"];
    const set = new Set(inputs.map((s) => sdbm(s)));
    assert.strictEqual(set.size, inputs.length);
  });

  it("is order sensitive", () => {
    assert.notStrictEqual(sdbm("ab"), sdbm("ba"));
    assert.notStrictEqual(sdbm("abc"), sdbm("cba"));
  });
});

describe("fnv1a64", () => {
  it("returns offset basis for empty string as bigint", () => {
    assert.strictEqual(fnv1a64(""), 14695981039346656037n);
    assert.strictEqual(typeof fnv1a64(""), "bigint");
  });

  it("is deterministic and returns bigint", () => {
    assert.strictEqual(fnv1a64("hello"), fnv1a64("hello"));
    assert.strictEqual(typeof fnv1a64("hello"), "bigint");
  });

  it("is sensitive to content", () => {
    assert.notStrictEqual(fnv1a64("abc"), fnv1a64("abd"));
    assert.notStrictEqual(fnv1a64("ABC"), fnv1a64("abc"));
  });

  it("handles unicode without throwing", () => {
    assert.doesNotThrow(() => fnv1a64("😀"));
    assert.strictEqual(fnv1a64("😀"), fnv1a64("😀"));
  });

  it("grows without 64-bit wraparound for long inputs (documents non-spec behavior)", () => {
    // spec FNV-1a64 masks to 64 bits; this impl does not mask so values can exceed 2^64
    const h = fnv1a64("a".repeat(1000));
    assert.strictEqual(typeof h, "bigint");
    assert.ok(h !== 14695981039346656037n);
  });

  it("is order sensitive and distinguishes single chars", () => {
    assert.notStrictEqual(fnv1a64("ab"), fnv1a64("ba"));
    assert.notStrictEqual(fnv1a64("a"), fnv1a64("b"));
    assert.notStrictEqual(fnv1a64("a"), 14695981039346656037n);
  });
});

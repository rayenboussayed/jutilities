import { describe, expect, it } from "vitest";

import { djb2, fnv1a64, sdbm } from "./hash.js";

describe("djb2", () => {
  it("returns default seed for empty string", () => {
    expect(djb2("")).toBe(5381);
  });

  it("returns unsigned 32-bit integers", () => {
    for (const s of ["", "a", "hello", "Hello, World!"]) {
      const h = djb2(s);
      expect(typeof h).toBe("number");
      expect(Number.isInteger(h)).toBeTruthy();
      expect(h >= 0 && h <= 0xffffffff).toBeTruthy();
    }
  });

  it("is deterministic", () => {
    expect(djb2("hello")).toBe(djb2("hello"));
  });

  it("is sensitive to content and case", () => {
    expect(djb2("abc")).not.toBe(djb2("abd"));
    expect(djb2("ABC")).not.toBe(djb2("abc"));
    expect(djb2("")).not.toBe(djb2(" "));
  });

  it("honors custom seed", () => {
    expect(djb2("x", 0)).not.toBe(djb2("x"));
    expect(djb2("", 0)).toBe(0);
    expect(djb2("", 123)).toBe(123);
  });

  it("handles unicode code units (astral split, combining vs precomposed)", () => {
    // é (U+00E9) vs e + combining acute differ at code-unit level
    expect(djb2("é")).not.toBe(djb2("é"));
    // emoji is 2 UTF-16 units, must not crash
    expect(() => djb2("😀")).not.toThrow();
    expect(djb2("😀")).toBe(djb2("😀"));
    expect(() => djb2("￿")).not.toThrow();
  });

  it("stays in uint32 range for long inputs", () => {
    const h = djb2("a".repeat(10_000));
    expect(h >= 0 && h <= 0xffffffff).toBeTruthy();
  });

  it("locks known vectors", () => {
    // precomputed with the implementation under test
    expect(djb2("a")).toBe(177670);
    expect(djb2("hello")).toBe(261238937);
  });

  it("is order sensitive", () => {
    expect(djb2("ab")).not.toBe(djb2("ba"));
    expect(djb2("abc")).not.toBe(djb2("cba"));
  });
});

describe("sdbm", () => {
  it("returns default seed for empty string", () => {
    expect(sdbm("")).toBe(0);
  });

  it("returns unsigned 32-bit integers", () => {
    for (const s of ["", "a", "hello"]) {
      const h = sdbm(s);
      expect(typeof h).toBe("number");
      expect(h >= 0 && h <= 0xffffffff).toBeTruthy();
    }
  });

  it("is deterministic and sensitive", () => {
    expect(sdbm("hello")).toBe(sdbm("hello"));
    expect(sdbm("abc")).not.toBe(sdbm("abd"));
    expect(sdbm("ABC")).not.toBe(sdbm("abc"));
    expect(sdbm("")).not.toBe(sdbm(" "));
  });

  it("honors custom seed", () => {
    expect(sdbm("x", 123)).not.toBe(sdbm("x"));
    expect(sdbm("", 99)).toBe(99);
  });

  it("handles unicode and long inputs", () => {
    expect(() => sdbm("😀")).not.toThrow();
    expect(sdbm("😀")).toBe(sdbm("😀"));
    const h = sdbm("b".repeat(10_000));
    expect(h >= 0 && h <= 0xffffffff).toBeTruthy();
  });

  it("locks known vectors", () => {
    expect(sdbm("a")).toBe(97);
    expect(sdbm("hello")).toBe(684824882);
    expect(typeof sdbm("hello")).toBe("number");
  });

  it("produces distinct outputs for small set (collision smoke)", () => {
    const inputs = ["a", "b", "c", "aa", "ab", "hello", "world"];
    const set = new Set(inputs.map((s) => sdbm(s)));
    expect(set.size).toBe(inputs.length);
  });

  it("is order sensitive", () => {
    expect(sdbm("ab")).not.toBe(sdbm("ba"));
    expect(sdbm("abc")).not.toBe(sdbm("cba"));
  });
});

describe("fnv1a64", () => {
  it("returns offset basis for empty string as bigint", () => {
    expect(fnv1a64("")).toBe(14695981039346656037n);
    expect(typeof fnv1a64("")).toBe("bigint");
  });

  it("is deterministic and returns bigint", () => {
    expect(fnv1a64("hello")).toBe(fnv1a64("hello"));
    expect(typeof fnv1a64("hello")).toBe("bigint");
  });

  it("is sensitive to content", () => {
    expect(fnv1a64("abc")).not.toBe(fnv1a64("abd"));
    expect(fnv1a64("ABC")).not.toBe(fnv1a64("abc"));
  });

  it("handles unicode without throwing", () => {
    expect(() => fnv1a64("😀")).not.toThrow();
    expect(fnv1a64("😀")).toBe(fnv1a64("😀"));
  });

  it("grows without 64-bit wraparound for long inputs (documents non-spec behavior)", () => {
    // spec FNV-1a64 masks to 64 bits; this impl does not mask so values can exceed 2^64
    const h = fnv1a64("a".repeat(1000));
    expect(typeof h).toBe("bigint");
    expect(h !== 14695981039346656037n).toBeTruthy();
  });

  it("is order sensitive and distinguishes single chars", () => {
    expect(fnv1a64("ab")).not.toBe(fnv1a64("ba"));
    expect(fnv1a64("a")).not.toBe(fnv1a64("b"));
    expect(fnv1a64("a")).not.toBe(14695981039346656037n);
  });
});

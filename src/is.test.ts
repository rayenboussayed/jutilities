import { describe, expect, it } from "vitest";

import {
  isAsyncFunction,
  isAsyncGeneratorFunction,
  isEmpty,
  isEmptyArray,
  isEmptyRecord,
  isEmptyString,
  isGeneratorFunction,
  isNil,
  isNull,
  isObject,
  isPromise,
  isRawMemberApplication,
  isRecord,
  isThenable,
  isUndefined,
} from "./is.js";

describe("isUndefined", () => {
  it("returns true for undefined and void 0", () => {
    expect(isUndefined(undefined)).toBe(true);
    expect(isUndefined(void 0)).toBe(true);
    const x: unknown = undefined;
    expect(isUndefined(x)).toBe(true);
  });

  it("returns false for null and other values", () => {
    expect(isUndefined(null)).toBe(false);
    expect(isUndefined(0)).toBe(false);
    expect(isUndefined("")).toBe(false);
    expect(isUndefined({})).toBe(false);
    expect(isUndefined(NaN)).toBe(false);
    expect(isUndefined(false)).toBe(false);
  });
});

describe("isNull", () => {
  it("returns true only for null", () => {
    expect(isNull(null)).toBe(true);
  });

  it("returns false for undefined and other values", () => {
    expect(isNull(undefined)).toBe(false);
    expect(isNull(0)).toBe(false);
    expect(isNull(false)).toBe(false);
    expect(isNull("")).toBe(false);
    expect(isNull({})).toBe(false);
    expect(isNull(NaN)).toBe(false);
  });
});

describe("isNil", () => {
  it("returns true for null and undefined", () => {
    expect(isNil(null)).toBe(true);
    expect(isNil(undefined)).toBe(true);
    expect(isNil(void 0)).toBe(true);
  });

  it("returns false for falsy non-nil values", () => {
    expect(isNil(0)).toBe(false);
    expect(isNil("")).toBe(false);
    expect(isNil(false)).toBe(false);
    expect(isNil(NaN)).toBe(false);
    expect(isNil({})).toBe(false);
    expect(isNil([])).toBe(false);
  });
});

describe("isEmptyString", () => {
  it("returns true only for empty string", () => {
    expect(isEmptyString("")).toBe(true);
  });

  it("returns false for non-empty strings", () => {
    expect(isEmptyString(" ")).toBe(false);
    expect(isEmptyString("a")).toBe(false);
  });

  it("returns false for non-strings and boxed strings", () => {
    expect(isEmptyString(0)).toBe(false);
    expect(isEmptyString(null)).toBe(false);
    expect(isEmptyString(undefined)).toBe(false);
    expect(isEmptyString([])).toBe(false);
    expect(isEmptyString({})).toBe(false);
     
    expect(isEmptyString(Object(""))).toBe(false);
  });
});

describe("isEmptyArray", () => {
  it("returns true for empty arrays", () => {
    expect(isEmptyArray([])).toBe(true);
    expect(isEmptyArray(new Array(0))).toBe(true);
    expect(isEmptyArray([])).toBe(true);
  });

  it("returns false for non-empty arrays", () => {
    expect(isEmptyArray([1])).toBe(false);
    expect(isEmptyArray([undefined])).toBe(false);
    expect(isEmptyArray([null])).toBe(false);
  });

  it("returns false for array-likes and non-arrays", () => {
    expect(isEmptyArray({})).toBe(false);
    expect(isEmptyArray("[]")).toBe(false);
    expect(isEmptyArray({ length: 0 })).toBe(false);
    expect(isEmptyArray(null)).toBe(false);
    expect(isEmptyArray(undefined)).toBe(false);
  });
});

describe("isObject", () => {
  it("returns true for plain objects, arrays, and built-ins", () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(new Date())).toBe(true);
    expect(isObject(new Map())).toBe(true);
    expect(isObject(Object.create(null))).toBe(true);
  });

  it("returns false for null, primitives, and functions", () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject(1)).toBe(false);
    expect(isObject("x")).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(() => {})).toBe(false);
    expect(isObject(Symbol("s"))).toBe(false);
  });
});

describe("isRecord", () => {
  it("returns true for plain objects and built-ins (arrays excluded)", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(new Date())).toBe(true);
    expect(isRecord(new Map())).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it("returns false for arrays, null, primitives, and functions", () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(1)).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(() => {})).toBe(false);
    expect(isRecord(Symbol("s"))).toBe(false);
  });
});

describe("isEmptyRecord", () => {
  it("returns true for records with no string keys", () => {
    expect(isEmptyRecord({})).toBe(true);
    expect(isEmptyRecord(Object.create(null))).toBe(true);
    expect(isEmptyRecord(new Date())).toBe(true);
  });

  it("returns false for arrays (not records)", () => {
    expect(isEmptyRecord([])).toBe(false);
    expect(isEmptyRecord([1])).toBe(false);
  });

  it("documents Object.keys ignores symbols", () => {
    expect(isEmptyRecord({ [Symbol("s")]: 1 })).toBe(true);
  });

  it("returns false for records with keys", () => {
    expect(isEmptyRecord({ a: 1 })).toBe(false);
    expect(isEmptyRecord({ a: undefined })).toBe(false);
  });

  it("returns false for non-records", () => {
    expect(isEmptyRecord(null)).toBe(false);
    expect(isEmptyRecord(undefined)).toBe(false);
    expect(isEmptyRecord("")).toBe(false);
  });
});

describe("isEmpty", () => {
  it("returns true for nil, empty string, empty array, empty record", () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty("")).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
  });

  it("returns false for non-empty and falsy primitives", () => {
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty(NaN)).toBe(false);
    expect(isEmpty(" ")).toBe(false);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty({ a: 1 })).toBe(false);
  });

  it("documents surprising empty built-ins", () => {
    // new Date() has no enumerable keys so counts as empty record
    expect(isEmpty(new Date())).toBe(true);
  });
});

describe("isThenable", () => {
  it("returns true for promises and promise-likes", () => {
    expect(isThenable(Promise.resolve())).toBe(true);
    expect(isThenable({ then: () => {} })).toBe(true);
    expect(isThenable(Promise.resolve(1))).toBe(true);
    /**
     *
     */
    async function af() {}
    expect(isThenable(af())).toBe(true);
  });

  it("returns false for non-thenables", () => {
    expect(isThenable(null)).toBe(false);
    expect(isThenable(undefined)).toBe(false);
    expect(isThenable({})).toBe(false);
    expect(isThenable({ then: 1 })).toBe(false);
    expect(isThenable("then")).toBe(false);
    expect(isThenable(0)).toBe(false);
  });

  it("accepts a callable carrying a then property", () => {
    // A function is an object for the duck-typing probe: `typeof` reports
    // "function", so the check must not exclude it.
    const callable = Object.assign(() => "value", { then: () => {} });
    expect(isThenable(callable)).toBe(true);
  });

  it("throws if then getter throws", () => {
    const evil = {
      get then(): unknown {
        throw new Error("getter boom");
      },
    };
    expect(() => isThenable(evil)).toThrow(/getter boom/);
  });
});

describe("isPromise", () => {
  it("returns true for native promises", () => {
    expect(isPromise(Promise.resolve())).toBe(true);
    expect(isPromise(Promise.resolve(1))).toBe(true);
    expect(isPromise(new Promise(() => {}))).toBe(true);
    /**
     *
     */
    async function af() {}
    expect(isPromise(af())).toBe(true);
  });

  it("returns true for thenables with catch and finally functions", () => {
    const fake = {
      catch: () => {},
      finally: () => {},
      then: () => {},
    };
    expect(isPromise(fake)).toBe(true);
  });

  it("returns false for bare thenables without catch/finally", () => {
    expect(isPromise({ then: () => {} })).toBe(false);
    expect(isPromise({ catch: () => {}, then: () => {} })).toBe(false);
    expect(isPromise({ finally: () => {}, then: () => {} })).toBe(false);
  });

  it("returns false for non-promises", () => {
    expect(isPromise(null)).toBe(false);
    expect(isPromise(undefined)).toBe(false);
    expect(isPromise({})).toBe(false);
    expect(isPromise(42)).toBe(false);
    expect(isPromise("then")).toBe(false);
  });
});

describe("isAsyncFunction", () => {
  it("returns true for async functions and methods", () => {
    /**
     *
     */
    async function af() {}
    const arrow = async () => {};
    expect(isAsyncFunction(af)).toBe(true);
    expect(isAsyncFunction(arrow)).toBe(true);
  });

  it("returns false for sync, generator, and async-generator functions", () => {
    /**
     *
     */
    function sync() {}
    /**
     *
     */
    function* gen() {}
    /**
     *
     */
    async function* agen() {}
    expect(isAsyncFunction(sync)).toBe(false);
    expect(isAsyncFunction(gen)).toBe(false);
    expect(isAsyncFunction(agen)).toBe(false);
  });
});

describe("isGeneratorFunction", () => {
  it("returns true for generator functions", () => {
    /**
     *
     */
    function* gen() {}
    expect(isGeneratorFunction(gen)).toBe(true);
  });

  it("returns false for sync, async, and async-generator functions", () => {
    /**
     *
     */
    function sync() {}
    /**
     *
     */
    async function af() {}
    /**
     *
     */
    async function* agen() {}
    expect(isGeneratorFunction(sync)).toBe(false);
    expect(isGeneratorFunction(af)).toBe(false);
    expect(isGeneratorFunction(agen)).toBe(false);
  });
});

describe("isAsyncGeneratorFunction", () => {
  it("returns true for async generator functions", () => {
    /**
     *
     */
    async function* agen() {}
    expect(isAsyncGeneratorFunction(agen)).toBe(true);
  });

  it("returns false for sync, async, and plain generator functions", () => {
    /**
     *
     */
    function sync() {}
    /**
     *
     */
    async function af() {}
    /**
     *
     */
    function* gen() {}
    expect(isAsyncGeneratorFunction(sync)).toBe(false);
    expect(isAsyncGeneratorFunction(af)).toBe(false);
    expect(isAsyncGeneratorFunction(gen)).toBe(false);
  });
});

describe("isRawMemberApplication", () => {
  const descriptor = { value: () => undefined };

  it("returns true for the (target, key, descriptor) fingerprint", () => {
    expect(isRawMemberApplication([Object.prototype, "member", descriptor])).toBe(true);
    expect(isRawMemberApplication([Object.prototype, Symbol("member"), { get: () => 1 }])).toBe(true);
    expect(isRawMemberApplication([Object.prototype, "member", { set: () => undefined }])).toBe(true);
  });

  it("returns false for rests that are not raw decoration invocations", () => {
    expect(isRawMemberApplication([])).toBe(false);
    expect(isRawMemberApplication([Object.prototype])).toBe(false);
    expect(isRawMemberApplication([Object.prototype, "member"])).toBe(false);
    expect(isRawMemberApplication([() => undefined, "member", descriptor])).toBe(false);
    expect(isRawMemberApplication([Object.prototype, 1, descriptor])).toBe(false);
    expect(isRawMemberApplication([Object.prototype, "member", 1])).toBe(false);
    expect(isRawMemberApplication([Object.prototype, "member", {}])).toBe(false);
    expect(isRawMemberApplication([null, "member", descriptor])).toBe(false);
  });
});

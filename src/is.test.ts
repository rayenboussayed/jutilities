import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAsyncFunction,
  isAsyncGeneratorFunction,
  isDecorationContext,
  isEmpty,
  isEmptyArray,
  isEmptyRecord,
  isEmptyString,
  isGeneratorFunction,
  isNil,
  isNull,
  isObject,
  isPromise,
  isRecord,
  isThenable,
  isRawMemberApplication,
  isUndefined,
} from "./is.js";

describe("isUndefined", () => {
  it("returns true for undefined and void 0", () => {
    assert.strictEqual(isUndefined(undefined), true);
    assert.strictEqual(isUndefined(void 0), true);
    const x: unknown = undefined;
    assert.strictEqual(isUndefined(x), true);
  });

  it("returns false for null and other values", () => {
    assert.strictEqual(isUndefined(null), false);
    assert.strictEqual(isUndefined(0), false);
    assert.strictEqual(isUndefined(""), false);
    assert.strictEqual(isUndefined({}), false);
    assert.strictEqual(isUndefined(NaN), false);
    assert.strictEqual(isUndefined(false), false);
  });
});

describe("isNull", () => {
  it("returns true only for null", () => {
    assert.strictEqual(isNull(null), true);
  });

  it("returns false for undefined and other values", () => {
    assert.strictEqual(isNull(undefined), false);
    assert.strictEqual(isNull(0), false);
    assert.strictEqual(isNull(false), false);
    assert.strictEqual(isNull(""), false);
    assert.strictEqual(isNull({}), false);
    assert.strictEqual(isNull(NaN), false);
  });
});

describe("isNil", () => {
  it("returns true for null and undefined", () => {
    assert.strictEqual(isNil(null), true);
    assert.strictEqual(isNil(undefined), true);
    assert.strictEqual(isNil(void 0), true);
  });

  it("returns false for falsy non-nil values", () => {
    assert.strictEqual(isNil(0), false);
    assert.strictEqual(isNil(""), false);
    assert.strictEqual(isNil(false), false);
    assert.strictEqual(isNil(NaN), false);
    assert.strictEqual(isNil({}), false);
    assert.strictEqual(isNil([]), false);
  });
});

describe("isEmptyString", () => {
  it("returns true only for empty string", () => {
    assert.strictEqual(isEmptyString(""), true);
  });

  it("returns false for non-empty strings", () => {
    assert.strictEqual(isEmptyString(" "), false);
    assert.strictEqual(isEmptyString("a"), false);
  });

  it("returns false for non-strings and boxed strings", () => {
    assert.strictEqual(isEmptyString(0), false);
    assert.strictEqual(isEmptyString(null), false);
    assert.strictEqual(isEmptyString(undefined), false);
    assert.strictEqual(isEmptyString([]), false);
    assert.strictEqual(isEmptyString({}), false);
     
    assert.strictEqual(isEmptyString(new String("")), false);
  });
});

describe("isEmptyArray", () => {
  it("returns true for empty arrays", () => {
    assert.strictEqual(isEmptyArray([]), true);
    assert.strictEqual(isEmptyArray(new Array(0)), true);
    assert.strictEqual(isEmptyArray([]), true);
  });

  it("returns false for non-empty arrays", () => {
    assert.strictEqual(isEmptyArray([1]), false);
    assert.strictEqual(isEmptyArray([undefined]), false);
    assert.strictEqual(isEmptyArray([null]), false);
  });

  it("returns false for array-likes and non-arrays", () => {
    assert.strictEqual(isEmptyArray({}), false);
    assert.strictEqual(isEmptyArray("[]"), false);
    assert.strictEqual(isEmptyArray({ length: 0 }), false);
    assert.strictEqual(isEmptyArray(null), false);
    assert.strictEqual(isEmptyArray(undefined), false);
  });
});

describe("isObject", () => {
  it("returns true for plain objects, arrays, and built-ins", () => {
    assert.strictEqual(isObject({}), true);
    assert.strictEqual(isObject([]), true);
    assert.strictEqual(isObject(new Date()), true);
    assert.strictEqual(isObject(new Map()), true);
    assert.strictEqual(isObject(Object.create(null)), true);
  });

  it("returns false for null, primitives, and functions", () => {
    assert.strictEqual(isObject(null), false);
    assert.strictEqual(isObject(undefined), false);
    assert.strictEqual(isObject(1), false);
    assert.strictEqual(isObject("x"), false);
    assert.strictEqual(isObject(true), false);
    assert.strictEqual(isObject(() => {}), false);
    assert.strictEqual(isObject(Symbol("s")), false);
  });
});

describe("isRecord", () => {
  it("returns true for plain objects and built-ins (arrays excluded)", () => {
    assert.strictEqual(isRecord({}), true);
    assert.strictEqual(isRecord(new Date()), true);
    assert.strictEqual(isRecord(new Map()), true);
    assert.strictEqual(isRecord(Object.create(null)), true);
  });

  it("returns false for arrays, null, primitives, and functions", () => {
    assert.strictEqual(isRecord([]), false);
    assert.strictEqual(isRecord([1]), false);
    assert.strictEqual(isRecord(null), false);
    assert.strictEqual(isRecord(undefined), false);
    assert.strictEqual(isRecord(1), false);
    assert.strictEqual(isRecord("x"), false);
    assert.strictEqual(isRecord(true), false);
    assert.strictEqual(isRecord(() => {}), false);
    assert.strictEqual(isRecord(Symbol("s")), false);
  });
});

describe("isEmptyRecord", () => {
  it("returns true for records with no string keys", () => {
    assert.strictEqual(isEmptyRecord({}), true);
    assert.strictEqual(isEmptyRecord(Object.create(null)), true);
    assert.strictEqual(isEmptyRecord(new Date()), true);
  });

  it("returns false for arrays (not records)", () => {
    assert.strictEqual(isEmptyRecord([]), false);
    assert.strictEqual(isEmptyRecord([1]), false);
  });

  it("documents Object.keys ignores symbols", () => {
    assert.strictEqual(isEmptyRecord({ [Symbol("s")]: 1 }), true);
  });

  it("returns false for records with keys", () => {
    assert.strictEqual(isEmptyRecord({ a: 1 }), false);
    assert.strictEqual(isEmptyRecord({ a: undefined }), false);
  });

  it("returns false for non-records", () => {
    assert.strictEqual(isEmptyRecord(null), false);
    assert.strictEqual(isEmptyRecord(undefined), false);
    assert.strictEqual(isEmptyRecord(""), false);
  });
});

describe("isEmpty", () => {
  it("returns true for nil, empty string, empty array, empty record", () => {
    assert.strictEqual(isEmpty(null), true);
    assert.strictEqual(isEmpty(undefined), true);
    assert.strictEqual(isEmpty(""), true);
    assert.strictEqual(isEmpty([]), true);
    assert.strictEqual(isEmpty({}), true);
  });

  it("returns false for non-empty and falsy primitives", () => {
    assert.strictEqual(isEmpty(0), false);
    assert.strictEqual(isEmpty(false), false);
    assert.strictEqual(isEmpty(NaN), false);
    assert.strictEqual(isEmpty(" "), false);
    assert.strictEqual(isEmpty([1]), false);
    assert.strictEqual(isEmpty({ a: 1 }), false);
  });

  it("documents surprising empty built-ins", () => {
    // new Date() has no enumerable keys so counts as empty record
    assert.strictEqual(isEmpty(new Date()), true);
  });
});

describe("isThenable", () => {
  it("returns true for promises and promise-likes", () => {
    assert.strictEqual(isThenable(Promise.resolve()), true);
    assert.strictEqual(isThenable({ then: () => {} }), true);
    assert.strictEqual(isThenable(Promise.resolve(1)), true);
    /**
     *
     */
    async function af() {}
    assert.strictEqual(isThenable(af()), true);
  });

  it("returns false for non-thenables", () => {
    assert.strictEqual(isThenable(null), false);
    assert.strictEqual(isThenable(undefined), false);
    assert.strictEqual(isThenable({}), false);
    assert.strictEqual(isThenable({ then: 1 }), false);
    assert.strictEqual(isThenable("then"), false);
    assert.strictEqual(isThenable(0), false);
  });

  it("throws if then getter throws", () => {
    const evil = {
      get then(): unknown {
        throw new Error("getter boom");
      },
    };
    assert.throws(() => isThenable(evil), /getter boom/);
  });
});

describe("isPromise", () => {
  it("returns true for native promises", () => {
    assert.strictEqual(isPromise(Promise.resolve()), true);
    assert.strictEqual(isPromise(Promise.resolve(1)), true);
    assert.strictEqual(isPromise(new Promise(() => {})), true);
    /**
     *
     */
    async function af() {}
    assert.strictEqual(isPromise(af()), true);
  });

  it("returns true for thenables with catch and finally functions", () => {
    const fake = {
      then: () => {},
      catch: () => {},
      finally: () => {},
    };
    assert.strictEqual(isPromise(fake), true);
  });

  it("returns false for bare thenables without catch/finally", () => {
    assert.strictEqual(isPromise({ then: () => {} }), false);
    assert.strictEqual(
      isPromise({ then: () => {}, catch: () => {} }),
      false,
    );
    assert.strictEqual(
      isPromise({ then: () => {}, finally: () => {} }),
      false,
    );
  });

  it("returns false for non-promises", () => {
    assert.strictEqual(isPromise(null), false);
    assert.strictEqual(isPromise(undefined), false);
    assert.strictEqual(isPromise({}), false);
    assert.strictEqual(isPromise(42), false);
    assert.strictEqual(isPromise("then"), false);
  });
});

describe("isAsyncFunction", () => {
  it("returns true for async functions and methods", () => {
    /**
     *
     */
    async function af() {}
    const arrow = async () => {};
    assert.strictEqual(isAsyncFunction(af), true);
    assert.strictEqual(isAsyncFunction(arrow), true);
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
    assert.strictEqual(isAsyncFunction(sync), false);
    assert.strictEqual(isAsyncFunction(gen), false);
    assert.strictEqual(isAsyncFunction(agen), false);
  });
});

describe("isGeneratorFunction", () => {
  it("returns true for generator functions", () => {
    /**
     *
     */
    function* gen() {}
    assert.strictEqual(isGeneratorFunction(gen), true);
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
    assert.strictEqual(isGeneratorFunction(sync), false);
    assert.strictEqual(isGeneratorFunction(af), false);
    assert.strictEqual(isGeneratorFunction(agen), false);
  });
});

describe("isAsyncGeneratorFunction", () => {
  it("returns true for async generator functions", () => {
    /**
     *
     */
    async function* agen() {}
    assert.strictEqual(isAsyncGeneratorFunction(agen), true);
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
    assert.strictEqual(isAsyncGeneratorFunction(sync), false);
    assert.strictEqual(isAsyncGeneratorFunction(af), false);
    assert.strictEqual(isAsyncGeneratorFunction(gen), false);
  });
});

describe("isDecorationContext", () => {
  it("returns true for objects carrying a string kind", () => {
    assert.strictEqual(isDecorationContext({ kind: "method" }), true);
    // A synthesized (partial) Stage 3 decoration context:
    assert.strictEqual(
      isDecorationContext({ kind: "field", name: "f", addInitializer() {} }),
      true,
    );
  });

  it("returns false for non-contexts", () => {
    assert.strictEqual(isDecorationContext({}), false);
    assert.strictEqual(isDecorationContext({ kind: 1 }), false);
    assert.strictEqual(isDecorationContext(null), false);
    assert.strictEqual(isDecorationContext(undefined), false);
    assert.strictEqual(isDecorationContext("method"), false);
    assert.strictEqual(isDecorationContext(() => {}), false);
  });
});

describe("isRawMemberApplication", () => {
  it("returns true for the (member, context) fingerprint", () => {
    const wrap = (x: unknown): unknown => x;
    assert.strictEqual(isRawMemberApplication([wrap, { kind: "method" }]), true);
  });

  it("returns false for rests that are not raw decoration invocations", () => {
    const wrap = (x: unknown): unknown => x;
    assert.strictEqual(isRawMemberApplication([]), false);
    assert.strictEqual(isRawMemberApplication([wrap]), false);
    assert.strictEqual(isRawMemberApplication([{}]), false);
    assert.strictEqual(
      isRawMemberApplication([wrap, { kind: "method" }, 1]),
      false,
    );
    assert.strictEqual(isRawMemberApplication([wrap, {}]), false);
    assert.strictEqual(isRawMemberApplication([{}, { kind: "method" }]), false);
    assert.strictEqual(isRawMemberApplication([1, { kind: "method" }]), false);
  });
});

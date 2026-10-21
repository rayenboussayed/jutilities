import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withCacheAsync, withCacheSync } from "../cache.js";
import { lazy } from "../lazy.js";
import { withLoggerSync } from "../logger.js";
import { decorateGetter } from "./getter.js";

// Decorator grammar notes (already pinned in method.test.ts): converters are
// hoisted to consts and applied with a single options call. Getters are always
// sync functions in JavaScript — an async getter cannot even be declared — so
// `require: "async"` always fails at decorate time and `require: "sync"` never
// rejects a getter.

describe("decorateGetter", () => {
  it("wraps a getter through withCacheSync (memoizes once for the whole class)", () => {
    const store = new Map<string | number, unknown>();
    const cached = decorateGetter(withCacheSync);
    class Reports {
      loads = 0;
      @cached({ cacheStore: store, extraKeys: ["getter-cached"] })
      get label() {
        this.loads++;
        return "L";
      }
    }
    const first = new Reports();
    const second = new Reports();
    assert.strictEqual(first.label, "L");
    assert.strictEqual(first.label, "L");
    // Getters live on the prototype: the memo is shared across instances.
    assert.strictEqual(second.label, "L");
    assert.strictEqual(first.loads, 1);
    assert.strictEqual(second.loads, 0);
    assert.strictEqual(store.size, 1);
  });

  it("forwards this into the wrapped getter body", () => {
    const store = new Map<string | number, unknown>();
    const cached = decorateGetter(withCacheSync);
    class Stats {
      calls = 0;
      width = 4;
      @cached({ cacheStore: store, extraKeys: ["getter-this"] })
      get area() {
        return this.width * 2;
      }
    }
    const stats = new Stats();
    assert.strictEqual(stats.area, 8);
    assert.strictEqual(stats.area, 8);
  });

  it("works with option-less HOFs (lazy) and logs through withLoggerSync", () => {
    const originalDebug = console.debug;
    const lines: unknown[][] = [];
    console.debug = (...parts: unknown[]) => {
      lines.push(parts);
    };
    try {
      const lazed = decorateGetter(lazy);
      class Heavy {
        computes = 0;
        @lazed()
        get value() {
          this.computes++;
          return "heavy";
        }
      }
      const heavy = new Heavy();
      assert.strictEqual(heavy.value, "heavy");
      // lazy memoizes the truthy getter result: the second access skips the
      // getter body entirely.
      assert.strictEqual(heavy.value, "heavy");
      assert.strictEqual(heavy.computes, 1);
      // The same converter also works for the logger.
      const logged = decorateGetter(withLoggerSync);
      class Buzzer {
        @logged()
        get buzz() {
          return "buzz";
        }
      }
      assert.strictEqual(new Buzzer().buzz, "buzz");
    } finally {
      console.debug = originalDebug;
    }
    assert.ok(lines.some((parts) => /value|buzz/.test(String(parts[0]))));
  });

  it("guards pass under require: sync and throw under require: async", () => {
    const synced = decorateGetter(withCacheSync, { require: "sync" });
    class Ok {
      @synced({ cacheStore: new Map(), extraKeys: ["getter-guard-ok"] })
      get fine() {
        return 1;
      }
    }
    assert.strictEqual(new Ok().fine, 1);
  });

  it("decorate-time guard rejects getters under require: async", () => {
    const requireAsync = decorateGetter(withCacheAsync, { require: "async" });
    assert.throws(
      () => {
        class Binder {
          @requireAsync({
            cacheStore: new Map(),
            extraKeys: ["getter-guard-bad"],
          })
          get nope() {
            return 1;
          }
        }
        new Binder();
      },
      (error) =>
        error instanceof TypeError &&
        /"nope" is not an async function, but require: "async" was requested/.test(
          error.message,
        ),
    );
  });

  it("setters are untouched; only the getter access function is replaced", () => {
    const cached = decorateGetter(withCacheSync);
    class Temperatures {
      writes = 0;
      #celsius = 0;
      @cached({ cacheStore: new Map(), extraKeys: ["getter-setter"] })
      get celsius() {
        return this.#celsius;
      }
      set celsius(value: number) {
        this.writes++;
        this.#celsius = value;
      }
    }
    const temps = new Temperatures();
    temps.celsius = 21;
    assert.strictEqual(temps.writes, 1);
    assert.strictEqual(temps.celsius, 21);
  });

  it("bare factory application fails fast at decorate time and is type-rejected", () => {
    // Single-line directive: tsc flags the bare application (TS1241/TS1270)
    // while tsx still executes it — and the runtime fingerprint throws the
    // paren-less misfire on the getter slot (the getter is a function, so the
    // (value, context) pair matches the raw application fingerprint).
    assert.throws(
      () => {
        const factory = decorateGetter(withCacheSync);
        class Bad {
          // @ts-expect-error - the bare factory grabs (getter, context) as its options rest.
          @factory
          get val() {
            return 1;
          }
        }
        void Bad;
      },
      (error) =>
        error instanceof TypeError &&
        /applied without parentheses/.test(error.message),
    );
  });

  it("runtime converter-level paren-less misfire fails fast (getter)", () => {
    // Calling decorateGetter with a fn-first HOF in the enhancer slot and a
    // decoration context in the options slot is the raw application
    // fingerprint. The assert runs inside the returned factory, so the probe
    // invokes it: raw(fn, context)() must throw before any member binds.
    const raw = decorateGetter as unknown as (
      hof: (value: unknown) => unknown,
      options: unknown,
    ) => () => unknown;
    const context = { kind: "getter", name: "val", addInitializer() {} };
    assert.throws(
      () => void raw((value: unknown) => value, context)(),
      (error) =>
        error instanceof TypeError &&
        /applied without parentheses/.test(error.message),
    );
  });
});

describe("decorateGetter: kind-based conversion contract", () => {
  it("rejects a legacy (non-factory) HOF at compile time", () => {
    // A hand-written fn-first function carries no `__kind` brand, so the
    // converter cannot recover its option bag — rejected.
    const legacyHof = (fn: (x: number) => number) => fn;

    void (() => {
      // @ts-expect-error - only factory-built HOFs are convertible.
      return decorateGetter(legacyHof);
    });
  });

  it("rejects an unknown option key at compile time", () => {
    const cached = decorateGetter(withCacheSync);
    void (() => {
      class Pinned {
        // @ts-expect-error - the option bag is typed from the HOF's kind.
        @cached({ bogus: true })
        get value() {
          return 1;
        }
      }
      return Pinned;
    });
  });

  it("forwards the option bag to the HOF as a single argument", () => {
    // `skipHof` lives in the option bag: a truthy predicate runs the getter
    // raw, so the cache layer never stores anything.
    const bypass = decorateGetter(withCacheSync);
    class Bypassed {
      calls = 0;
      @bypass({ skipHof: () => true })
      get value() {
        this.calls++;
        return 1;
      }
    }
    const instance = new Bypassed();
    assert.strictEqual(instance.value, 1);
    assert.strictEqual(instance.value, 1);
    assert.strictEqual(instance.calls, 2);
  });
});

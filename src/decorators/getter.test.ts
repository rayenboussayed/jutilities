/* eslint-disable sonarjs/void-use */
import { describe, expect, it } from "vitest";

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
    const store = new Map<number | string, unknown>();
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
    expect(first.label).toBe("L");
    expect(first.label).toBe("L");
    // Getters live on the prototype: the memo is shared across instances.
    expect(second.label).toBe("L");
    expect(first.loads).toBe(1);
    expect(second.loads).toBe(0);
    expect(store.size).toBe(1);
  });

  it("forwards this into the wrapped getter body", () => {
    const store = new Map<number | string, unknown>();
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
    expect(stats.area).toBe(8);
    expect(stats.area).toBe(8);
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
      expect(heavy.value).toBe("heavy");
      // lazy memoizes the truthy getter result: the second access skips the
      // getter body entirely.
      expect(heavy.value).toBe("heavy");
      expect(heavy.computes).toBe(1);
      // The same converter also works for the logger.
      const logged = decorateGetter(withLoggerSync);
      class Buzzer {
        @logged()
        get buzz() {
          return "buzz";
        }
      }
      expect(new Buzzer().buzz).toBe("buzz");
    } finally {
      console.debug = originalDebug;
    }
    expect(lines.some((parts) => /value|buzz/.test(String(parts[0])))).toBeTruthy();
  });

  it("guards pass under require: sync and throw under require: async", () => {
    const synced = decorateGetter(withCacheSync, { require: "sync" });
    class Ok {
      @synced({ cacheStore: new Map(), extraKeys: ["getter-guard-ok"] })
      get fine() {
        return 1;
      }
    }
    expect(new Ok().fine).toBe(1);
  });

  it("decorate-time guard rejects getters under require: async", () => {
    const requireAsync = decorateGetter(withCacheAsync, { require: "async" });
    expect(() => {
        class Binder {
          @requireAsync({
            cacheStore: new Map(),
            extraKeys: ["getter-guard-bad"],
          })
          get nope() {
            return 1;
          }
        }
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        new Binder();
      }).toThrow();
  });

  it("setters are untouched; only the getter access function is replaced", () => {
    const cached = decorateGetter(withCacheSync);
    class Temperatures {
      writes = 0;
      @cached({ cacheStore: new Map(), extraKeys: ["getter-setter"] })
      get celsius() {
        return this.#celsius;
      }
      set celsius(value: number) {
        this.writes++;
        this.#celsius = value;
      }
      #celsius = 0;
    }
    const temps = new Temperatures();
    temps.celsius = 21;
    expect(temps.writes).toBe(1);
    expect(temps.celsius).toBe(21);
  });

  it("bare factory application fails fast at decorate time and is type-rejected", () => {
    // Single-line directive: tsc flags the bare application (TS1241/TS1270)
    // while tsx still executes it — and the runtime fingerprint throws the
    // paren-less misfire on the getter slot (the getter is a function, so the
    // (value, context) pair matches the raw application fingerprint).
    expect(() => {
        const factory = decorateGetter(withCacheSync);
        class Bad {
          // @ts-expect-error - the bare factory grabs (getter, context) as its options rest.
          @factory
          get val() {
            return 1;
          }
        }
        void Bad;
      }).toThrow();
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
    const context = { addInitializer() {}, kind: "getter", name: "val" };
    expect(() => void raw((value: unknown) => value, context)()).toThrow();
  });
});

describe("decorateGetter: kind-based conversion contract", () => {
  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("rejects a legacy (non-factory) HOF at compile time", () => {
    // A hand-written fn-first function carries no `__kind` brand, so the
    // converter cannot recover its option bag — rejected.
    const legacyHof = (fn: (x: number) => number) => fn;

    void (() => {
      // @ts-expect-error - only factory-built HOFs are convertible.
      return decorateGetter(legacyHof);
    });
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests
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
    expect(instance.value).toBe(1);
    expect(instance.value).toBe(1);
    expect(instance.calls).toBe(2);
  });
});

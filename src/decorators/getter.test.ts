/* eslint-disable sonarjs/void-use */
import { describe, expect, it } from "vitest";

import { withCacheAsync, withCacheSync } from "../hof/cache.js";
import { withLoggerSync } from "../hof/logger.js";
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

  it("works with an option-less HOF (withLoggerSync) and logs each access", () => {
    const originalDebug = console.debug;
    const lines: unknown[][] = [];
    console.debug = (...parts: unknown[]) => {
      lines.push(parts);
    };
    try {
      const logged = decorateGetter(withLoggerSync);
      class Heavy {
        computes = 0;
        @logged()
        get value() {
          this.computes++;
          return "heavy";
        }
      }
      const heavy = new Heavy();
      expect(heavy.value).toBe("heavy");
      // A sync HOF re-runs the getter body on every access.
      expect(heavy.value).toBe("heavy");
      expect(heavy.computes).toBe(2);
    } finally {
      console.debug = originalDebug;
    }
    expect(lines.some((parts) => /value/.test(String(parts[0])))).toBeTruthy();
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

  it("throws a TypeError when the accessor has no getter to enhance", () => {
    const cached = decorateGetter(withCacheSync);
    expect(() => {
      const decorator = cached({
        cacheStore: new Map(),
        extraKeys: ["getter-only-set"],
      });
      const descriptor: PropertyDescriptor = {
        set: () => undefined,
      };
      decorator(Object.prototype, "onlySet", descriptor);
    }).toThrow(/has no getter/);
  });

  it("bare factory application fails fast at decorate time and is type-rejected", () => {
    // tsc flags the bare application while tsx still executes it — the
    // runtime fingerprint throws the paren-less misfire on the getter slot
    // (the bare factory grabs (target, key, descriptor) as its options rest).
    expect(() => {
        const factory = decorateGetter(withCacheSync);
        class Bad {
          // @ts-expect-error - the bare factory grabs (target, key, descriptor) as its options rest.
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
    // function in the options slot is the raw application fingerprint. The
    // assert runs inside the returned factory, so the probe invokes it:
    // raw(fn, fn)() must throw before any member binds.
    const raw = decorateGetter as unknown as (
      hof: (value: unknown) => unknown,
      options: unknown,
    ) => () => unknown;
    expect(() => void raw((value: unknown) => value, () => {})()).toThrow();
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

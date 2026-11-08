/* eslint-disable sonarjs/void-use */
import { describe, expect, it } from "vitest";

import { withCacheSync } from "../cache.js";
import { withLoggerSync } from "../logger.js";
import { decorateProperty } from "./property.js";

// Decorator grammar notes (already pinned in method.test.ts): converters are
// hoisted to consts and applied with a single options call. A bare field
// application is type-rejected (TS1270) but silently corrupts the field at
// runtime — the runtime fingerprint cannot see it (field decorators receive
// `undefined`, not the member), so it is pinned compile-only below.

describe("decorateProperty", () => {
  it("wraps a function-valued field through withCacheSync with shared options", () => {
    const store = new Map<number | string, unknown>();
    const cached = decorateProperty(withCacheSync);
    class Adder {
      addRuns = 0;
      @cached({ cacheStore: store, extraKeys: ["prop-cached"] })
      add = (a: number, b: number) => {
        this.addRuns++;
        return a + b;
      };
    }
    const adder = new Adder();
    expect(adder.add(1, 2)).toBe(3);
    expect(adder.add(1, 2)).toBe(3);
    expect(adder.addRuns).toBe(1);
  });

  it("each instance gets a freshly enhanced function (per-instance enhancement)", () => {
    const store = new Map<number | string, unknown>();
    const cached = decorateProperty(withCacheSync);
    class Multiplier {
      factor = 3;
      @cached({ cacheStore: store, extraKeys: ["prop-instance"] })
      times = (n: number) => n * this.factor;
    }
    const first = new Multiplier();
    const second = new Multiplier();
    // The HOF runs once per instance, at field initialization time.
    expect(first.times).not.toBe(second.times);
    expect(first.times(2)).toBe(6);
    expect(second.times(4)).toBe(12);
  });

  it("non-function field initializer throws at construction naming the field", () => {
    const cached = decorateProperty(withCacheSync);
    class Bad {
      @cached({ cacheStore: new Map(), extraKeys: ["prop-bad"] })
      notAFn = "oops";
    }
    expect(() => new Bad()).toThrow();
  });

  it("lexical this is preserved across arrow-function fields (withCacheSync wrapper)", () => {
    const store = new Map<number | string, unknown>();
    const cached = decorateProperty(withCacheSync);
    class Ratios {
      factor = 2;
      @cached({ cacheStore: store, extraKeys: ["prop-this"] })
      scale = (n: number) => n * this.factor;
    }
    const ratios = new Ratios();
    expect(ratios.scale(5)).toBe(10);
    // Second call hits the per-instance memoized entry.
    expect(ratios.scale(5)).toBe(10);
  });

  it("guards pass for matching sync/async members", () => {
    const store = new Map<number | string, unknown>();
    const requireSync = decorateProperty(withCacheSync, { require: "sync" });
    const requireAsync = decorateProperty(withCacheSync, { require: "async" });
    class Ok {
      @requireSync({ cacheStore: store, extraKeys: ["prop-guard-ok-sync"] })
      go = () => 1;

      @requireAsync({ cacheStore: store, extraKeys: ["prop-guard-ok-async"] })
      hop = async () => 1;
    }
    const ok = new Ok();
    expect(typeof ok.go).toBe("function");
    expect(typeof ok.hop).toBe("function");
  });

  it("decorate-time guard rejects an async field under require: sync", () => {
    const requireSync = decorateProperty(withCacheSync, { require: "sync" });
    class Bad {
      @requireSync({ cacheStore: new Map(), extraKeys: ["prop-guard-bad-sync"] })
      hop = async () => 1;
    }
    // The guard runs inside the initializer transformer, so it fires when the
    // field is initialized (construction), not at class definition.
    expect(() => new Bad()).toThrow();
  });

  it("decorate-time guard rejects a sync field under require: async", () => {
    const requireAsync = decorateProperty(withCacheSync, { require: "async" });
    class Bad {
      @requireAsync({ cacheStore: new Map(), extraKeys: ["prop-guard-bad-async"] })
      walk = () => 1;
    }
    expect(() => new Bad()).toThrow();
  });

  it("works with option-less HOFs (withLoggerSync) via an empty factory call", () => {
    const originalDebug = console.debug;
    const lines: unknown[][] = [];
    console.debug = (...parts: unknown[]) => {
      lines.push(parts);
    };
    try {
      const logged = decorateProperty(withLoggerSync);
      class Announcer {
        @logged()
        speak = () => "hi";
      }
      const talker = new Announcer();
      expect(talker.speak()).toBe("hi");
    } finally {
      console.debug = originalDebug;
    }

    expect(lines.some((parts) => /anonymous/.test(String(parts[0])))).toBeTruthy();
  });

  it("runtime paren-less factory application fails fast on member slots", () => {
    // The fingerprint requires a function in the first decoration slot, which
    // fields cannot supply (they pass `undefined`) — but applying the field
    // converter to a method/getter-style member does match and throws here.
    const factory = decorateProperty(withCacheSync) as (
      ...args: any[]
    ) => unknown;
    const member = function member() {
      return 1;
    };
    const context = { addInitializer() {}, kind: "getter", name: "member" };
    expect(() => void factory(member, context)).toThrow();
  });

  it("runtime converter-level paren-less misfire fails fast (property)", () => {
    // Calling decorateProperty with a fn-first HOF in the enhancer slot and a
    // decoration context in the options slot is the raw application
    // fingerprint. The assert runs inside the returned factory, so the probe
    // invokes it: raw(fn, context)() must throw before any member binds.
    const raw = decorateProperty as unknown as (
      hof: (value: unknown) => unknown,
      options: unknown,
    ) => () => unknown;
    const context = { addInitializer() {}, kind: "field", name: "go" };
    expect(() => void raw((value: unknown) => value, context)()).toThrow();
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("compile pin: bare field application is type-rejected", () => {
    // Analysis-time probe: the body never runs; tsc must reject the bare
    // factory application on the field slot (TS1270). Runtime cannot self-
    // guard this shape (field decorators pass `undefined`), so the compile
    // layer is the only line of defense — hence the explicit pin.
    void (() => {
      const cached = decorateProperty(withCacheSync);
      class Pinned {
        // @ts-expect-error - the bare factory grabs (undefined, context) as its options rest.
        @cached
        go = () => 1;
      }
      return Pinned;
    });
  });
});

describe("decorateProperty: kind-based conversion contract", () => {
  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("rejects a legacy (non-factory) HOF at compile time", () => {
    // A hand-written fn-first function carries no `__kind` brand, so the
    // converter cannot recover its option bag — rejected.
    const legacyHof = (fn: (x: number) => number) => fn;

    void (() => {
      // @ts-expect-error - only factory-built HOFs are convertible.
      return decorateProperty(legacyHof);
    });
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("rejects an unknown option key at compile time", () => {
    const memoize = decorateProperty(withCacheSync);
    void (() => {
      class Pinned {
        // @ts-expect-error - the option bag is typed from the HOF's kind.
        @memoize({ bogus: true })
        go = () => 1;
      }
      return Pinned;
    });
  });

  it("forwards the option bag to the HOF as a single argument", () => {
    // `skipHof` lives in the option bag: a truthy predicate runs the field's
    // initializer raw, so the cache layer never stores anything.
    const bypass = decorateProperty(withCacheSync);
    class Bypassed {
      calls = 0;
      @bypass({ skipHof: () => true })
      go = () => {
        this.calls++;
        return 1;
      };
    }
    const instance = new Bypassed();
    expect(instance.go()).toBe(1);
    expect(instance.go()).toBe(1);
    expect(instance.calls).toBe(2);
  });
});

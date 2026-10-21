import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
    const store = new Map<string | number, unknown>();
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
    assert.strictEqual(adder.add(1, 2), 3);
    assert.strictEqual(adder.add(1, 2), 3);
    assert.strictEqual(adder.addRuns, 1);
  });

  it("each instance gets a freshly enhanced function (per-instance enhancement)", () => {
    const store = new Map<string | number, unknown>();
    const cached = decorateProperty(withCacheSync);
    class Multiplier {
      factor = 3;
      @cached({ cacheStore: store, extraKeys: ["prop-instance"] })
      times = (n: number) => n * this.factor;
    }
    const first = new Multiplier();
    const second = new Multiplier();
    // The HOF runs once per instance, at field initialization time.
    assert.notStrictEqual(first.times, second.times);
    assert.strictEqual(first.times(2), 6);
    assert.strictEqual(second.times(4), 12);
  });

  it("non-function field initializer throws at construction naming the field", () => {
    const cached = decorateProperty(withCacheSync);
    class Bad {
      @cached({ cacheStore: new Map(), extraKeys: ["prop-bad"] })
      notAFn = "oops";
    }
    assert.throws(
      () => new Bad(),
      (error) =>
        error instanceof TypeError &&
        /field "notAFn" must be a function-value initializer, got string/.test(
          error.message,
        ),
    );
  });

  it("lexical this is preserved across arrow-function fields (withCacheSync wrapper)", () => {
    const store = new Map<string | number, unknown>();
    const cached = decorateProperty(withCacheSync);
    class Ratios {
      factor = 2;
      @cached({ cacheStore: store, extraKeys: ["prop-this"] })
      scale = (n: number) => n * this.factor;
    }
    const ratios = new Ratios();
    assert.strictEqual(ratios.scale(5), 10);
    // Second call hits the per-instance memoized entry.
    assert.strictEqual(ratios.scale(5), 10);
  });

  it("guards pass for matching sync/async members", () => {
    const store = new Map<string | number, unknown>();
    const requireSync = decorateProperty(withCacheSync, { require: "sync" });
    const requireAsync = decorateProperty(withCacheSync, { require: "async" });
    class Ok {
      @requireSync({ cacheStore: store, extraKeys: ["prop-guard-ok-sync"] })
      go = () => 1;

      @requireAsync({ cacheStore: store, extraKeys: ["prop-guard-ok-async"] })
      hop = async () => 1;
    }
    const ok = new Ok();
    assert.strictEqual(typeof ok.go, "function");
    assert.strictEqual(typeof ok.hop, "function");
  });

  it("decorate-time guard rejects an async field under require: sync", () => {
    const requireSync = decorateProperty(withCacheSync, { require: "sync" });
    class Bad {
      @requireSync({ cacheStore: new Map(), extraKeys: ["prop-guard-bad-sync"] })
      hop = async () => 1;
    }
    // The guard runs inside the initializer transformer, so it fires when the
    // field is initialized (construction), not at class definition.
    assert.throws(
      () => new Bad(),
      (error) =>
        error instanceof TypeError &&
        /"hop" is an async function, but require: "sync" was requested/.test(
          error.message,
        ),
    );
  });

  it("decorate-time guard rejects a sync field under require: async", () => {
    const requireAsync = decorateProperty(withCacheSync, { require: "async" });
    class Bad {
      @requireAsync({ cacheStore: new Map(), extraKeys: ["prop-guard-bad-async"] })
      walk = () => 1;
    }
    assert.throws(
      () => new Bad(),
      (error) =>
        error instanceof TypeError &&
        /"walk" is not an async function, but require: "async" was requested/.test(
          error.message,
        ),
    );
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
      assert.strictEqual(talker.speak(), "hi");
    } finally {
      console.debug = originalDebug;
    }
    assert.ok(lines.some((parts) => /speak/.test(String(parts[0]))));
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
    const context = { kind: "getter", name: "member", addInitializer() {} };
    assert.throws(
      () => void factory(member, context),
      (error) =>
        error instanceof TypeError &&
        /applied without parentheses/.test(error.message),
    );
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
    const context = { kind: "field", name: "go", addInitializer() {} };
    assert.throws(
      () => void raw((value: unknown) => value, context)(),
      (error) =>
        error instanceof TypeError &&
        /applied without parentheses/.test(error.message),
    );
  });

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
  it("rejects a legacy (non-factory) HOF at compile time", () => {
    // A hand-written fn-first function carries no `__kind` brand, so the
    // converter cannot recover its option bag — rejected.
    const legacyHof = (fn: (x: number) => number) => fn;

    void (() => {
      // @ts-expect-error - only factory-built HOFs are convertible.
      return decorateProperty(legacyHof);
    });
  });

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
    assert.strictEqual(instance.go(), 1);
    assert.strictEqual(instance.go(), 1);
    assert.strictEqual(instance.calls, 2);
  });
});

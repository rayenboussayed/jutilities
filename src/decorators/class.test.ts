/* eslint-disable sonarjs/void-use */
import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { withCacheAsync, withCacheSync } from "../cache.js";
import { withLoggerAsync, withLoggerSync } from "../logger.js";
import { decorateClass } from "./class.js";

// Decorator grammar notes (already pinned in method.test.ts): TS rejects
// chained annotation calls without parentheses, so converters are hoisted to
// consts and applied with a single call on the class keyword.

describe("decorateClass", () => {
  it("single enhancer wraps every own prototype method with shared options", () => {
    const store = new Map<number | string, unknown>();
    const cached = decorateClass(withCacheSync);
    @cached({ cacheStore: store, extraKeys: ["class-single"] })
    class Users {
      countLoads = 0;
      ctorRuns = 0;
      nameLoads = 0;
      constructor() {
        this.ctorRuns++;
      }
      count() {
        this.countLoads++;
        return 1;
      }
      name(id: string) {
        this.nameLoads++;
        return `u-${id}`;
      }
    }
    const first = new Users();
    const second = new Users();
    assert.strictEqual(first.name("a"), "u-a");
    assert.strictEqual(first.name("a"), "u-a");
    assert.strictEqual(first.nameLoads, 1);
    assert.strictEqual(second.name("a"), "u-a");
    // Prototype-wide memoization: the second instance never re-executed the
    // method body, which is the documented class-fan-out tradeoff.
    assert.strictEqual(second.nameLoads, 0);

    assert.strictEqual(first.count(), 1);
    assert.strictEqual(first.countLoads, 1);
    assert.strictEqual(first.count(), 1);
    assert.strictEqual(first.countLoads, 1);

    // Constructor untouched: each instance ran it exactly once.
    assert.strictEqual(first.ctorRuns, 1);
    assert.strictEqual(second.ctorRuns, 1);
  });

  it("detect pair: sync members take the sync slot, async members the async slot", async () => {
    const store = new Map<number | string, unknown>();
    const pair = decorateClass({
      async: withCacheAsync,
      sync: withCacheSync,
    });
    @pair({ cacheStore: store, extraKeys: ["class-pair"] })
    class Repo {
      asyncLoads = 0;
      syncLoads = 0;

      fast() {
        this.syncLoads++;
        return "fast";
      }
      async slow() {
        this.asyncLoads++;
        return "slow";
      }
    }
    const repo = new Repo();
    assert.strictEqual(repo.fast(), "fast");
    assert.strictEqual(repo.fast(), "fast");
    assert.strictEqual(repo.syncLoads, 1);

    assert.strictEqual(await repo.slow(), "slow");
    assert.strictEqual(await repo.slow(), "slow");
    assert.strictEqual(repo.asyncLoads, 1);
  });

  it("pick 'sync' forces every member through the sync slot", async () => {
    const store = new Map<number | string, unknown>();
    const forcedSync = decorateClass(
      { async: withCacheAsync, sync: withCacheSync },
      { pick: "sync" },
    );
    @forcedSync({ cacheStore: store, extraKeys: ["class-pick-sync"] })
    class Mixed {
      loads = 0;
      syncLoads = 0;
      async hop() {
        this.loads++;
        return "once";
      }
      ping() {
        this.syncLoads++;
        return "same";
      }
    }
    const mixed = new Mixed();
    // The async member goes through the sync slot, which rejects promise
    // values at call time instead of memoizing them.
    assert.throws(
      () => mixed.hop(),
      (error) =>
        error instanceof TypeError &&
        /promise or generator/.test((error as Error).message),
    );
    // The sync member memoizes normally through the same forced enhancer.
    assert.strictEqual(mixed.ping(), "same");
    assert.strictEqual(mixed.ping(), "same");
    assert.strictEqual(mixed.syncLoads, 1);
    // Only the sync member's result was ever stored.
    assert.strictEqual(store.size, 1);
  });

  it("pick 'async' forces every member through the async slot", async () => {
    const forcedAsync = decorateClass(
      { async: withCacheAsync, sync: withCacheSync },
      { pick: "async" },
    );
    // Declared sync, pushed through the async slot: the async wrapper resolves
    // a promise either way.
    @forcedAsync({ cacheStore: new Map(), extraKeys: ["class-pick-async"] })
    class Mixed {
      loads = 0;
      tick() {
        this.loads++;
        return "same";
      }
    }
    const mixed = new Mixed();
    assert.strictEqual(await mixed.tick(), "same");
    assert.strictEqual(await mixed.tick(), "same");
    assert.strictEqual(mixed.loads, 1);
  });

  it("pair with a missing detected slot fails fast at decorate time", () => {
    const syncOnly = decorateClass(
      { sync: withCacheSync },
      { pick: "detect" },
    );
    assert.throws(
      () => {
        @syncOnly({ cacheStore: new Map(), extraKeys: ["class-missing-sync"] })
        class Nowrap {
          fast() {
            return 1;
          }
          async hop() {
            return 1;
          }
        }
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        new Nowrap();
      },
      (error) =>
        error instanceof TypeError &&
        /"hop" needs a async enhancer/.test(error.message),
    );
  });

  it("forced pick with a missing slot fails fast naming the request", () => {
    const forcedAsync = decorateClass(
      { sync: withCacheSync },
      { pick: "async" },
    );
    assert.throws(
      () => {
        @forcedAsync({ cacheStore: new Map(), extraKeys: ["class-missing-async"] })
        class Bad {
          bar() {
            return 1;
          }
        }
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        new Bad();
      },
      (error) =>
        error instanceof TypeError &&
        /"bar" needs a async enhancer/.test(error.message),
    );
  });

  it("statics are skipped", () => {
    const cached = decorateClass(withCacheSync);
    @cached({ cacheStore: new Map(), extraKeys: ["class-static-skip"] })
    class Registry {
      // eslint-disable-next-line sonarjs/public-static-readonly
      static ticks = 0;
      static bust() {
        Registry.ticks++;
        return Registry.ticks;
      }

      instancePing() {
        return "ping";
      }
    }
    const registry = new Registry();
    assert.strictEqual(registry.instancePing(), "ping");
    assert.strictEqual(Registry.bust(), 1);
    assert.strictEqual(Registry.bust(), 2);
  });

  it("getters are skipped", () => {
    const cached = decorateClass(withCacheSync);
    @cached({ cacheStore: new Map(), extraKeys: ["class-getter-skip"] })
    class Greeters {
      labelLoads = 0;
      get label() {
        // Accessors stay original: every read executes the getter again.
        this.labelLoads++;
        return `L-${this.labelLoads}`;
      }

      ping() {
        return "ping";
      }
    }
    const greeter = new Greeters();
    assert.strictEqual(greeter.ping(), "ping");
    assert.strictEqual(greeter.label, "L-1");
    assert.strictEqual(greeter.label, "L-2");
    assert.strictEqual(greeter.labelLoads, 2);
  });

  it("works with option-less HOFs (withLoggerSync) via decorator syntax", () => {
    const originalDebug = console.debug;
    const lines: unknown[][] = [];
    console.debug = (...parts: unknown[]) => {
      lines.push(parts);
    };
    try {
      const logged = decorateClass(withLoggerSync);
      @logged()
      class Announcer {
        speak() {
          return "hi";
        }
      }
      const talker = new Announcer();
      assert.strictEqual(talker.speak(), "hi");
    } finally {
      console.debug = originalDebug;
    }
    assert.ok(lines.some((parts) => /speak/.test(String(parts[0]))));
  });

  it("runtime paren-less factory application fails fast (class)", () => {
    // Decorator syntax cannot express this shape, so the invocation is
    // synthesized: the factory receives (class, context) as its options rest.
    const factory = decorateClass(withLoggerSync) as (...args: any[]) => unknown;
    const member = class Source {};
    const context = { addInitializer() {}, kind: "class", name: "Source" };
    assert.throws(
      () => void factory(member, context),
      (error) =>
        error instanceof TypeError &&
        /applied without parentheses/.test(error.message),
    );
  });

  it("runtime converter-level paren-less misfire fails fast (class)", () => {
    // Calling decorateClass with a class in the enhancer slot and a context
    // in the options slot is the raw application fingerprint.
    const raw = decorateClass as unknown as (...args: any[]) => unknown;
    const member = class Raw {};
    const context = { addInitializer() {}, kind: "class", name: "Raw" };
    assert.throws(
      () => void raw(member, context),
      (error) =>
        error instanceof TypeError &&
        /applied without parentheses/.test(error.message),
    );
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("compile pin: paren-less class application is type-rejected", () => {
    // Analysis-time probe: the body never runs; tsc must reject the bare
    // factory application on the class slot.
    void (() => {
      const cached = decorateClass(withCacheSync);
      // @ts-expect-error - paren-less misfire registers decoration args instead of options.
      @cached
      class Pinned {
        m() {
          return 1;
        }
      }
      return Pinned;
    });
  });
});

describe("decorateClass: kind-based conversion contract", () => {
  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("rejects a legacy (non-factory) HOF at compile time", () => {
    // A hand-written fn-first function carries no `__kind` brand, so the
    // converter cannot recover its option bag — rejected.
    const legacyHof = (fn: (x: number) => number) => fn;

    void (() => {
      // @ts-expect-error - only factory-built HOFs are convertible.
      return decorateClass(legacyHof);
    });
    void (() => {
      return decorateClass({
        // @ts-expect-error - only factory-built HOFs are convertible.
        sync: legacyHof,
      });
    });
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("rejects an unknown option key at compile time", () => {
    const pair = decorateClass({ async: withCacheAsync, sync: withCacheSync });
    void (() => {
      // @ts-expect-error - the option bag is typed from the HOFs' kinds.
      @pair({ bogus: true })
      class Pinned {
        count() {
          return 1;
        }
      }
      return Pinned;
    });
  });

  it("merges both slots' option bags into one shared bag", async () => {
    const pair = decorateClass({ async: withLoggerAsync, sync: withCacheSync });
    const lines: unknown[][] = [];
    const originalDebug = console.debug;
    console.debug = (...parts: unknown[]) => {
      lines.push(parts);
    };
    try {
      @pair({ extraKeys: ["class-merged"], name: "merged" })
      class Merged {
        count() {
          return 1;
        }
        async load() {
          return 2;
        }
      }
      const instance = new Merged();
      assert.strictEqual(instance.count(), 1);
      assert.strictEqual(await instance.load(), 2);
    } finally {
      console.debug = originalDebug;
    }
    assert.ok(lines.some((parts) => /merged/.test(String(parts[0]))));
  });

  it("forwards the option bag to every wrapped member", () => {
    // `skipHof` lives in the option bag: a truthy predicate runs each member
    // raw, so the cache layer never stores anything.
    const bypass = decorateClass(withCacheSync);
    @bypass({ skipHof: () => true })
    class Bypassed {
      calls = 0;
      count() {
        this.calls++;
        return 1;
      }
    }
    const instance = new Bypassed();
    assert.strictEqual(instance.count(), 1);
    assert.strictEqual(instance.count(), 1);
    assert.strictEqual(instance.calls, 2);
  });
});


describe("decorateClass: coverage extras", () => {
  it("skips non-function own prototype members", () => {
    const decorated = decorateClass(withCacheSync);
    @decorated()
    class Mixed {
      marker = 42;

      run() {
        return this.marker;
      }
    }
    const mixed = new Mixed();
    assert.strictEqual(mixed.run(), 42);
    assert.strictEqual(mixed.marker, 42);
  });

  it("reports a sync member missing its enhancer in pair mode", () => {
    const decorated = decorateClass({ async: withCacheAsync }, { pick: "detect" });
    assert.throws(
      () =>
        void (() => {
          @decorated()
          class MissingSync {
            run() {
              return "run";
            }
          }
          return MissingSync;
        })(),
      /method "run" needs a sync enhancer, but the pair does not provide one/,
    );
  });

  // eslint-disable-next-line sonarjs/no-duplicate-test-title
  it("skips non-function own prototype members", () => {
    const decorated = decorateClass(withCacheSync);
    class Base {
      run() {
        return "run";
      }
    }
    Object.defineProperty(Base.prototype, "tag", {
      configurable: true,
      value: 1,
      writable: true,
    });
    const Enhancer = decorated as (options?: unknown) => (cls: unknown) => unknown;
    const Result = Enhancer()(Base) as any;
    assert.strictEqual(typeof Result, "function", "decorator should return the class");
    const instance = new Result();
    assert.strictEqual(instance.run(), "run");
    assert.strictEqual(instance.tag, 1);
  });
});

/* eslint-disable sonarjs/void-use */
import { describe, expect, it } from "vitest";

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
    expect(first.name("a")).toBe("u-a");
    expect(first.name("a")).toBe("u-a");
    expect(first.nameLoads).toBe(1);
    expect(second.name("a")).toBe("u-a");
    // Prototype-wide memoization: the second instance never re-executed the
    // method body, which is the documented class-fan-out tradeoff.
    expect(second.nameLoads).toBe(0);

    expect(first.count()).toBe(1);
    expect(first.countLoads).toBe(1);
    expect(first.count()).toBe(1);
    expect(first.countLoads).toBe(1);

    // Constructor untouched: each instance ran it exactly once.
    expect(first.ctorRuns).toBe(1);
    expect(second.ctorRuns).toBe(1);
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
    expect(repo.fast()).toBe("fast");
    expect(repo.fast()).toBe("fast");
    expect(repo.syncLoads).toBe(1);

    expect(await repo.slow()).toBe("slow");
    expect(await repo.slow()).toBe("slow");
    expect(repo.asyncLoads).toBe(1);
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
    expect(() => mixed.hop()).toThrow();
    // The sync member memoizes normally through the same forced enhancer.
    expect(mixed.ping()).toBe("same");
    expect(mixed.ping()).toBe("same");
    expect(mixed.syncLoads).toBe(1);
    // Only the sync member's result was ever stored.
    expect(store.size).toBe(1);
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
    expect(await mixed.tick()).toBe("same");
    expect(await mixed.tick()).toBe("same");
    expect(mixed.loads).toBe(1);
  });

  it("pair with a missing detected slot fails fast at decorate time", () => {
    const syncOnly = decorateClass(
      { sync: withCacheSync },
      { pick: "detect" },
    );
    expect(() => {
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
      }).toThrow();
  });

  it("forced pick with a missing slot fails fast naming the request", () => {
    const forcedAsync = decorateClass(
      { sync: withCacheSync },
      { pick: "async" },
    );
    expect(() => {
        @forcedAsync({ cacheStore: new Map(), extraKeys: ["class-missing-async"] })
        class Bad {
          bar() {
            return 1;
          }
        }
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        new Bad();
      }).toThrow();
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
    expect(registry.instancePing()).toBe("ping");
    expect(Registry.bust()).toBe(1);
    expect(Registry.bust()).toBe(2);
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
    expect(greeter.ping()).toBe("ping");
    expect(greeter.label).toBe("L-1");
    expect(greeter.label).toBe("L-2");
    expect(greeter.labelLoads).toBe(2);
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
      expect(talker.speak()).toBe("hi");
    } finally {
      console.debug = originalDebug;
    }
    expect(lines.some((parts) => /speak/.test(String(parts[0])))).toBeTruthy();
  });

  it("runtime paren-less factory application fails fast (class)", () => {
    // Decorator syntax cannot express the paren-less shape, so the invocation
    // is synthesized: the factory receives the constructor as its options.
    const factory = decorateClass(withLoggerSync) as (...args: any[]) => unknown;
    const target = class Source {};
    expect(() => void factory(target)).toThrow();
  });

  it("runtime converter-level paren-less misfire fails fast (class)", () => {
    // Calling decorateClass with a class in the enhancer slot and a function
    // in the options slot is the raw application fingerprint.
    const raw = decorateClass as unknown as (...args: any[]) => unknown;
    expect(() => void raw(class Raw {}, () => {})).toThrow();
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
      expect(instance.count()).toBe(1);
      expect(await instance.load()).toBe(2);
    } finally {
      console.debug = originalDebug;
    }
    expect(lines.some((parts) => /merged/.test(String(parts[0])))).toBeTruthy();
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
    expect(instance.count()).toBe(1);
    expect(instance.count()).toBe(1);
    expect(instance.calls).toBe(2);
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
    expect(mixed.run()).toBe(42);
    expect(mixed.marker).toBe(42);
  });

  it("reports a sync member missing its enhancer in pair mode", () => {
    const decorated = decorateClass({ async: withCacheAsync }, { pick: "detect" });
    expect(() =>
        void (() => {
          @decorated()
          class MissingSync {
            run() {
              return "run";
            }
          }
          return MissingSync;
        })()).toThrow(/method "run" needs a sync enhancer, but the pair does not provide one/);
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
    expect(typeof Result).toBe("function");
    const instance = new Result();
    expect(instance.run()).toBe("run");
    expect(instance.tag).toBe(1);
  });
});

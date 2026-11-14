/* eslint-disable sonarjs/void-use */
import { describe, expect, it } from "vitest";

import { withCacheAsync, withCacheSync } from "../cache.js";
import { withDelayAsync } from "../delay.js";
import { lazy } from "../lazy.js";
import { withAsync } from "../libs/with.js";
import { withLoggerAsync, withLoggerSync } from "../logger.js";
import { withRetryAsync } from "../retry.js";
import { withTimeoutAsync } from "../timeout.js";
import { decorateMethod } from "./method.js";

// Hoisted converters: TS rejects inline chained calls (`@f(h)(opts)`)
// without parentheses, so the supported shapes are (1) hoisted factory +
// single call and (2) fully parenthesized inline chains.
export const memoizeSync = decorateMethod(withCacheSync);
export const retryAsync = decorateMethod(withRetryAsync);
export const timebox = decorateMethod(withTimeoutAsync);
export const delayIt = decorateMethod(withDelayAsync);

describe("decorateMethod", () => {
  it("wraps a sync method through withCacheSync and memoizes per args", () => {
    const store = new Map<number | string, unknown>();
    class Users {
      loads = 0;
      @memoizeSync({ cacheStore: store, extraKeys: ["method-basic"] })
      name(id: string) {
        this.loads++;
        return `u-${id}`;
      }
    }
    const user = new Users();
    expect(user.name("a")).toBe("u-a");
    expect(user.name("a")).toBe("u-a");
    expect(user.loads).toBe(1);
    expect(user.name("b")).toBe("u-b");
    expect(user.loads).toBe(2);
  });

  it("supports inline parenthesized factory application", () => {
    class Inline {
      @(decorateMethod(withCacheSync)({ extraKeys: ["method-inline"] }))
      add(x: number) {
        return x + 1;
      }
    }
    const inline = new Inline();
    expect(inline.add(1)).toBe(2);
    expect(inline.add(1)).toBe(2);
  });

  it("wraps an async method through withRetryAsync with shared options", async () => {
    class Flaky {
      attempts = 0;
      @retryAsync({
        onError: ({ retries }) => {
          if (retries >= 2) throw new Error("give up");
        },
      })
      async call() {
        this.attempts++;
        if (this.attempts < 2) throw new Error("transient");
        return "ok";
      }
    }
    const service = new Flaky();
    expect(await service.call()).toBe("ok");
    expect(service.attempts).toBe(2);
  });

  it("forwards this and args through the wrapper (timeout demo)", async () => {
    class Slow {
      factor = 10;
      @timebox({ timeoutMs: 200 })
      async job(x: number) {
        return await Promise.resolve(x * this.factor);
      }
    }
    const machine = new Slow();
    expect(await machine.job(4)).toBe(40);
  });

  it("forwards this across extracted method references", async () => {
    class Counter {
      base = 3;
      @delayIt({ delay: 1 })
      async add(x: number) {
        return this.base + x;
      }
    }
    const counter = new Counter();
    const add = counter.add; // extracted reference keeps the wrapper behavior
    expect(await add.call(counter, 2)).toBe(5);
  });

  it("shared-store pitfall: memoization is prototype-wide", () => {
    const store = new Map<number | string, unknown>();
    class Cacher {
      loads = 0;
      @memoizeSync({ cacheStore: store, extraKeys: ["method-shared"] })
      value() {
        this.loads++;
        return "shared";
      }
    }
    const first = new Cacher();
    const second = new Cacher();
    expect(first.value()).toBe("shared");
    expect(second.value()).toBe("shared");
    expect(first.loads).toBe(1);
    expect(second.loads).toBe(0);
  });

  it("decorate-time guard rejects an async member under require: sync", () => {
    // A permissive enhancer (withLoggerAsync) is required in decorator syntax:
    // slot-precise enhancers compile-reject async members outright, which is
    // the intended typing discipline; the runtime guard is for loose slots.
    const guardSyncOnly = decorateMethod(withLoggerAsync, { require: "sync" });
    expect(() => {
        class Mixed {
          @guardSyncOnly()
          async asyncMethod() {
            return "declared async";
          }
        }
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        new Mixed();
      }).toThrow();
  });

  it("decorate-time guard rejects require: async on a sync member", () => {
    const guardAsyncOnly = decorateMethod(withLoggerSync, { require: "async" });
    expect(() => {
        class Mixed {
          @guardAsyncOnly()
          syncMethod() {
            return 1;
          }
        }
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        new Mixed();
      }).toThrow();
  });

  it("guards pass for matching sync/async members", async () => {
    const strictSync = decorateMethod(withCacheSync, { require: "sync" });
    const strictAsync = decorateMethod(withCacheAsync, { require: "async" });
    class Pairs {
      @strictSync({ extraKeys: ["method-pairs-sync"] })
      fast() {
        return 1;
      }

      @strictAsync({ extraKeys: ["method-pairs-async"] })
      async slow() {
        return 2;
      }
    }
    const pairs = new Pairs();
    expect(pairs.fast()).toBe(1);
    expect(await pairs.slow()).toBe(2);
  });

  it("works with option-less HOFs (lazy, withLoggerAsync)", async () => {
    const originalDebug = console.debug;
    const lines: unknown[][] = [];
    console.debug = (...parts: unknown[]) => {
      lines.push(parts);
    };
    try {
      const memoizeLazy = decorateMethod(lazy);
      const logged = decorateMethod(withLoggerAsync);
      class Spread {
        @memoizeLazy()
        syncValue() {
          return 42;
        }

        @logged()
        async watched() {
          return "seen";
        }
      }
      const spread = new Spread();
      expect(spread.syncValue()).toBe(42);
      expect(spread.syncValue()).toBe(42);
      expect(await spread.watched()).toBe("seen");
    } finally {
      console.debug = originalDebug;
    }
    expect(lines.some((parts) => /watched/.test(String(parts[0])))).toBeTruthy();
  });

  it("paren-less factory application fails fast at decorate time", () => {
    expect(() => {
        class Oops {
          // @ts-expect-error - paren-less misfire is a compile rejection; the runtime fallback exists for plain-JS users.
          @memoizeSync
          boomed() {
            return 1;
          }
        }
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        new Oops();
      }).toThrow();
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("compile pin: single-call guard usage is type-rejected", () => {
    // Analysis-time probe: passing the guard inline means the decorator
    // shape still hangs on the factory's fluent options call — rejected.
    // The arrow body is deliberately never invoked; tsc still type-checks it.
    void (() => {
      class Pinned {
        // @ts-expect-error - the guard only configures the converter; a paren-less application is still a misfire.
        @decorateMethod(withCacheSync, { require: "sync" })
        m() {
          return 1;
        }
      }
      return Pinned;
    });
  });

  it("zero-option converters reject raw member application at runtime", () => {
    // Decorator syntax cannot express the paren-less zero-option shape
    // (tsc rejects it while parsing), so the invocation is synthesized:
    const factory = decorateMethod(lazy) as (...args: any[]) => unknown;
    const descriptor = {
      configurable: true,
      enumerable: false,
      value: function member() {
        return 1;
      },
      writable: true,
    };
    expect(() => void factory(Object.prototype, "member", descriptor)).toThrow();
  });
});

describe("decorateMethod: kind-based conversion contract", () => {
  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("rejects a legacy (non-factory) HOF at compile time", () => {
    // A hand-written fn-first function carries no `__kind` brand, so the
    // converter cannot recover its option bag — rejected.
    const legacyHof = (fn: (x: number) => number) => fn;

    void (() => {
      // @ts-expect-error - only factory-built HOFs are convertible.
      return decorateMethod(legacyHof);
    });
  });

  it("guards an async member under a sync HOF at call time", () => {
    class Pinned {
      @memoizeSync()
      async m() {
        return 1;
      }
    }

    expect(() => new Pinned().m()).toThrow();
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("rejects a sync member under an async HOF at compile time", () => {
    void (() => {
      class Pinned {
        // @ts-expect-error - an async HOF refuses a non-promise member.
        @retryAsync()
        m() {
          return 1;
        }
      }
      return Pinned;
    });
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests
  it("rejects an unknown option key at compile time", () => {
    void (() => {
      class Pinned {
        // @ts-expect-error - the option bag is typed from the HOF's kind.
        @memoizeSync({ bogus: true })
        m() {
          return 1;
        }
      }
      return Pinned;
    });
  });

  it("accepts an async member under an any-flavor HOF (lazy)", async () => {
    const memo = decorateMethod(lazy);
    class Async {
      calls = 0;
      @memo()
      async value() {
        this.calls++;
        return 42;
      }
    }
    const instance = new Async();
    expect(await instance.value()).toBe(42);
    expect(await instance.value()).toBe(42);
    expect(instance.calls).toBe(1);
  });

  it("forwards the option bag to the HOF as a single argument", () => {
    // `skipHof` lives in the option bag: a truthy predicate runs the member
    // raw, so the cache layer never stores anything.
    const bypass = decorateMethod(withCacheSync);
    class Bypassed {
      calls = 0;
      @bypass({ skipHof: () => true })
      value() {
        this.calls++;
        return 1;
      }
    }
    const instance = new Bypassed();
    expect(instance.value()).toBe(1);
    expect(instance.value()).toBe(1);
    expect(instance.calls).toBe(2);
  });

  it("converts a composed stack (the composer's brand is honored)", async () => {
    const stack = decorateMethod(withAsync(withCacheAsync, withRetryAsync));
    class Stacked {
      calls = 0;
      @stack({ extraKeys: ["stacked"] })
      async value() {
        this.calls++;
        return 7;
      }
    }
    const instance = new Stacked();
    expect(await instance.value()).toBe(7);
    expect(await instance.value()).toBe(7);
    expect(instance.calls).toBe(1);
  });
});

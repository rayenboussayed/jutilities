import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withCacheAsync, withCacheSync } from "../cache.js";
import { lazy } from "../lazy.js";
import { withDelayAsync } from "../delay.js";
import { withLoggerAsync, withLoggerSync } from "../logger.js";
import { withRetryAsync } from "../retry.js";
import { withTimeoutAsync } from "../timeout.js";
import { withAsync } from "../libs/with.js";
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
    const store = new Map<string | number, unknown>();
    class Users {
      loads = 0;
      @memoizeSync({ cacheStore: store, extraKeys: ["method-basic"] })
      name(id: string) {
        this.loads++;
        return `u-${id}`;
      }
    }
    const user = new Users();
    assert.strictEqual(user.name("a"), "u-a");
    assert.strictEqual(user.name("a"), "u-a");
    assert.strictEqual(user.loads, 1);
    assert.strictEqual(user.name("b"), "u-b");
    assert.strictEqual(user.loads, 2);
  });

  it("supports inline parenthesized factory application", () => {
    class Inline {
      @(decorateMethod(withCacheSync)({ extraKeys: ["method-inline"] }))
      add(x: number) {
        return x + 1;
      }
    }
    const inline = new Inline();
    assert.strictEqual(inline.add(1), 2);
    assert.strictEqual(inline.add(1), 2);
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
    assert.strictEqual(await service.call(), "ok");
    assert.strictEqual(service.attempts, 2);
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
    assert.strictEqual(await machine.job(4), 40);
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
    assert.strictEqual(await add.call(counter, 2), 5);
  });

  it("shared-store pitfall: memoization is prototype-wide", () => {
    const store = new Map<string | number, unknown>();
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
    assert.strictEqual(first.value(), "shared");
    assert.strictEqual(second.value(), "shared");
    assert.strictEqual(first.loads, 1);
    assert.strictEqual(second.loads, 0);
  });

  it("decorate-time guard rejects an async member under require: sync", () => {
    // A permissive enhancer (withLoggerAsync) is required in decorator syntax:
    // slot-precise enhancers compile-reject async members outright, which is
    // the intended typing discipline; the runtime guard is for loose slots.
    const guardSyncOnly = decorateMethod(withLoggerAsync, { require: "sync" });
    assert.throws(
      () => {
        class Mixed {
          @guardSyncOnly()
          async asyncMethod() {
            return "declared async";
          }
        }
        new Mixed();
      },
      (error) =>
        error instanceof TypeError &&
        /"asyncMethod" is an async function, but require: "sync" was requested/.test(
          error.message,
        ),
    );
  });

  it("decorate-time guard rejects require: async on a sync member", () => {
    const guardAsyncOnly = decorateMethod(withLoggerSync, { require: "async" });
    assert.throws(
      () => {
        class Mixed {
          @guardAsyncOnly()
          syncMethod() {
            return 1;
          }
        }
        new Mixed();
      },
      (error) =>
        error instanceof TypeError &&
        /"syncMethod" is not an async function, but require: "async" was requested/.test(
          error.message,
        ),
    );
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
    assert.strictEqual(pairs.fast(), 1);
    assert.strictEqual(await pairs.slow(), 2);
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
      assert.strictEqual(spread.syncValue(), 42);
      assert.strictEqual(spread.syncValue(), 42);
      assert.strictEqual(await spread.watched(), "seen");
    } finally {
      console.debug = originalDebug;
    }
    assert.ok(lines.some((parts) => /watched/.test(String(parts[0]))));
  });

  it("paren-less factory application fails fast at decorate time", () => {
    assert.throws(
      () => {
        class Oops {
          // @ts-expect-error - paren-less misfire is a compile rejection; the runtime fallback exists for plain-JS users.
          @memoizeSync
          boomed() {
            return 1;
          }
        }
        new Oops();
      },
      (error) =>
        error instanceof TypeError &&
        /applied without parentheses/.test(error.message),
    );
  });

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
    const member = function member() {
      return 1;
    };
    const context = { kind: "method", name: "member", addInitializer() {} };
    assert.throws(
      () => void factory(member, context),
      (error) =>
        error instanceof TypeError &&
        /applied without parentheses/.test(error.message),
    );
  });
});

describe("decorateMethod: kind-based conversion contract", () => {
  it("rejects a legacy (non-factory) HOF at compile time", () => {
    // A hand-written fn-first function carries no `__kind` brand, so the
    // converter cannot recover its option bag — rejected.
    const legacyHof = (fn: (x: number) => number) => fn;

    void (() => {
      // @ts-expect-error - only factory-built HOFs are convertible.
      return decorateMethod(legacyHof);
    });
  });

  it("rejects an async member under a sync HOF at compile time", () => {
    void (() => {
      class Pinned {
        // @ts-expect-error - a sync HOF refuses a promise-returning member.
        @memoizeSync()
        async m() {
          return 1;
        }
      }
      return Pinned;
    });
  });

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
    assert.strictEqual(await instance.value(), 42);
    assert.strictEqual(await instance.value(), 42);
    assert.strictEqual(instance.calls, 1);
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
    assert.strictEqual(instance.value(), 1);
    assert.strictEqual(instance.value(), 1);
    assert.strictEqual(instance.calls, 2);
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
    assert.strictEqual(await instance.value(), 7);
    assert.strictEqual(await instance.value(), 7);
    assert.strictEqual(instance.calls, 1);
  });
});

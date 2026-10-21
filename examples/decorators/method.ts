/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Runnable demo for `decorateMethod` (`jutilities/decorators/method`): any
 * fn-first HOF built by this package converts into a reusable method
 * decorator. Stage 3 decorators cannot be parsed by plain Node, so this file
 * is TypeScript and is executed through tsx alongside the flat demos by
 * `examples/run-all.ts`.
 *
 * Grammar demonstrated here: hoist each factory once, decorate prototype
 * methods with `@factory(...options)`, and swap enhancers (cache, delay,
 * retry, logger) without touching the classes. Misfire and guard rules are
 * pinned in `src/decorators/method.test.ts`, not here.
 */
import assert from "node:assert/strict";
import { withCacheAsync, withCacheSync } from "jutilities/cache";
import { withDelayAsync } from "jutilities/delay";
import { withLoggerSync } from "jutilities/logger";
import { withRetryAsync } from "jutilities/retry";
import { withAsync } from "jutilities/libs/with";
import { decorateMethod } from "jutilities/decorators/method";

// Hoist the factory so each decoration applies it exactly once.
const memoizeSync = decorateMethod(withCacheSync, { require: "sync" });
const delayIt = decorateMethod(withDelayAsync, { require: "async" });
const retried = decorateMethod(withRetryAsync, { require: "async" });
const logged = decorateMethod(withLoggerSync, { require: "sync" });

let slugComputations = 0;
let fetches = 0;

class Store {
  @memoizeSync({ extraKeys: ["store"] })
  slug(name: string): string {
    slugComputations++;
    return name.toLowerCase();
  }

  // No options → the default retry policy (10 retries with built-in
  // exponential, jittered backoff) applies between attempts.
  @retried()
  async loadUser(name: string): Promise<string> {
    fetches++;
    if (fetches === 1) throw new Error("boom");
    return await Promise.resolve(`user:${name}`);
  }

  @delayIt({ delay: 5 })
  async waitForIt(): Promise<string> {
    return await Promise.resolve("done");
  }

  @logged()
  audit(action: string): string {
    return `audited ${action}`;
  }
}

const store = new Store();

console.log("retried :", await store.loadUser("ada"), `(${fetches} real attempts)`);
console.log("delayed :", await store.waitForIt(), "(5 ms pre-call sleep)");
console.log("logged  :", store.audit("rename"), "— logger lines above");
console.log("memoized:", store.slug("Ada"), ",", store.slug("Ada"), "(same arguments → cache key hit, 1 computation)");

assert.strictEqual(fetches, 2);
assert.strictEqual(slugComputations, 1);

// ---- a composed stack converts like a single HOF -----------------------------
// The composer carries the same kind brand, so the converter can type the
// shared option bag — here the cache layer reads `extraKeys`, the retry layer
// uses its default policy.
const resilient = decorateMethod(withAsync(withCacheAsync, withRetryAsync));

let stackFetches = 0;

class Gateway {
  @resilient({ extraKeys: ["gateway"] })
  async fetchUser(id: string): Promise<string> {
    stackFetches++;
    if (stackFetches === 1) throw new Error("flaky upstream");
    return `user:${id}`;
  }
}

const gateway = new Gateway();

console.log("stack   :", await gateway.fetchUser("u1"), `(${stackFetches} real attempts)`);
console.log("stack   :", await gateway.fetchUser("u1"), "(cache hit, no new attempt)");

assert.strictEqual(stackFetches, 2);

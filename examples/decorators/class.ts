/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Runnable demo for `decorateClass` (`jutilities/decorators/class`): apply a
 * fn-first HOF — or a `{ sync, async }` pair resolved per member — to every
 * own prototype method at once. Stage 3 decorators cannot be parsed by plain
 * Node, so this file is TypeScript and is executed through tsx alongside the
 * flat demos by `examples/run-all.ts`.
 *
 * Note the option slots are declared once on the class decoration and
 * forwarded verbatim to every wrapped member, and each wrapped method shares
 * the same dedicated `cacheStore`. Almost-boundary rules (statics, getters,
 * `#private` members) are pinned in `src/decorators/class.test.ts`, not here.
 */
import assert from "node:assert/strict";
import { withCacheAsync, withCacheSync } from "jutilities/cache";
import { withLoggerSync } from "jutilities/logger";
import { decorateClass } from "jutilities/decorators/class";

// Pair mode: declared-async members take the async slot, others the sync slot.
const cached = decorateClass({ sync: withCacheSync, async: withCacheAsync });

// Single mode: one enhancer (logging) wrapped around every sync member.
const logged = decorateClass(withLoggerSync);

let mounts = 0;
let remoteCalls = 0;

@cached({ cacheStore: new Map(), extraKeys: ["users"] })
class Users {
  count(): number {
    mounts++;
    return 42;
  }

  async loadUser(name: string): Promise<string> {
    remoteCalls++;
    return await Promise.resolve(`user:${name}`);
  }
}

@logged()
class Pulse {
  greet(name: string): string {
    return `hi ${name}`;
  }
}

const users = new Users();

console.log("count     #1:", users.count());
console.log("count     #2:", users.count(), "(cached — still 1 mount)");
console.log("loadUser  #1:", await users.loadUser("ada"));
console.log("loadUser  #2:", await users.loadUser("ada"), "(cached — still 1 remote call)");
console.log("greet     :", new Pulse().greet("ada"), "— logger lines above");

assert.strictEqual(mounts, 1);
assert.strictEqual(remoteCalls, 1);

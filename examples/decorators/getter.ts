/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Runnable demo for `decorateGetter` (`jutilities/decorators/getter`): the
 * getter's access function runs through the HOF once at class definition, and
 * every access calls the wrapped getter with the instance as `this`. Because
 * getters live on the prototype, the HOF's state is shared prototype-wide —
 * `lazy` here memoizes its value once for the whole class (across all
 * instances), while a logger wrapper keeps firing on every read.
 *
 * Stage 3 decorators cannot be parsed by plain Node, so this file is
 * TypeScript and is executed through tsx alongside the flat demos by
 * `examples/run-all.ts`. Setter pairing and guard misfires are pinned in
 * `src/decorators/getter.test.ts`, not here.
 */
import assert from "node:assert/strict";
import { lazy } from "jutilities/lazy";
import { withLoggerSync } from "jutilities/logger";
import { decorateGetter } from "jutilities/decorators/getter";

// Hoist the factory so each decoration applies it exactly once.
const report = decorateGetter(lazy);
const logged = decorateGetter(withLoggerSync);

let recomputes = 0;

class Stats {
  @report()
  get heavy(): string {
    recomputes++;
    return `snapshot@${recomputes}`;
  }

  @logged()
  get name(): string {
    return "Ada";
  }
}

const stats = new Stats();

console.log("heavy #1 :", stats.heavy);
console.log("heavy #2 :", stats.heavy, "(memoized — lazy computed once)");
console.log("cross    :", new Stats().heavy, "(prototype-wide: instances share the memo)");
console.log("name     :", stats.name, ",", stats.name, "(logged on every read)");

assert.strictEqual(recomputes, 1);
assert.strictEqual(new Stats().heavy, stats.heavy);

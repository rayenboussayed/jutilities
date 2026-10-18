/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Runnable demo for `decorateProperty` (`jutilities/decorators/property`):
 * function-valued fields get their INITIAL VALUE wrapped through the HOF, once
 * per instance, at field initialization — arrow-function fields keep their
 * lexical `this` and each construction re-runs the wrapper.
 *
 * Grammar note demonstrated here: always decorate fields in call form
 * (`@factory(...)`); a bare `@decorator` on a field is type-rejected and
 * runtime-silent, and a non-function initializer throws a `TypeError` naming
 * the field at construction. Those fire paths are pinned in
 * `src/decorators/property.test.ts`, not here. Stage 3 decorators cannot be
 * parsed by plain Node, so this file is TypeScript and is executed through tsx
 * alongside the flat demos by `examples/run-all.ts`.
 */
import assert from "node:assert/strict";
import { withCacheSync } from "jutilities/cache";
import { withDelayAsync } from "jutilities/delay";
import { decorateProperty } from "jutilities/decorators/property";

// Guards check the field's initial function async-ness at construction time
// (not at class definition, unlike the method/class/getter kinds).
const delayed = decorateProperty(withDelayAsync, { require: "async" });
const memoized = decorateProperty(withCacheSync, { require: "sync" });

let halvings = 0;

class Scheduler {
  @delayed({ delay: 5 })
  run = async (name: string): Promise<string> => {
    return await Promise.resolve(`drained ${name}`);
  };

  @memoized({ extraKeys: ["scheduler"] })
  halve = (value: number): number => {
    halvings++;
    return value / 2;
  };
}

const scheduler = new Scheduler();

console.log("run   :", await scheduler.run("queue"), "(5 ms pre-call sleep)");
console.log("halve :", scheduler.halve(10), ",", scheduler.halve(10), "(1 computation → cached)");

assert.strictEqual(halvings, 1);

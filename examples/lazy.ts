/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */
import { lazy } from "jutilities/lazy";
import { withCacheAsync, withCacheSync } from "jutilities/cache";


/**
 * Demonstrates `lazy`: source+args-keyed memoization, falsy results never
 * cached, and rejected promises evicted so the next call retries.
 */

// ---- memoization by source + args -------------------------------------------
let doublerCalls = 0;

/**
 * Doubler used as the memoization subject.
 * @param x - Number to double.
 * @returns `x * 2`, computed at most once per distinct `x` (truthy results).
 */
function doubler(x: number): number {
  doublerCalls += 1;
  return x * 2;
}

const memoDoubler = lazy(doubler);
console.log("first :", memoDoubler(21)); // computed
console.log("second:", memoDoubler(21)); // cached (same source + args)
console.log("third :", memoDoubler(22)); // different args -> computed
console.log("total real computations:", doublerCalls); // 2

// ---- falsy results are never cached -----------------------------------------
let zeroerCalls = 0;

/**
 * Returning-falsy demo: `0` recomputes on every call.
 * @returns Always `0` — falsy, therefore never stored.
 */
function zeroer(): number {
  zeroerCalls += 1;
  return 0;
}

const memoZero = lazy(zeroer);
memoZero();
memoZero();
console.log("falsy('0') computations:", zeroerCalls); // 2 (never cached)

// ---- rejected promises are evicted (next call retries) ------------------------
let recovererAttempts = 0;

/**
 * Failing-then-succeeding async producer showing failure eviction.
 * @returns `"recovered"` after one simulated failed attempt.
 */
async function recoverer(): Promise<string> {
  recovererAttempts += 1;
  if (recovererAttempts === 1) throw new Error("transient");
  return "recovered";
}

const memoRecover = lazy(recoverer);
try {
  await memoRecover();
} catch (error) {
  console.log("first async call failed:", (error as Error).message);
}
console.log("second async call:", await memoRecover()); // retried, not cached


// ===== appended generic example: examples/generic-no-cast.ts =====================
/**
 * No-cast example: wrap generic functions the plain way (letting the compiler
 * infer every signature) and consume the results. The sync and async flavors
 * both preserve the generic signature; no boundary cast is required.
 *
 * This file is type-checked by the gate (`npm run typecheck` includes
 * `examples/`). The `@ts-expect-error` lines below document *real* errors.
 */

// A generic producer: T flows one-to-one from argument to return.
/**
 * A generic producer: T flows one-to-one from argument to return.
 * @param value - The value to produce.
 * @returns The same value.
 */
function produce<T>(value: T): T {
  return value;
}
const asyncProduce = async <T>(value: T): Promise<T> => value;

// ---- async flavor ------------------------------------------------------------
// Inference picks `TF` (the gate is unconstrained on async flavors), so
// `wrappedAsync` is `<T>(value: T) => Promise<T>`.
const wrappedAsync = withCacheAsync(asyncProduce);

// Consuming the return: T is inferred per call site.
const awPromise: Promise<string> = wrappedAsync("ok");
const awNumber: Promise<number> = wrappedAsync(1);
const awObject: Promise<{ deep: string[] }> = wrappedAsync({ deep: ["x"] });
// @ts-expect-error -- inferred generic, arity IS enforced
wrappedAsync();
// @ts-expect-error -- `void` does not match `T`
const awWrong: Promise<void> = wrappedAsync("not-void");
void awPromise;
void awNumber;
void awObject;
void awWrong;
console.log("async wrapper arity enforced via @ts-expect-error above");

// ---- lazy -------------------------------------------------------------------
const wrappedLazy = lazy(produce);
// Generics survive here too — every call site recovers its own T.
const lwStr: string = wrappedLazy("payload");
const lwNum: number = wrappedLazy(9);
// @ts-expect-error -- inferred generic, arity IS enforced
wrappedLazy();
console.log("lazy wrapper accepts", lwStr, lwNum);

// ---- sync flavor -------------------------------------------------------------
// The sync HOF is signature-preserving, just like the async flavor: T flows
// through every call site without an explicit type argument or a cast.
const plainSync = withCacheSync(produce);

// The wrapper keeps the polymorphic signature, not just the nominal shape:
const genericResult: "seed" = plainSync("seed");
const numberResult: number = plainSync(5);
// @ts-expect-error -- "seed" is not assignable to number
const wrongType: number = plainSync("seed");
void genericResult;
void numberResult;
void wrongType;

// Arity is enforced on the preserved signature too:
// @ts-expect-error -- inferred generic, arity IS enforced
plainSync();
console.log("sync wrapper preserves generics end-to-end");

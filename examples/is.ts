/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */
import type { HandleAsyncFunction } from "jutilities/types/type";

import { isAsyncFunction, isEmpty, isEmptyRecord, isNil, isObject, isPromise, isRecord, isThenable } from "jutilities/is";


/**
 * Demonstrates the `is` type guards, including the aggregated `isEmpty`
 * semantics and the promise-family duck typing.
 */
console.log("isNil(null)        :", isNil(null));
console.log("isNil(undefined)   :", isNil(undefined));
console.log("isNil(0)           :", isNil(0));

console.log("isObject([])       :", isObject([]));       // arrays are objects…
console.log("isRecord([])       :", isRecord([]));       // …but never records
console.log("isRecord({})       :", isRecord({}));

console.log("isEmptyRecord(new Date()):", isEmptyRecord(new Date())); // keyless
console.log("isEmpty(0)         :", isEmpty(0));          // falsy is NOT empty
console.log("isEmpty('')        :", isEmpty(""));
console.log("isEmpty([])        :", isEmpty([]));
console.log("isEmpty({})        :", isEmpty({}));

console.log("isThenable({ then(){}}) :", isThenable({ then: () => {} }));
console.log("isPromise(Promise.resolve()) :", isPromise(Promise.resolve()));
console.log("isPromise({ then(){}})      :", isPromise({ then: () => {} }));
console.log("isPromise({then,catch,finally}) :",
  isPromise({ catch: () => {}, finally: () => {}, then: () => {} }));

/**
 * Canonical `async` function for constructor-name detection.
 * @returns Always the literal `"plain"`. Minimal body by design.
 */
async function plainAsync(): Promise<string> {
  return "plain";
}
console.log("isAsyncFunction(plainAsync):", isAsyncFunction(plainAsync));


// ===== appended generic conditional demo from examples/generic-complex.ts =====
// ---- conditional type branching --------------------------------------------
/**
 * Picks a runner shape depending on whether `F` resolves to a promise.
 * @template F - The function whose return shape drives the branch.
 */
type AsyncWhen<F extends (...args: any) => unknown> = HandleAsyncFunction<
  F,
  { flavor: "async"; run: (x: Parameters<F>[0]) => Promise<Awaited<ReturnType<F>>> },
  { flavor: "sync"; run: (x: Parameters<F>[0]) => ReturnType<F> }
>;

/**
 * Builds a runner whose shape is selected by the conditional type.
 * @template F - The anchored function type driving the branch.
 * @param _fn - The function whose return shape drives the branch.
 * @returns The picked runner shape.
 */
function makeRunner<F extends (...args: any) => unknown>(_fn: F): AsyncWhen<F> {
  if (isAsyncFunction(_fn)) {
    return {
      flavor: "async",
      run: (x: Parameters<F>[0]) => Promise.resolve(_fn(x)),
    } as unknown as AsyncWhen<F>;
  }
  return {
    flavor: "sync",
    run: (x: Parameters<F>[0]) => _fn(x),
  } as unknown as AsyncWhen<F>;
}

const syncRunner = makeRunner((n: number) => n * 2);
const asyncRunner = makeRunner(async (n: number) => n * 2);
console.log("sync flavor:", syncRunner.flavor, syncRunner.run(4));
console.log("async flavor:", asyncRunner.flavor, await asyncRunner.run(4));

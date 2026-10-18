/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates the `is` type guards, including the aggregated `isEmpty`
 * semantics and the promise-family duck typing.
 */
import {
  isAsyncFunction,
  isEmpty,
  isEmptyRecord,
  isNil,
  isObject,
  isPromise,
  isRecord,
  isThenable,
} from "jutilities/is";

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
  isPromise({ then: () => {}, catch: () => {}, finally: () => {} }));

/**
 * Canonical `async` function for constructor-name detection.
 * @returns Always the literal `"plain"`. Minimal body by design.
 */
async function plainAsync(): Promise<string> {
  return "plain";
}
console.log("isAsyncFunction(plainAsync):", isAsyncFunction(plainAsync));

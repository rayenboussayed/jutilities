import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
  HandleAsyncFunction,
} from "./type.js";

describe("HandleAsyncFunction", () => {
  it("picks the sync branch for a plain function", () => {
    type Branch = HandleAsyncFunction<
      (value: number) => number,
      "async",
      "sync"
    >;

    const branch: Branch = "sync";
    assert.strictEqual(branch, "sync");
  });

  it("picks the async branch for a promise-returning function", () => {
    type Branch = HandleAsyncFunction<
      (value: number) => Promise<number>,
      "async",
      "sync"
    >;

    const branch: Branch = "async";
    assert.strictEqual(branch, "async");
  });
});

describe("callable gates", () => {
  it("accepts any callable in AnyFunction", () => {
    const fn: AnyFunction = (value: number) => value;
    assert.strictEqual(fn(1), 1);
  });

  it("rejects a promise-returning function in the sync gate", () => {
    // @ts-expect-error - a promise-returning function is not sync.
    const fn: AnySyncFunction<(value: number) => Promise<number>> = async (
      value: number,
    ) => value;
    assert.ok(fn);
  });

  it("requires an actual promise return in the async gate", () => {
    // @ts-expect-error - the async gate requires a promise return.
    const fn: AnyAsyncFunction = (value: number) => value;
    assert.ok(fn);
  });
});

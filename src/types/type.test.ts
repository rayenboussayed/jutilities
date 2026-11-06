import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
  HandleAsyncFunction,
} from "./type.js";
import { withCacheSync, withCacheAsync } from "../cache.js";
import { lazy } from "../lazy.js";

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

describe("generic wrap matrix", () => {
  it("compile-only: generic signatures survive every flavor without casts", () => {
    const identity = <T>(value: T): T => value;

    // Async and `lazy` preserve generic signatures end-to-end:
    const asyncWrapped = withCacheAsync(
      async <T>(value: T): Promise<T> => value,
    );
    const lazyWrapped = lazy(identity);
    const fromAsync: Promise<number> = asyncWrapped(7);
    const fromLazy: { n: number } = lazyWrapped({ n: 7 });
    void fromAsync;
    void fromLazy;

    // Sync HOFs also preserve the signature and infer T per call site:
    const syncWrapped = withCacheSync(identity);
    const fromSyncString: "abc" = syncWrapped("abc");
    const fromSyncObject: { n: number } = syncWrapped({ n: 1 });
    const fromSyncTrue: true = syncWrapped(true as const);
    void fromSyncString;
    void fromSyncObject;
    void fromSyncTrue;

    // Arity is enforced on the preserved signature:
    // @ts-expect-error -- a generic identity wrapper requires its argument.
    syncWrapped();

    // Explicit type arguments are no longer necessary, but remain valid:
    const withTypeArgument = withCacheSync<typeof identity>(identity);
    const escaped: "abc" = withTypeArgument("abc");
    void escaped;

    assert.ok(true);
  });
});

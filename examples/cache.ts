/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */
import type { CacheStore, Key } from "jutilities/hof/cache";
import type { AnyFunction } from "jutilities/types/type";

import { decorateMethod } from "jutilities/decorators/method";
import { withCacheAsync, withCacheSync } from "jutilities/hof/cache";
import { withRetryAsync } from "jutilities/hof/retry";
import { lazy } from "jutilities/lazy";
import assert from "node:assert/strict";


/**
 * Demonstrates `withCacheSync` and `withCacheAsync`: TTL-backed default store,
 * hashed argument-keyed memoization (default keys are 32-bit `djb2` numbers),
 * `extraKeys` scoping, custom numeric key factories, and in-flight
 * deduplication.
 */

let computeCalls = 0;

/**
 * Expensive-to-compute sync function used as the cache subject. The `string |
 * number` parameter also lets the custom numeric-key factory below pass raw
 * ids straight through.
 * @param id - Arbitrary identifier (part of the cache key).
 * @returns A payload recording how many times the real computation ran.
 */
function computeSync(id: number | string): { id: number | string; marker: string } {
  computeCalls += 1;
  return { id, marker: `compute-${computeCalls}` };
}

// ---- sync memoization ------------------------------------------------------
const cached = withCacheSync(computeSync);

console.log("sync first :", cached("u1"));
console.log("sync second:", cached("u1")); // same key -> served from store
console.log("sync third :", cached("u2")); // different key -> recomputed

// ---- extraKeys scoping -----------------------------------------------------
const tenanted = withCacheSync(computeSync, { extraKeys: ["tenant-A"] });
console.log("tenant-A   :", tenanted("u1")); // separate identity from `cached`

// ---- custom key factory (numeric keys are first-class) ---------------------
// Keys may be `string` OR `number`: the default keygen already returns a
// number (the 32-bit hash), and custom factories may do the same — here the
// factory keys each cache entry by a small numeric id instead of a string.
const byNumericId = withCacheSync(computeSync, {
  generateCacheKey: ({ parameters }) => Number(parameters[0]),
});
console.log("key 7 once:", byNumericId(7), "==", byNumericId(7));

// ---- async memoization with in-flight deduplication ------------------------
let loadUserCalls = 0;

const loadUser = withCacheAsync(async (id: string) => {
  loadUserCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { id, phone: "+1-555-0000" };
});

const results = await Promise.all([
  loadUser("u9"),
  loadUser("u9"), // same key -> shares the first in-flight promise
  loadUser("u8"),
]);
console.log("async merged:", results);
console.log("upstream ran", loadUserCalls, "times for 3 requests");


// ===== appended generic example: examples/generic-cache.ts =====================
/**
 * Demonstrates generics flowing through `withCacheSync` / `withCacheAsync`: a
 * generic factory keeps its type parameter `T` all the way through to the
 * returned wrapper, and a typed custom `CacheStore<W>` can be plugged in for a
 * concrete wrapped function `W`.
 *
 * Boundary note: both flavors preserve generic signatures end-to-end; the
 * sync flavor additionally enforces sync discipline at runtime.
 */

interface User {
  id: string;
  name: string;
  roles: ReadonlyArray<string>;
}

// ---- generic sync memoizer factory --------------------------------------------
/**
 * Factory producing a generic, cached sync producer of value type `T`.
 *
 * The generic producer flows through unchanged; callers see a fully generic
 * signature.
 * @template T - The value type produced by `load`. Must expose an `id`.
 * @param label - Label used in cache keys (scope).
 * @param load - The (expensive) producer.
 * @returns The cached loader; the producer closure counts real invocations in
 * `realUserCalls`.
 */
function makeSyncLoader<T extends { id: string }>(
  label: string,
  load: (id: string) => T,
) {
  const cached = withCacheSync(load, {
    cacheStore: typedStore<(id: string) => T>(),
    extraKeys: [label],
  });
  return cached;
}

// ---- generic typed cache store ------------------------------------------------
/**
 * A tiny typed `CacheStore<W>` backed by a `Map`, generic on the wrapped
 * function `W`; it stores `Awaited<ReturnType<W>>` values.
 * @template W - The wrapped function whose return value is stored.
 * @returns A `CacheStore<W>` implementation backed by an in-memory `Map`.
 */
function typedStore<W extends AnyFunction>(): CacheStore<W> {
  const map = new Map<string, unknown>();
  return {
    delete: (key: Key) => {
      map.delete(String(key));
      return undefined;
    },
    get: (key: Key) => map.get(String(key)) as never,
    set: (key: Key, value: ReturnType<W>) => {
      map.set(String(key), value);
      return undefined;
    },
  };
}

let realUserCalls = 0;
const users = makeSyncLoader<User>("users", (id) => {
  realUserCalls += 1;
  return { id, name: `user-${id}`, roles: ["member"] };
});
const u1 = users("u1");
const u2 = users("u1"); // same args + scope -> cache hit, producer not run
const u3 = users("u2"); // different id -> producer runs again
assert.strictEqual(realUserCalls, 2, "the identical second id is a cache hit");
console.log("generic sync cache:", u1, u2, u3, "real calls:", realUserCalls);

interface Product {
  id: string;
  price: number;
  tags: ReadonlyArray<string>;
}

// ---- generic async repository (no boundary cast) -------------------------------
interface Repo<T> {
  get(id: string): Promise<T | undefined>;
  save(value: T): Promise<T>;
}

/**
 * Builds a generic async repository backed by a `Map`, with the `get` cached
 * and scoped by `extraKeys`.
 * @template T - The entity type. Must expose an `id`.
 * @param kind - Repository kind tag mixed into cache keys (scoping).
 * @returns A `Repo<T>` whose `get` is cached.
 */
function makeRepo<T extends { id: string }>(kind: string): Repo<T> {
  const store = new Map<string, T>();
  const get = withCacheAsync(
    async (id: string): Promise<T | undefined> => store.get(id),
    { extraKeys: [kind] },
  );

  return {
    get: async (id) => get(id),
    save: async (value) => {
      store.set(value.id, value);
      return value;
    },
  };
}

const products = makeRepo<Product>("product");
const saved = await products.save({ id: "p1", price: 9.99, tags: ["a", "b"] });
const fetched = await products.get("p1");
console.log("saved then (cached) fetched:", fetched, "===", saved.id);
assert.deepStrictEqual(fetched, saved);
console.log("generic async repo: OK");


// ===== appended generic example: examples/generic-function.ts =====================
/**
 * Wrapping a **generic** function with the package's fn-first enhancers —
 *
 * - Every flavor takes `TF` directly, so a generic function wraps with its
 *   signature fully preserved (no boundary cast, no explicit type argument).
 * - `withCacheSync` and the other sync HOFs enforce sync discipline at runtime:
 *   a promise/generator result throws a TypeError before the enhancer or
 *   caller can consume it.
 * - Generic *factories* whose type parameter is only visible inside the factory
 *   still compile and return their inferred signature; no cast is needed.
 *
 * Every `@ts-expect-error` pin below is verified by the repo's typecheck.
 */

// ---- a generic identity producer ----------------------------------------------
/**
 * Generic producer used as the wrapping subject.
 * @param value - The value to produce.
 * @returns The same value.
 */
function produce<T>(value: T): T {
  return value;
}
const asyncProduce = async <T>(value: T): Promise<T> => value;

// ---- async flavor: generic signature preserved end-to-end ---------------------
const memoizedAsync = withCacheAsync(asyncProduce);
const a1 = await memoizedAsync("seed");
const a2 = await memoizedAsync(1234); // T inferred per call site
const a3 = await memoizedAsync({ deep: [1, 2, 3] });
console.log("withCacheAsync keeps generics:", a1, a2, a3);

const retry = withRetryAsync(asyncProduce, { onError: () => {} });
console.log("withRetryAsync keeps generics:", await retry("ok"), await retry(84));

// ---- lazy: generic signature preserved via its widened any-export -------------
const memoizedAny = lazy(produce);
const l1 = memoizedAny("payload");
const l2 = memoizedAny(9);
console.log("lazy keeps generics:", l1, l2);

// ---- sync flavor: generic signature preserved end-to-end --------------------
// The HOF accepts the polymorphic function directly: TF is inferred from the
// call, so each result is typed per call site and arity is enforced.
const memoizedSync = withCacheSync(produce);
const s1: "abc" = memoizedSync("abc"); // T narrowed per call site
const s2: number = memoizedSync(5);
const s3: boolean = memoizedSync(true);
// @ts-expect-error -- the generic signature is inferred, so arity is enforced
memoizedSync();
assert.strictEqual(s1, "abc");
assert.strictEqual(s2, 5);
assert.strictEqual(s3, true);
console.log("withCacheSync keeps generics:", s1, s2, s3);

// Rejecting a promise happens at call time, not compile time: the runtime is
// authoritative for the sync flavor.
const syncStillGuards = withCacheSync((value: string) => Promise.resolve(value));
try {
  syncStillGuards("nope");
  throw new Error("expected a TypeError from the sync guard");
} catch (error) {
  assert.ok(error instanceof TypeError);
  console.log("sync guard rejected the promise result:", error.message);
}


// ===== appended generic complex hoisted factories demo =====
// ---- hoisted factories -----------------------------------------------------
const cachedAsync = decorateMethod(withCacheAsync);

interface Cat {
  id: string;
  lives: number;
}

/**
 * A generic repository whose cache-signature member keeps the entity type `T`.
 * The async member keeps its unresolved entity type parameter end-to-end; an
 * equivalent *sync* member is shown in the factory below.
 * @template T - The entity type. Must expose an `id`.
 */
class Repository<T extends { id: string }> {
  private readonly data = new Map<string, T>();

  add(value: T): void {
    this.data.set(value.id, value);
  }

  @cachedAsync({ extraKeys: ["repo"] })
  async findAsync(id: string): Promise<T | undefined> {
    return this.data.get(id);
  }
}

const repo = new Repository<Cat>();
repo.add({ id: "c1", lives: 9 });

console.log("async generic repo fetch:", await repo.findAsync("c1"));

/**
 * Shape of a demo entity holding arbitrary generic `V` contents.
 * @template V - The payload type.
 */
interface Entity<V> {
  id: string;
  payload: V;
}

// ---- generic sync cache via a hoisted factory --------------------------------
/**
 * Builds a generic, cached sync producer.
 * @template V - The value type produced by `load`.
 * @param key - Cache scope tag.
 * @param load - The producer.
 * @returns The cached producer; `realSynchCalls` counts actual invocations.
 */
function memoizeValue<V>(key: string, load: (id: string) => V) {
  const calls = { realCalls: 0 };
  const cached = withCacheSync(
    (id: string) => {
      calls.realCalls += 1;
      return load(id);
    },
    { extraKeys: [key] },
  );
  return { cached, calls };
}

const memo = memoizeValue<Entity<number>>("entity", (id) => {
  return { id, payload: 42 };
});
const a = memo.cached("e1");
const b = memo.cached("e1"); // cache hit
assert.strictEqual(a, b, "cached identity preserved (generic V)");
assert.strictEqual(memo.calls.realCalls, 1, "producer ran once across identical calls");
console.log("generic sync memo:", a, "(real producer calls:", memo.calls.realCalls + ")");

import { isEmpty } from "./is.js";
import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
  MaybePromise,
} from "./types/type.js";
import { ExpiredMap } from "expired-map";

const globalCache = new ExpiredMap<string, any>().start();

type CacheKeyParams<T extends AnyFunction> = {
  parameters: Parameters<T>[];
  function: string;
  extraKeys?: unknown[];
};

type ShouldCacheParams<T extends AnyFunction> = {
  parameters: Parameters<T>[];
  result: Awaited<ReturnType<T>>;
};

type CacheStore<T extends AnyFunction> = {
  get: (
    key: string,
  ) => T extends AnyAsyncFunction
    ? MaybePromise<Awaited<ReturnType<T>> | undefined>
    : ReturnType<T> | undefined;
  set: (
    key: string,
    value: ReturnType<T>,
  ) => T extends AnyAsyncFunction ? MaybePromise<unknown> : unknown;
  delete: (
    key: string,
  ) => T extends AnyAsyncFunction ? MaybePromise<unknown> : unknown;
};

type Options<T extends AnyFunction> = {
  cacheStore?: CacheStore<T>;
  shouldCache?: (
    options: ShouldCacheParams<T>,
  ) => T extends AnyAsyncFunction ? MaybePromise<boolean> : boolean;
  generateCacheKey?: (
    options: CacheKeyParams<T>,
  ) => T extends AnyAsyncFunction ? MaybePromise<string> : string;
  extraKeys?: unknown[];
};

/**
 * Higher-order memoization helpers backed by a pluggable cache store.
 *
 * The default store is a process-wide `ExpiredMap` (TTL-aware Map), and the
 * default cache key is `JSON.stringify` of `{ parameters, function source,
 * extraKeys }` — so key collisions depend on stable argument serialization,
 * and object keys are order-sensitive by nature of `JSON.stringify`.
 */

/**
 * Memoizes a sync function's results.
 *
 * Behavior notes:
 * - Reads/writes go through the cache store; hits return the stored value (same
 *   reference for objects).
 * - Empty/falsy-empty results (see {@link isEmpty}) are never stored and never
 *   treated as hits, so `undefined`, `""`, `[]`, `{}`, `null` always recompute.
 * - `shouldCache` gates writes (throwing propagates and prevents caching);
 *   `generateCacheKey` (throwing propagates) and `extraKeys` let you key by
 *   tenant/user/etc. — `function` and `extraKeys` are visible to both hooks.
 * - No in-flight concept exists for sync: sequential post-throw/recompute calls
 *   simply recompute.
 * @param fn - The sync function to memoize.
 * @param root0 - Options object.
 * @param root0.cacheStore - Object with `get`/`set`/`delete` (defaults to a
 * process-wide TTL-backed `ExpiredMap`).
 * @param root0.generateCacheKey - Custom key factory over
 * `{ parameters, function, extraKeys }` (defaults to JSON keygen).
 * @param root0.shouldCache - Predicate over `{ parameters, result }` deciding
 * whether a computed value may be stored (defaults to always `true`).
 * @param root0.extraKeys - Extra lexical keys mixed into the cache
 * identity (e.g. tenant id).
 * @returns The wrapped function (typeof `fn`) that reads and writes through
 * the cache store.
 */
export function withCacheSync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  {
    cacheStore = globalCache,
    generateCacheKey = JSON.stringify,
    shouldCache = () => true,
    extraKeys,
  }: Options<AnySyncFunction<T>> = {},
) {
  const functionString = fn.toString();

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const cacheKey = generateCacheKey({
      parameters: args,
      function: functionString,
      extraKeys,
    });

    // @ts-expect-error - cache store is generic; the narrowed sync branch
    // returns undefined-or-value when the entry is present.
    const cached = cacheStore.get(cacheKey);
    if (!isEmpty(cached)) return cached;

    const result = fn.apply(this, args);
    if (!isEmpty(result) && shouldCache({ parameters: args, result })) {
      // @ts-expect-error - cache store is generic; storing a known sync value.
      cacheStore.set(cacheKey, result);
    }
    return result;
  } as T;
}

/**
 * Memoizes an async function's results, with in-flight deduplication.
 *
 * Behavior notes:
 * - Concurrent calls with the same cache key share one promise (`inFlight`),
 *   so a slow call is executed once per key.
 * - Rejections are never cached and clear the in-flight entry, so the next
 *   call retries from scratch.
 * - Empty results (see {@link isEmpty}) are never stored and never treated as
 *   hits; `shouldCache`, `generateCacheKey` and the store hooks may all be
 *   async.
 * @param fn - The async function to memoize.
 * @param root0 - Options object.
 * @param root0.cacheStore - Object with `get`/`set`/`delete` (defaults to a
 * process-wide TTL-backed `ExpiredMap`).
 * @param root0.generateCacheKey - Custom (optionally async) key factory over
 * `{ parameters, function, extraKeys }` (defaults to JSON keygen).
 * @param root0.shouldCache - (Optionally async) predicate over
 * `{ parameters, result }` deciding whether a computed value may be stored.
 * @param root0.extraKeys - Extra lexical keys mixed into the cache identity
 * (e.g. tenant id).
 * @returns The wrapped function (typeof `fn`) that dedups in-flight calls and
 * reads/writes through the cache store.
 */
export function withCacheAsync<T extends AnyAsyncFunction>(
  fn: T,
  {
    cacheStore = globalCache,
    generateCacheKey = JSON.stringify,
    shouldCache = () => true,
    extraKeys,
  }: Options<T> = {},
) {
  const functionString = fn.toString();
  const inFlight = new Map<string, ReturnType<T>>();

  return async function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const cacheKey = await generateCacheKey({
      parameters: args,
      function: functionString,
      extraKeys,
    });

    const pending = inFlight.get(cacheKey);
    if (pending) return pending;

    const promise = (async () => {
      const cached = await cacheStore.get(cacheKey);
      if (!isEmpty(cached)) return cached;

      const result = await fn.apply(this, args);
      if (
        !isEmpty(result) &&
        (await shouldCache({ parameters: args, result }))
      ) {
        await cacheStore.set(cacheKey, result);
      }
      return result;
    })().finally(() => inFlight.delete(cacheKey));

    inFlight.set(cacheKey, promise as ReturnType<T>);
    return promise;
  } as T;
}

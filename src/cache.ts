import { djb2 } from "./hash.js";
import { isEmpty } from "./is.js";
import { superjson } from "./json.js";
import type {
  AnyFunction,
  HandleAsyncFunction,
  MaybePromise,
} from "./types/type.js";
import {
  createHofAsync,
  createHofSync,
  type HofKind,
} from "./libs/create-hof.js";
import { ExpiredMap } from "expired-map";

export type Key = string | number;

/**
 * The process-wide `ExpiredMap` singleton backing every cache wrapper in this
 * module. Exposed so consumers can inspect or clear the shared store (e.g.
 * between tests); wrappers share entries through it.
 */
export const globalCache = new ExpiredMap<Key, any>().start();

/**
 * The default cache-key function: `djb2` over the superjson-stringified
 * parameters (`function` name, `parameters`, `extraKeys`).
 * @param options - The key inputs provided by the wrapper.
 * @returns The hashed cache key.
 */
export const defaultGenerateCacheKey = (options: CacheKeyParams<AnyFunction>) =>
  djb2(superjson.stringify(options));

export type CacheKeyParams<T extends AnyFunction> = {
  parameters: Parameters<T>[];
  function: string;
  extraKeys?: unknown[];
};

export type ShouldCacheParams<T extends AnyFunction> = {
  parameters: Parameters<T>[];
  result: Awaited<ReturnType<T>>;
};

export type CacheStore<T extends AnyFunction> = {
  get: (
    key: Key,
  ) => HandleAsyncFunction<
    T,
    MaybePromise<Awaited<ReturnType<T>> | undefined>,
    ReturnType<T> | undefined
  >;
  set: (
    key: Key,
    value: ReturnType<T>,
  ) => HandleAsyncFunction<T, MaybePromise<unknown>, unknown>;
  delete: (key: Key) => HandleAsyncFunction<T, MaybePromise<unknown>, unknown>;
};

export type Options<T extends AnyFunction> = {
  cacheStore?: CacheStore<T>;
  shouldCache?: (
    options: ShouldCacheParams<T>,
  ) => HandleAsyncFunction<T, MaybePromise<boolean>, boolean>;
  generateCacheKey?: (
    options: CacheKeyParams<T>,
  ) => HandleAsyncFunction<T, MaybePromise<Key>, Key>;
  extraKeys?: unknown[];
};

export interface CacheKind<T extends AnyFunction = AnyFunction> extends HofKind<T> {
  options: Options<this["fn"]>;
}


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
 * @template T - The function being wrapped.
 * @param fn - The sync function to memoize.
 * @param options - Options object.
 * @param options.cacheStore - Object with `get`/`set`/`delete` (defaults to a
 * process-wide TTL-backed `ExpiredMap`).
 * @param options.generateCacheKey - Custom key factory over
 * `{ parameters, function, extraKeys }` (defaults to the hashed keygen
 * `djb2(superjson.stringify(...))`); may return a string or a number.
 * @param options.shouldCache - Predicate over `{ parameters, result }` deciding
 * whether a computed value may be stored (defaults to always `true`).
 * @param options.extraKeys - Extra lexical keys mixed into the cache
 * identity (e.g. tenant id).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call arguments
 * and a truthy result invokes `fn` raw for that call (no cache read/write).
 * Defaults to enabled.
 * @returns The wrapped function (typeof `fn`) that reads and writes through
 * the cache store.
 */
export const withCacheSync = createHofSync<CacheKind>(
  (
    fn,
    {
      cacheStore = globalCache,
      generateCacheKey = defaultGenerateCacheKey,
      shouldCache = () => true,
      extraKeys,
    },
  ) => {
    const functionString = fn.toString();

    return function (
      this: ThisParameterType<CacheKind["fn"]>,
      ...args: Parameters<CacheKind["fn"]>[]
    ) {
      const cacheKey = generateCacheKey({
        parameters: args,
        function: functionString,
        extraKeys,
      });

      const cached = cacheStore.get(cacheKey);
      if (!isEmpty(cached)) return cached;

      const result = fn.apply(this, args);
      if (!isEmpty(result) && shouldCache({ parameters: args, result })) {
        cacheStore.set(cacheKey, result);
      }
      return result;
    } as CacheKind["fn"];
  },
);

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
 * @template T - The function being wrapped.
 * @param fn - The async function to memoize.
 * @param options - Options object.
 * @param options.cacheStore - Object with `get`/`set`/`delete` (defaults to a
 * process-wide TTL-backed `ExpiredMap`).
 * @param options.generateCacheKey - Custom (optionally async) key factory over
 * `{ parameters, function, extraKeys }` (defaults to the hashed keygen
 * `djb2(superjson.stringify(...))`); may return a string or a number.
 * @param options.shouldCache - (Optionally async) predicate over
 * `{ parameters, result }` deciding whether a computed value may be stored.
 * @param options.extraKeys - Extra lexical keys mixed into the cache identity
 * (e.g. tenant id).
 * @param options.skipHof - Per-call bypass switch: `true` resolves the wrapper
 * to `fn` itself at wrap time; a function predicate receives the call
 * arguments and a truthy result invokes `fn` raw for that call (no cache
 * read/write, no in-flight dedup). Defaults to enabled.
 * @returns The wrapped function (typeof `fn`) that dedups in-flight calls and
 * reads/writes through the cache store.
 */
export const withCacheAsync = createHofAsync<CacheKind>(
  (
    fn,
    {
      cacheStore = globalCache,
      generateCacheKey = defaultGenerateCacheKey,
      shouldCache = () => true,
      extraKeys,
    },
  ) => {
    const functionString = fn.toString();
    const inFlight = new Map<Key, Promise<unknown>>();

    return async function (
      this: ThisParameterType<CacheKind["fn"]>,
      ...args: Parameters<CacheKind["fn"]>
    ) {
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

      inFlight.set(cacheKey, promise);
      return promise;
    } as CacheKind["fn"];
  },
);

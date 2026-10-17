import { isEmpty } from "./is.js";
import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
  MaybePromise,
} from "@/types/type.js";
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
 *
 * @param fn
 * @param root0
 * @param root0.cacheStore
 * @param root0.generateCacheKey
 * @param root0.shouldCache
 * @param root0.extraKeys
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

    // @ts-ignore
    const cached = cacheStore.get(cacheKey);
    if (!isEmpty(cached)) return cached;

    const result = fn.apply(this, args);
    if (!isEmpty(result) && shouldCache({ parameters: args, result })) {
      // @ts-ignore
      cacheStore.set(cacheKey, result);
    }
    return result;
  } as T;
}

/**
 *
 * @param fn
 * @param root0
 * @param root0.cacheStore
 * @param root0.generateCacheKey
 * @param root0.shouldCache
 * @param root0.extraKeys
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

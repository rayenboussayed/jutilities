# `jutilities/cache`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/cache.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/cache.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/cache.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/cache.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { globalCache, defaultGenerateCacheKey, withCacheSync, withCacheAsync } from "jutilities/cache";
import type { Key, CacheKeyParams, CacheKind, CacheStore, Options, ShouldCacheParams } from "jutilities/cache";
```
## Constants

<dl>
<dt><a href="#globalCache">globalCache</a></dt>
<dd><p>The process-wide <code>ExpiredMap</code> singleton backing every cache wrapper in this
module. Exposed so consumers can inspect or clear the shared store (e.g.
between tests); wrappers share entries through it.</p>
</dd>
<dt><a href="#defaultGenerateCacheKey">defaultGenerateCacheKey</a> ⇒</dt>
<dd><p>The default cache-key function: <code>djb2</code> over the superjson-stringified
parameters (<code>function</code> name, <code>parameters</code>, <code>extraKeys</code>).</p>
</dd>
<dt><a href="#withCacheSync">withCacheSync</a> ⇒</dt>
<dd><p>Memoizes a sync function&#39;s results.</p>
<p>Behavior notes:</p>
<ul>
<li>Reads/writes go through the cache store; hits return the stored value (same
reference for objects).</li>
<li>Empty/falsy-empty results (see <a href="isEmpty">isEmpty</a>) are never stored and never
treated as hits, so <code>undefined</code>, <code>&quot;&quot;</code>, <code>[]</code>, <code>{}</code>, <code>null</code> always recompute.</li>
<li><code>shouldCache</code> gates writes (throwing propagates and prevents caching);
<code>generateCacheKey</code> (throwing propagates) and <code>extraKeys</code> let you key by
tenant/user/etc. — <code>function</code> and <code>extraKeys</code> are visible to both hooks.</li>
<li>No in-flight concept exists for sync: sequential post-throw/recompute calls
simply recompute.</li>
</ul>
</dd>
<dt><a href="#withCacheAsync">withCacheAsync</a> ⇒</dt>
<dd><p>Memoizes an async function&#39;s results, with in-flight deduplication.</p>
<p>Behavior notes:</p>
<ul>
<li>Concurrent calls with the same cache key share one promise (<code>inFlight</code>),
so a slow call is executed once per key.</li>
<li>Rejections are never cached and clear the in-flight entry, so the next
call retries from scratch.</li>
<li>Empty results (see <a href="isEmpty">isEmpty</a>) are never stored and never treated as
hits; <code>shouldCache</code>, <code>generateCacheKey</code> and the store hooks may all be
async.</li>
</ul>
</dd>
</dl>

<a name="globalCache"></a>

## globalCache
The process-wide `ExpiredMap` singleton backing every cache wrapper in this
module. Exposed so consumers can inspect or clear the shared store (e.g.
between tests); wrappers share entries through it.

**Kind**: global constant  

* * *

<a name="defaultGenerateCacheKey"></a>

## defaultGenerateCacheKey ⇒
The default cache-key function: `djb2` over the superjson-stringified
parameters (`function` name, `parameters`, `extraKeys`).

**Kind**: global constant  
**Returns**: The hashed cache key.  

| Param | Description |
| --- | --- |
| options | The key inputs provided by the wrapper. |


* * *

<a name="withCacheSync"></a>

## withCacheSync ⇒
Memoizes a sync function's results.

Behavior notes:
- Reads/writes go through the cache store; hits return the stored value (same
  reference for objects).
- Empty/falsy-empty results (see [isEmpty](isEmpty)) are never stored and never
  treated as hits, so `undefined`, `""`, `[]`, `{}`, `null` always recompute.
- `shouldCache` gates writes (throwing propagates and prevents caching);
  `generateCacheKey` (throwing propagates) and `extraKeys` let you key by
  tenant/user/etc. — `function` and `extraKeys` are visible to both hooks.
- No in-flight concept exists for sync: sequential post-throw/recompute calls
  simply recompute.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`) that reads and writes through
the cache store.  

| Param | Description |
| --- | --- |
| fn | The sync function to memoize. |
| options | Options object. |
| options.cacheStore | Object with `get`/`set`/`delete` (defaults to a process-wide TTL-backed `ExpiredMap`). |
| options.generateCacheKey | Custom key factory over the `(parameters, function, extraKeys)` record (defaults to the hashed keygen `djb2(superjson.stringify(...))`); may return a string or a number. |
| options.shouldCache | Predicate over the `(parameters, result)` record deciding whether a computed value may be stored (defaults to always `true`). |
| options.extraKeys | Extra lexical keys mixed into the cache identity (e.g. tenant id). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (no cache read/write). Defaults to enabled. |


* * *

<a name="withCacheAsync"></a>

## withCacheAsync ⇒
Memoizes an async function's results, with in-flight deduplication.

Behavior notes:
- Concurrent calls with the same cache key share one promise (`inFlight`),
  so a slow call is executed once per key.
- Rejections are never cached and clear the in-flight entry, so the next
  call retries from scratch.
- Empty results (see [isEmpty](isEmpty)) are never stored and never treated as
  hits; `shouldCache`, `generateCacheKey` and the store hooks may all be
  async.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`) that dedups in-flight calls and
reads/writes through the cache store.  

| Param | Description |
| --- | --- |
| fn | The async function to memoize. |
| options | Options object. |
| options.cacheStore | Object with `get`/`set`/`delete` (defaults to a process-wide TTL-backed `ExpiredMap`). |
| options.generateCacheKey | Custom (optionally async) key factory over the `(parameters, function, extraKeys)` record (defaults to the hashed keygen `djb2(superjson.stringify(...))`); may return a string or a number. |
| options.shouldCache | (Optionally async) predicate over the `(parameters, result)` record deciding whether a computed value may be stored. |
| options.extraKeys | Extra lexical keys mixed into the cache identity (e.g. tenant id). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (no cache read/write, no in-flight dedup). Defaults to enabled. |


* * *



# `jutilities/node/stream/cache`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/node/stream/cache.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/stream/cache.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/node/stream/cache.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/stream/cache.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { StreamCache } from "jutilities/node/stream/cache";
import type { StreamCacheOptions } from "jutilities/node/stream/cache";
```
<a name="StreamCache"></a>

## StreamCache
Filesystem-backed stream cache with resumable (append) writes.

One file per key. A full write goes to a temporary file that is renamed
into place when complete, so readers only ever see whole entries (a miss
while a replacement is in flight). The file size is the entry size and its
modification time is the entry age, so no metadata is stored. Fills for
the same key run one after another; a second full write while one is
already running is dropped.

**Kind**: global class  

* [StreamCache](#StreamCache)
    * [new StreamCache(options)](#new_StreamCache_new)
    * [.createCachePath(key)](#StreamCache+createCachePath) ⇒
    * [.flush()](#StreamCache+flush)
    * [.getOriginalSize(key)](#StreamCache+getOriginalSize) ⇒
    * [.read(options)](#StreamCache+read) ⇒
    * [.unlink(key)](#StreamCache+unlink) ⇒
    * [.write(options)](#StreamCache+write)


* * *

<a name="new_StreamCache_new"></a>

### new StreamCache(options)
Create a cache rooted at `options.directory`.


| Param | Description |
| --- | --- |
| options | Directory and limits. |


* * *

<a name="StreamCache+createCachePath"></a>

### streamCache.createCachePath(key) ⇒
Absolute on-disk path for `key` (a hash, so any key is a safe file name).

**Kind**: instance method of [<code>StreamCache</code>](#StreamCache)  
**Returns**: File path.  

| Param | Description |
| --- | --- |
| key | Cache key. |


* * *

<a name="StreamCache+flush"></a>

### streamCache.flush()
Wait until every queued write has finished.

**Kind**: instance method of [<code>StreamCache</code>](#StreamCache)  

* * *

<a name="StreamCache+getOriginalSize"></a>

### streamCache.getOriginalSize(key) ⇒
Size of the cached entry, or `undefined` on miss or expiry.

**Kind**: instance method of [<code>StreamCache</code>](#StreamCache)  
**Returns**: Size in bytes.  

| Param | Description |
| --- | --- |
| key | Cache key. |


* * *

<a name="StreamCache+read"></a>

### streamCache.read(options) ⇒
Open a readable over a byte range of an entry.

**Kind**: instance method of [<code>StreamCache</code>](#StreamCache)  
**Returns**: Readable, empty when the range is empty, or `undefined` on miss.  

| Param | Description |
| --- | --- |
| options | Key, range and signal. |
| options.end | Inclusive end offset (default: last byte). |
| options.key | Cache key. |
| options.signal | Optional abort signal. |
| options.start | Inclusive start offset (default 0). |


* * *

<a name="StreamCache+unlink"></a>

### streamCache.unlink(key) ⇒
Remove one cached entry.

**Kind**: instance method of [<code>StreamCache</code>](#StreamCache)  
**Returns**: Resolves once the entry is removed.  

| Param | Description |
| --- | --- |
| key | Cache key. |


* * *

<a name="StreamCache+write"></a>

### streamCache.write(options)
Cache `readable` at `key`.

Returns immediately and never throws; failures go to `onError` and
leave no partial entry behind.

**Kind**: instance method of [<code>StreamCache</code>](#StreamCache)  

| Param | Description |
| --- | --- |
| options | Key, source and flags. |
| options.append | Extend an existing entry instead of replacing it. |
| options.key | Cache key. |
| options.readable | Source bytes. |
| options.signal | Optional abort signal. |


* * *



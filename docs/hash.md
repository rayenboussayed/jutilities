# `jutilities/hash`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/hash.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hash.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/hash.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hash.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { djb2, sdbm, FNV_OFFSET, FNV_PRIME, fnv1a64 } from "jutilities/hash";
```
## Constants

<dl>
<dt><a href="#FNV_OFFSET">FNV_OFFSET</a></dt>
<dd><p>FNV-1a 64-bit offset basis (as <code>BigInt</code>); see <a href="fnv1a">fnv1a</a>.</p>
</dd>
<dt><a href="#FNV_PRIME">FNV_PRIME</a></dt>
<dd><p>FNV-1a 64-bit prime (as <code>BigInt</code>); see <a href="fnv1a">fnv1a</a>.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#djb2">djb2(string, hash)</a> ⇒</dt>
<dd><p>Hashes a string with the classic DJB2 algorithm.</p>
<p>Uses 32-bit arithmetic (<code>hash &lt;&lt; 5 + hash</code> is <code>hash * 33</code>), finalizing to an
unsigned 32-bit integer so the result is always non-negative.</p>
</dd>
<dt><a href="#sdbm">sdbm(string, hash)</a> ⇒</dt>
<dd><p>Hashes a string with the SDBM algorithm.</p>
<p>Equivalent to <code>hash * 65599 + charCode</code> (65599 = 2^16 + 2^6 - 1), finalized
to an unsigned 32-bit integer.</p>
</dd>
<dt><a href="#fnv1a64">fnv1a64(string)</a> ⇒</dt>
<dd><p>FNV-1a-style string hash implemented with <code>BigInt</code>.</p>
<p>Note: unlike the canonical 64-bit FNV-1a algorithm, this implementation does
NOT wrap with a 2^64 mask, so results grow past 64 bits for longer inputs
(deterministic, positive bigint, unique-ish distribution — not a
wire-compatible FNV-1a).</p>
<p>Cost grows with the unmasked BigInt result, so large inputs are much slower
than the 32-bit hashes (measured at roughly 57 ops/sec for a 4 KiB input on
Node 24 vs ~24,000 ops/sec for <a href="#djb2">djb2</a>). Prefer <a href="#djb2">djb2</a> or
<a href="#sdbm">sdbm</a> for large cache keys.</p>
</dd>
</dl>

<a name="FNV_OFFSET"></a>

## FNV\_OFFSET
FNV-1a 64-bit offset basis (as `BigInt`); see [fnv1a](fnv1a).

**Kind**: global constant  

* * *

<a name="FNV_PRIME"></a>

## FNV\_PRIME
FNV-1a 64-bit prime (as `BigInt`); see [fnv1a](fnv1a).

**Kind**: global constant  

* * *

<a name="djb2"></a>

## djb2(string, hash) ⇒
Hashes a string with the classic DJB2 algorithm.

Uses 32-bit arithmetic (`hash << 5 + hash` is `hash * 33`), finalizing to an
unsigned 32-bit integer so the result is always non-negative.

**Kind**: global function  
**Returns**: The unsigned 32-bit DJB2 hash of the input so far.  

| Param | Description |
| --- | --- |
| string | The input to hash. |
| hash | Starting seed (defaults to the 5381 standard DJB2 seed). |


* * *

<a name="sdbm"></a>

## sdbm(string, hash) ⇒
Hashes a string with the SDBM algorithm.

Equivalent to `hash * 65599 + charCode` (65599 = 2^16 + 2^6 - 1), finalized
to an unsigned 32-bit integer.

**Kind**: global function  
**Returns**: The unsigned 32-bit SDBM hash of the input so far.  

| Param | Description |
| --- | --- |
| string | The input to hash. |
| hash | Starting seed (defaults to 0, the standard SDBM seed). |


* * *

<a name="fnv1a64"></a>

## fnv1a64(string) ⇒
FNV-1a-style string hash implemented with `BigInt`.

Note: unlike the canonical 64-bit FNV-1a algorithm, this implementation does
NOT wrap with a 2^64 mask, so results grow past 64 bits for longer inputs
(deterministic, positive bigint, unique-ish distribution — not a
wire-compatible FNV-1a).

Cost grows with the unmasked BigInt result, so large inputs are much slower
than the 32-bit hashes (measured at roughly 57 ops/sec for a 4 KiB input on
Node 24 vs ~24,000 ops/sec for [djb2](#djb2)). Prefer [djb2](#djb2) or
[sdbm](#sdbm) for large cache keys.

**Kind**: global function  
**Returns**: The hash as a positive `bigint` (unmasked; larger than 64 bits for
longer inputs).  

| Param | Description |
| --- | --- |
| string | The input to hash. |


* * *



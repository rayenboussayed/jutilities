# `jutilities/libs/sync-guard`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/libs/sync-guard.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/libs/sync-guard.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/libs/sync-guard.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/libs/sync-guard.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { assertSyncReturn, guardSyncFunction, isSyncReturnViolation } from "jutilities/libs/sync-guard";
```
## Functions

<dl>
<dt><a href="#assertSyncReturn">assertSyncReturn(value, fnName)</a></dt>
<dd><p>Throws a <a href="TypeError">TypeError</a> when a sync wrapper sees a promise-like or
generator value.</p>
</dd>
<dt><a href="#guardSyncFunction">guardSyncFunction(fn)</a> ⇒</dt>
<dd><p>Creates a call-time guard for a promised/generator-returning wrapped
function. The public wrapper retains the raw function&#39;s call shape while
rejecting non-synchronous results before any enhancer can observe them.</p>
<p>The guard copies the raw function&#39;s identity metadata so wrapped functions
still produce stable <code>toString</code>/<code>name</code>/<code>length</code> values for enhancers that
need them (cache-key generation, logging, and so on).</p>
</dd>
<dt><a href="#isSyncReturnViolation">isSyncReturnViolation(value)</a> ⇒</dt>
<dd><p>Checks if a returned value is a native-style promise or generator shape the
sync flavor must not leak to callers. Plain thenables without the Promise
tag are treated as ordinary sync values, matching the old compile-time gate.</p>
</dd>
</dl>

<a name="assertSyncReturn"></a>

## assertSyncReturn(value, fnName)
Throws a [TypeError](TypeError) when a sync wrapper sees a promise-like or
generator value.

**Kind**: global function  

| Param | Description |
| --- | --- |
| value | The value returned by the wrapped function. |
| fnName | Best-effort name for the wrapped function in the message. |


* * *

<a name="guardSyncFunction"></a>

## guardSyncFunction(fn) ⇒
Creates a call-time guard for a promised/generator-returning wrapped
function. The public wrapper retains the raw function's call shape while
rejecting non-synchronous results before any enhancer can observe them.

The guard copies the raw function's identity metadata so wrapped functions
still produce stable `toString`/`name`/`length` values for enhancers that
need them (cache-key generation, logging, and so on).

**Kind**: global function  
**Returns**: A thin wrapper with the same public signature.  

| Param | Description |
| --- | --- |
| fn | The wrapped function to guard. |


* * *

<a name="isSyncReturnViolation"></a>

## isSyncReturnViolation(value) ⇒
Checks if a returned value is a native-style promise or generator shape the
sync flavor must not leak to callers. Plain thenables without the Promise
tag are treated as ordinary sync values, matching the old compile-time gate.

**Kind**: global function  
**Returns**: `true` for Promise or generator/async-generator objects.  

| Param | Description |
| --- | --- |
| value | Result of a wrapped sync call. |


* * *



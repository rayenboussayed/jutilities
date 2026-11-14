# `jutilities/runtime`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/runtime.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/runtime.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/runtime.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/runtime.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { isServer, isClient, createConditionalFn, serverFn, clientFn } from "jutilities/runtime";
```
## Constants

<dl>
<dt><a href="#serverFn">serverFn</a></dt>
<dd><p>Returns <code>fn</code> on the server, otherwise <code>undefined</code>.</p>
</dd>
<dt><a href="#clientFn">clientFn</a></dt>
<dd><p>Returns <code>fn</code> in the browser, otherwise <code>undefined</code>.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#createConditionalFn">createConditionalFn(condition)</a> ⇒</dt>
<dd><p>Builds a conditional wrapper that returns <code>fn</code> only when <code>condition</code> holds.
Used to create no-op-safe <code>serverFn</code> / <code>clientFn</code> helpers.</p>
</dd>
</dl>

<a name="serverFn"></a>

## serverFn
Returns `fn` on the server, otherwise `undefined`.

**Kind**: global constant  

* * *

<a name="clientFn"></a>

## clientFn
Returns `fn` in the browser, otherwise `undefined`.

**Kind**: global constant  

* * *

<a name="createConditionalFn"></a>

## createConditionalFn(condition) ⇒
Builds a conditional wrapper that returns `fn` only when `condition` holds.
Used to create no-op-safe `serverFn` / `clientFn` helpers.

**Kind**: global function  
**Returns**: A wrapper mapping `fn` to itself or `undefined`.  

| Param | Description |
| --- | --- |
| condition | Static flag or thunk evaluated once per call. |


* * *



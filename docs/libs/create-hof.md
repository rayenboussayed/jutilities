# `jutilities/libs/create-hof`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/libs/create-hof.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/libs/create-hof.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/libs/create-hof.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/libs/create-hof.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { createHofAsync, createHofSync } from "jutilities/libs/create-hof";
import type { ApplyKind, FlavorOf, Hof, HofConstraint, HofFlavor, HofFn, HofKind, HofSlot, KindOf, WithSkipHof } from "jutilities/libs/create-hof";
```
## Functions

<dl>
<dt><a href="#createHofAsync">createHofAsync(handler)</a> ⇒</dt>
<dd><p>Builds an async fn-first HOF from a core handler. See
<a href="#createHofSync">createHofSync</a> for the shared bypass semantics; the only difference
is the per-call predicate, which may be async (its result is awaited
before deciding whether to bypass).</p>
</dd>
<dt><a href="#createHofSync">createHofSync(handler)</a> ⇒</dt>
<dd><p>Builds a sync-flavored fn-first HOF.</p>
</dd>
</dl>

<a name="createHofAsync"></a>

## createHofAsync(handler) ⇒
Builds an async fn-first HOF from a core handler. See
[createHofSync](#createHofSync) for the shared bypass semantics; the only difference
is the per-call predicate, which may be async (its result is awaited
before deciding whether to bypass).

**Kind**: global function  
**Returns**: The new fn-first HOF taking `(fn, options)`.  

| Param | Description |
| --- | --- |
| handler | The core handler building the enhanced wrapper; called exactly once per wrap. |


* * *

<a name="createHofSync"></a>

## createHofSync(handler) ⇒
Builds a sync-flavored fn-first HOF.

**Kind**: global function  
**Returns**: The new fn-first HOF.  

| Param | Description |
| --- | --- |
| handler | Core handler building the enhanced wrapper. |


* * *



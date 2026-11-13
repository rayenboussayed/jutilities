# `jutilities/libs/with`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/libs/with.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/libs/with.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/libs/with.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/libs/with.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { withAsync, withSync } from "jutilities/libs/with";
import type { ComposedKind, MergeOptions } from "jutilities/libs/with";
```
## Functions

<dl>
<dt><a href="#withAsync">withAsync(hofs)</a> ⇒</dt>
<dd><p>Composes async HOFs into one. The FIRST hof is the OUTERMOST layer:
<code>withAsync(a, b, c)(fn, o)</code> === <code>a(b(c(fn, o), o), o)</code>.
Options are one flat bag shared by all layers (each reads its own keys).
<code>skipHof</code> is handled once for the whole stack (inner layers never see it),
so a per-call predicate runs once per call, not once per layer.</p>
<p>The result carries the composed kind as a type-only brand, so a decorator
can convert a whole stack (see <code>jutilities/decorators/method</code>).</p>
</dd>
<dt><a href="#withSync">withSync(hofs)</a> ⇒</dt>
<dd><p>Sync counterpart of <a href="#withAsync">withAsync</a>: same ordering and <code>skipHof</code> rules,
and the same generic/type-preserving signature. Runtime guards reject
promise-like and generator values on every call instead of narrowing the
accepted function type at compile time.</p>
</dd>
</dl>

<a name="withAsync"></a>

## withAsync(hofs) ⇒
Composes async HOFs into one. The FIRST hof is the OUTERMOST layer:
`withAsync(a, b, c)(fn, o)` === `a(b(c(fn, o), o), o)`.
Options are one flat bag shared by all layers (each reads its own keys).
`skipHof` is handled once for the whole stack (inner layers never see it),
so a per-call predicate runs once per call, not once per layer.

The result carries the composed kind as a type-only brand, so a decorator
can convert a whole stack (see `jutilities/decorators/method`).

**Kind**: global function  
**Returns**: A fn-first wrapper applying the whole stack.  

| Param | Description |
| --- | --- |
| hofs | The HOFs to stack, outermost first. |


* * *

<a name="withSync"></a>

## withSync(hofs) ⇒
Sync counterpart of [withAsync](#withAsync): same ordering and `skipHof` rules,
and the same generic/type-preserving signature. Runtime guards reject
promise-like and generator values on every call instead of narrowing the
accepted function type at compile time.

**Kind**: global function  
**Returns**: A fn-first wrapper applying the whole stack.  

| Param | Description |
| --- | --- |
| hofs | The HOFs to stack, outermost first. |


* * *



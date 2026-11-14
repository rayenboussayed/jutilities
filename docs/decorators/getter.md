# `jutilities/decorators/getter`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/decorators/getter.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/getter.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/decorators/getter.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/getter.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { decorateGetter } from "jutilities/decorators/getter";
import type { GetterDecoratorOf } from "jutilities/decorators/getter";
```
<a name="decorateGetter"></a>

## decorateGetter(hof, options) ⇒
Converts a fn-first HOF into a reusable legacy getter decorator factory.
The getter's access function runs through the HOF once at class-definition
time; every subsequent access calls the wrapped getter with the instance as
`this`. The HOF's option bag (one object, resolved from the HOF's kind) is
forwarded verbatim.

A getter's signature is preserved; sync HOFs rely on runtime guarding (or
`require`) rather than rejecting at the type layer. An async HOF is still
type-compatible only when the getter's return type is promise-like; the
`require: "async"` guard can enforce this at decorate time.

**Kind**: global function  
**Returns**: A decorator factory whose options are forwarded to `hof`.  
**Report()**: get report() { return computeHeavyReport(this); }
}
```  

| Param | Description |
| --- | --- |
| hof | The fn-first HOF to convert. |
| options | Optional [DecoratorGuard](DecoratorGuard) for decorate-time sync/async discipline. |

**Example**  
```ts
// Hoist the factory so each decoration applies it exactly once.
const report = decorateGetter(lazy);

class Stats {
  

* * *



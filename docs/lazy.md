# `jutilities/lazy`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/lazy.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/lazy.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/lazy.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/lazy.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { lazy } from "jutilities/lazy";
```
<a name="lazy"></a>

## lazy(fn) ⇒
Memoizes a function's results keyed by a hash of its source and arguments.

The memoization store is process-lifetime and shared across every `lazy()`
wrapper of the same initializer — two wrappers built from the same source
text and called with the same arguments hit the same entry. Every distinct
(function source, arguments) pair is retained until the process exits, so
use it for stable, low-cardinality inputs.

**Kind**: global function  
**Returns**: The cached function.  

| Param | Description |
| --- | --- |
| fn | The initializer whose results should be cached. |


* * *



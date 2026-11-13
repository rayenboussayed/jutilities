# `jutilities/lazy`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/lazy.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/lazy.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/lazy.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/lazy.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { lazy } from "jutilities/lazy";
import type { LazyKind, LazyOptions } from "jutilities/lazy";
```
<a name="lazy"></a>

## lazy ⇒
Memoizes a function's results keyed by a hash of its source and arguments.

**Kind**: global constant  
**Returns**: The cached function.  

| Param | Description |
| --- | --- |
| fn | The initializer whose results should be cached. |
| options | Options object. |
| options.skipHof | Per-call bypass switch. |


* * *



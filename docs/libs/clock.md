# `jutilities/libs/clock`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/libs/clock.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/libs/clock.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/libs/clock.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/libs/clock.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { now } from "jutilities/libs/clock";
```
<a name="now"></a>

## now() ⇒
The clock the timing-sensitive wrappers measure with.

Behavior notes:
- Outside a browser (Node and every other server runtime) the monotonic,
  sub-millisecond `performance.now()` is used.
- Where a global `window` exists (the browser branch) the clock falls back
  to `Date.now()`.

The rule lives here so the wrappers that measure durations — the logger and
the retry loop — share one definition instead of repeating the branch.

**Kind**: global function  
**Returns**: The current timestamp in milliseconds.  

* * *



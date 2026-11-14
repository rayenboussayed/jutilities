# `jutilities/web/stream/size`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/web/stream/size.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/web/stream/size.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/web/stream/size.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/web/stream/size.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { streamSize, streamSizeTransform } from "jutilities/web/stream/size";
```
## Functions

<dl>
<dt><a href="#streamSize">streamSize(root0)</a></dt>
<dd><p>Async generator that passes chunks through while reporting cumulative size.</p>
</dd>
<dt><a href="#streamSizeTransform">streamSizeTransform(root0)</a> ⇒</dt>
<dd><p>Creates a <code>TransformStream</code> that reports cumulative byte size.</p>
</dd>
</dl>

<a name="streamSize"></a>

## streamSize(root0)
Async generator that passes chunks through while reporting cumulative size.

**Kind**: global function  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.onSize | Callback receiving the `(size, done)` record per chunk and at the end. |
| root0.signal | Optional per-chunk abort check. |
| root0.stream | The source stream to read through. |


* * *

<a name="streamSizeTransform"></a>

## streamSizeTransform(root0) ⇒
Creates a `TransformStream` that reports cumulative byte size.

**Kind**: global function  
**Returns**: A `TransformStream`.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.onSize | Callback receiving the `(size, done)` record per chunk and at flush. |
| root0.signal | Optional signal checked per chunk. |


* * *



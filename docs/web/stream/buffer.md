# `jutilities/web/stream/buffer`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/web/stream/buffer.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/web/stream/buffer.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/web/stream/buffer.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/web/stream/buffer.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { buffer2stream, stream2buffer } from "jutilities/web/stream/buffer";
```
## Functions

<dl>
<dt><a href="#buffer2stream">buffer2stream(root0)</a> ⇒</dt>
<dd><p>Converts bytes into a <code>ReadableStream</code> of chunked views.</p>
<p>Chunks are zero-copy <code>subarray</code> slices of <code>chunkSize</code> bytes (default
16 KiB). An empty input produces an immediately-closing stream.</p>
</dd>
<dt><a href="#stream2buffer">stream2buffer(root0)</a> ⇒</dt>
<dd><p>Consumes a <code>ReadableStream</code> into one <code>Uint8Array</code>.</p>
<p>The signal is checked up-front and on every chunk.</p>
</dd>
</dl>

<a name="buffer2stream"></a>

## buffer2stream(root0) ⇒
Converts bytes into a `ReadableStream` of chunked views.

Chunks are zero-copy `subarray` slices of `chunkSize` bytes (default
16 KiB). An empty input produces an immediately-closing stream.

**Kind**: global function  
**Returns**: A `ReadableStream` yielding the bytes in order.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.buffer | The bytes to emit. |
| root0.chunkSize | Maximum bytes per emitted chunk (default `16384`). |
| root0.signal | Optional abort signal checked per chunk. |


* * *

<a name="stream2buffer"></a>

## stream2buffer(root0) ⇒
Consumes a `ReadableStream` into one `Uint8Array`.

The signal is checked up-front and on every chunk.

**Kind**: global function  
**Returns**: The concatenated contents as a single `Uint8Array`.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.signal | Optional abort signal. |
| root0.stream | Stream to consume fully. |


* * *



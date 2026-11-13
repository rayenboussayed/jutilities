# `jutilities/node/stream/buffer`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/node/stream/buffer.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/stream/buffer.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/node/stream/buffer.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/stream/buffer.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { buffer2stream, stream2buffer } from "jutilities/node/stream/buffer";
```
## Functions

<dl>
<dt><a href="#buffer2stream">buffer2stream(root0)</a> ⇒</dt>
<dd><p>Converts a <code>Buffer</code> into a readable stream of chunked views.</p>
<p>Chunks are zero-copy <code>buffer.subarray</code> slices of <code>chunkSize</code> bytes (default
16 KiB), so writing to a chunk mutates the source buffer. An empty buffer
produces an immediately-ending stream. Throws synchronously when the signal
is already aborted; aborting mid-read propagates via the Readable&#39;s
internal <code>signal</code> option.</p>
</dd>
<dt><a href="#stream2buffer">stream2buffer(root0)</a> ⇒</dt>
<dd><p>Consumes a readable stream into one <code>Buffer</code>.</p>
<p>Non-Buffer chunks (strings, Uint8Array) are converted per-chunk. The signal
is checked up-front and on every chunk, so aborting mid-stream rejects the
returned promise with <code>signal.reason</code>.</p>
</dd>
</dl>

<a name="buffer2stream"></a>

## buffer2stream(root0) ⇒
Converts a `Buffer` into a readable stream of chunked views.

Chunks are zero-copy `buffer.subarray` slices of `chunkSize` bytes (default
16 KiB), so writing to a chunk mutates the source buffer. An empty buffer
produces an immediately-ending stream. Throws synchronously when the signal
is already aborted; aborting mid-read propagates via the Readable's
internal `signal` option.

**Kind**: global function  
**Returns**: A `Readable` yielding the buffer's bytes in order.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.buffer | The bytes to emit. |
| root0.chunkSize | Maximum bytes per emitted chunk (default `16384`). |
| root0.signal | Optional signal wired into the returned Readable. |


* * *

<a name="buffer2stream..gen"></a>

### buffer2stream~gen()
Async generator emitting successive `subarray` views of the buffer.

**Kind**: inner method of [<code>buffer2stream</code>](#buffer2stream)  

* * *

<a name="stream2buffer"></a>

## stream2buffer(root0) ⇒
Consumes a readable stream into one `Buffer`.

Non-Buffer chunks (strings, Uint8Array) are converted per-chunk. The signal
is checked up-front and on every chunk, so aborting mid-stream rejects the
returned promise with `signal.reason`.

**Kind**: global function  
**Returns**: The concatenated contents as a single `Buffer` (empty input yields
an empty Buffer).  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.signal | Optional abort signal. |
| root0.stream | Stream to consume fully. |


* * *



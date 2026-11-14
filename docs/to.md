# `jutilities/to`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/to.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/to.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/to.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/to.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { toArray, toBase64, toBuffer, toSeconds, toUint8Array } from "jutilities/to";
```
## Functions

<dl>
<dt><a href="#toArray">toArray(value)</a> ⇒</dt>
<dd><p>Normalizes a value into an array without copying existing arrays.</p>
<p>Note: arrays and array subclasses are returned by reference (no flattening);
everything else is wrapped in a fresh single-element array, including
<code>null</code>/<code>undefined</code> and falsy values.</p>
</dd>
<dt><a href="#toBase64">toBase64(bytes)</a> ⇒</dt>
<dd><p>Encodes bytes to a base64 string, in Node and browsers.</p>
<p>Node uses <code>Buffer.toString(&quot;base64&quot;)</code>; browsers build the binary string
manually and pass it to <code>btoa</code>. Only the viewed slice is encoded when the
input is a view with <code>byteOffset</code>/<code>byteLength</code> (e.g. a <code>subarray</code>).</p>
</dd>
<dt><a href="#toBuffer">toBuffer(chunk)</a> ⇒</dt>
<dd><p>Wraps a chunk into a <code>Buffer</code>.</p>
</dd>
<dt><a href="#toSeconds">toSeconds(ms)</a> ⇒</dt>
<dd><p>Converts milliseconds to whole seconds.</p>
</dd>
<dt><a href="#toUint8Array">toUint8Array(value)</a> ⇒</dt>
<dd><p>Normalizes a string, ArrayBuffer, typed array (including <code>Buffer</code> and
<code>DataView</code>), or number array into a fresh <code>Uint8Array</code> over the viewed
region (honoring <code>byteOffset</code>/<code>byteLength</code> for views).</p>
</dd>
</dl>

<a name="toArray"></a>

## toArray(value) ⇒
Normalizes a value into an array without copying existing arrays.

Note: arrays and array subclasses are returned by reference (no flattening);
everything else is wrapped in a fresh single-element array, including
`null`/`undefined` and falsy values.

**Kind**: global function  
**Returns**: The original array (same reference), or `[value]`.  

| Param | Description |
| --- | --- |
| value | An array, an array subclass, or a scalar (any other value). |


* * *

<a name="toBase64"></a>

## toBase64(bytes) ⇒
Encodes bytes to a base64 string, in Node and browsers.

Node uses `Buffer.toString("base64")`; browsers build the binary string
manually and pass it to `btoa`. Only the viewed slice is encoded when the
input is a view with `byteOffset`/`byteLength` (e.g. a `subarray`).

**Kind**: global function  
**Returns**: The base64 representation (`""` for empty input).  

| Param | Description |
| --- | --- |
| bytes | The bytes to encode; only the viewed region is used. |


* * *

<a name="toBuffer"></a>

## toBuffer(chunk) ⇒
Wraps a chunk into a `Buffer`.

**Kind**: global function  
**Returns**: A `Buffer`.  

| Param | Description |
| --- | --- |
| chunk | The chunk to convert. |


* * *

<a name="toSeconds"></a>

## toSeconds(ms) ⇒
Converts milliseconds to whole seconds.

**Kind**: global function  
**Returns**: Seconds.  

| Param | Description |
| --- | --- |
| ms | Milliseconds to round. |


* * *

<a name="toUint8Array"></a>

## toUint8Array(value) ⇒
Normalizes a string, ArrayBuffer, typed array (including `Buffer` and
`DataView`), or number array into a fresh `Uint8Array` over the viewed
region (honoring `byteOffset`/`byteLength` for views).

**Kind**: global function  
**Returns**: The byte representation.  

| Param | Description |
| --- | --- |
| value | The value to convert. |


* * *



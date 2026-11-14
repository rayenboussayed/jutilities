# `jutilities/from`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/from.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/from.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/from.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/from.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { fromBase64 } from "jutilities/from";
```
<a name="fromBase64"></a>

## fromBase64(b64) ⇒
Decodes a base64 string into bytes.

Returns a `Buffer` view in Node (lenient: invalid characters are skipped by
`Buffer.from(..., "base64")`; the pooled view may share/back-offset its
backing store so only the decoded slice is valid). In browsers it is strict:
invalid input throws from `atob`.

**Kind**: global function  
**Returns**: A `Buffer` in Node, or a fresh `Uint8Array` in browsers.  

| Param | Description |
| --- | --- |
| b64 | The base64 string to decode. |


* * *



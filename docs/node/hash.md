# `jutilities/node/hash`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/node/hash.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/hash.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/node/hash.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/hash.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { Hash, md5, sha1, sha224, sha256, sha384, sha512, sha512_224, sha512_256, sha3_224, sha3_256, sha3_384, sha3_512, blake2b512, blake2s256, ripemd160, sm3, shake128, shake256 } from "jutilities/node/hash";
```
<a name="Hash"></a>

## Hash
Named digest (`sha512`, …) over streams or buffers, optionally HMAC.

**Kind**: global class  

* [Hash](#Hash)
    * [.name](#Hash+name) ⇒
    * [.buffer(options)](#Hash+buffer) ⇒
    * [.stream(options)](#Hash+stream) ⇒


* * *

<a name="Hash+name"></a>

### hash.name ⇒
The algorithm name passed to `node:crypto`.

**Kind**: instance property of [<code>Hash</code>](#Hash)  
**Returns**: The underlying algorithm identifier.  

* * *

<a name="Hash+buffer"></a>

### hash.buffer(options) ⇒
The digest implementation for buffers.

**Kind**: instance method of [<code>Hash</code>](#Hash)  
**Returns**: The digest.  

| Param | Description |
| --- | --- |
| options | Data to digest, with HMAC key; plain hash when omitted. |


* * *

<a name="Hash+stream"></a>

### hash.stream(options) ⇒
Digests a stream. Rejects on stream error.

**Kind**: instance method of [<code>Hash</code>](#Hash)  
**Returns**: The digest.  

| Param | Description |
| --- | --- |
| options | Data source, with HMAC key; plain hash when omitted. |
| options.stream | The source stream. |
| options.secret | Optional HMAC key. |
| options.options | Hash/HMAC options. |
| options.signal | Optional abort signal. |


* * *



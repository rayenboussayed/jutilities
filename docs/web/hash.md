# `jutilities/web/hash`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/web/hash.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/web/hash.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/web/hash.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/web/hash.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { Hash, sha1, sha256, sha384, sha512 } from "jutilities/web/hash";
```
<a name="Hash"></a>

## Hash
Named digest over buffers/strings (and streams), optionally HMAC.

**Kind**: global class  

* [Hash](#Hash)
    * [.importHmacKey](#Hash+importHmacKey) ⇒
    * [.buffer](#Hash+buffer) ⇒
    * [.name](#Hash+name) ⇒
    * [.stream(options)](#Hash+stream) ⇒


* * *

<a name="Hash+importHmacKey"></a>

### hash.importHmacKey ⇒
The cached HMAC key importer.

**Kind**: instance property of [<code>Hash</code>](#Hash)  
**Returns**: The imported CryptoKey.  

| Param | Description |
| --- | --- |
| keyData | The raw HMAC key bytes. |


* * *

<a name="Hash+buffer"></a>

### hash.buffer ⇒
The cached digest implementation for [buffer](buffer).

**Kind**: instance property of [<code>Hash</code>](#Hash)  
**Returns**: The digest bytes.  

| Param | Description |
| --- | --- |
| options | Data to digest, with optional HMAC key. |


* * *

<a name="Hash+name"></a>

### hash.name ⇒
The algorithm name passed to `crypto.subtle`.

**Kind**: instance property of [<code>Hash</code>](#Hash)  
**Returns**: The underlying algorithm identifier.  

* * *

<a name="Hash+stream"></a>

### hash.stream(options) ⇒
Digests a `ReadableStream`, accumulating chunks then hashing.

**Kind**: instance method of [<code>Hash</code>](#Hash)  
**Returns**: The digest bytes.  

| Param | Description |
| --- | --- |
| options | Data source, with optional HMAC key and signal. |
| options.stream | The stream to consume. |
| options.secret | Optional HMAC key. |
| options.signal | Optional abort signal. |


* * *



# `jutilities/node/fs/json`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/node/fs/json.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/fs/json.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/node/fs/json.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/fs/json.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { readJsonFile, writeJsonFile } from "jutilities/node/fs/json";
```
## Functions

<dl>
<dt><a href="#readJsonFile">readJsonFile(root0)</a> ⇒</dt>
<dd><p>Reads and parses a JSON file.</p>
<p>Read and parse failures are thrown. Each call reads and parses the file, so
callers receive independent values and custom <code>parse</code> functions keep
working.</p>
</dd>
<dt><a href="#writeJsonFile">writeJsonFile(root0)</a> ⇒</dt>
<dd><p>Serializes a value as JSON and writes it to disk.</p>
<p>The parent directory must already exist. Throws when the value is not
JSON-serializable (for example <code>undefined</code>, a function, or a symbol) or when
the write itself fails.</p>
</dd>
</dl>

<a name="readJsonFile"></a>

## readJsonFile(root0) ⇒
Reads and parses a JSON file.

Read and parse failures are thrown. Each call reads and parses the file, so
callers receive independent values and custom `parse` functions keep
working.

**Kind**: global function  
**Returns**: The parsed value.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.filePath | Path to the JSON file. |
| root0.parse | parse applied to the file text (default `JSON.parse`). |


* * *

<a name="writeJsonFile"></a>

## writeJsonFile(root0) ⇒
Serializes a value as JSON and writes it to disk.

The parent directory must already exist. Throws when the value is not
JSON-serializable (for example `undefined`, a function, or a symbol) or when
the write itself fails.

**Kind**: global function  
**Returns**: Resolves once the file is written.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.filePath | Destination path. |
| root0.value | Value to serialize. |
| root0.stringify | Serializer applied to the value (default `JSON.stringify`). |


* * *



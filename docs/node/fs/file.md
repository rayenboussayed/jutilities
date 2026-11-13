# `jutilities/node/fs/file`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/node/fs/file.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/fs/file.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/node/fs/file.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/fs/file.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { removeFiles } from "jutilities/node/fs/file";
```
<a name="removeFiles"></a>

## removeFiles(root0) ⇒
Removes files concurrently, ignoring missing paths.

Missing paths are ignored via `force`; every other removal failure rejects.

**Kind**: global function  
**Returns**: Resolves after every file is removed.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.filePaths | Paths to remove. |


* * *



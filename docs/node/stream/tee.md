# `jutilities/node/stream/tee`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/node/stream/tee.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/stream/tee.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/node/stream/tee.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/node/stream/tee.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { tee } from "jutilities/node/stream/tee";
```
<a name="tee"></a>

## tee(root0) ⇒
Duplicates a readable stream into two backpressure-aware branches.

The source is paused as soon as either branch is full and resumed only when
neither needs to drain, in both orders. Source `end` ends both branches,
`close` (e.g. a source destroyed without `end`/`error`) ends both branches
the same way, and source `error` destroys both. Closing one branch
(destroying it) does not affect the other.

Throws synchronously when the signal is already aborted.

**Kind**: global function  
**Returns**: Exactly two `PassThrough` branches, each receiving every chunk.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.stream | The readable stream to duplicate. |
| root0.signal | Optional signal: pre-aborted throws immediately; aborting mid-flight destroys both branches via the internal `PassThrough`. |


* [tee(root0)](#tee) ⇒
    * [~cleanup()](#tee..cleanup)
    * [~onData(chunk)](#tee..onData)
    * [~onEnd()](#tee..onEnd)
    * [~onError(error)](#tee..onError)


* * *

<a name="tee..cleanup"></a>

### tee~cleanup()
Detaches every source listener so the source no longer retains the branches.

**Kind**: inner method of [<code>tee</code>](#tee)  

* * *

<a name="tee..onData"></a>

### tee~onData(chunk)
Writes one chunk to both branches, pausing the source on backpressure.

**Kind**: inner method of [<code>tee</code>](#tee)  

| Param | Description |
| --- | --- |
| chunk | Chunk emitted by the source. |


* * *

<a name="tee..onEnd"></a>

### tee~onEnd()
Ends the branches that are still open and detaches the source listeners.

**Kind**: inner method of [<code>tee</code>](#tee)  

* * *

<a name="tee..onError"></a>

### tee~onError(error)
Destroys the branches that are still open and detaches the source listeners.

**Kind**: inner method of [<code>tee</code>](#tee)  

| Param | Description |
| --- | --- |
| error | Error emitted by the source. |


* * *



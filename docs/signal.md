# `jutilities/signal`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/signal.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/signal.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/signal.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/signal.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { abort } from "jutilities/signal";
```
<a name="abort"></a>

## abort(root0) ⇒
Registers `onAbort` to run when the signal aborts.

Behavior notes:
- No-op when `signal` is absent: the remover is still a safe callable.
- Adding the listener to an already-aborted signal does NOT fire it
  retroactively (same semantics as `EventTarget`).

**Kind**: global function  
**Returns**: A remover that detaches the listener (also safe without a
signal).  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.signal | The signal to observe (may be `undefined`). |
| root0.onAbort | Callback invoked when the signal aborts (and only then). |


* * *



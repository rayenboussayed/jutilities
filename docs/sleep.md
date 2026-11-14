# `jutilities/sleep`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/sleep.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/sleep.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/sleep.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/sleep.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { sleepAsync, sleepSync } from "jutilities/sleep";
import type { Options } from "jutilities/sleep";
```
## Functions

<dl>
<dt><a href="#sleepAsync">sleepAsync(root0)</a> ⇒</dt>
<dd><p>Waits asynchronously for <code>sleep</code> milliseconds.</p>
<p>Behavior notes:</p>
<ul>
<li><code>sleep &lt;= 0</code> (and <code>undefined</code>/<code>NaN</code>) resolves immediately.</li>
<li>Throws synchronously when the signal is already aborted.</li>
<li>Aborting mid-sleep cuts the wait short and rejects with <code>signal.reason</code>.</li>
<li>Aborting clears the pending timer and removes the abort listener.</li>
</ul>
</dd>
<dt><a href="#sleepSync">sleepSync(root0)</a></dt>
<dd><p>Waits synchronously by busy-waiting the event loop.</p>
<p>Behavior notes:</p>
<ul>
<li>Blocks the thread: timers and signals CANNOT fire during the wait, so an
abort is only detected when the signal was already aborted before the
call (throws synchronously, like <code>sleepAsync</code>).</li>
<li><code>sleep &lt;= 0</code> (and <code>undefined</code>/<code>NaN</code>) returns immediately.</li>
<li>Prefer <code>sleepAsync</code> unless a truly synchronous pause is required.</li>
</ul>
</dd>
</dl>

<a name="sleepAsync"></a>

## sleepAsync(root0) ⇒
Waits asynchronously for `sleep` milliseconds.

Behavior notes:
- `sleep <= 0` (and `undefined`/`NaN`) resolves immediately.
- Throws synchronously when the signal is already aborted.
- Aborting mid-sleep cuts the wait short and rejects with `signal.reason`.
- Aborting clears the pending timer and removes the abort listener.

**Kind**: global function  
**Returns**: A promise resolving to `undefined` once the wait completes; rejects
with `signal.reason` if the signal aborts during the wait.  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.signal | Optional abort signal to cancel the wait early. |
| root0.sleep | Milliseconds to wait (default `0`). |


* * *

<a name="sleepSync"></a>

## sleepSync(root0)
Waits synchronously by busy-waiting the event loop.

Behavior notes:
- Blocks the thread: timers and signals CANNOT fire during the wait, so an
  abort is only detected when the signal was already aborted before the
  call (throws synchronously, like `sleepAsync`).
- `sleep <= 0` (and `undefined`/`NaN`) returns immediately.
- Prefer `sleepAsync` unless a truly synchronous pause is required.

**Kind**: global function  

| Param | Description |
| --- | --- |
| root0 | Options object. |
| root0.signal | Optional abort signal (checked up-front and on each busy-wait iteration). |
| root0.sleep | Milliseconds to block (default `0`). |


* * *



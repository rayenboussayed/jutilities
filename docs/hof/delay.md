# `jutilities/hof/delay`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/hof/delay.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hof/delay.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/hof/delay.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hof/delay.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { withDelayAsync, withDelaySync } from "jutilities/hof/delay";
import type { DelayKind, Options } from "jutilities/hof/delay";
```
## Constants

<dl>
<dt><a href="#withDelayAsync">withDelayAsync</a> ⇒</dt>
<dd><p>Wraps an async function so every invocation waits <code>delay</code> milliseconds first.</p>
<p>Behavior notes:</p>
<ul>
<li><code>delay &lt;= 0</code> (and <code>undefined</code>/<code>NaN</code>) returns the original function itself.</li>
<li>The wrapper itself is not <code>async</code> — the factory returns synchronously
(<code>withDelayAsync(fn)</code> is <code>fn</code> when there is nothing to do).</li>
<li>Aborting mid-delay cuts the wait short and the wrapped call rejects with
<code>signal.reason</code> — the wrapped function never runs mid-wait.</li>
</ul>
</dd>
<dt><a href="#withDelaySync">withDelaySync</a> ⇒</dt>
<dd><p>Wraps a sync function so every invocation busy-blocks <code>delay</code> milliseconds
first (see <a href="sleepSync">sleepSync</a> for the blocking caveats).</p>
<p>Behavior notes:</p>
<ul>
<li><code>delay &lt;= 0</code> (and <code>undefined</code>/<code>NaN</code>) returns the original function itself.</li>
<li>The event loop is blocked during the pre-call wait.</li>
</ul>
</dd>
</dl>

<a name="withDelayAsync"></a>

## withDelayAsync ⇒
Wraps an async function so every invocation waits `delay` milliseconds first.

Behavior notes:
- `delay <= 0` (and `undefined`/`NaN`) returns the original function itself.
- The wrapper itself is not `async` — the factory returns synchronously
  (`withDelayAsync(fn)` is `fn` when there is nothing to do).
- Aborting mid-delay cuts the wait short and the wrapped call rejects with
  `signal.reason` — the wrapped function never runs mid-wait.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`), or `fn` itself when there is
nothing to delay.  

| Param | Description |
| --- | --- |
| fn | The async function to wrap. |
| options | Options object. |
| options.signal | Optional abort signal for the pre-call wait. |
| options.delay | Milliseconds to wait before each call (default `0`). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (no wait). Defaults to enabled. |


* * *

<a name="withDelaySync"></a>

## withDelaySync ⇒
Wraps a sync function so every invocation busy-blocks `delay` milliseconds
first (see [sleepSync](sleepSync) for the blocking caveats).

Behavior notes:
- `delay <= 0` (and `undefined`/`NaN`) returns the original function itself.
- The event loop is blocked during the pre-call wait.

**Kind**: global constant  
**Returns**: The wrapped function, or `fn` itself when there is nothing to
delay.  

| Param | Description |
| --- | --- |
| fn | The sync function to wrap. |
| options | Options object. |
| options.signal | Optional abort signal for the pre-call wait. |
| options.delay | Milliseconds to block before each call (default `0`). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (no wait). Defaults to enabled. |


* * *



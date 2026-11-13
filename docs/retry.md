# `jutilities/retry`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/retry.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/retry.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/retry.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/retry.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { defaultOnError, withRetryAsync, withRetrySync } from "jutilities/retry";
import type { OnErrorFn, Options, RetryKind } from "jutilities/retry";
```
## Constants

<dl>
<dt><a href="#defaultOnError">defaultOnError</a></dt>
<dd><p>The default <code>onError</code> policy: exponential back-off (2^retries × the last
attempt&#39;s duration) with jitter, bounded by a 60s budget; rethrows past
10 retries or once the budget is exhausted.</p>
</dd>
<dt><a href="#withRetryAsync">withRetryAsync</a> ⇒</dt>
<dd><p>Wraps an async function in a policy-driven retry loop.</p>
<p>The default policy (see above) gives up after 10 retries (11 attempts; the
policy throws at <code>retries === 10</code>) or once the retry tour has taken
<code>&gt;= 60_000</code> ms cumulative. It also backs off: between attempts it sleeps an
exponential, jittered <code>2^retries * lastAttemptDuration</code> wait, capped by the
remaining time budget. Pass <code>options.onError</code> to own the whole policy
instead.</p>
</dd>
<dt><a href="#withRetrySync">withRetrySync</a> ⇒</dt>
<dd><p>Wraps a sync function in a policy-driven retry loop (busy, no awaits).</p>
<p>Behavior notes:</p>
<ul>
<li>Every call argument is forwarded verbatim to <code>fn</code> and reported to
<code>options.onError</code> via <code>parameters</code> (see <a href="OnErrorFn">OnErrorFn</a>).</li>
<li><code>this</code> is forwarded to every attempt.</li>
</ul>
</dd>
</dl>

<a name="defaultOnError"></a>

## defaultOnError
The default `onError` policy: exponential back-off (2^retries × the last
attempt's duration) with jitter, bounded by a 60s budget; rethrows past
10 retries or once the budget is exhausted.

**Kind**: global constant  

| Param | Description |
| --- | --- |
| root0 | The retry bookkeeping provided by the wrapper. |
| root0.totalRetryExecution | Milliseconds spent retrying so far. |
| root0.startFnExecution | When the last attempt started. |
| root0.endFnExecution | When the last attempt ended. |
| root0.error | The last attempt's error. |
| root0.retries | How many retries have run so far. |


* * *

<a name="withRetryAsync"></a>

## withRetryAsync ⇒
Wraps an async function in a policy-driven retry loop.

The default policy (see above) gives up after 10 retries (11 attempts; the
policy throws at `retries === 10`) or once the retry tour has taken
`>= 60_000` ms cumulative. It also backs off: between attempts it sleeps an
exponential, jittered `2^retries * lastAttemptDuration` wait, capped by the
remaining time budget. Pass `options.onError` to own the whole policy
instead.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`) that runs until it succeeds or
the policy throws.  

| Param | Description |
| --- | --- |
| fn | The async function to wrap with retries. |
| options | Options object. |
| options.onError | Retry policy callback invoked after each failure; return to retry, throw to stop (defaults to the 10-retry / 60s policy with built-in exponential jittered backoff; may be async). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (failures propagate without retrying). Defaults to enabled. |


* * *

<a name="withRetrySync"></a>

## withRetrySync ⇒
Wraps a sync function in a policy-driven retry loop (busy, no awaits).

Behavior notes:
- Every call argument is forwarded verbatim to `fn` and reported to
  `options.onError` via `parameters` (see [OnErrorFn](OnErrorFn)).
- `this` is forwarded to every attempt.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`) that runs until it succeeds or
the policy throws.  

| Param | Description |
| --- | --- |
| fn | The sync function to wrap with retries. |
| options | Options object. |
| options.onError | Sync retry policy callback; return to retry, throw to stop (defaults to the 10-retry / 60s policy with built-in exponential jittered backoff). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (failures propagate without retrying). Defaults to enabled. |


* * *



# `jutilities/hof/logger`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/hof/logger.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hof/logger.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/hof/logger.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hof/logger.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { withLoggerSync, withLoggerAsync } from "jutilities/hof/logger";
import type { LoggerKind, Options } from "jutilities/hof/logger";
```
## Constants

<dl>
<dt><a href="#withLoggerSync">withLoggerSync</a> ⇒</dt>
<dd><p>Logs the invocation arguments and completion (value + duration) of a
wrapped SYNC function.</p>
<p>The wrapper accepts the full callable signature and preserves it for
callers; like the other sync HOFs it rejects promise/generator results at
call time rather than narrowing the accepted function type at compile time.</p>
</dd>
<dt><a href="#withLoggerAsync">withLoggerAsync</a> ⇒</dt>
<dd><p>Logs the invocation arguments and completion (awaited value + duration) of
a wrapped ASYNC function.</p>
<p>The first parameter is <code>AnyAsyncFunction</code>, so the wrapper feeds the direct
slot of the decorator converters exactly like
<a href="./cache.ts"> withCacheAsync</a> does.</p>
</dd>
</dl>

<a name="withLoggerSync"></a>

## withLoggerSync ⇒
Logs the invocation arguments and completion (value + duration) of a
wrapped SYNC function.

The wrapper accepts the full callable signature and preserves it for
callers; like the other sync HOFs it rejects promise/generator results at
call time rather than narrowing the accepted function type at compile time.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`) with logging around each call.  

| Param | Description |
| --- | --- |
| fn | The sync function being wrapped. |
| options | Options object. |
| options.name | Explicit label for logs; defaults to `fn.name`, or `anonymous` when that is empty. |
| options.logger | Debug/error output sink; defaults to `console` (inject a capturing mock to swap or verify output). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (no log lines). Defaults to enabled. |


* * *

<a name="withLoggerAsync"></a>

## withLoggerAsync ⇒
Logs the invocation arguments and completion (awaited value + duration) of
a wrapped ASYNC function.

The first parameter is `AnyAsyncFunction`, so the wrapper feeds the direct
slot of the decorator converters exactly like
[ withCacheAsync](./cache.ts) does.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`) with logging around each await.  

| Param | Description |
| --- | --- |
| fn | The async function being wrapped. |
| options | Options object. |
| options.name | Explicit label for logs; defaults to `fn.name`, or `anonymous` when that is empty. |
| options.logger | Debug/error output sink; defaults to `console` (inject a capturing mock to swap or verify output). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (no log lines). Defaults to enabled. |


* * *



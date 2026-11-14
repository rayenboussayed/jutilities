# `jutilities/hof/timeout`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/hof/timeout.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hof/timeout.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/hof/timeout.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hof/timeout.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { withTimeoutAsync } from "jutilities/hof/timeout";
import type { Options, TimeoutKind } from "jutilities/hof/timeout";
```
<a name="withTimeoutAsync"></a>

## withTimeoutAsync ⇒
Wraps an async function so each invocation races against `timeoutMs` and/or
an abort signal.

Behavior notes:
- Without a signal and with `timeoutMs <= 0`, the original function is
  returned unchanged.
- The rejection value is always `signal?.reason` — this applies to the
  wall-clock timeout too when a signal is present (an `AbortError` by
  default, or whatever reason was used to abort).
- Losing the race does not stop the underlying work; the caller's promise
  simply rejects first.
- A sync-throwing wrapped function propagates synchronously after the timer
  and abort listener are cleaned up.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`), or `fn` itself when neither a
signal nor a timeout is configured.  

| Param | Description |
| --- | --- |
| fn | The async function to wrap. |
| options | Options object. |
| options.signal | Optional abort signal to reject early on abort. |
| options.timeoutMs | Wall-clock budget in milliseconds (default `0`, meaning "no wall-clock timeout"). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (no deadline). Defaults to enabled. |


* * *



# jutilities

Small, typed, heavily documented TypeScript utilities for Node.js — caching, retries, timeouts, delays, abort-aware sleeps, one-shot signal listeners, Node stream helpers, a super-JSON serializer, non-cryptographic hashes, and type guards.

Everything is an independent module with a locked, test-verified behavior contract (289 tests). Every non-obvious quirk is documented at the call site.

> **Status:** early — APIs are stable in practice but not yet frozen with semver guarantees. Requires **Node ≥ 22** (uses `Buffer` pool semantics, `Symbol.for` round-trips, shared timers).

## Install

```bash
npm install jutilities
```

ESM only. The package ships compiled `dist/` output — no barrel, no `main`.

**Published contents** (guarded by `files` in `package.json` + `.npmignore`):
`dist/` (compiled modules + types with source maps), `docs/DOCUMENTATION.md`,
`examples/` (runnable demos), `README.md`, `package.json`. Sources (`src/`),
tests, and all dev tooling stay in the repository only.

### Deep imports (the only supported style)

jutilities intentionally exposes **no index barrel**: every module is imported by its full path, so bundlers and runtimes only pull the code you use.

```ts
// TypeScript
import { withCacheAsync } from "jutilities/dist/cache.js";
import { sleepAsync } from "jutilities/dist/sleep.js";
```

```js
// JavaScript
import { withRetryAsync } from "jutilities/dist/retry.js";
import { superjson } from "jutilities/dist/json.js";
```

## Modules

| Deep import | Exports | One-line summary |
| --- | --- | --- |
| `jutilities/dist/cache.js` | `withCacheSync`, `withCacheAsync` | Memoize with a pluggable (TTL-aware default) store |
| `jutilities/dist/retry.js` | `withRetryAsync`, `withRetrySync` | Policy-driven retries (`onError` decides) |
| `jutilities/dist/timeout.js` | `withTimeoutAsync` | Race an async call against a deadline / signal |
| `jutilities/dist/delay.js` | `withDelayAsync`, `withDelaySync` | Sleep before each invocation |
| `jutilities/dist/sleep.js` | `sleepAsync`, `sleepSync` | Promisified (and blocking) waits, abort-aware |
| `jutilities/dist/signal.js` | `abort` | Flatten `AbortSignal` add/remove into two callables |
| `jutilities/dist/lazy.js` | `lazy` | Memoize by (source + args) hash, retry failures |
| `jutilities/dist/logger.js` | `withLogger` | Log invocation args + awaited result + duration |
| `jutilities/dist/json.js` | `Json`, `superjson` | Round-trip Map/Set/Date/bigint/typed arrays/Errors… |
| `jutilities/dist/node-stream.js` | `tee`, `stream2buffer`, `buffer2stream`, `streamSizeTransform`, `streamSize` | Bandwidth-aware stream plumbing |
| `jutilities/dist/hash.js` | `djb2`, `sdbm`, `fnv1a64` | Fast 32-bit seeds + BigInt (unmasked) hashing |
| `jutilities/dist/is.js` | 14 type guards | `isRecord`, `isEmpty`, `isThenable`, … |
| `jutilities/dist/to.js` | `toArray`, `toBase64` | Normalize wrappers / encode bytes |
| `jutilities/dist/from.js` | `fromBase64` | Decode bytes (Node `Buffer` / browser `atob`) |
| `jutilities/dist/types/type.js` | `AnyFunction`, `AnySyncFunction`, … | Shared callable/utility types |
| `jutilities/dist/types/with.js` | `WithSignal` | `{ signal?: AbortSignal } & T` convention |

`AsyncFunction`, `MaybePromise`, `Generator`, and friends are all re-exportable straight from `dist/types/type.js`.

## Quick start

### Cache (memoize anything)

```ts
import { withCacheAsync } from "jutilities/dist/cache.js";

const getUser = withCacheAsync(async (id: string) => fetchUser(id));

await getUser("u1"); // miss — hits the source
await getUser("u1"); // hit — served from the store
```

- Default store: a process-wide TTL-aware `ExpiredMap` (from `expired-map`).
- Default key: `JSON.stringify({ parameters, function source, extraKeys })` — argument objects are **key-order sensitive**, matching native JSON semantics.
- Results cached only when `shouldCache` (default: non-empty results) says so — empty/`undefined` results are never cached.

### Retry (policy in your hands)

```ts
import { withRetryAsync } from "jutilities/dist/retry.js";

const flaky = withRetryAsync(callThirdPartyApi, ({ retries, error }) => {
  if (retries >= 5) throw error; // stop and surface
  await sleepAsync({ sleep: 2 ** retries * 100 }); // your backoff
});
```

Default policy: ≤ 3 retries (4 attempts) and a per-execution 60 s ceiling; **no built-in backoff** — you own the timing inside `onError`.

### Timeout + signal

```ts
import { withTimeoutAsync } from "jutilities/dist/timeout.js";

const deadline = withTimeoutAsync(loadRemote, { timeoutMs: 2500 });
```

The rejection value is always `signal?.reason` — including the wall-clock timeout when a signal is present.

### Sleep (abort-aware)

```ts
import { sleepAsync } from "jutilities/dist/sleep.js";

await sleepAsync({ sleep: 1500, signal: controller.signal });
// aborted mid-sleep? resolves with signal.reason instead of hanging
```

`sleepSync({ sleep })` busy-waits (blocks the loop) for when you truly cannot await; it detects only pre-aborted signals.

### superjson — JSON that round-trips your values

```ts
import { superjson } from "jutilities/dist/json.js";

superjson.stringify(new Map([["k", 1n]]));
// '{"__type":"map","value":[["k",{"__type":"bigint","value":"1"}]]}'

const back = superjson.parse(sameString); // Map with 1n — bit-for-bit
```

Handlers cover numeric edge cases (`NaN`/`±Infinity`/`-0`, bigint, symbols via `Symbol.for`, boxed primitives, invalid dates, `Date`, `Map`, `Set`, `Buffer`, all typed arrays, `DataView`, `ArrayBuffer`, `Error` (+ `cause`), `RegExp`, `URL`, `URLSearchParams`, `Headers`). Build your own registry with `new Json().addHandler(type, { isApplicable, stringify, parse })`.

### Node streams

```ts
import { tee } from "jutilities/dist/node-stream.js";
import { streamSize } from "jutilities/dist/node-stream.js";

const [memory, disk] = tee({ source: upload }); // backpressure-aware duplication

for await (const chunk of streamSize(fetchStream, { onSize: console.log })) {
  // onSize reports cumulative { size, done } per chunk and at flush
}
```

## Design principles

1. **Independent modules.** Every helper is a single-file module; nothing pulls another feature in (only tiny shared types).
2. **Explicit contracts over clever defaults.** Defaults exist (TTL store, 3 retries) but each is documented *including its surprising corners* — e.g. "abort during a delayed call still runs the function".
3. **`signal` is a first-class option.** Every async wrapper accepts `WithSignal<T>` (`{ signal?: AbortSignal } & T`) and behaves sensibly for pre-aborted and mid-flight aborts.
4. **No throwing wrappers.** Racy failures resolve/reject with `signal.reason`; sync validation errors are the only synchronous surfaces (`tee`, `buffer2stream`, pre-aborted `sleepAsync`, …).
5. **Compose, don't reimplement.** Wrappers are `this`-preserving and argument-preserving, so they stack: `withLogger(withRetryAsync(withCacheAsync(fn)))`.

## Known quirks (documented, intentional)

- `withCacheSync/Async` skip caching for empty/falsy results; JSON keys are order-sensitive for object args.
- `withRetrySync` has a documented args-spreading bug: exactly one array argument gets spread, other arities throw — known and pinned by a test until fixed.
- `withDelayAsync/withDelaySync`: abort **mid-delay still runs the wrapped function** (the delay is checked, not the call).
- `withTimeoutAsync` rejects with `signal.reason` even for wall-clock timeouts.
- `withLogger`/`withCache*` timing switches from `performance.now` (Node) to `Date.now` (browser branch, `window` present).
- `lazy` caches only truthy results, evicts rejected promises, and keys on `djb2(source + args)` (32-bit, collidable).
- `superjson.parse` of typed-array payloads rebuilds views on a fresh **shared Buffer pool**; pooled neighbors may be reachable from the bytes of adjacent allocations.
- `sleepSync` is a busy-wait and can only observe signals that aborted *before* it started.

## Development

```bash
npm run lint        # 0 errors / 0 warnings policy
npm run lint:fix
npm run typecheck   # strict TS, tests included
npm test            # 289 tests
npm run build       # tsc → dist (tests excluded)
npm run examples    # run every example in examples/
```

### Lint policy

The config never disables a rule globally. The 0/0 gate holds by *solving* warnings where possible — e.g. the examples carry fully typed JSDoc (`@param {string} …`) — and by exactly two justified, *inline* exceptions:

- `src/logger.ts` — `deslint/no-prod-console` is disabled next to each `console.log`, because console logging **is this module's feature** (the output target is test-pinned). Swapping in pino/winston would change the public behavior and dependencies.
- `examples/*.mjs` — one file-level `deslint/no-prod-console` disable per example: examples are demo scripts and printing is their purpose.

Community guides live in [docs/DOCUMENTATION.md](./docs/DOCUMENTATION.md) — per-module behavior contracts, quirks, and worked use cases. Executable, runnable copies of those snippets live in [examples/](./examples).

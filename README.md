# jutilities

Small, typed, heavily documented TypeScript utilities for Node.js — caching, retries, timeouts, delays, abort-aware sleeps, one-shot signal listeners, Node stream helpers, a super-JSON serializer, non-cryptographic hashes, and type guards.

Everything is an independent module with a locked, test-verified behavior contract (361 tests). Every non-obvious quirk is documented at the call site.

> **Status:** v1.0.0 — published on npm. APIs are stable in practice, but semver guarantees are not yet frozen. Requires **Node ≥ 22** (uses `Buffer` pool semantics, `Symbol.for` round-trips, shared timers).

## Install

```bash
npm install jutilities
```

ESM only. The package ships compiled `dist/` output — no barrel, no `main`.

**Published contents** (guarded by `files` in `package.json` + `.npmignore`):
`dist/` (compiled modules + types with source maps), `docs/DOCUMENTATION.md`,
`examples/` (runnable demos), `README.md`, `package.json`. Sources (`src/`),
tests, and all dev tooling stay in the repository only.

### Subpath imports (the only supported style)

jutilities intentionally exposes **no index barrel**: every module is imported by its own subpath — `jutilities/<module>`. A single `exports` pattern routes each subpath onto the compiled file (`jutilities/cache` resolves to `dist/cache.js`, typings sit next to it), so bundlers and runtimes only pull the code you use.

```ts
// TypeScript
import { withCacheAsync } from "jutilities/cache";
import { sleepAsync } from "jutilities/sleep";
```

```js
// JavaScript
import { withRetryAsync } from "jutilities/retry";
import { superjson } from "jutilities/json";
```

## Modules

| Subpath import | Exports | One-line summary |
| --- | --- | --- |
| `jutilities/cache` | `withCacheSync`, `withCacheAsync` + `Key`/`CacheStore`/`Options`/`CacheKeyParams`/`ShouldCacheParams` types | Memoize with a pluggable (TTL-aware default) store |
| `jutilities/retry` | `withRetryAsync`, `withRetrySync` | Policy-driven retries (`onError` decides) |
| `jutilities/timeout` | `withTimeoutAsync` | Race an async call against a deadline / signal |
| `jutilities/delay` | `withDelayAsync`, `withDelaySync` | Sleep before each invocation |
| `jutilities/sleep` | `sleepAsync`, `sleepSync` | Promisified (and blocking) waits, abort-aware |
| `jutilities/signal` | `abort` | Flatten `AbortSignal` add/remove into two callables |
| `jutilities/lazy` | `lazy` | Memoize by (source + args) hash, retry failures |
| `jutilities/logger` | `withLogger` | Log invocation args + awaited result + duration |
| `jutilities/decorators/<kind>` | `decorateMethod`, `decorateClass`, `decorateProperty`, `decorateGetter` | Turn fn-first HOFs into fully typed Stage 3 decorators (methods / whole classes / function-valued fields / getters) |
| `jutilities/json` | `Json`, `superjson` | Round-trip Map/Set/Date/bigint/typed arrays/Errors… |
| `jutilities/node-stream` | `tee`, `stream2buffer`, `buffer2stream`, `streamSizeTransform`, `streamSize` | Bandwidth-aware stream plumbing |
| `jutilities/hash` | `djb2`, `sdbm`, `fnv1a64` | Fast 32-bit seeds + BigInt (unmasked) hashing |
| `jutilities/is` | 16 type guards | `isRecord`, `isEmpty`, `isThenable`, … |
| `jutilities/assert` | `assert`, `assertNotNil`, `assertNever`, `withAssertSync`/`withAssertAsync` + decorator contract guards | Throw-first counterparts of the checks + per-call result gates (narrow, never return to broken state) |
| `jutilities/to` | `toArray`, `toBase64` | Normalize wrappers / encode bytes |
| `jutilities/from` | `fromBase64` | Decode bytes (Node `Buffer` / browser `atob`) |
| `jutilities/types/type` | `AnyFunction`, `AnySyncFunction`, … | Shared callable/utility types |
| `jutilities/types/with` | `WithSignal` | `{ signal?: AbortSignal } & T` convention |

`AsyncFunction`, `MaybePromise`, `Generator`, and friends are all re-exportable straight from `dist/types/type.js`.

## Quick start

### Cache (memoize anything)

```ts
import { withCacheAsync } from "jutilities/cache";

const getUser = withCacheAsync(async (id: string) => fetchUser(id));

await getUser("u1"); // miss — hits the source
await getUser("u1"); // hit — served from the store
```

- Default store: a process-wide TTL-aware `ExpiredMap` (from `expired-map`).
- Default key: `djb2(superjson.stringify({ parameters, function source, extraKeys }))` — a stable unsigned 32-bit integer; `superjson` keeps types bare JSON loses distinct (`NaN` vs `null`, `BigInt`, `Map`/`Set`) and object arguments stay **key-order sensitive**.
- Custom `generateCacheKey` factories may return a `string` **or** a `number` — whatever your store prefers as identity.
- The contract types are exported too: `import type { CacheStore, Options, Key, CacheKeyParams, ShouldCacheParams } from "jutilities/cache"` to annotate custom stores and hooks.
- Results cached only when `shouldCache` (default: non-empty results) says so — empty/`undefined` results are never cached.

### Retry (policy in your hands)

```ts
import { withRetryAsync } from "jutilities/retry";

const flaky = withRetryAsync(callThirdPartyApi, ({ retries, error }) => {
  if (retries >= 5) throw error; // stop and surface
  await sleepAsync({ sleep: 2 ** retries * 100 }); // your backoff
});
```

Default policy: ≤ 3 retries (4 attempts) and a per-execution 60 s ceiling; **no built-in backoff** — you own the timing inside `onError`.

### Timeout + signal

```ts
import { withTimeoutAsync } from "jutilities/timeout";

const deadline = withTimeoutAsync(loadRemote, { timeoutMs: 2500 });
```

The rejection value is always `signal?.reason` — including the wall-clock timeout when a signal is present.

### Sleep (abort-aware)

```ts
import { sleepAsync } from "jutilities/sleep";

await sleepAsync({ sleep: 1500, signal: controller.signal });
// aborted mid-sleep? resolves with signal.reason instead of hanging
```

`sleepSync({ sleep })` busy-waits (blocks the loop) for when you truly cannot await; it detects only pre-aborted signals.

### superjson — JSON that round-trips your values

```ts
import { superjson } from "jutilities/json";

superjson.stringify(new Map([["k", 1n]]));
// '{"__type":"map","value":[["k",{"__type":"bigint","value":"1"}]]}'

const back = superjson.parse(sameString); // Map with 1n — bit-for-bit
```

Handlers cover numeric edge cases (`NaN`/`±Infinity`/`-0`, bigint, symbols via `Symbol.for`, boxed primitives, invalid dates, `Date`, `Map`, `Set`, `Buffer`, all typed arrays, `DataView`, `ArrayBuffer`, `Error` (+ `cause`), `RegExp`, `URL`, `URLSearchParams`, `Headers`). Invalid-date detection is strict (`Number.isNaN(getTime())` — no coercion), so a `Date` whose `getTime` was overridden to a non-number still round-trips as a valid date. Build your own registry with `new Json().addHandler(type, { isApplicable, stringify, parse })`.

### Node streams

```ts
import { tee } from "jutilities/node-stream";
import { streamSize } from "jutilities/node-stream";

const [memory, disk] = tee({ source: upload }); // backpressure-aware duplication

for await (const chunk of streamSize(fetchStream, { onSize: console.log })) {
  // onSize reports cumulative { size, done } per chunk and at flush
}
```

### Decorators — promote any HOF to `@decorator`

```ts
import { decorateMethod } from "jutilities/decorators/method";
import { decorateClass } from "jutilities/decorators/class";
import { withCacheSync, withCacheAsync } from "jutilities/cache";
import { withRetryAsync } from "jutilities/retry";

// Hoist the factory once, then apply it with single options calls:
const cached = decorateMethod(withCacheSync);
const retry = decorateMethod(withRetryAsync, { require: "async" });

class Users {
  @cached({ extraKeys: ["users"] })
  name(id: string) { return `u-${id}`; }

  // Declared-async methods pair with declared-async HOFs — mismatched slots
  // are compile errors, and `require: "async"` backs them up at runtime.
  // `withRetryAsync`'s option slot IS the onError policy callback, not a
  // config object — omit it for the default policy (10 retries with
  // exponential, jittered backoff):
  @retry()
  async load(id: string) { return id; }
}

// Whole-class fan-out: every own prototype method, one options call:
const cachedUsers = decorateClass({
  sync: withCacheSync,   // non-async members
  async: withCacheAsync, // async members (resolved via pick: "detect")
});

@cachedUsers({ cacheStore: new Map(), extraKeys: ["users"] })
class Repo {
  count() { return 42; }
  async load(id: string) { return id; }
}
// The class decorator also skips constructor, statics, and accessors.
```

`decorateProperty` enhances function-valued fields **per instance** (arrow
fields keep their lexical `this`; a non-function initializer throws at
construction), `decorateGetter` wraps a getter **once, prototype-wide** (a
cached getter is shared across every instance), and `require: "sync" | "async"`
guards turn declared-async mismatches into decorate-time `TypeError`s.

## Design principles

1. **Independent modules.** Every helper is a single-file module; nothing pulls another feature in (only tiny shared types).
2. **Explicit contracts over clever defaults.** Defaults exist (TTL store, a 10-retry backoff policy) but each is documented *including its surprising corners* — e.g. "a mid-wait abort rejects the delayed call with the abort reason and never runs the function".
3. **`signal` is a first-class option.** Every async wrapper accepts `WithSignal<T>` (`{ signal?: AbortSignal } & T`) and behaves sensibly for pre-aborted and mid-flight aborts.
4. **No throwing wrappers.** Racy failures resolve/reject with `signal.reason`; sync validation errors are the only synchronous surfaces (`tee`, `buffer2stream`, pre-aborted `sleepAsync`, …).
5. **Compose, don't reimplement.** Wrappers are `this`-preserving and argument-preserving, so they stack: `withLogger(withRetryAsync(withCacheAsync(fn)))`.

## Known quirks (documented, intentional)

- `withCacheSync/Async` skip caching for empty/falsy results; default keys are 32-bit `djb2` hashes (theoretically collidable) and object-arg keys are order-sensitive.
- `withDelayAsync`: abort **mid-delay rejects the wrapped call with `signal.reason` — the wrapped function never runs**; `withDelaySync` blocks the loop, so only pre-aborts are observable.
- `withTimeoutAsync` rejects with `signal.reason` even for wall-clock timeouts.
- `withLogger`/`withCache*` timing switches from `performance.now` (Node) to `Date.now` (browser branch, `window` present).
- `lazy` caches only truthy results, evicts rejected promises, and keys on `djb2(source + args)` (32-bit, collidable).
- `superjson.parse` of typed-array payloads rebuilds views on a fresh **shared Buffer pool**; pooled neighbors may be reachable from the bytes of adjacent allocations.
- `sleepSync` is a busy-wait and can only observe signals that aborted *before* it started.
- `decorators/<kind>` annotations must be applied as `@f(...options)` / `@f()`: bare `@f` applications are type-rejected, and method/class/getter bare applications additionally throw a `TypeError` at runtime. A bare application on a **field** is runtime-silent (fields hand `undefined`, not the member, to the decorator — only the type layer catches it), which is why the field shape is pinned compile-only.
- Decorator async detection (`class` pair `pick: "detect"`, and the `require` guards) uses `fn.constructor.name === "AsyncFunction"`. It holds under tsx/esbuild and native Node, but transpilers that *lower* `async` functions into plain functions returning promises defeat it — declare `pick`/`require` explicitly in such toolchains.
- `withCacheSync` forced onto a declared-`async` member (class `pick: "sync"`) does not memoize: promises count as "empty" under `isEmpty`, so every call recomputes — keep async members on the async slot (`pick: "detect"` does this automatically).

## Development

```bash
npm run lint        # 0 errors / 0 warnings policy
npm run lint:fix
npm run typecheck   # strict TS, tests included
npm test            # 361 tests
npm run build       # tsc → dist (tests excluded)
npm run examples    # run every example in examples/
```

The examples import through the same `jutilities/<module>` style as every snippet on this page. Published installs resolve them through the consumer's `node_modules`; fresh checkouts get the `node_modules/jutilities` self-link wired automatically by the `prepare` hook on `npm install` (`scripts/link-self.mjs`).

### Lint policy

The config never disables a rule globally. The 0/0 gate holds by *solving* warnings where possible — e.g. the examples are fully typed TypeScript, strict-checked like `src` — and by exactly two justified, *inline* exceptions:

- `src/logger.ts` — `deslint/no-prod-console` is disabled next to each `console.log`, because console logging **is this module's feature** (the output target is test-pinned). Swapping in pino/winston would change the public behavior and dependencies.
- `examples/**/*.ts` — one file-level `deslint/no-prod-console` disable per example: examples are demo scripts and printing is their purpose.

Examples are ordinary TypeScript: the flat demos live in `examples/`, and the Stage 3 decorator showcases live in `examples/decorators/` (they need a transpile pass, like every plain-Node consumer of this repo). `npm run examples` drives them all through tsx (`examples/run-all.ts`), seeded by a fresh build.

Community guides live in [docs/DOCUMENTATION.md](./docs/DOCUMENTATION.md) — per-module behavior contracts, quirks, and worked use cases; every snippet there has an executable, runnable copy in [examples/](./examples) that runs through the same gate.

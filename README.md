# jutilities

**Typed utilities. Pinned by 588 tests.**

![npm version](https://img.shields.io/npm/v/jutilities)
![node](https://img.shields.io/badge/node-%E2%89%A5%2022.13-339933?logo=node.js&logoColor=white)
![tests](https://img.shields.io/badge/tests-588%20passing-brightgreen)
![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)

Typed utilities for Node and browser services — caching, retries, timeouts,
abort-aware sleeps, super-JSON serialization, streams and hashing — shipped as **34
independent modules**, each imported by its own subpath. No barrel, no `main`: you
import only what you use, and every module carries a documented, test-pinned
behavior contract — quirks included.

Evidence:

- **588 tests at 100% coverage** (statements / branches / functions / lines). The
  `npm run check` gate runs typecheck, lint, knip, the suite, the `--expose-gc`
  memory suite, a docs-regenerating build and every example.
- **Exactly one runtime dependency** — `expired-map`, the TTL store behind the
  cache wrappers.
- **ESM-only** (compiled `dist/` + generated docs, one page per module) on
  **Node ≥ 22.13** (Buffer pool semantics and `Symbol.for` round-trips in
  `from` / `json`; `node:sqlite` in the examples).
- Behavior is pinned by `src/**/*.test.ts`; caveats are documented at each call
  site, in this README and in the generated [docs](./docs/README.md).

## Install

```bash
npm install jutilities
```

`examples/` ships in the tarball — every demo runs through `npm run examples`.

The published tarball ships compiled `dist/` (plus types and source maps), the
generated `docs/`, runnable `examples/` and this README — sources and dev tooling
stay in the repo, and `prepack` rebuilds `dist/` and `docs/` before publishing so
the tarball is never stale.

**Subpath imports — the only supported style.** Every module is imported as
`jutilities/<module>`; a single `exports` pattern routes each subpath onto the
compiled file (typings sit next to it), so bundlers and runtimes only pull the
code you use:

```ts
// TypeScript
import { withCacheAsync } from "jutilities/hof/cache";
import { sleepAsync } from "jutilities/sleep";
```

```ts
// JavaScript
import { withRetryAsync } from "jutilities/hof/retry";
import { superjson } from "jutilities/json";
```

Fresh clones get the `node_modules/jutilities` self-link automatically
(`prepare` → `scripts/link-self.mjs`), so the repo's own examples and docs import
the same paths you will.

## Why jutilities

1. **Independent modules.** Nothing pulls a feature in with everything it wants —
   only tiny shared types are shared.
2. **Explicit contracts over clever defaults.** Defaults exist (a TTL store, a
   jittered backoff policy) and each is documented, including the
   surprising corners — e.g. "a mid-delay abort rejects the delayed call with the
   abort reason and the wrapped function never runs".
3. **`signal` is a first-class option.** Every async wrapper accepts
   `WithSignal<T>` (`{ signal?: AbortSignal } & T`) and behaves for pre-aborted
   and mid-flight aborts.
4. **No throwing wrappers.** Racy failures resolve/reject with `signal.reason`;
   sync validation errors are the only synchronous surfaces.
5. **Compose, don't reimplement.** Wrappers are `this`- and argument-preserving,
   so they stack: `withLoggerAsync(withRetryAsync(withCacheAsync(fn)))` — by hand
   or through `withAsync`.

## Use cases

Real-world scenarios straight from the runnable [examples](./examples) —
`npm run examples` builds the package first, then runs every demo through tsx.

### Retry a flaky upstream with a policy you own

```ts
import { sleepAsync } from "jutilities/sleep";
import { withRetryAsync } from "jutilities/hof/retry";

const charge = withRetryAsync(chargeCard, {
  onError: async ({ error, retries }) => {
    if (retries >= 4) throw error; // your stop condition
    await sleepAsync({ sleep: 2 ** retries * 250 }); // your backoff
  },
});
```

The default policy (no `onError`) retries 10 times — 11 attempts — inside a 60 s
cumulative budget, sleeping an exponential, jittered `2^retries × last attempt's
duration`; pass `onError` to own the whole policy.
[Docs → hof/retry](./docs/hof/retry.md) · [Example](./examples/retry.ts)

### Put a wall-clock deadline on a remote call

```ts
import { withTimeoutAsync } from "jutilities/hof/timeout";

const controller = new AbortController();
const bounded = withTimeoutAsync(loadReport, {
  signal: controller.signal,
  timeoutMs: 2_000,
});

const report = await bounded(id); // on failure: rejects with controller.signal.reason
```

The rejection value is always `signal?.reason` — including the wall-clock timeout
when a signal is present; losing the race never silently swallows the work.
[Docs → hof/timeout](./docs/hof/timeout.md) · [Example](./examples/timeout.ts)

### Shut down cleanly: abort-aware sleeps

```ts
import { sleepAsync } from "jutilities/sleep";

process.once("SIGTERM", () => controller.abort());
try {
  await sleepAsync({ sleep: 1_500, signal: controller.signal });
} catch (error) {
  // controller.signal.reason — the wait was cut short on shutdown
}
```

Pre-aborted signals throw synchronously; aborting mid-sleep rejects with
`signal.reason` and clears the timer. `sleepSync` busy-waits when you truly cannot
await. [Docs → sleep](./docs/sleep.md) · [Example](./examples/sleep.ts)

### Cache expensive lookups — TTL included, in-flight dedup included

```ts
import { withCacheAsync } from "jutilities/hof/cache";

const getUser = withCacheAsync(async (id: string) => db.findUser(id));

await getUser("u_1"); // miss — hits the source
await getUser("u_1"); // hit — served from the process-wide store (default TTL 5 min)
```

Async wrappers share one in-flight promise per key (three simultaneous callers
run the loader once), never cache empty results, and evict rejections. The
default store is the process-wide `ExpiredMap` — pass a bounded `cacheStore`
(e.g. your own `ExpiredMap` with `maxSize`) for high-cardinality keys.
[Docs → hof/cache](./docs/hof/cache.md) · [Example](./examples/cache.ts)

### One lazy singleton for the whole process

```ts
import { DatabaseSync } from "node:sqlite";

import { lazy } from "jutilities/lazy";

const openDb = lazy(() => new DatabaseSync("app.db"));

openDb(); // opens the connection
openDb(); // same instance — memoized by source + args
```

Truths mirror the cache: truthy results only, rejected promises evicted, one
store shared process-wide by wrappers of the same initializer. Keys are
`djb2(superjson.stringify(...))` (see Known quirks) — never feed it
high-cardinality input. [Docs → lazy](./docs/lazy.md) · [Example](./examples/lazy.ts)

### Round-trip what `JSON` loses — Map, Set, bigint, Date

```ts
import { superjson } from "jutilities/json";

const text = superjson.stringify({
  at: new Date(),
  balance: 9007199254740993n, // bigint survives the trip
  plan: new Map([["tier", "pro"]]),
});
const value = superjson.parse(text); // Date, bigint, Map — intact
```

`jutilities/json` exports its own `superjson` instance — an envelope-based handler
registry (`Json`, `addHandler`) over native `JSON`. It is **unrelated to the
flightcontrol `superjson` package** used by tRPC/Next.js: the wire formats differ.
[Docs → json](./docs/json.md) · [Example](./examples/json.ts)

### Hash a multi-GB upload while streaming it to disk

```ts
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import { sha256 } from "jutilities/node/hash";
import { tee } from "jutilities/node/stream/tee";

const [toHash, toDisk] = tee({ stream: upload }); // two backpressure-aware branches
const digest = await sha256.stream({ stream: toHash }); // no full-buffer
await pipeline(toDisk, createWriteStream(target));
```

`tee` pauses the source until *both* branches drain; `sha256` hashes streams in
constant memory. [Docs → node/stream/tee](./docs/node/stream/tee.md) ·
[node/hash](./docs/node/hash.md) · [Example](./examples/node-stream.ts)

### Promote any HOF to a decorator

```ts
import { decorateMethod } from "jutilities/decorators/method";
import { withCacheSync } from "jutilities/hof/cache";

const cached = decorateMethod(withCacheSync);

class Billing {
  @cached({ extraKeys: ["billing"] })
  rate(plan: string) { /* expensive lookup */ }
}
```

TypeScript **legacy** decorators only (`"experimentalDecorators": true`) — plain
Node cannot parse decorator syntax, so decorator consumers are TypeScript run
through a transpiler (the examples use tsx). `decorateClass` fans one call out to
every own prototype method; `withCacheSync` does not memoize declared-`async`
members — pair those with `withCacheAsync` or `decorateClass({ async, sync })`.
[Docs → decorators/method](./docs/decorators/method.md) ·
[Example](./examples/decorators/method.ts)

**More use cases** — the [real-life scenarios](./examples/real-life) (hardened
HTTP API, SQLite with lazy connections and cached aggregates, a dead-lettering
worker pool, a cron scheduler) and the other flat demos (`assert`, `is`, `hash`,
`from`/`to`, `with`) all run via `npm run examples`.

## Why not roll your own

| Hand-rolled pattern | jutilities answer |
| --- | --- |
| `Map` + `Date.now` TTL memoization | `withCacheAsync` — TTL, in-flight dedup, `shouldCache`, key hooks |
| `Promise.race([fn, timeout])` + manual signal cleanup | `withTimeoutAsync` — always rejects with `signal.reason` |
| retry `while` loop + `setTimeout` | `withRetryAsync` — jittered exponential backoff, 60 s budget, your `onError` |
| `JSON.parse` silently losing `Map` / `bigint` | `superjson` — typed round-trips for the `JSON`-incompatible values |
| two `PassThrough`s + `pipe` juggling | `tee` — exactly two branches, backpressure-aware, error propagation |
| hand-written decorator glue | `decorateMethod` / `decorateClass` / `decorateGetter` |

**When jutilities is not the pick:** you need `p-retry`'s fine-grained knobs
(`factor` / `minTimeout` / `maxTimeout` / `shouldConsumeRetry`) — it is the more
configurable HTTP-retry choice; you need layered/LRU/LFU/bounded or distributed
caches with stats — reach for `cacheable` (or pass `jutilities` a bounded
`cacheStore` instead); you need `lodash.memoize`-style resolvers; you consume
tRPC/Next.js server-serialization (the flightcontrol `superjson`) — jutilities'
wire formats are not interchangeable with theirs; you need rate limiting,
circuit breakers or concurrency queues — bring `p-limit` / `p-queue`; you publish
CommonJS only. And anything Promise-returning under a sync wrapper throws a
`TypeError` (sync-guard) instead of being cached at all — use `withCacheAsync`
or `lazy` for async work.

`AnyAsyncFunction`, `MaybePromise` and friends are re-exportable from
`dist/types/type.js`; every wrapper preserves `this` and argument lists.

## Modules

No barrel — the complete, generated index of all **34 public modules**, one page
each with the full export surface, lives in [docs/](./docs/README.md). The map:

- **Higher-order wrappers** — `jutilities/hof/cache`, `hof/retry`, `hof/timeout`, `hof/delay`, `hof/logger`, `hof/assert`
- **Composition and decorators** — `jutilities/libs/create-hof`, `jutilities/libs/with`, `jutilities/decorators/method` · `class` · `getter` (TypeScript legacy decorators)
- **Environment and clock** — `jutilities/runtime` (`isServer`, `isBrowser`, `isBrowserWorker`, `isServerWorker`, `serverFn`/`browserFn`), `jutilities/clock`
- **General utilities** — `jutilities/lazy`, `sleep`, `signal`, `json` + `superjson`, `hash`, `is`, `to`, `from`
- **Node and Web** — `jutilities/node/stream/*`, `jutilities/node/fs/*`, `jutilities/node/hash`, `jutilities/web/stream/*`, `jutilities/web/hash`
- **Types** — `jutilities/types/type`, `jutilities/types/with` (type-only; no generated pages)

**Shared bypass (`skipHof`)** — every fn-first HOF accepts `options.skipHof` (`true`
returns the original `fn` untouched; a predicate selects raw invocation per call);
`withAsync` / `withSync` handle it once for the whole stack — see
[docs/libs/create-hof](./docs/libs/create-hof.md) and
[docs/libs/with](./docs/libs/with.md).

## Known quirks (documented, intentional)

- `withCacheSync/Async` cache nothing empty or falsy; default keys are 32-bit
  `djb2` hashes (theoretically collidable) and object-arg keys are
  order-sensitive.
- `withDelayAsync`: abort **mid-delay rejects the wrapped call with
  `signal.reason` — the wrapped function never runs**; `withDelaySync` blocks the
  loop, so only pre-aborts are observable.
- `withTimeoutAsync` rejects with `signal.reason` even for wall-clock timeouts.
- `withLoggerSync`/`withLoggerAsync`/`withCache*` and `lazy` timing go through
  `jutilities/clock` (`performance.now` outside a `window`, `Date.now` in classic
  browsers).
- `jutilities/runtime`: `isServer` is `true` anywhere `window` is absent —
  including browser Web Workers. Refine with `isBrowserWorker` (classic workers)
  or `isServerWorker` (Node `worker_threads`, detected synchronously via
  `process.getBuiltinModule`); module service workers report `isServer`.
- `lazy` caches only truthy results, evicts rejected promises, and keys on
  `djb2(superjson.stringify({ args, functionString }))`; its store is
  process-wide and unbounded — no user-controlled or high-cardinality input.
- `superjson` (jutilities) is unrelated to flightcontrol's `superjson`; its
  typed-array payloads decode over fresh, exactly sized buffers.
- `sleepSync` is a busy-wait and only observes signals that aborted before it
  started.
- Decorator HOFs must be applied as `@f(...)` / `@f()`; bare `@f` is type-rejected
  and throws at runtime. Only factory-built HOFs (`createHofSync`/`Async`)
  convert. Async detection uses `fn.constructor.name === "AsyncFunction"` —
  transpilers that lower `async` defeat it; declare `pick`/`require` explicitly in
  such toolchains. `withCacheSync` never memoizes a declared-`async` method.
- Sync wrappers now preserve the generic/polymorphic signature end-to-end (like
  `async` flavours) and enforce sync discipline at runtime: a Promise, Generator
  or AsyncGenerator result throws a `TypeError` before the caller consumes it.

## Performance and memory

Benchmarks (`npm run bench`, opt-in, not in `npm run check`) measure the built
artifact via the package self-link (`dist/` is rebuilt first); memory/leak tests
(`npm run test:memory`) run with `--expose-gc` and **are** part of the gate.
Numbers below are a single Node 24.18.0 / Linux run (2026-11-13) — illustrative,
environment-specific, never a comparison against other machines:

| Benchmark | ops/sec |
| --- | --- |
| `withCacheSync` hit | ~3.1–3.6M |
| `djb2` short key | ~4.2M |
| `lazy` hit | ~930k–1.0M |
| `withCacheAsync` hit | ~755–820k |
| `superjson.parse` plain | ~40k |
| `streamSize` 64 KiB | ~85–146k |
| `tee` 64 KiB | ~59–60k |

Memory suite asserts: cached values are released (`WeakRef` collected) after
`clear()` and TTL expiry; timer counts return to zero after abort and completion; `abort()`
registers exactly one listener per call with an idempotent remover; `tee` detaches
its source listeners on end/error/close; `StreamCache` leaves no partial files on
rollback and shares one `beforeExit` listener across instances. Methodology and
caveats: [test/benchmark/README.md](./test/benchmark/README.md).

## Development

```bash
npm run lint        # 0 errors / 0 warnings policy
npm run typecheck   # strict TS, tests included
npm run knip        # unused files/exports/dependencies (in check)
npm test            # 588 tests
npm run test:memory # leak/resource suite (in check)
npm run build       # tsc → dist + regenerate docs/ (tests excluded)
npm run examples    # build + run every example in examples/
```

See [AGENTS.md](./AGENTS.md) for the full command set (`lint:fix`, `test:heap`,
`profile`, `bench`).

The lint config never disables a rule globally; warnings are solved or handled by
a small set of justified inline exceptions (per-example `no-prod-console`, the
`node:sqlite` builtin rule in the SQLite demo). Examples are ordinary TypeScript,
style-checked like `src`; decorator showcases run via tsx like every plain-Node
consumer of this repo.

## Documentation

One page per module, generated from the JSDoc by `npm run build` (via
`scripts/generate-api-docs.mjs`) — never edited by hand:
[docs/README.md](./docs/README.md). Runtime caveats and quirks are in
[Known quirks](#known-quirks-documented-intentional); behavior contracts are the
executable tests in `src/**/*.test.ts`; the runnable demos are in
[examples/](./examples).

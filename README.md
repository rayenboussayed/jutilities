# jutilities

Small, typed, heavily documented TypeScript utilities for Node.js — caching, retries, timeouts, delays, abort-aware sleeps, one-shot signal listeners, Node stream and filesystem helpers, a super-JSON serializer, non-cryptographic hashes, and type guards.

Everything is an independent module with a locked, test-verified behavior contract (588 tests). Every non-obvious quirk is documented at the call site.

> **Status:** APIs are stable in practice, but semver guarantees are not yet frozen. Requires **Node ≥ 22.13** (uses `Buffer` pool semantics, `Symbol.for` round-trips, shared timers, `node:sqlite` in the examples).

## Install

```bash
npm install jutilities
```

ESM only. The package ships compiled `dist/` output — no barrel, no `main`.

**Published contents** (guarded by `files` in `package.json` + `.npmignore`; `prepack` rebuilds `dist/` and `docs/` before packing so the tarball is always fresh):
`dist/` (compiled modules + types with source maps), `docs/` (generated API
reference), `examples/` (runnable demos), `README.md`, `package.json`. Sources
(`src/`), tests, and all dev tooling stay in the repository only.

### Subpath imports (the only supported style)

jutilities intentionally exposes **no index barrel**: every module is imported by its own subpath — `jutilities/<module>`. A single `exports` pattern routes each subpath onto the compiled file (`jutilities/hof/cache` resolves to `dist/hof/cache.js`, typings sit next to it), so bundlers and runtimes only pull the code you use.

```ts
// TypeScript
import { withCacheAsync } from "jutilities/hof/cache";
import { sleepAsync } from "jutilities/sleep";
```

```js
// JavaScript
import { withRetryAsync } from "jutilities/hof/retry";
import { superjson } from "jutilities/json";
```

## Modules

No barrel, no `main` — every module imports by its own subpath, and the complete,
generated index of every public module — one page each with the full export surface
from the JSDoc — lives in [docs/](./docs/README.md). The map:

- **Higher-order wrappers** — `jutilities/hof/cache`, `hof/retry`, `hof/timeout`, `hof/delay`, `hof/logger`, `hof/assert`
- **Composition and decorators** — `jutilities/libs/create-hof`, `jutilities/libs/with`, `jutilities/decorators/method` · `class` · `getter` (TypeScript legacy decorators)
- **Environment and clock** — `jutilities/runtime` (`isServer`, `isBrowser`, `isBrowserWorker`, `isServerWorker`, `serverFn`/`browserFn`), `jutilities/clock`
- **General utilities** — `jutilities/lazy`, `sleep`, `signal`, `json` + `superjson`, `hash`, `is`, `to`, `from`
- **Node and Web** — `jutilities/node/stream/*`, `jutilities/node/fs/*`, `jutilities/node/hash`, `jutilities/web/stream/*`, `jutilities/web/hash`
- **Types** — `jutilities/types/type`, `jutilities/types/with` (type-only; no generated pages)

**Shared bypass (`skipHof`)** — every fn-first HOF accepts `options.skipHof` (`true` returns the original `fn` untouched; a predicate selects raw invocation per call); the `withAsync` / `withSync` composers handle it once for the whole stack. Details: [docs/libs/create-hof](./docs/libs/create-hof.md) and [docs/libs/with](./docs/libs/with.md).

`AsyncFunction`, `MaybePromise`, `Generator`, and friends are all re-exportable straight from `dist/types/type.js`.

## Quick start

### Cache (memoize anything)

```ts
import { withCacheAsync } from "jutilities/hof/cache";

const getUser = withCacheAsync(async (id: string) => fetchUser(id));

await getUser("u1"); // miss — hits the source
await getUser("u1"); // hit — served from the store
```

- Default store: a process-wide TTL-aware `ExpiredMap` (from `expired-map`).
- Default key: `djb2(superjson.stringify({ parameters, function source, extraKeys }))` — a stable unsigned 32-bit integer; `superjson` keeps types bare JSON loses distinct (`NaN` vs `null`, `BigInt`, `Map`/`Set`) and object arguments stay **key-order sensitive**.
- Custom `generateCacheKey` factories may return a `string` **or** a `number` — whatever your store prefers as identity.
- The contract types are exported too: `import type { CacheStore, Options, Key, CacheKeyParams, ShouldCacheParams } from "jutilities/hof/cache"` to annotate custom stores and hooks.
- Results cached only when `shouldCache` (default: non-empty results) says so — empty/`undefined` results are never cached.

### Retry (policy in your hands)

```ts
import { withRetryAsync } from "jutilities/hof/retry";

const flaky = withRetryAsync(callThirdPartyApi, {
  onError: async ({ retries, error }) => {
    if (retries >= 5) throw error; // stop and surface
    await sleepAsync({ sleep: 2 ** retries * 100 }); // your backoff
  },
});
```

Default policy: 10 retries (the policy throws at `retries === 10`, so 11
attempts) and a 60 s cumulative budget; between attempts it sleeps an
exponential, jittered `2^retries × last attempt's duration`, capped by the
remaining budget. Pass `onError` to own the whole policy.

### Timeout + signal

```ts
import { withTimeoutAsync } from "jutilities/hof/timeout";

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

Handlers cover the `JSON`-incompatible values — the full registry, invalid-date semantics and the `addHandler` authoring API are documented in [docs/json](./docs/json.md).

### Node streams

```ts
import { tee } from "jutilities/node/stream/tee";
import { streamSize } from "jutilities/node/stream/size";

const [memory, disk] = tee({ stream: upload }); // backpressure-aware duplication

for await (const chunk of streamSize({ onSize: console.log, stream: fetchStream })) {
  // onSize reports cumulative { size, done } per chunk and at flush
}
```

### Decorators — promote any HOF to `@decorator`

Decorators here are the TypeScript **legacy** decorators (`"experimentalDecorators": true` in `tsconfig.json`); plain Node cannot parse decorator syntax, so decorator-consuming files are TypeScript executed through a transpiler (the examples run via tsx).

```ts
import { decorateMethod } from "jutilities/decorators/method";
import { decorateClass } from "jutilities/decorators/class";
import { withCacheSync, withCacheAsync } from "jutilities/hof/cache";
import { withRetryAsync } from "jutilities/hof/retry";

// Hoist the factory once, then apply it with single options calls:
const cached = decorateMethod(withCacheSync);
const retry = decorateMethod(withRetryAsync, { require: "async" });

class Users {
  @cached({ extraKeys: ["users"] })
  name(id: string) { return `u-${id}`; }

  // Declared-async methods pair with declared-async HOFs (async-lane
  // mismatches are compile errors; sync lanes use runtime guards/`require`).
  // No options → the default retry policy; pass `{ onError }` to own it:
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

`decorateGetter` wraps a getter **once, prototype-wide** (a cached getter is shared across every instance). Plain fields are not supported — TypeScript legacy field decorators receive no initializer value, so the decorators module covers methods, classes and getters only. `require: "sync" | "async"` guards turn declared-async mismatches into decorate-time `TypeError`s.

Only HOFs built by `createHofSync` / `createHofAsync` (or composed by `withAsync` / `withSync`) are convertible — they carry the kind brand the converter types the option bag from. A hand-written fn-first function is rejected at compile time; an async member contradicts the async gate, while sync HOFs preserve signatures and rely on runtime guards (or `require`) to reject promise/generator results.

### Compose several HOFs

```ts
import { withAsync } from "jutilities/libs/with";
import { withCacheAsync } from "jutilities/hof/cache";
import { withRetryAsync } from "jutilities/hof/retry";

// The first HOF is the outermost layer: cache → retry → fn.
const resilient = withAsync(withCacheAsync, withRetryAsync);

const send = resilient(sendMail, {
  extraKeys: ["mail"], // read by the cache layer
  onError: backoff,    // read by the retry layer
});
```

One flat options bag is shared by the whole stack (each layer reads its own
keys), and a single `skipHof` covers every layer.

## Design principles

1. **Independent modules.** Every helper is a single-file module; nothing pulls another feature in (only tiny shared types).
2. **Explicit contracts over clever defaults.** Defaults exist (TTL store, a 10-retry backoff policy) but each is documented *including its surprising corners* — e.g. "a mid-wait abort rejects the delayed call with the abort reason and never runs the function".
3. **`signal` is a first-class option.** Every async wrapper accepts `WithSignal<T>` (`{ signal?: AbortSignal } & T`) and behaves sensibly for pre-aborted and mid-flight aborts.
4. **No throwing wrappers.** Racy failures resolve/reject with `signal.reason`; sync validation errors are the only synchronous surfaces (`tee`, `buffer2stream`, pre-aborted `sleepAsync`, …).
5. **Compose, don't reimplement.** Wrappers are `this`-preserving and argument-preserving, so they stack: `withLoggerAsync(withRetryAsync(withCacheAsync(fn)))` — by hand or through the composer (`withAsync(withLoggerAsync, withRetryAsync)`).

## Known quirks (documented, intentional)

- `withCacheSync/Async` skip caching for empty/falsy results; default keys are 32-bit `djb2` hashes (theoretically collidable) and object-arg keys are order-sensitive.
- `withDelayAsync`: abort **mid-delay rejects the wrapped call with `signal.reason` — the wrapped function never runs**; `withDelaySync` blocks the loop, so only pre-aborts are observable.
- `withTimeoutAsync` rejects with `signal.reason` even for wall-clock timeouts.
- `withLoggerSync`/`withLoggerAsync`/`withCache*` timing goes through `jutilities/clock`: `performance.now` outside a `window` (Node — and browser Web Workers too, since the branch keys off `isServer`) and `Date.now` in classic browsers.
- `jutilities/runtime`: `isServer` is `true` anywhere `window` is absent — including browser Web Workers. Refine with `isBrowserWorker` (classic workers: `self === globalThis` plus `importScripts`; module service workers have neither and report `isServer`) or `isServerWorker` (Node `worker_threads`, detected synchronously via `process.getBuiltinModule`, so browser bundles see nothing Node-specific).
- `lazy` caches only truthy results, evicts rejected promises, and keys on `djb2(superjson.stringify({ args, function source }))` (32-bit, collidable). superjson widens what can serve as a key (BigInt, symbols, typed arrays all serialize); circular arguments still throw. The store is process-wide: wrappers of the same initializer share one memo.
- `superjson.parse` of typed-array payloads rebuilds views over a fresh, exactly sized buffer (the decoded bytes are copied out of Node's shared pool), so no neighboring allocation's bytes are reachable.
- `sleepSync` is a busy-wait and can only observe signals that aborted *before* it started.
- `decorators/<kind>` annotations must be applied as `@f(...options)` / `@f()`: bare `@f` applications are type-rejected, and method/class/getter bare applications additionally throw a `TypeError` at runtime.
- `decorators/<kind>` convert only factory-built HOFs (they carry the `__kind` brand); a hand-written fn-first function is type-rejected, and a member whose async-ness contradicts the HOF's slot is rejected in both directions.
- Decorator async detection (`class` pair `pick: "detect"`, and the `require` guards) uses `fn.constructor.name === "AsyncFunction"`. It holds under tsx/esbuild and native Node, but transpilers that *lower* `async` functions into plain functions returning promises defeat it — declare `pick`/`require` explicitly in such toolchains.
- `withCacheSync` forced onto a declared-`async` member (class `pick: "sync"`) does not memoize: promises count as "empty" under `isEmpty`, so every call recomputes — keep async members on the async slot (`pick: "detect"` does this automatically).
- `withCacheSync` (and every sync-flavored wrapper) now preserves the generic/polymorphic signature end-to-end, just like `withCacheAsync` and `lazy`. Sync discipline is enforced at runtime: any Promise, Generator, or AsyncGenerator result throws a `TypeError` before the enhancer/caller can consume it, and `skipHof` predicates are likewise validated. Async-oriented workloads should use `withCacheAsync`/`lazy`; sync wrappers no longer reject promise-returning functions at compile time.

## Performance and memory

The unit suite stays fast (~3 s with coverage). Performance and memory checks are opt-in so they never add noise to `npm test`:

| Command | What it does |
| --- | --- |
| `npm run bench` | Tinybench benchmarks for hash, json, cache, node streams, stream cache, fs (rebuilds first; opt-in, not in `check`) |
| `npm run bench:json` | Rebuild and dump a full JSON report to `test/benchmark/results/bench.json` |
| `npm run test:memory` | Memory/leak suite with `--expose-gc` (part of `npm run check`) |
| `npm run test:heap` | Per-test heap usage |
| `npm run profile` | CPU + heap profiles (pass a file filter, e.g. `npm run profile -- src/json.test.ts`) |

See [test/benchmark/README.md](./test/benchmark/README.md) for methodology, profiling how-tos and reference numbers.

## Development

```bash
npm run lint        # 0 errors / 0 warnings policy
npm run lint:fix
npm run typecheck   # strict TS, tests included
npm run knip        # unused files/exports/dependencies (in check)
npm test            # 588 tests
npm run test:memory # leak/resource suite (in check)
npm run build       # tsc → dist + regenerate docs/ (tests excluded)
npm run examples    # run every example in examples/
```

The examples import through the same `jutilities/<module>` style as every snippet on this page. Published installs resolve them through the consumer's `node_modules`; fresh checkouts get the `node_modules/jutilities` self-link wired automatically by the `prepare` hook on `npm install` (`scripts/link-self.mjs`).

### Lint policy

The config never disables a rule globally. The 0/0 gate holds by *solving* warnings where possible — e.g. the examples are fully typed TypeScript, strict-checked like `src` — and by a small set of justified, *inline* exceptions:

- `src/hof/logger.ts` — no inline disables needed: normal lines go through the injectable `options.logger` sink (default `console`, swapped for capture mocks in tests) rather than calling `console` directly, so `deslint/no-prod-console` never fires; console logging **is this module's feature**, and swapping in pino/winston would change the public behavior and dependencies.
- `examples/**/*.ts` — one file-level `deslint/no-prod-console` disable per example: examples are demo scripts and printing is their purpose.
- `examples/real-life/sqlite-db.ts` — one extra file-level `n/no-unsupported-features/node-builtins` disable: `node:sqlite` has no stable release in eslint-plugin-n's dataset, so no `engines` range can satisfy the rule; the example pins the real unflagged floor (Node ≥ 22.13) in its header.

Examples are ordinary TypeScript: the flat demos live in `examples/` — including five `generic-*` case studies (typed sync-cache boundaries, conditional `HandleAsyncFunction` branches, parameterized `Json` handlers, and the wrap-and-consume matrix that shows sync generics degrading to `any`) — the legacy decorator showcases live in `examples/decorators/` (they need a transpile pass, like every plain-Node consumer of this repo), and the multi-module scenarios live in `examples/real-life/` — a `node:http` API, an SQLite store, file management, a worker pool, schedulers. `npm run examples` drives them all through tsx (`examples/run-all.ts`), seeded by a fresh build.

Per-module API reference lives in [docs/](./docs/README.md) — one page per module, generated from the JSDoc with [`jsdoc-to-markdown`](https://github.com/jsdoc2md/jsdoc-to-markdown) via `npm run build` (through `scripts/generate-api-docs.mjs`); regenerate it after changing the docs comments. Runtime caveats and quirks are called out in [Known quirks](#known-quirks-documented-intentional) above, with per-call notes in the quick-start sections, and each module's behavior contract is pinned by the executable tests in `src/**/*.test.ts` — every example in [examples/](./examples) runs through the same `npm run check` gate.

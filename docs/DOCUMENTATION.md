# jutilities — Module Documentation

Behavior contracts, quirks, use cases, and composition patterns for every module.

Every statement below is pinned by an executable test in `src/**/*.test.ts` — if this document and the code ever disagree, the test is the source of truth.

**Reading conventions**

- `signal` — every async helper accepts the `WithSignal<T>` shape: `{ signal?: AbortSignal } & T`.
- `this` — all higher-order wrappers forward the receiver and arguments unchanged.
- `skipHof` — every fn-first HOF's options carry the shared bypass switch
  (`WithSkipHof`): `true` resolves the wrapper to the original `fn` itself at
  wrap time (the handler never builds an enhancer); a function predicate
  receives the call arguments and, when truthy, bypasses the enhancement for
  that single call (`fn` runs raw with the original `this` and args — async
  wrappers may await an async predicate; sync wrappers treat a pending promise
  as truthy); omitted / `false` applies the enhancement normally.
- "resolve(s)" and "reject(s)" refer to the returned promise of a wrapped call.
- Subpath imports are the only supported import style: `jutilities/<module>` (the package `exports` pattern routes it to the compiled `dist/<module>.js`).

---

## Table of contents

1. [cache](#cache) — `withCacheSync`, `withCacheAsync`
2. [retry](#retry) — `withRetryAsync`, `withRetrySync`
3. [timeout](#timeout) — `withTimeoutAsync`
4. [delay](#delay) — `withDelayAsync`, `withDelaySync`
5. [sleep](#sleep) — `sleepAsync`, `sleepSync`
6. [signal](#signal) — `abort`
7. [lazy](#lazy) — `lazy`
8. [logger](#logger) — `withLoggerSync` / `withLoggerAsync`
9. [decorators](#decorators) — `decorateMethod`, `decorateClass`, `decorateProperty`, `decorateGetter`
10. [json](#json) — `Json`, `superjson`
11. [node-stream](#node-stream) — `tee`, `stream2buffer`, `buffer2stream`, `streamSizeTransform`, `streamSize`
12. [hash](#hash) — `djb2`, `sdbm`, `fnv1a64`
13. [is](#is) — 16 type guards
14. [assert](#assert) — `assert`, `assertNotNil`, `assertNever`, `withAssertSync`/`withAssertAsync` + decorator contract guards
15. [to](#to) / [from](#from) — `toArray`, `toBase64`, `fromBase64`
16. [types](#types) — shared type utilities
17. [create-hof](#create-hof) — `createHofSync`, `createHofAsync`
18. [with](#with) — `withAsync`, `withSync` (stack composition)

---

## cache

```ts
import { withCacheSync, withCacheAsync } from "jutilities/cache";

function withCacheSync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  options?: {
    cacheStore?: CacheStore<T>;                  // get/set/delete object
    generateCacheKey?: (o: CacheKeyParams<T>) => string | number | Promise<string | number>;
    shouldCache?: (o: ShouldCacheParams<T>) => boolean | Promise<boolean>;
    extraKeys?: unknown[];
  },
): T;

function withCacheAsync<T extends AnyAsyncFunction>(
  fn: T,
  options?: { /* same shapes, all hooks may be async */ },
): T;
```

Defaults: `cacheStore` = process-wide TTL-backed `ExpiredMap` (from `expired-map`); `generateCacheKey` = `djb2(superjson.stringify({ parameters, function: fn.toString(), extraKeys }))` — an unsigned 32-bit integer; `shouldCache` = always allow. Custom key factories may return a `string` or a `number`.

Also exported (types): `Key`, `CacheStore<T>`, `Options<T>`, `CacheKeyParams<T>`, and `ShouldCacheParams<T>` — `import type { ... } from "jutilities/cache"` to annotate custom stores and hooks against the exact contract.

### Behavior contract

- Hits are detected with `!isEmpty(cached)` — values that are nil / `""` / `[]` / `{}`
  are **never treated as hits and never stored**; such results always recompute.
- Sync wrapper: no in-flight dedup — throws and empty results simply recompute on
  the next sequential call.
- Async wrapper: concurrent calls with the same key **share one in-flight promise**;
  a slow upstream is executed at most once per key at a time. Rejections are never
  cached and clear the in-flight entry, so the next call retries from scratch.
- `this` is forwarded on every call but is **not** part of the cache identity.
- Throwing inside `generateCacheKey` or `shouldCache` propagates and prevents the
  call from being cached.
- Store hooks may be async in the async wrapper (the `MaybePromise` return types).
- `skipHof` — bypasses the store entirely (no read, no write).

### Quirks

- The default keygen hashes a `superjson` serialization with `djb2` (unsigned
  32-bit): object-argument keys stay **order-sensitive** (`{a:1,b:2}` ≠
  `{b:2,a:1}` — keyed by serialization order), and the finite 32-bit space
  means distinct inputs can theoretically collide; pass a custom
  `generateCacheKey` when strict identity matters.
- `superjson` (vs. the old bare-`JSON.stringify` default) serializes types JSON
  collapses or rejects: `NaN` no longer becomes the same key as `null`,
  `Map`/`Set` no longer stringify to `{}`, and `BigInt` arguments no longer
  throw under the default keygen.
- Two different functions with *byte-identical source text* share cache identity —
  inline duplicate helpers can cross-pollinate entries; pass `generateCacheKey` or
  distinct sources to avoid it.
- The store receives whatever the wrapped function returns: an object hit is the
 **same reference**, so mutating a cached object mutates the cache entry.

### Use cases

1. **Per-tenant memoization** — pass `extraKeys: [tenantId]` so two tenants never
   see each other's entries under the same argument set.
2. **Collapsing read amplification** — wrap a goroutine-style loader with
   `withCacheAsync` so N concurrent identical requests produce one network call.
3. **Redis / custom LRU** — plug any `{ get, set, delete }` object; async hooks
   (e.g. IORedis round-trips) are supported in `withCacheAsync`.
4. **Skip caching failure-shaped results** — `shouldCache: ({ result }) =>
   result.ok` stores only successful payloads.

### Composition

```ts
const cachedSend = withCacheAsync(
  withRetryAsync(sendEmail, { onError: backoff }), // retries inside each cache miss
  { extraKeys: [campaignId] },
);
```

Wrap order matters: put the cache **outside** the retry — retries then stay
invisible to the cache (one miss = one retry tour) and rejections are never
cached.

---

## retry

```ts
import { withRetryAsync, withRetrySync } from "jutilities/retry";

function withRetryAsync<T extends AnyAsyncFunction>(
  fn: T,
  options?: {
    onError?: (o: {
      parameters: Parameters<T>; // the call arguments, forwarded verbatim
      startRetryExecution: number; // performance.now (Node) — retry-loop start
      totalRetryExecution: number; // elapsed since startRetryExecution
      startFnExecution: number; // per attempt start
      endFnExecution: number; // per attempt end
      retries: number; // attempt index, starting at 0
      error: unknown; // whatever the attempt threw (not always Error)
    }) => void | Promise<void>;
    skipHof?: false | ((...args: Parameters<T>) => boolean | Promise<boolean>); // shared bypass
  },
): T;

function withRetrySync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  options?: {
    onError?: (o: /* same context, sync */) => void;
    skipHof?: false | ((...args: Parameters<T>) => boolean);
  },
): T;
```

Default `onError`: throw when `retries >= 10` (i.e. at most **11 attempts** — the
policy throws on the 11th failure) or when the retry tour has taken
`>= 60_000` ms **cumulative**. The default policy also backs off on its own,
sleeping an exponential, jittered `2^retries * last-attempt-duration` between
attempts.

### Behavior contract

- `options.onError` runs **after every failed attempt** — return (nothing) to
  retry, **throw to stop** (that thrown value replaces the original error and is
  the rejection value).
- A custom `onError` replaces the default policy (backoff included) entirely —
  sleeps then belong inside `onError` (combine with [sleep](#sleep)).
- Non-`Error` thrown values (strings, objects, DOMExceptions) are forwarded
  untouched into `error`.
- Timings are per-attempt (`endFnExecution - startFnExecution`) measuring the
  failing attempt's own duration, not the total elapsed time; the tour-wide
  clock is `totalRetryExecution` (started at `startRetryExecution`).

### Use cases

1. **Backoff** — built into the default policy (see defaults above); custom
   pacing goes inside `onError`.
2. **Bounded retries for job queues** — `if (retries >= 5) throw error;` so the
   queue framework sees a clean failure after 6 attempts.
3. **Slow-call circuit break** — the default 60 s ceiling turns an infinite hang
   into a normal failure after **one** attempt.
4. **String-error tolerance** — modules throwing non-Error values are retried
   exactly like real exceptions.

### Composition

```ts
const resilientFetch = withCacheAsync(
  withRetryAsync(withTimeoutAsync(fetchJson, { timeoutMs: 5_000 })),
);
```

Here the timeout makes each attempt bounded; retries orchestrate new attempts;
the cache dedups in-flight identical requests at the outer layer.

---

## timeout

```ts
import { withTimeoutAsync } from "jutilities/timeout";

function withTimeoutAsync<T extends AnyAsyncFunction>(
  fn: T,
  options?: { signal?: AbortSignal; timeoutMs?: number }, // timeoutMs default 0
): T;
```

### Behavior contract

- Unwrap shortcut: with **no signal** and `timeoutMs <= 0` (or options omitted),
  the original `fn` reference is returned — zero overhead.
- Wrapping happens whenever a signal exists, even with `timeoutMs: 0` (signal-only
  mode: reject as soon as the signal aborts, no wall-clock deadline).
- **The rejection value is always `signal?.reason`.** This includes the
  wall-clock timeout path when a signal is present (default: `AbortError`).
- Losing the race does **not** stop the underlying work — the caller's promise
  settles first and the wrapped call runs to its own completion.
- Concurrent calls **share the signal**: one abort rejects all in-flight calls.
- `timeoutMs: NaN` wraps the function but the deadline effectively never fires
  (`NaN > 0` is false skips the fast path; the test locks resolution behavior).
- A sync-throwing wrapped fn propagates **synchronously** and (with
  `timeoutMs > 0`) may leak the internal timer — see the test's "signal-only"
  workaround.
- `skipHof` — the deadline race never starts (a slow raw call resolves on its
  own).

### Use cases

1. **Request deadlines** — `withTimeoutAsync(doFetch, { timeoutMs: 2500 })`.
2. **Cooperative shutdown** — keep a lifespan `AbortController`; pass its signal
   so all workers reject together with meaningful reasons (`"draining"`).
3. **Hedged calls** — race two mirrors by giving each a timeout and taking the
   first fulfilled promise yourself.

### Composition

```ts
const guarded = withTimeoutAsync(
  withDelayAsync(handler, { delay: 50 }),
  { signal: lifespan.signal, timeoutMs: 10_000 },
);
```

Place the timeout **outermost** so the delay also counts against the budget.

---

## delay

```ts
import { withDelayAsync, withDelaySync } from "jutilities/delay";

function withDelayAsync<T extends AnyAsyncFunction>(
  fn: T,
  options?: { signal?: AbortSignal; delay?: number },
): T; // the factory itself is synchronous

function withDelaySync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  options?: { signal?: AbortSignal; delay?: number },
): T;
```

### Behavior contract

- `delay <= 0` (including missing options) returns **the original `fn`**
  (identity) — in both sync and async flavors, and the factory returns
  synchronously (there is no `Promise<T>` to await).
- Every invocation sleeps the full `delay` first (per-call, no shared state) and
  then executes; concurrency is unlimited (three calls delayed 20 ms share one
  timer window, as the tests assert).
- Abort semantics: a **pre-aborted signal** prevents the wrapped call
  (never invoked, sync-ish rejection); aborting **mid-delay rejects the wrapped
  call with `signal.reason`** — the sleep window shrinks to the abort point and
  the wrapped function never runs.
- NaN delay: wraps, and the sleep resolves immediately (no meaningful wait).
- Sync variant blocks via a busy-wait (`sleepSync` semantics) — see [sleep](#sleep),
  so mid-loop aborts are not observable there.
- `skipHof` — the pre-call wait never happens.

### Quirks

- The factory is synchronous, but every wrapped call is still async:
  `const wrapped = withDelayAsync(fn, { delay: 100 });` — no `await` on the wrap.

### Use cases

1. **Fixed-rate side effects** — render pushes that must always happen *after* a
   paint tick, `withDelaySync(write, { delay: 16 })`.
2. **Staggered fan-out** — wrap per-shard handlers with slightly different
   delays to smooth load on a downstream system.
3. **Test stabilization** — insert a deterministic 20 ms gap before asserting
   against eventual-consistency writes.

### Composition

```ts
const throttledSave = withDelaySync(withCacheSync(save), { delay: 50 });
```

---

## sleep

```ts
import { sleepAsync, sleepSync } from "jutilities/sleep";

function sleepAsync(options?: { signal?: AbortSignal; sleep?: number }): Promise<void>;
function sleepSync(options?: { signal?: AbortSignal; sleep?: number }): void;
```

### Behavior contract (`sleepAsync`)

- `sleep <= 0` (`0`, negative, `NaN`, missing) resolves **immediately**.
- Pre-aborted signal: throws **synchronously** (`signal.reason`) before any timer
  is created — a sync throw is the only early-exit surface.
- Aborted **mid-sleep**: rejects with `signal.reason` once the abort fires —
  the wait is cut short and the rejection carries the abort reason.
- Natural expiry resolves `undefined`.
- The timer delay is **rounded to whole milliseconds** (`Math.round`): `0.6`
  waits 1 ms, `0.4` waits 0 ms — a rounded-to-zero delay still goes through a
  timer tick (it is not an immediate resolve like `sleep: 0`).

### Behavior contract (`sleepSync`)

- Busy-waits the event loop; a block of ~1 s freezes all I/O.
- Signal awareness is limited: it detects signals that aborted **before** the
  call started (`sleep == 0`-like immediate return of `undefined`), because the
  busy-wait loop cannot observe new abort events mid-loop.
- Runs out of a timer; interrupting mid-loop requires the pre-abort case.

### Use cases

1. **Backoff loops** — `await sleepAsync({ sleep: ms })` between retries.
2. **Polling** — fixed-interval checks with an abortable stop condition.
3. **Sequencing batched writes** — yield to I/O between chunks.
4. **Test determinism** — block briefly in sync test bodies without timers or
   fake clocks.

### Composition

```ts
async function poll(signal: AbortSignal) {
  do {
    const found = await check();
    if (found) return found;
    try {
      await sleepAsync({ sleep: 1_000, signal }); // waits next tick
    } catch (abortReason) {
      return abortReason;                          // aborted → reason surfaced
    }
  } while (true);
}
```

---

## signal

```ts
import { abort } from "jutilities/signal";

function abort(options: { signal?: AbortSignal; onAbort: () => void }): () => void;
```

### Behavior contract

- Registers `onAbort` to fire exactly when the signal aborts.
- No signal present: **no-op registration**; the returned remover is still a
  safe callable.
- Adding to an **already-aborted** signal does **not** fire `onAbort`
  retroactively (native `EventTarget` semantics — use `signal.reason` yourself
  for the historical fact).
- The returned remover is idempotent and safe without a signal.

### Use cases

1. **Scoped cleanup** — keep touches strict: register in `try`, remove in
   `finally`.
2. **Composite lifespans** — couple an internal resource's teardown with a
   parent abort controller.
3. **Test harnesses** — assert that abort triggers side effects exactly once.

---

## lazy

```ts
import { lazy, type LazyOptions } from "jutilities/lazy";

function lazy<T extends AnyFunction>(
  fn: T,
  options?: LazyOptions<T>,
): T;
```

`lazy` is the one wrapper accepting **both sync and async initializers** (the
sync factory's sync-only fn slot is intentionally widened back for it); its
per-call predicate stays plain-sync.

### Behavior contract

- Memoizes results keyed by `djb2(JSON.stringify({ functionString: fn.toString(), args }))`.
- The initializer's **source text** is part of the key — different initializers
  never share entries; `this` is *not* part of the key (a second call with the
  same args but a different receiver reads the first call's value — intentionally
  documented by a test).
- **Falsy results are never cached**: `0`, `""`, `false`, `null`, `undefined`,
  `NaN` recompute every call.
- Promise results are cached until they **reject** — a rejected promise is
  evicted, so the next call retries from scratch.
- `djb2` is 32-bit: distinct argument tuples can theoretically collide.
- The lower-level `withCache*` helpers collapse in-flight calls; `lazy` does not.
- `skipHof` — recomputes fresh (never reads from or writes to the memo store).

### Use cases

1. **Expensive pure computations** — parse/format heavy results by argument.
2. **Retry-on-failure loaders** — failed `fetchConfig()` attempts naturally
   re-run on the next read.
3. **Reality-check memoization** — cheap caches for idempotent counters where
   hits must not disturb side effects (`this`-ignoring semantics).

### Composition

```ts
const getRegion = lazy((ip: string) => geoLookup(ip));
const memoGetRegion = withCacheSync(getRegion, { extraKeys: [env.API_VERSION] });
```

---

## logger

```ts
import { withLoggerAsync, withLoggerSync } from "jutilities/logger";

type CallableLogger = { debug: (...args: any[]) => void; error: (...args: any[]) => void };

function withLoggerSync<T extends AnyFunction>(fn: AnySyncFunction<T>, options?: { name?: string; logger?: CallableLogger }): T;
function withLoggerAsync<T extends AnyAsyncFunction>(fn: T, options?: { name?: string; logger?: CallableLogger }): T;
```

### Behavior contract

- **Split API** (mirrors `withCache*`): sync functions go through
  `withLoggerSync`, declared-`async` functions through `withLoggerAsync` —
  type-gated, no runtime promise sniffing.
- Two `logger.debug` lines per success (both variants): output goes through
  the injectable `options.logger` sink (defaults to `console`), and each line
  carries a `new Date()` timestamp prefix. Per call:
  `` `[timestamp] [Function <name>] Execution, Args:` `` + the spread args,
  then `` `[timestamp] [Function <name>] Execution <ms>ms, Result:` `` + the
  (awaited) result.
- Timing uses `performance.now` in Node; `Date.now` wherever a global `window`
  exists (browser branch, *intentionally* mirrored by `withCache*`/`withDelay*`).
- Anonymous or trimmed-name functions log as `anonymous`.
- Sync throw: the invocation line is logged, the result line is not; failures
  (sync throw and async rejection) are additionally emitted through
  `logger.error` and then rethrown.
- Async functions: the awaited **resolved value** is logged (and the duration
  spans the whole await).
- Non-`Promise` thenable returned by a SYNC function takes the sync path —
  the thenable object itself is logged as the result.
- `skipHof` — nothing is logged.

### Use cases

1. **Dev tracing** — wrap any layer boundary to see args + awaited values.
2. **Timing harnesses** — compare wrapped sync vs async durations with
   `performance.now` under Node.
3. **Name-driven log filtering** — pass stable labels (`"stripe:charge"`) and
   grep your console logs.

### Composition

```ts
const traced = withLoggerAsync(withRetryAsync(send), { name: "queue:send" });
```

---

## json (`Json`, `superjson`)

```ts
import { Json, superjson } from "jutilities/json";

class Json {
  addHandler<TA, TS>(type: string, handler: {
    isApplicable: (key: string, value: any) => value is TA;
    stringify: (key: string, value: TA) => TS;
    parse: (key: string, value: TS) => TA;
  }): this;
  removeHandler(type: string): this;
  stringify<T>(value: T, replacer?, space?): string /* JsonStringified<T> */;
  parse<T = unknown>(text: string, reviver?): T;
}

export const superjson: Json; // all built-in handlers pre-registered
```

Envelope format: every handler match becomes `{ __type: "<key>", value: <payload> }`.

### Built-in handler coverage (in `superjson` registration order)

`undefined` · non-finite numbers & `-0` · `bigint` · globally-registered symbols
(`Symbol.for` only) · boxed `Number`/`String`/`Boolean` · invalid `Date`s ·
`Date` · `Map` · `Set` · `Buffer` (Node only, guarded by the `window` check) ·
typed arrays (10 ctors) · `DataView` · `ArrayBuffer` · `Error` · `RegExp` ·
`URL` · `URLSearchParams` · `Headers`.

**First match wins** — `addHandler` replaces an entry *in place* (Map insertion
order is kept, but a later `stringify` sees the replaced handler).

### Behavior contract

- `stringify` matches handlers against the **raw (pre-`toJSON`)** value — so
  `Date` produces an envelope instead of its native ISO string when a date
  handler is registered; unclaimed values fall through to your `replacer`.
- `parse` calls the user `reviver` only for **non-envelope** values (envelope
  children included) — never for the envelope value itself.
- Keys whose parsed value is `undefined` are restored after parse (the reviver
  protocol would delete them), so `undefined` round-trips end-to-end.
- Error payloads keep `name`, `message`, `stack`, `cause` and **own enumerable
  props**; subclasses of `Error` are rebuilt as plain `Error` (aggregate error
  detail lives in non-enumerable fields and is dropped).
- Symbols round-trip only when created via `Symbol.for` (global registry).
- `Json.parse` also accepts output of *native* `JSON.stringify` — envelopes are
  simply absent, so plain JSON flows through untouched.
- Return values are branded: `stringify` yields `JsonStringified<T>`,
  a compile-time proof of what it serializes.
- The handler registry is **internal**: `Json` exposes `addHandler` /
  `removeHandler` only — the map itself is not part of the public surface.
- Invalid-date detection is strict: the `invaliddate` handler claims a `Date`
  only when `Number.isNaN(v.getTime())` — no coercion.

### Quirks

- **Shared Buffer pool**: parsed typed-array / `DataView` / `ArrayBuffer` views
  may cover a buffer slice of Node's shared pool; the surrounding bytes
  (neighbors from other allocations) can be reachable — treat parsed views as
  opaque and pass only their payload forward.
- `SharedArrayBuffer` is deliberately *not* handled.
- **`__type` collision risk**: a payload object that coincidentally has
  `{ __type: "map", value: ... }` at the same position parse into an envelope —
  pick a unique handler namespace for custom types.
- Native `JSON`'s circular-structure and duplicate-key rules apply unchanged.

### Use cases

1. **Durable cache payloads** — cache the stringified form (with `withCache*`
   and a Redis store) and `parse` on the way out; Maps and bigints survive.
2. **Structured error reporting** — ship `Error` instances with causes through
   your logging pipeline without custom serializers.
3. **Typed IPC boundaries** — narrow the surface by building `new Json()` with
   only the handlers your protocol needs.
4. **Snapshot fixtures** — human-readable JSON with type envelopes —

### Composition

```ts
const sessionCache = withCacheAsync(processState, {
  cacheStore: redisAdapter, // store stringified superjson payloads
});
```

---

## node-stream

```ts
import {
  tee, stream2buffer, buffer2stream, streamSizeTransform, streamSize,
} from "jutilities/node-stream";

function tee(o: { source: Readable; signal?: AbortSignal }): [PassThrough, PassThrough];

function stream2buffer(readable: Readable, o?: { signal?: AbortSignal }): Promise<Buffer>;

function buffer2stream(buffer: Buffer, o?: { signal?: AbortSignal; chunkSize?: number }): Readable;

function streamSizeTransform(o: {
  signal?: AbortSignal;
  onSize: (r: { size: number; done: boolean }) => void;
}): Transform;

function streamSize(readable: Readable, o: {
  signal?: AbortSignal;
  onSize: (r: { size: number; done: boolean }) => void;
}): AsyncGenerator;
```

### `tee` contract

- Two independent `PassThrough` branches; every source chunk lands in both.
- **Backpressure in both directions**: when *either* branch is full the source is
  paused; resumed only when *neither* needs draining.
- Source `end` → both branches end; source `error` → both destroyed.
- Destroying one branch leaves the other healthy and flowing.
- Pre-aborted signal: synchronous throw (`signal.reason`); aborting mid-flight
  destroys both branches via their internal signal wiring.
- Branch high-water marks & object modes copy from the source.

### `stream2buffer` contract

- Concatenates everything into one `Buffer`; empty streams yield an empty Buffer.
- Non-Buffer chunks (strings, Uint8Array) are converted per chunk.
- The signal is checked up-front **and per chunk**, so mid-stream abort rejects
  with `signal.reason`.
- Never rejects for stream contents — only aborts and underlying stream errors
  propagate.

### `buffer2stream` contract

- Emits zero-copy `subarray` views of `chunkSize` (default 16 KiB); writing to a
  chunk mutates the source buffer.
- Empty buffer → an immediately-ending stream.
- Pre-aborted signal: synchronous throw.

### `streamSizeTransform` / `streamSize` contract

- Both report cumulative byte counts via `onSize`:
  `{ size, done: false }` after each chunk, `{ size, done: true }` on completion
  (Transform: at flush).
- `streamSizeTransform` is a pipeline stage — data passes through unchanged.
- `streamSize` is an async generator to iterate directly; the signal is checked
  per chunk, so aborting mid-iteration throws `signal.reason` and the final
  `done: true` report never fires (same skip on underlying stream errors).
- String chunks are counted by their encoded length.

### Use cases

1. **Duplicate a download to memory *and* disk in one read** (`tee`).
2. **Upload-size guardrails** — count with `streamSize` and abort over quota.
3. **Stream a prepared buffer with backpressure** (`buffer2stream`).
4. **Byte-accurate telemetry** — report real uploaded bytes per request.

### Composition

```ts
const [persisted, counter] = tee({ source: read, signal: cts.signal });
void pipeline(persisted, diskWrite);
for await (const chunk of streamSize(counter, { onSize: report })) void chunk;
```

---

## hash

```ts
import { djb2, sdbm, fnv1a64 } from "jutilities/hash";

function djb2(string: string, hash?: number): number;  // uint32, seed 5381
function sdbm(string: string, hash?: number): number;  // uint32
function fnv1a64(string: string): bigint;              // FNV-1a 64, BigInt-safe
```

### Behavior contract

- Non-cryptographic by design: predictable and collision-prone; never use for
  security boundaries.
- 32-bit variants finalize to unsigned integers (always non-negative).
- `djb2`/`sdbm` accept a starting seed so you can hash-reduce streams of inputs
  (e.g. domain-separated keys: `djb2(str2, djb2(str1))`).
- `fnv1a64` is FNV-1a-*style* with BigInt arithmetic and **no 2⁶⁴ mask** —
  deterministic and collision-averse, but results grow past 64 bits for longer
  inputs and it is not wire-compatible with canonical FNV-1a.

### Use cases

1. **Cache key fingerprints** — hash normalized payloads (seeded per namespace).
2. **Sharding** — `sdbm(id) % shardCount` for stable distribution.
3. **Weak content fingerprints** — detect identical small documents cheaply.

### Composition

```ts
const key = `user:${djb2(JSON.stringify(payload))}`;
```

---

## is

```ts
import {
  isUndefined, isNull, isNil, isEmptyString, isEmptyArray,
  isObject, isRecord, isEmptyRecord, isEmpty,
  isThenable, isPromise,
  isAsyncFunction, isGeneratorFunction, isAsyncGeneratorFunction,
  isDecorationContext, isRawMemberApplication,
} from "jutilities/is";
```

### Behavior contract — the exact rules

| Guard | Returns `true` for | Returns `false` for (notable) |
| --- | --- | --- |
| `isUndefined` | `undefined`, `void 0` | missing keys are *not read* (guards take a value) |
| `isNull` | `null` | `undefined` |
| `isNil` | `null`, `undefined` | everything else |
| `isEmptyString` | `""` (string *primitive*) | boxed `new String("")` |
| `isEmptyArray` | real empty arrays | array-likes, non-arrays, `null` |
| `isObject` | any non-null object (including arrays & class instances) | functions (typeof `"function"`), primitives |
| `isRecord` | non-array objects | arrays (explicitly excluded), functions |
| `isEmptyRecord` | records with zero `Object.keys` | objects with only *symbol* keys count as empty |
| `isEmpty` | nil ∪ `""` ∪ `[]` ∪ keyless records | `0`, `false`, `NaN` are **not** empty; keyless objects like `new Date()` **are** |
| `isThenable` | callable `then` property | a *throwing* `then` getter propagates the throw |
| `isPromise` | native `Promise`, or thenable with `catch` **and** `finally` | thenables missing either method |
| `isAsyncFunction` | declared with `async` (constructor name) | transpiled/minified sources that lower async functions |
| `isGeneratorFunction` | `function*` declarations | — |
| `isAsyncGeneratorFunction` | `async function*` declarations | — |
| `isDecorationContext` | objects exposing a string `kind` slot (Stage 3 decorator contexts) | content beyond `kind` is not validated |
| `isRawMemberApplication` | raw `(member, context)` pairs handed to a decorator factory | option bags / callback rests cannot mimic both stripes (length must be 2, leading function, context-shaped second slot) |

### Use cases

1. **Safe result shaping** — `isEmpty(res)` before `const [first] = res`.
2. **Promise handling without `await` side effects** — branch on `isPromise(x)`
   where `typeof x.then === "function"` would be too permissive.
3. **Validation of param payloads** — `isRecord(body)` inside HTTP handlers.

### Composition

```ts
if (isObject(raw) && isRecord(raw)) cacheableEnvelope(raw);
```

---

## assert

```ts
import {
  assert, assertNotNil, assertNever,
  withAssertSync, withAssertAsync,
  assertNotRawApplication, assertNotRawMemberApplication, assertGuardConsistency,
} from "jutilities/assert";

function withAssertSync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  options: {
    onResult: (o: { parameters: Parameters<T>; result: ReturnType<T> }) => void;
    skipHof?: false | ((...args: Parameters<T>) => boolean); // shared bypass
  },
): T;

function withAssertAsync<T extends AnyAsyncFunction>(
  fn: T,
  options: {
    onResult: (o: {
      parameters: Parameters<T>;
      result: Awaited<ReturnType<T>>;
    }) => void | Promise<void>;
    skipHof?: false | ((...args: Parameters<T>) => boolean | Promise<boolean>); // shared bypass
  },
): T;
```

Throw-first counterparts of the `is` guards: all six throw `TypeError`
immediately with a readable message instead of corrupting downstream state.
The `withAssert*` wrappers never throw on their own — they gate a wrapped
call's result on a caller-provided `onResult` validator (usually one of the
guards above) before it escapes. `onResult` is **required** in practice: a
bare `withAssert*(fn)` still compiles (the factory's `= {}` default) but
throws on every call.

### Behavior contract

- `assert(condition, message?, name?)` — throws for **every** falsy value
  (`false`, `0`, `""`, `null`, `undefined`, `NaN`); emptiness checks belong to
  `isEmpty`, truthiness here. `name` prefixes `` `${name}: ${message}` `` so
  subsystems can sign their violations. Signature: `asserts condition`.
- `assertNotNil(value, name = "value")` — throws only on `null`/`undefined`;
  falsy-but-not-nil values (`0`, `""`, `false`, `NaN`) pass. Signature:
  `asserts value is NonNullable<T>`.
- `assertNever(value, message = "Non-exhaustive value reached")` — call on a
  `never`-typed leftover (e.g. a discriminated-union `switch`'s `default`) so
  adding a case without handling it fails at compile time, and impossible
  leftovers fail loudly here. The message carries a rendered preview:
  `JSON.stringify`, falling back to `String(value)`, then `typeof` when both
  throw. Returns `never` — always throws.
- `assertNotRawApplication`, `assertNotRawMemberApplication`,
  `assertGuardConsistency` — the decorator guards: paren-less factory
  applications and `require: "sync" | "async"` mismatches throw a `TypeError`
  naming the converter/member (shapes and messages in
  [decorators](#decorators)).
- `withAssertSync(fn, { onResult })` — every call's result is checked by
  `onResult` over `parameters` and `result` before it is returned. Throwing
  inside `onResult` surfaces that error instead — the invalid result never
  escapes.
- `withAssertAsync(fn, { onResult })` — the same gate for async functions: the
  awaited result is checked after the call resolves, and the validator may be
  sync or async (its return is awaited before the checked result is returned).
  Wrapped rejections propagate untouched — the validator is never invoked for
  a rejected call.
- `skipHof` — the result escapes unchecked.

### Use cases

1. **Early bailout at boundaries** — `assertNotNil(env.DATABASE_URL, "config")`
   before building the pool.
2. **Compile-time exhaustiveness** — `switch` over a union kind with
   `default: return assertNever(kind)`.
3. **Readable decorator misfires** — all four `decorators/<kind>` converters
   route paren-less applications and guard violations through the decorator
   trio above instead of corrupting members silently.
4. **Result-shape guarantees** — `withAssertAsync(loadUser, { onResult: ({
   result }) => assertNotNil(result, "user") })` turns a silent `null` into a
   readable, named failure at the boundary instead of propagating an
   unvalidated result.

---

## to

```ts
import { toArray, toBase64 } from "jutilities/to";

function toArray<T>(value: T | T[]): T[];
function toBase64(bytes: Uint8Array): string;
```

### `toArray` contract

- Arrays and array subclasses: returned **by reference** (no flattening, no
  copy).
- Everything else — including `null`/`undefined` and falsy values — becomes
  `[value]`.

### `toBase64` contract

- Node: `Buffer.toString("base64")` over the input's viewed slice.
- Browsers: byte-by-byte binary string `btoa`.
- Encodes the **viewed region** only for views (`subarray` windows honored).
- Empty input → `""`.
- Non-cryptographic, no validation — assumes a valid `Uint8Array`.

### Use cases

1. **Normalize API inputs** — `toArray(filterOrFilters).map(validate)`.
2. **Canonical hashing** — `djb2(toBase64(bytes))` for binary keys.
3. **Binary-safe JSON transport** (browsers) without Buffer's node-only fields.

---

## from

```ts
import { fromBase64 } from "jutilities/from";

function fromBase64(b64: string): Buffer | Uint8Array;
```

### Behavior contract

- Node: `Buffer.from(b64, "base64")` — **lenient**; invalid characters are
  skipped, no throw. The returned buffer is a pooled view: treat only the
  decoded slice as meaningful.
- Browsers: `atob` is **strict** — invalid input throws.
- Empty string yields an empty result in both branches.

### Use cases

1. **Decoding wire payloads** straight into Node processing.
2. **Round-trip superjson's binary envelopes** (typed arrays) via
   `toBase64`/`fromBase64` pairs.
3. **Lenient migration filtering** — tolerate legacy base64 with whitespace.

---

## types

```ts
import {
  AnyFunction, AnyAsyncFunction, AnySyncFunction,
  AnyGeneratorFunction, AnyAsyncGeneratorFunction,
  HandleAsyncFunction, MaybePromise, Prettier, StrictOmit,
} from "jutilities/types/type";
import { WithSignal } from "jutilities/types/with";
```

- `AnyFunction` — any callable (sync or async, generator or not).
- `AnyAsyncFunction` — callables producing a promise.
- `AnySyncFunction<T>` — anything whose return type is **not** a promise or
  generator; the guard rails behind `withCacheSync`/`withRetrySync`.
- `HandleAsyncFunction<T, TTrue, TFalse>` — picks `TTrue` when `T` returns a
  promise and `TFalse` otherwise: the hook return types in
  [cache](#cache) / [retry](#retry) / [assert](#assert) (`MaybePromise<…>` for
  an async function, the plain value for a sync one).
- `MaybePromise<T>` — `Promise<T> | T` (the store-hook return shapes).
- `Prettier<T>` — flattened, hoverable object type.
- `StrictOmit<T, K>` — `Omit` that rejects typo'd keys.
- `WithSignal<T>` — `{ signal?: AbortSignal } & T`, the package's option-shape
  convention.

### Use cases

1. **Constraining plugin inputs** — accept `AnySyncFunction` when your wrapper
   cannot race promises.
2. **Option-shape reuse** — `{ signal?: AbortSignal } & T` everywhere your API
   takes an AbortSignal.
3. **Ergonomic monorepo types** — `MaybePromise` for adapter boundaries that may
   or may not await.

---

## decorators

```ts
import { decorateMethod } from "jutilities/decorators/method";
import { decorateClass } from "jutilities/decorators/class";
import { decorateProperty } from "jutilities/decorators/property";
import { decorateGetter } from "jutilities/decorators/getter";
```

Four converters that turn any fn-first HOF from this package (`withCacheSync`,
`withRetryAsync`, `withLoggerSync`, `withLoggerAsync`, `lazy`,
`withDelayAsync`, …) into a reusable
**Stage 3 decorator factory** — one per member kind:

| Converter | Decorates | Enhancement moment | Scope of HOF state |
| --- | --- | --- | --- |
| `decorateMethod` | prototype methods (incl. `async`) | class definition | per method |
| `decorateClass` | every **own prototype method** at once | class definition | per method |
| `decorateProperty` | function-valued fields | field initialization | per instance |
| `decorateGetter` | getters | class definition | prototype-wide |

### Behavior contract

- **The conversion contract.** A converter takes `hof` (whose first parameter
  is the wrapped function) and returns a decorator factory. Everything after
  the first HOF parameter is an *option slot* declared once at decorate time
  and forwarded verbatim: `(value, context) => hof(value, ...rest)`.
- **The recommended usage grammar.** Hoist the factory to a const, then apply
  it with a single options call per member. A HOF with zero extra parameters
  still needs the empty call `@f()`:

  ```ts
  const cached = decorateMethod(withCacheSync);   // hoist once
  const logged = decorateMethod(withLoggerSync);  // zero-rest HOF
  class Repo {
    @cached({ cacheStore: store, extraKeys: ["repo"] })
    load(id: string) { return id; }

    @logged()                                     // zero-rest HOF: empty call
    ping() { return "pong"; }
  }
  ```

- **Decorate-time guards.** Passing `{ require: "sync" }` (or `"async"`) to the
  converter asserts the member's async-ness at decoration time and throws a
  `TypeError` on mismatch:
  - `decorateMethod: member "m" is an async function, but require: "sync" was requested`
  - `decorateMethod: member "m" is not an async function, but require: "async" was requested`
  (the converter name and member name vary per kind).
- **Where the guard fires.** `decorateMethod`, `decorateGetter` (and
  `decorateClass` via its pair slots) assert when the class is *defined*;
  `decorateProperty` asserts when the field is *initialized*
  (i.e. construction), because field values only exist then.
- **Type-layer discipline.** For converters typed against a precise HOF
  (`withCacheSync`, `withLoggerSync`), a member whose declared sync/async-ness
  contradicts the HOF's slot is a compile error — the runtime `require` guard
  mostly protects loose HOFs and transpiled code where declared `async` is
  invisible to types.
- **Runtime misfire protection.** Where they *can* occur, both paren-less
  shapes throw a `TypeError` naming the converter: the factory called with a
  raw `(member, context)` rest (pinned for all four kinds), and the converter
  called with `(hof, context)` (property/getter converters run that assert
  inside the returned factory).
- **Class fan-out specifics.**
  - Only *own prototype methods* are wrapped: the constructor, static
    members, getters/setters, and non-function prototype members are left
    untouched (pinned).
  - Either a single HOF (every method through it; `pick` is ignored) or a
    `{ sync?: hof, async?: hof }` pair resolved per method.
  - `pick`: `"detect"` (default; uses `isAsyncFunction` per member),
    `"sync"`, or `"async"` (forces every member through one slot; the
    enhancer's own sync/async capability is not checked).
  - A missing slot fails fast at decorate time naming the member and slot:
    `"hop" needs a async enhancer`.
  - Options are declared once for the whole class and forwarded to every
    method; memoizing caches keyed by fn source + args keep methods separate,
    but the store is shared and entries are prototype-wide (a second instance
    hits the first instance's cached entry).
- **Property specifics.**
  - The HOF runs **once per instance**, at field initialization: each
    instance receives a freshly enhanced function (`a.add !== b.add`) and
    arrow-function fields keep their lexical `this`.
  - A field whose initial value is not a function throws at construction:
    `decorateProperty: field "f" must be a function-value initializer, got string`.
- **Getter specifics.**
  - The access function is wrapped once at class definition; every access is
    `hof`-wrapped with the instance as `this`.
  - Caching a getter memoizes **prototype-wide** (all instances share the
    entry).
  - Setters are untouched: an accessor pair keeps its original setter while
    only the getter side goes through the HOF.
  - Getters are always sync — `require: "async"` always throws at decorate
    time; `require: "sync"` is safe.

### Usage grammar (probe-verified)

| Shape | Verdict |
| --- | --- |
| `const f = conv(hof)` hoisted + `@f(...opts)` | ✅ the pattern |
| zero-rest HOF: `@f()` (empty call) | ✅ required — bare `@f` misfires |
| inline `(f(h)(opts))` with surrounding parens | ✅ compiles (discouraged) |
| inline `@f(h)(opts)` without parens | 🚫 **parse error** (TS1497) — nothing suppresses it |
| paren-less `@f(...)` bare application, zero-rest | 🚫 type-rejected (TS1241/TS1270) |
| paren-less `@f` with option-rest HOF, on method/class/getter | 🚫 type-rejected **and** runtime `TypeError` |
| paren-less `@f` on a **field** | 🚫 type-rejected but runtime-silent — fields hand `undefined`, not the member, so the fingerprint cannot see it; hence the compile pin |

### Quirks

- `@ts-expect-error` cannot suppress the no-parens chained shape — it is a
  *parse* error; nothing but structural avoidance (hoisting or parenthesizing)
  works.
- `withCacheSync` forced onto a declared-`async` member (class
  `pick: "sync"`) does **not** memoize: promises count as "empty" under
  `isEmpty` (an object without own keys), so every call recomputes. Use the
  async slot (`withCacheAsync`) for async members.
- Async detection uses `fn.constructor.name === "AsyncFunction"` (the native
  identity). It survives esbuild/tsx and native Node, but transpilers that
  *lower* `async` functions into plain functions returning promises (legacy
  decorator transforms, some downlevel-async presets) defeat it. In such
  toolchains, declare intent explicitly: `pick: "sync"` / `"async"` or
  `require: "sync"` / `"async"`.
- Guard failures are `TypeError`s at decorate (or construction) time, not
  silent no-ops: a wrong slot never silently wraps.

### Use cases

1. **Repository-wide memoization** — `decorateClass(withCacheSync)` + one
   shared `cacheStore`: every own method memoizes per args; constructor and
   accessors stay hot.
2. **Whole-class tracing** — `decorateClass({ sync: withLoggerSync,
   async: withLoggerAsync })` with a captured console: one invocation line
   per method without touching bodies.
3. **Injected strategies as fields** — `decorateProperty(withCacheSync)` on
   closure/strategy fields keeps per-instance enhancements and lexical
   `this`.
4. **Heavy computed reports** — `decorateGetter(lazy)()` memoizes expensive
   getters prototype-wide; `@cached` getters key by the getter source.
5. **Sync/async discipline in mixed codebases** — the `require` guard plus
   `EnhancerPair` keeps declared-async methods on async-only HOFs
   (`withRetryAsync`) and sync methods on sync-only ones (`withCacheSync`),
   failing at decorate time instead of first call.

### Composition

```ts
// Hand-composed stacks convert exactly like single HOFs — the decorator
// pattern is orthogonal to wrapper stacking:
const resilient = (fn: AnyFunction) => withCacheAsync(withRetryAsync(fn));
const cachedResilient = decorateMethod(resilient);

class Service {
  @cachedResilient({ extraKeys: ["svc"] })   // rest goes to the OUTER HOF
  async load(id: string) { return id; }
}
```

Guidelines:

- The converter forwards its rest options to whatever HOF you hand it — when
  composing a stack, configure *inner* layers inline (or via closures) and
  pass only the outermost layer's options to the annotation call.

---

## create-hof (fn-first HOF factory)

```ts
import {
  createHofSync, createHofAsync,
  type HofKind, type ApplyKind, type WithSkipHof,
} from "jutilities/libs/create-hof";

interface MyKind<T extends AnyFunction> extends HofKind<T> {
  options: {
    myHook?: (o: { parameters: Parameters<this["fn"]> }) => void;
  };
}

export const withMineSync = createHofSync<MyKind>((fn, { myHook } = {}) => {
  /* build the enhanced function once here; return it as MyKind["fn"] */
  return enhanced as MyKind["fn"];
});
export type MySyncKind = MyKind<AnySyncFunction>;
export type MyAsyncKind = MyKind<AnyAsyncFunction>;
```

The engine every fn-first HOF in this package is built on — each wrapper is a
single `createHofSync`/`createHofAsync` call with an inline handler, which is
what makes them all share one shape: fn-first parameter, one options object,
`typeof fn` return, built-in `skipHof` bypass.

### Behavior contract

- **Handler runs exactly once per wrap.** It receives `(fn, options)` and
  returns the enhanced function. All wrap-time state (memo stores, timers,
  prepared labels) lives in the handler's closure — never built per call.
- **Handler typing vs. wrapper typing.** The handler is typed against the
  *declared kind*, not the concrete `TF` of a wrap; the wrapper re-types both
  slots per `TF`. Declaring options through `this["fn"]` keeps
  `Parameters<this["fn"]>` / `ReturnType<this["fn"]>` in sync with whichever
  `TF` callers fix (how `retry`'s `parameters` stays plain `Parameters<T>`).
- **Wrap-time bypass:** `options.skipHof === true` returns `fn` itself and the
  handler never runs — zero wrap-time work, zero dispatch layer.
- **Echo identity:** when the handler's return is `=== fn`, `fn` is returned
  unchanged. Handlers implement their unconditional shortcuts by echoing
  (e.g. `delay <= 0`, no-signal `timeoutMs <= 0`), which also disables the
  per-call dispatch (there is nothing left to enhance or bypass).
- **Dispatch is opt-in per wrap.** The per-call bypass closure exists only
  when a function was passed as `skipHof`; otherwise the wrapper *is* the
  handler's `enhanced` return — exactly the shape of a hand-written wrapper.
- **Predicate dispatch:** the closure passes the call arguments to the
  predicate; truthy → `fn.apply(this, args)` raw, falsy →
  `enhanced.apply(this, args)`. Async wrappers type the predicate's return as
  `MaybePromise<boolean>` and `await` it before deciding; sync wrappers
  evaluate it synchronously.
- **`skipHof` is mixed in, not declared.** `WithSkipHof<Options<T>, T>` adds
  the bypass slot to whatever the kind declares — kinds never spell it out.
- **The `__kind` brand.** Every built HOF carries a type-only `__kind`
  property holding its declared kind. It is never set at runtime, but it lets
  a composer recover the kind from the HOF value — that is how
  [with](#with) types a stack's merged options.

### Quirks

- In a **sync** wrapper a pending Promise returned by the predicate is always
  truthy — every call bypasses. Async predicates belong to `createHofAsync`
  only.
- The predicate is read at **call time** (the dispatch captures `options`
  itself): mutating `options.skipHof` from `false` to a function after
  wrapping switches later calls into bypass territory; `false` → `true` does
  not (that check already ran at wrap time).
- The factory injects an `= {}` default for `options`, so zero-option wraps
  stay possible (`@retried()` decorators) even for HOFs whose declared options
  have required members — those members are still enforced for any passed
  literal.

### Use cases

1. **New HOFs in this package's mold** — declare the kind, write one handler,
   get the `(fn, options)` ergonomics, `typeof fn` return, and `skipHof` for
   free; the decorators then convert your HOF with zero extra work.
2. **Sync/async pair shipping** — declare `MySyncKind = MyKind<AnySyncFunction>`
   / `MyAsyncKind = MyKind<AnyAsyncFunction>` next to the two wrappers so
   decorator converters (`require: "sync"` / `"async"`) can gate on them.

---

## with (stack composition)

```ts
import { withAsync, withSync, type MergeOptions } from "jutilities/libs/with";
import type { HofAsyncFn, HofSyncFn } from "jutilities/libs/create-hof";

function withAsync<const Hs extends readonly HofAsyncFn<any>[]>(
  ...hofs: Hs
): <TF extends AnyAsyncFunction>(
  fn: TF,
  options?: WithSkipHof<MergeOptions<Hs, TF>, TF>,
) => TF;

function withSync<const Hs extends readonly HofSyncFn<any>[]>(
  ...hofs: Hs
): <TF extends AnyFunction>(
  fn: AnySyncFunction<TF>,
  options?: WithSkipHof<MergeOptions<Hs, TF>, TF>,
) => TF;
```

Composes several fn-first HOFs into one wrapper. The **first** HOF is the
**outermost** layer: `withAsync(a, b, c)(fn, o)` is `a(b(c(fn, o), o), o)` —
the same stack you would nest by hand, with the ordering rule stated once.

### Behavior contract

- **Ordering:** the first HOF is the outermost layer, the last one wraps the
  function itself. Layers are built once per wrap (innermost first), never per
  call.
- **One flat options bag:** the composed call takes a single options object
  shared by every layer — each layer reads its own keys (`extraKeys`,
  `onError`, `name`, …) and ignores the rest. `MergeOptions<Hs, TF>` types
  the bag as the intersection of every layer's options, resolved for the
  concrete `TF`.
- **`skipHof` is handled once for the whole stack:** `true` returns `fn`
  untouched (no layer is built at all); a predicate is evaluated **once per
  call** — not once per layer — and a truthy result runs `fn` raw for that
  call. Inner layers never see the slot.
- **Sync and async are separate composers:** `withAsync` takes async HOFs
  (their predicate may be async and is awaited before deciding), `withSync`
  takes sync HOFs and rejects an async function at compile time.
- **A layer's own behavior is untouched:** every layer is a normal fn-first
  HOF, so its own options, defaults, and shortcuts (e.g. `delay <= 0`) keep
  working inside the stack.
- An **empty stack** returns `fn` unchanged.

### Use cases

1. **One wrapper, many layers** — `withAsync(withCacheAsync, withRetryAsync)`
   replaces a hand-written nest and keeps the ordering explicit.
2. **One policy set, reused** — build the stack once and share it across
   modules (`const resilient = withAsync(withRetryAsync, withTimeoutAsync)`).
3. **Uniform bypass** — a single `skipHof` predicate covers the whole stack
   instead of being threaded through every layer.

### Composition

```ts
const resilient = withAsync(withLoggerAsync, withCacheAsync, withRetryAsync);

const send = resilient(sendMail, {
  name: "mail:send",       // logger
  extraKeys: [tenant],     // cache
  onError: backoff,        // retry
});
```

---

## Wrapping-order cheat sheet

```ts
// outermost (does the most generic job) → innermost (owns the task)
withLoggerAsync(                  // trace every layer once
  withCacheAsync(                 // dedup identical payloads
    withRetryAsync(               // heal transient failures
      withTimeoutAsync(doWork, { timeoutMs: 2_000, signal: cts.signal }),
      { onError: backoff },       // own the retry pacing
    ),
    { extraKeys: [tenant] },
  ),
  { name: "worker:doWork" },
);
```

Guidelines:

- Put **timeout inside retry** — each attempt gets its own budget.
- Put **cache outside retry** — in-flight dedup collapses concurrent retries.
- Put **logger outermost** — one line per logical operation, not per attempt.

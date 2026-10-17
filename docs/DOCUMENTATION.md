# jutilities — Module Documentation

Behavior contracts, quirks, use cases, and composition patterns for every module.

Every statement below is pinned by an executable test in `src/*.test.ts` — if this document and the code ever disagree, the test is the source of truth.

**Reading conventions**

- `signal` — every async helper accepts the `WithSignal<T>` shape: `{ signal?: AbortSignal } & T`.
- `this` — all higher-order wrappers forward the receiver and arguments unchanged.
- "resolve(s)" and "reject(s)" refer to the returned promise of a wrapped call.
- Deep imports are the only supported import style: `jutilities/dist/<module>.js`.

---

## Table of contents

1. [cache](#cache) — `withCacheSync`, `withCacheAsync`
2. [retry](#retry) — `withRetryAsync`, `withRetrySync`
3. [timeout](#timeout) — `withTimeoutAsync`
4. [delay](#delay) — `withDelayAsync`, `withDelaySync`
5. [sleep](#sleep) — `sleepAsync`, `sleepSync`
6. [signal](#signal) — `abort`
7. [lazy](#lazy) — `lazy`
8. [logger](#logger) — `withLogger`
9. [json](#json) — `Json`, `superjson`
10. [node-stream](#node-stream) — `tee`, `stream2buffer`, `buffer2stream`, `streamSizeTransform`, `streamSize`
11. [hash](#hash) — `djb2`, `sdbm`, `fnv1a64`
12. [is](#is) — 14 type guards
13. [to](#to) / [from](#from) — `toArray`, `toBase64`, `fromBase64`
14. [types](#types) — shared type utilities

---

## cache

```ts
import { withCacheSync, withCacheAsync } from "jutilities/dist/cache.js";

function withCacheSync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  options?: {
    cacheStore?: CacheStore<T>;                  // get/set/delete object
    generateCacheKey?: (o: CacheKeyParams<T>) => string | Promise<string>;
    shouldCache?: (o: ShouldCacheParams<T>) => boolean | Promise<boolean>;
    extraKeys?: unknown[];
  },
): T;

function withCacheAsync<T extends AnyAsyncFunction>(
  fn: T,
  options?: { /* same shapes, all hooks may be async */ },
): T;
```

Defaults: `cacheStore` = process-wide TTL-backed `ExpiredMap` (from `expired-map`); `generateCacheKey` = `JSON.stringify({ parameters, function: fn.toString(), extraKeys })`; `shouldCache` = always allow.

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

### Quirks

- JSON default keygen makes object-argument keys **key-order sensitive**
  (`{a:1,b:2}` ≠ `{b:2,a:1}` as strings but they hash differently — by design,
  matching native JSON semantics).
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
  withRetryAsync(sendEmail, backoff), // retries inside each cache miss
  { extraKeys: [campaignId] },
);
```

Wrap order matters: caching outside retrying means one cached rejection is never
retried — reversely, caching outside means retries stay invisible to the cache.

---

## retry

```ts
import { withRetryAsync, withRetrySync } from "jutilities/dist/retry.js";

function withRetryAsync<T extends AnyAsyncFunction>(
  fn: T,
  onError?: (o: {
    parameters: Parameters<T>;
    startExecution: number;   // performance.now (Node) — per attempt start
    endExecution: number;     // per attempt end
    retries: number;          // attempt index, starting at 0
    error: unknown;           // whatever the attempt threw (not always Error)
  }) => void | Promise<void>,
): T;

function withRetrySync<T extends AnyFunction>(fn: AnySyncFunction<T>, onError?): T;
```

Default `onError`: throw when `retries >= 3` (i.e. at most **4 attempts**: 0, 1, 2, 3)
or when one execution took `>= 60_000` ms.

### Behavior contract

- `onError` runs **after every failed attempt** — return (nothing) to retry,
  **throw to stop** (that thrown value replaces the original error and is the
  rejection value).
- No built-in backoff: sleeps belong inside `onError` (combine with
  [sleep](#sleep) or `withDelayAsync`-style patterns).
- Non-`Error` thrown values (strings, objects, DOMExceptions) are forwarded
  untouched into `error`.
- `this` is forwarded to every attempt.
- Timings are per-attempt, so `endExecution - startExecution` measures the failing
  attempt's own duration, not the total elapsed time.

### Quirks (locked by tests)

- **`withRetrySync` args-spreading bug**: the implementation is
  `function (this, args: Parameters<T>) { fn.apply(this, args) }`. Consequences:
  `wrapped()` (zero args) works; `wrapped([1,2])` (exactly one array argument)
  passes the array as the *spread list*; any other call shape throws
  `TypeError: CreateListFromArrayLike called on non-object`. The test suite
  documents this until the wrapper is fixed to `(...args)`.

### Use cases

1. **Exponential backoff with jitter** — in `onError`, `await sleepAsync({ sleep: base * 2 ** retries + jitter })` and give up at your own budget.
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
import { withTimeoutAsync } from "jutilities/dist/timeout.js";

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
  just settles first; the boolean `finished` flag in the tests exists to show
  that real work continues to its own completion.
- Concurrent calls **share the signal**: one abort rejects all in-flight calls.
- `timeoutMs: NaN` wraps the function but the deadline effectively never fires
  (`NaN > 0` is false skips the fast path; the test locks resolution behavior).
- A sync-throwing wrapped fn propagates **synchronously** and (with
  `timeoutMs > 0`) may leak the internal timer — see the test's "signal-only"
  workaround.

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
import { withDelayAsync, withDelaySync } from "jutilities/dist/delay.js";

function withDelayAsync<T extends AnyAsyncFunction>(
  fn: T,
  options?: { signal?: AbortSignal; delay?: number },
): Promise<T>;                                            // note: awaited wrap

function withDelaySync<T extends AnyFunction>(
  fn: AnySyncFunction<T>,
  options?: { signal?: AbortSignal; delay?: number },
): T;
```

### Behavior contract

- `delay <= 0` (including missing options) returns **the original `fn`**
  (identity) — in both sync and async flavors.
- Every invocation sleeps the full `delay` first (per-call, no shared state) and
  then executes; concurrency is unlimited (three calls delayed 20 ms share one
  timer window, as the tests assert).
- Abort semantics: a **pre-aborted signal** prevents the wrapped call
  (never invoked); aborting **mid-delay does not cancel the run** — the wrapped
  function still executes after the sleep window (documented + tested).
- NaN delay: wraps, and the sleep resolves immediately (no meaningful wait).
- Sync variant blocks via a busy-wait (`sleepSync` semantics) — see [sleep](#sleep).

### Quirks

- Because wrap is async (`Promise<T>`), don't forget `await`:
  `const wrapped = await withDelayAsync(fn, { delay: 100 })`.
- `delay` is checked with `<= 0`, so `-500` behaves like `0` (fast path).

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
import { sleepAsync, sleepSync } from "jutilities/dist/sleep.js";

function sleepAsync(options?: { signal?: AbortSignal; sleep?: number }): Promise<void>;
function sleepSync(options?: { signal?: AbortSignal; sleep?: number }): void;
```

### Behavior contract (`sleepAsync`)

- `sleep <= 0` (`0`, negative, `NaN`, missing) resolves **immediately**.
- Pre-aborted signal: throws **synchronously** (`signal.reason`) before any timer
  is created — a sync throw is the only early-exit surface.
- Aborted **mid-sleep**: resolves (does *not* reject) with `signal.reason` — treat
  a truthy awaited value as "we woke early because we were asked to stop".
- Natural expiry resolves `undefined`.

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
    const woke = await sleepAsync({ sleep: 1_000, signal }); // waits next tick
    if (woke !== undefined) throw woke;                       // aborted → reason
  } while (true);
}
```

---

## signal

```ts
import { abort } from "jutilities/dist/signal.js";

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
import { lazy } from "jutilities/dist/lazy.js";

function lazy<T extends AnyFunction>(fn: T): T;
```

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
import { withLogger } from "jutilities/dist/logger.js";

function withLogger<T extends AnyFunction>(name: string, fn: T): T;  // explicit
function withLogger<T extends AnyFunction>(fn: T): T;                // infers name
```

### Behavior contract

- Two `console.log` lines per success:
  `[Function <name>] Execution, Args:` + the spread args, then
  `[Function <name>] Execution <ms>ms, Result:` + the (awaited) result.
- Timing uses `performance.now` in Node; `Date.now` wherever a global `window`
  exists (browser branch, *intentionally* mirrored by `withCache*`/`withDelay*`).
- Anonymous or trimmed-name functions log as `unknown`.
- Sync throw: the invocation line is logged, the result line is not.
- Async functions: the awaited **resolved value** is logged (and the duration
  spans the whole await).
- A non-`Promise` thenable takes the sync path — the thenable object itself is
  logged as the result.
- `this` and args are forwarded untouched.

### Use cases

1. **Dev tracing** — wrap any layer boundary to see args + awaited values.
2. **Timing harnesses** — compare wrapped sync vs async durations with
   `performance.now` under Node.
3. **Name-driven log filtering** — pass stable labels (`"stripe:charge"`) and
   grep your console logs.

### Composition

```ts
const traced = withLogger("queue:send", withRetryAsync(send));
```

---

## json (`Json`, `superjson`)

```ts
import { Json, superjson } from "jutilities/dist/json.js";

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
} from "jutilities/dist/node-stream.js";

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
import { djb2, sdbm, fnv1a64 } from "jutilities/dist/hash.js";

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
} from "jutilities/dist/is.js";
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

## to

```ts
import { toArray, toBase64 } from "jutilities/dist/to.js";

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
import { fromBase64 } from "jutilities/dist/from.js";

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
  MaybePromise, Prettier, StrictOmit,
} from "jutilities/dist/types/type.js";
import { WithSignal } from "jutilities/dist/types/with.js";
```

- `AnyFunction` — any callable (sync or async, generator or not).
- `AnyAsyncFunction` — callables producing a promise.
- `AnySyncFunction<T>` — anything whose return type is **not** a promise or
  generator; the guard rails behind `withCacheSync`/`withRetrySync`.
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

## Wrapping-order cheat sheet

```ts
// outermost (does the most generic job) → innermost (owns the task)
withLogger(                       // trace every layer once
  withCacheAsync(                 // dedup identical payloads
    withRetryAsync(               // heal transient failures
      withTimeoutAsync(doWork, { timeoutMs: 2_000, signal: cts.signal }),
      backoff,                    // delays before each retry
    ),
    { extraKeys: [tenant] },
  ),
  "worker:doWork",
);
```

Guidelines:

- Put **timeout inside retry** — each attempt gets its own budget.
- Put **cache outside retry** — in-flight dedup collapses concurrent retries.
- Put **logger outermost** — one line per logical operation, not per attempt.

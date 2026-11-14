# jutilities — auto-generated API reference

One page per module, generated from the JSDoc in the source. Regenerate with
`npm run docs:api` after changing the docs comments — these files must never be edited by hand.

Per-module behavior contracts, quirks, composition patterns and worked use cases live in
[./DOCUMENTATION.md](./DOCUMENTATION.md) instead; the exports below are the complete public surface.

## Modules

- [jutilities/assert](./assert.md) — Fail-fast invariants: violated preconditions throw immediately with a readable message instead of corrupting downstream state.
- [jutilities/cache](./cache.md) — The process-wide `ExpiredMap` singleton backing every cache wrapper in this module.
- [jutilities/decorators/class](./decorators/class.md) — Class-level enhancer fan-out.
- [jutilities/decorators/getter](./decorators/getter.md) — Getter decorators from fn-first enhancers.
- [jutilities/decorators/hof](./decorators/hof.md) — Decorator conversion contract.
- [jutilities/decorators/method](./decorators/method.md) — Method decorators from fn-first enhancers.
- [jutilities/delay](./delay.md) — Higher-order wrappers that sleep before invoking a function.
- [jutilities/from](./from.md) — Base64 decoding, working in Node and browsers.
- [jutilities/hash](./hash.md) — Small, fast, non-cryptographic string hashes.
- [jutilities/is](./is.md) — Utilities for checking common runtime values and shapes without throwing.
- [jutilities/json](./json.md) — Branded serialization ("super JSON") built on native `JSON`: a `Json` class with a set of named, typed handlers that add round-trip support for values `JSON` cannot represent natively (bigint, Map/Set, Date, RegExp, typed arrays, Errors, URLs, boxed primitives, NaN family, globally-registered symbols, .
- [jutilities/lazy](./lazy.md) — The HofKind of lazy: its options are resolved from the concrete wrapped function type.
- [jutilities/libs/clock](./libs/clock.md) — The clock the timing-sensitive wrappers measure with.
- [jutilities/libs/create-hof](./libs/create-hof.md) — Resolves a HofKind's `options` for the concrete function type `TF`.
- [jutilities/libs/sync-guard](./libs/sync-guard.md) — Runtime guard for the sync HOF flavor.
- [jutilities/libs/with](./libs/with.md) — The kind of a composed stack: its options are the merged option bags of every layer, resolved for the concrete wrapped function type.
- [jutilities/logger](./logger.md) — Sync and async higher-order loggers that trace a function's invocation and result through `logger.
- [jutilities/node/fs/dir](./node/fs/dir.md) — The kind of a filesystem entry, as reported by directoryTree.
- [jutilities/node/fs/file](./node/fs/file.md) — Removes files concurrently, ignoring missing paths.
- [jutilities/node/fs/json](./node/fs/json.md) — Reads and parses a JSON file.
- [jutilities/node/hash](./node/hash.md) — Named digest (`sha512`, …) over streams or buffers, optionally HMAC.
- [jutilities/node/stream/buffer](./node/stream/buffer.md) — Converts a `Buffer` into a readable stream of chunked views.
- [jutilities/node/stream/cache](./node/stream/cache.md) — Options for StreamCache.
- [jutilities/node/stream/size](./node/stream/size.md) — Async generator that passes chunks through while reporting cumulative size.
- [jutilities/node/stream/tee](./node/stream/tee.md) — Duplicates a readable stream into two backpressure-aware branches.
- [jutilities/retry](./retry.md) — The default `onError` policy: exponential back-off (2^retries × the last attempt's duration) with jitter, bounded by a 60s budget; rethrows past 10 retries or once the budget is exhausted.
- [jutilities/runtime](./runtime.md) — Builds a conditional wrapper that returns `fn` only when `condition` holds.
- [jutilities/signal](./signal.md) — `AbortSignal` helper: run a callback on abort and be able to detach it.
- [jutilities/sleep](./sleep.md) — Promisified sleep helpers.
- [jutilities/timeout](./timeout.md) — Higher-order wrapper that races an async function against a deadline or an abort signal.
- [jutilities/to](./to.md) — Small conversion helpers.
- [jutilities/web/hash](./web/hash.md) — Web Crypto (`crypto.
- [jutilities/web/stream/buffer](./web/stream/buffer.md) — Converts bytes into a `ReadableStream` of chunked views.
- [jutilities/web/stream/size](./web/stream/size.md) — Async generator that passes chunks through while reporting cumulative size.

# Benchmarks and memory tests

## What this is

Performance work is split into two deliberately isolated suites:

- **Micro-benchmarks** — [Tinybench](https://github.com/tinylibs/tinybench) through the Vitest 5 benchmark API: benchmarks are `test()` cases that consume a `bench` fixture (`test/benchmark/**/*.bench.ts`). Opt-in via `npm run bench`; never part of `npm run check`.
- **Memory/leak tests** — `test/memory/**/*.memory.test.ts`, run with `--expose-gc` by `vitest.memory.config.ts`. `npm run test:memory` **is** part of `npm run check`.

Both live outside `src/**/*.test.ts`, so the normal unit run (`npm test`) stays focused and fast.

Benchmarks measure the **built artifact** through the package self-link (`jutilities/<module>` → `dist/`), not the TypeScript sources, so numbers reflect what consumers actually run and avoid per-call module-runner overhead on your own imports. `npm run bench` rebuilds first (`npm run build`), so the numbers are never measured against a stale `dist/`.

## Commands

| Command | What it does | In `check`? |
| --- | --- | --- |
| `npm run bench` | Rebuild, then run every `test/benchmark/*.bench.ts` | No (opt-in) |
| `npm run bench:json` | Rebuild, then dump the full JSON report (benchmark fields included) to `test/benchmark/results/bench.json` | No |
| `npm run test:memory` | Memory/leak suite with `--expose-gc` | Yes |
| `npm run test:heap` | Unit suite with per-test heap usage (`--logHeapUsage`) | No |
| `npm run profile` | CPU + heap profiles of the whole suite via `vitest.profile.config.ts` | No |

In a non-interactive shell the default reporter prints only the summary; pass `--reporter=verbose` (or `--reporter=tree`) to also print the ops/sec tables, e.g. `npm run bench -- --reporter=tree`.

Profiling runs can be kept small by passing a filter, e.g. `npm run profile -- src/json.test.ts`. The `bench:json` output directory is created automatically (and is gitignored).

## Layout

- `test/benchmark/hash.bench.ts`, `json.bench.ts`, `cache.bench.ts`, `streams.bench.ts`, `stream-cache.bench.ts`, `fs.bench.ts` — one file per module area.
- `test/memory/*.memory.test.ts` — leak/resource tests for the cache, timers, abort listeners, streams and `StreamCache`.
- `test/memory/gc.ts` — `forceGc()` and `isCollected(ref)` helpers (three forced GC passes, one per event-loop turn).
- `vitest.profile.config.ts` — drives `npm run profile` with `--cpu-prof` + `--heap-prof` into `profiles/` (via top-level `execArgv`, `maxWorkers: 1`, `isolate: false`).
- `vitest.memory.config.ts` — drives `npm run test:memory` with `--expose-gc`.

## Benchmark discipline

- Benchmarks assign the result under test to a shared `sink` (the I/O benches consume it instead, via `flush()` / iteration) and assert it per test, so V8 cannot dead-code-eliminate the call.
- Results come from a dedicated benchmark project of the same Vitest instance (`benchmark.include`); tests inside a benchmark file run sequentially.
- Module-level bindings (no getter overhead), pre-created fixtures.
- Signature is `bench(name, fn).run(options?)` or `bench(name, fnOptions, fn)`; `fnOptions` are the tinybench lifecycle hooks, `run()` takes the tinybench engine options (`{ time: 1000 }` etc.).
- Numbers are environment-specific — compare only against the same machine/runner, never against a hardcoded threshold, `bench` is NOT part of `npm run check`.
- The Vitest 5 benchmark provider warns when a benchmark accesses module-export getters too often. Two of this repo's benches (`withCacheSync hit`, `lazy hit`) and two parse benches (`superjson.parse plain/rich`) still trip it because of **cross-module calls inside the library itself** (e.g. `dist/hof/cache.js` → `dist/is.js`, `dist/lazy.js` → `dist/hash.js`) under the module runner. That is inherent to running library internals through Vite's module runner, not a benchmark bug — do not chase it by restructuring the library; the numbers are stable within a few percent on a quiet machine.

## Reference run

Node 24.18.0 / Linux, 2026-11-13, via `npm run bench` after a fresh build — illustrative only, not a gate:

| Benchmark | ops/sec |
| --- | --- |
| `djb2` short key | ~4.2M |
| `djb2` 1 KiB | ~58k |
| `sdbm` short key | ~4.4M |
| `sdbm` 1 KiB | ~57k |
| `djb2` 4 KiB | ~24k |
| `fnv1a64` short key | ~610k |
| `fnv1a64` 4 KiB | ~45–57 (BigInt growth — see below) |
| `superjson.stringify` plain | ~92k |
| `superjson.parse` plain | ~40k |
| `superjson.stringify` rich | ~36k |
| `superjson.parse` rich | ~15k |
| `withCacheSync` hit | ~3.1–3.6M |
| `withCacheAsync` hit | ~755–820k |
| `lazy` hit | ~930k–1.0M |
| `defaultGenerateCacheKey` | ~108k |
| `buffer2stream` 64 KiB | ~60–72k |
| `stream2buffer` 64 KiB | ~54–76k |
| `streamSize` 64 KiB | ~85–146k |
| `tee` 64 KiB | ~59–60k |
| `createCachePath` | ~300–327k |
| `write+flush` 64 KiB | ~2.3–3.4k |
| `read` 64 KiB | ~5.5–7.5k |
| `directoryTree` (44 entries) | ~0.7–1.0k |
| `directorySize` (44 entries) | ~0.7–1.0k |
| `walkEntries` (44 entries) | ~3.4–4.4k |

## Memory tests

`--expose-gc` is injected through `vitest.memory.config.ts` (`execArgv`); the suite fails with a clear message if GC is unavailable. The tests assert:

- `WeakRef` collection after `globalCache.clear()` / TTL expiry.
- Active timer counts via `vi.getTimerCount()` after abort and normal completion.
- Abort-listener counts via `getEventListeners`.
- `tee()` detaches source listeners on `end`, `error` and `close`-without-end; `StreamCache` leaves no partial files on `maxFileSize` rollback, leaves no files behind after write/unlink cycles, and adds at most one shared `beforeExit` listener across instances.

No absolute heap thresholds (they flake). The suite runs inside `npm run check`.

## Profiling

- `npm run profile -- src/json.test.ts` — one CPU + one heap profile of the selected suite, written to `profiles/` (gitignored). Open them in VS Code, Chrome DevTools or Speedscope.
- `node --cpu-prof --cpu-prof-dir=profiles ./node_modules/vitest/vitest.mjs run` — main-thread profile of a custom run.
- `DEBUG=vite-node:* npm run test` — see which files transform and when.
- `DEBUG=vitest:coverage npm run test` — diagnose coverage-conversion slowness.

## Known characteristics and gotchas

- `fnv1a64` is O(n²) (result BigInt grows unboundedly): ~610k ops/s on short keys and only ~45–57 ops/s on a 4 KiB input. Prefer `djb2`/`sdbm` for large cache keys.
- `lazy`'s memoization store is process-lifetime, shared across all wrappers of the same initializer, and unbounded: every distinct (function source, arguments) pair is retained until exit. Use it for stable, low-cardinality inputs.
- `globalCache` entries expire after the default TTL (5 minutes) and are removed lazily on access; there is no size cap. Pass a bounded `cacheStore` for high-cardinality work.
- `StreamCache` writes are atomic (temp file + rename), so a failed `maxFileSize` write leaves no partial file — but rename/fsync costs make writes noisy.
- Filesystem and stream-cache numbers vary wildly with disk, tmpfs, antivirus and CI load. Treat them as smoke signals, not targets.

## Baseline workflow

Vitest 5 removed the `--outputJson` / `--compare` flags. Stored baselines are now a per-bench option instead:

1. `npm run bench:json` writes `test/benchmark/results/bench.json`, a full JSON report with a `benchmarks` field per test case (useful for one-off archiving and diffs).
2. For repeatable A/B comparisons, add `writeResult: "./test/benchmark/results/<name>.json"` to the bench and replay it with `bench.from(name, path)` inside `bench.compare()` — see <https://vitest.dev/guide/benchmarking#storing-and-replaying-results>.
3. `test/benchmark/results/` is gitignored on purpose — numbers are machine-specific. On a pinned runner (same hardware/image), you may force-add an artifact with `git add -f test/benchmark/results/…` if you want a committed reference; otherwise keep it local.
4. Keep artifacts out of git — `test/benchmark/results/`, `profiles/`, `*.cpuprofile` and `*.heapprofile` are already ignored.

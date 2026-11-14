# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Changed
- Standardized superjson handler keys to hyphenated forms: `invalid-date`, `number-object`, `string-object`, and `boolean-object`.
- Restored function handler round-trip behavior using `new Function(\`return ${v}\`)()` and `v.toString()`.
- Aligned docs and tests with the updated handler keys and function behavior.
- Upgraded Vitest `^3.2.7` → `^5.1.0` and `@vitest/coverage-v8` to match. Benchmarks now use the Vitest 5 benchmark API (`test()` + `bench` fixture); `--outputJson`/`--compare` are gone — `bench:json` writes a full JSON report via `--reporter=json`, and stored-baseline comparisons use `writeResult`/`bench.from()` (see `test/benchmark/README.md`). Coverage is now the AST-aware V8 remapping; the 100% branch/line/function/statement gate is re-earned against it.
- **Breaking:** the `decorators/<kind>` converters (`decorateMethod`, `decorateClass`, `decorateGetter`) now target TypeScript legacy decorators (`"experimentalDecorators": true`, added to `tsconfig.json`) because Vite 8 / Rolldown (oxc) cannot parse TC39 Stage 3 decorator syntax. The Stage 3 public API (`ClassDecoratorContext`-typed signatures, `isDecorationContext`) is discarded.
- **Breaking:** `decorateProperty` is removed — legacy field decorators receive no initializer value, so function-valued field decoration is impossible. Plain fields are not supported; the decorators module covers methods, classes and getters only. The 15 `decorateProperty` tests and the `decorators/property` example are gone.
- Paren-less-misfire guards now fingerprint legacy decorator invocations: `isRawMemberApplication` matches `(target, propertyKey, descriptor)` and `assertNotRawApplication` matches a function passed as the options bag.
- **Breaking:** `lazy` is a plain memoizing function again — it no longer carries the `HofFn` brand. `LazyKind`/`LazyOptions` exports and the `skipHof` bypass are removed, and the internal `lazyFactory` indirection is gone. `decorateMethod`/`decorateGetter` cannot convert it; use a branded HOF there instead.
- **Breaking:** the HOF modules moved to nested subpaths — `jutilities/cache` → `jutilities/hof/cache`, `jutilities/retry` → `jutilities/hof/retry`, `jutilities/timeout` → `jutilities/hof/timeout`, `jutilities/delay` → `jutilities/hof/delay`, `jutilities/logger` → `jutilities/hof/logger`, and `jutilities/assert` → `jutilities/hof/assert`. Sources and tests moved with them (`src/hof/*.ts`); the public surface (exports, docs, examples) follows the same paths. The `exports` map (`"./*": "./dist/*.js"`) already routes nested subpaths, so no manifest change was needed; deep imports of `jutilities/libs/*` and `jutilities/decorators/*` are unaffected.
- README and AGENTS now point at the generated API reference in `docs/` (index `docs/README.md`) instead of the absent `docs/DOCUMENTATION.md` and `docs/api/`; docs regeneration is documented as part of `npm run build`, and the phantom `npm run docs:api` references in the generator templates (and thus in every generated header and the `docs/README.md` index) were removed in the same pass.

### Tests
- Replaced `node:assert/strict` with Vitest `expect` assertions across all test suites.
- Added function round-trip and invalid-syntax assertions for `SyntaxError`.
- Benchmarks run against the built artifact (`jutilities/*` self-link) after a fresh `npm run build`.
- Full `npm run check` is green on Vitest 5: typecheck, lint, 581 tests, build, 25 examples.

## [1.2.0] - 2026-11-06

### Added
- Kind-based HOF factory (`createHofSync`, `createHofAsync`) with shared skipHof bypass and one flat options bag.
- Stack composer (`withAsync`, `withSync`) with HOF kind branding (`__kind`, flavor tags), result merge behavior, and single-pass skipHof handling.
- Type exports and strengthened typing around async functions, handler results, cache keys, retry/default policies, and example consumers.
- Five real-life scenario demos: HTTP server, in-memory SQLite, filesystem management, worker queue, and scheduler.
- Examples expanded to 25 runnable TypeScript demos.

### Changed
- Simplified sync HOF generics while preserving strict type constraints.
- Consolidated HOF tests and removed the `createHofAny` helper.
- Raised the Node floor to `>=22.13.0` for unflagged `node:sqlite` availability.
- Simplified lazy sync/async initializer handling and sleep rounding to whole milliseconds.

### Fixed
- Fixed a pooled Buffer decoding bug in typed-array, DataView, and ArrayBuffer handlers.
- Fixed cache key generation by using `djb2(superjson.stringify(...))` and preserving NaN-vs-null, BigInt, and Map/Set argument distinctions.
- Fixed npm run check errors and warnings.
- Fixed husky/pre-commit tooling and dev-dependency setup.
- Resolved invalid-date claims using strict `Number.isNaN(getTime())` behavior.

### Documentation
- Added `AGENTS.md`.
- Refactored JSON typing and casts.
- Updated `docs/DOCUMENTATION.md` and README with module exports, quirks, and composition details.

## [1.1.0] - 2026-10-17

### Added
- Cache keygen rework with stable unsigned 32-bit numeric keys.
- Public contract types: `Key`, `CacheKeyParams`, `ShouldCacheParams`, `CacheStore`, and `Options`.
- Examples converted to TypeScript with `withAssert` result gates.
- Every top-level declaration and class member exported for consumers and tests.
- Kind-based decorator conversion supporting sync, async, and any-flavor HOFs.
- Shared stack composition and decorator support.

### Changed
- Migrated examples to TypeScript and added run-all TypeScript runner.
- Made JSON handler registry private while exposing `addHandler` / `removeHandler`.
- Enabled type-checking for `src` and `examples`.

### Fixed
- Fixed invalid-date strictness under overridden `getTime`.
- Added ±Infinity pins for nested values, Map keys, and Set members.
- Fixed cache BigInt and NaN handling.

## [1.0.1] - 2026-10-17

### Added
- Canonical `jutilities/<module>` subpath imports through a single exports pattern.
- Self-link shim for local checkouts.

### Changed
- Migrated README, docs, and all examples to extension-less subpath imports.
- Enforced no-barrel package design.

### Fixed
- Publish and ignore-file hardening.
- Broken husky prepare (missing dev dependency).

## [1.0.0] - 2026-10-17

### Added
- Initial typed utility library with modules: `assert`, `cache`, `delay`, `from`, `hash`, `is`, `json`/superjson, `lazy`, `logger`, `node-stream`, `retry`, `signal`, `sleep`, `timeout`, and `to`.
- Complete test suites for all modules.
- JSDoc/TSDoc coverage across source, tests, and shared types.
- Runnable examples and npm scripts.
- Publish configuration with whitelist and ignore guards.

### Documentation
- README and `docs/DOCUMENTATION.md` covering module contracts, quirks, and composition patterns.

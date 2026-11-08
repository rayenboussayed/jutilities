# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Changed
- Standardized superjson handler keys to hyphenated forms: `invalid-date`, `number-object`, `string-object`, and `boolean-object`.
- Restored function handler round-trip behavior using `new Function(\`return ${v}\`)()` and `v.toString()`.
- Aligned docs and tests with the updated handler keys and function behavior.

### Tests
- Replaced `node:assert/strict` with Vitest `expect` assertions across all test suites.
- Added function round-trip and invalid-syntax assertions for `SyntaxError`.
- Full `npm run check` remains green: typecheck, lint, 487 tests, build, and 25 examples.

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

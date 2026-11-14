# AGENTS

## Verification and commits

- Never skip Git verification or checks. Do not use `--no-verify`, `--no-gpg-sign`, or any flag that bypasses hooks or verification.
- Required pre-commit hook runs `npm audit --omit=dev && npm run check`. It verifies runtime audit findings and all project checks; inspect changes before committing.
- A change is not done until `npm run check` exits 0.

## Commands

```bash
npm run typecheck          # tsc --noEmit
npm run lint               # eslint . --cache --max-warnings 0 (no --fix)
npm run knip               # knip (unused files/exports/dependencies)
npm run test               # vitest run with 100% coverage thresholds
npm run build              # tsc -> dist/ + regenerate docs/
npm run examples           # npm run build && node --import tsx examples/run-all.ts
npm run check              # typecheck && lint && knip && test && test:memory && build && examples
```

- Single test file: `npx vitest run src/hof/cache.test.ts`
- Single test by name: `npx vitest run -t "exact test title"`
- Typecheck includes `examples/` but emits only `src/`; keep build rootDir as configured.
- Clean ESLint cache artifacts are ignored; stale cache can hide issues.

## Repository shape

- ESM-only Node package, no barrel: import every module as `jutilities/<module>` (for example `jutilities/hof/cache`).
- `src/` is the library. `examples/` are type-checked consumers. `docs/` is the generated API reference (entry point `docs/README.md`) — one page per module, produced by `scripts/generate-api-docs.mjs` as part of `npm run build`; change the JSDoc in `src/`, never the generated pages.
- `src/**/*.test.ts` are tests; Vitest coverage thresholds are 100% for lines, statements, functions, and branches.
- Coverage exclusions are only `src/types/type.ts` and `src/types/with.ts`.
- Target centers: function-level HOFs in `src/libs/create-hof.ts` and `src/libs/with.ts`; sync-only runtime guarding is authoritative.

## Constraints and gotchas

- Node `>=22.13.0` is required.
- `src/runtime.ts` is isomorphic (browser bundles import it): no static `node:` imports. Node-only synchronous detection goes through the guarded `process.getBuiltinModule("node:worker_threads")` (Node ≥ 22.3), evaluated once at module load.
- Environment-dependent branches read `isServer`/`isBrowser` at module import time. Tests that stub `window`/`self`/`process` must use `vi.stubGlobal` + `vi.resetModules()` + dynamic `import()` — per-test global mutation no longer flips the branch.
- Examples are discovered at runtime by `readdirSync` + `spawn` (`examples/run-all.ts`), invisible to static analysis — `knip.json` declares `examples/**/*.ts` as entry. Keep example subfolders covered by that glob.
- Do not change ESLint configuration; it lives in `eslint.config.js`.
- Keep JSDoc and tests aligned. `docs/` is generated from the JSDoc; README documents runtime caveats at call sites.
- `npm audit --omit=dev` should be clean. Dev-only advisories can remain from the toolchain.
- Moving packages between `dependencies` and `devDependencies` affects `package-lock.json`; re-run install and `npm run check`.
- Generated `dist/` and `coverage/` are ignored and rebuilt.
- `pre-commit` starts with `npm audit --omit=dev`, so dev-only advisories do not gate project verification. Runtime advisories must be fixed.

## Agent expectations

- Prefer small patches and rerun `npm run check` after meaningful changes.
- Maintain strict types and tests; avoid casting, especially `as any`, `as unknown`, and `as never`.
- Do not bypass hooks. If a hook fails, fix the underlying issue and retry normally.
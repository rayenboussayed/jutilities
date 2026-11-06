# AGENTS

## Verification and commits

- Never skip Git verification or checks. Do not use `--no-verify`, `--no-gpg-sign`, or any flag that bypasses hooks or verification.
- Required pre-commit hook runs `npm audit --omit=dev && npm run check`. It verifies runtime audit findings and all project checks; inspect changes before committing.
- A change is not done until `npm run check` exits 0.

## Commands

```bash
npm run typecheck          # tsc --noEmit
npm run lint               # eslint . --cache --max-warnings 0 (no --fix)
npm run test               # vitest run with 100% coverage thresholds
npm run build              # tsc -p tsconfig.build.json -> dist/
npm run examples           # npm run build && node --import tsx examples/run-all.ts
npm run check              # typecheck && lint && test && build && examples
```

- Single test file: `npx vitest run src/cache.test.ts`
- Single test by name: `npx vitest run -t "exact test title"`
- Typecheck includes `examples/` but emits only `src/`; keep build rootDir as configured.
- Clean ESLint cache artifacts are ignored; stale cache can hide issues.

## Repository shape

- ESM-only Node package, no barrel: import every module as `jutilities/<module>` (for example `jutilities/cache`).
- `src/` is the library. `examples/` are type-checked consumers. `docs/DOCUMENTATION.md` is reference behavior documentation.
- `src/**/*.test.ts` are tests; Vitest coverage thresholds are 100% for lines, statements, functions, and branches.
- Coverage exclusions are only `src/types/type.ts` and `src/types/with.ts`.
- Target centers: function-level HOFs in `src/libs/create-hof.ts` and `src/libs/with.ts`; sync-only runtime guarding is authoritative.

## Constraints and gotchas

- Node `>=22.13.0` is required.
- Do not change ESLint configuration; it lives in `eslint.config.js`.
- Keep behavior documentation and tests aligned. README documents runtime caveats at call sites.
- `npm audit --omit=dev` should be clean. Dev-only advisories can remain from the toolchain.
- Moving packages between `dependencies` and `devDependencies` affects `package-lock.json`; re-run install and `npm run check`.
- Generated `dist/` and `coverage/` are ignored and rebuilt.
- `pre-commit` starts with `npm audit --omit=dev`, so dev-only advisories do not gate project verification. Runtime advisories must be fixed.

## Agent expectations

- Prefer small patches and rerun `npm run check` after meaningful changes.
- Maintain strict types and tests; avoid casting, especially `as any`, `as unknown`, and `as never`.
- Do not bypass hooks. If a hook fails, fix the underlying issue and retry normally.
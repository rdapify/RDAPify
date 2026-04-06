# rdapify — Execution Contract
## Architecture
Hexagonal: `application/` → `core/ports/` ← `infrastructure/` · `shared/` · `cli/`
Dependency: Shared ← Core ← Application ← Infrastructure (never reverse)
5 query types: `domain()` `ip()` `asn()` `nameserver()` `entity()`
## Commands
`npm test` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run verify`
`npm run test:unit` · `npm run test:integration` · `npm run test:security`
`npm run verify:api` — run after any export change in `src/index.ts`
## Invariants
- TypeScript strict + `noUncheckedIndexedAccess` · Node.js 20+ · target ES2020
- Tests: `--runInBand` · 10s timeout · coverage ≥ 80% (branches, functions, lines, statements)
- Unused vars: prefix `_` · no `console.log` (`.warn`/`.error` allowed)
- Run `npm run verify:api` after any export change — snapshot: `api-snapshot.json`
- Apache-2.0 · never add paid features · never break public API without updating snapshot

# ENTERPRISE REFACTOR EXECUTION PLAN

**Goal:** Transform RDAPify into a public-ready, organization-ready enterprise library with clean architecture, stable API, and professional tooling.

**Constraints:**
- ✅ Public API must remain 100% stable
- ✅ All 146 tests must continue passing
- ✅ ESM + CJS support maintained
- ✅ Security guarantees intact (SSRF + PII)
- ✅ Incremental execution with verification

---

## PHASE 1: REPOSITORY HYGIENE (Public-Ready)

### 1.1 Root Directory Cleanup
**Goal:** Professional first impression for public repository

**Actions:**
1. Create `docs/internal/` directory
2. Move internal docs:
   - `FINAL_ORGANIZATION_SUMMARY.md`
   - `GITHUB_ORGANIZATION_READY.md`
   - `PHASE_*.md` (all phase files)
   - `PRE_PUBLIC_RELEASE_CHECKLIST.md`
   - `QUICK_SUMMARY_AR.md`
   - `REFACTOR_*.md` (all refactor files except this plan)
3. Delete temporary files:
   - `CNAME` (website artifact)
   - `str.txt` (temp file)
4. Keep essential root docs:
   - README.md, LICENSE, CHANGELOG.md
   - ROADMAP.md, SECURITY.md, PRIVACY.md
   - CONTRIBUTING.md, CODE_OF_CONDUCT.md
   - GOVERNANCE.md, MAINTAINERS.md
   - README_AR.md (localization)

**Verification:**
```bash
ls -la | grep "\.md$" | wc -l  # Should be ~11 files
npm test  # Must pass
```

### 1.2 Git Tracking Cleanup
**Goal:** Ensure generated files are not tracked

**Actions:**
1. Stop tracking `dist/` if tracked:
   ```bash
   git rm -r --cached dist/
   ```
2. Stop tracking `coverage/` if tracked:
   ```bash
   git rm -r --cached coverage/
   ```
3. Verify .gitignore is comprehensive (already good)

**Verification:**
```bash
git status  # Should show no dist/ or coverage/ files
```

### 1.3 Repository Meta Files
**Goal:** Professional OSS standards

**Actions:**
1. Verify `.editorconfig` exists ✅
2. Create `.gitattributes`:
   ```
   * text=auto eol=lf
   *.{cmd,[cC][mM][dD]} text eol=crlf
   *.{bat,[bB][aA][tT]} text eol=crlf
   ```
3. Verify formatting/lint configs are consistent ✅

**Verification:**
```bash
npm run lint
npm run format:check
```

---

## PHASE 2: ENTERPRISE ARCHITECTURE (Required)

### 2.1 Target Architecture

```
src/
├── core/
│   ├── client/              # RDAPClient (thin orchestrator)
│   │   ├── RDAPClient.ts
│   │   └── index.ts
│   └── services/            # Business logic orchestration
│       ├── QueryOrchestrator.ts
│       └── index.ts
│
├── infrastructure/
│   ├── http/                # HTTP concerns
│   │   ├── Fetcher.ts
│   │   ├── RetryPolicy.ts (extracted from RDAPClient)
│   │   └── index.ts
│   ├── cache/               # Caching infrastructure
│   │   ├── CacheManager.ts
│   │   ├── InMemoryCache.ts
│   │   ├── ICache.ts (interface)
│   │   └── index.ts
│   └── bootstrap/           # IANA bootstrap discovery
│       ├── BootstrapDiscovery.ts
│       ├── BootstrapCache.ts (extracted)
│       └── index.ts
│
├── domain/
│   ├── models/              # Response models
│   │   ├── DomainResponse.ts (from types/responses.ts)
│   │   ├── IPResponse.ts
│   │   ├── ASNResponse.ts
│   │   └── index.ts
│   ├── validators/          # Domain validation
│   │   ├── DomainValidator.ts (from utils/validators/domain.ts)
│   │   ├── IPValidator.ts
│   │   ├── ASNValidator.ts
│   │   └── index.ts
│   └── normalizers/         # Data transformation
│       ├── Normalizer.ts
│       ├── ResponseNormalizer.ts (extracted)
│       └── index.ts
│
├── security/
│   ├── ssrf/                # SSRF protection
│   │   ├── SSRFProtection.ts
│   │   ├── IPRangeChecker.ts (extracted)
│   │   └── index.ts
│   └── privacy/             # PII redaction
│       ├── PIIRedactor.ts
│       ├── RedactionRules.ts (extracted)
│       └── index.ts
│
├── shared/
│   ├── types/               # Shared contracts
│   │   ├── entities.ts
│   │   ├── enums.ts
│   │   ├── options.ts
│   │   ├── raw.ts (RawRDAPResponse)
│   │   └── index.ts
│   ├── errors/              # Error hierarchy
│   │   ├── RDAPifyError.ts (base)
│   │   ├── NetworkErrors.ts
│   │   ├── ValidationErrors.ts
│   │   ├── guards.ts (type guards)
│   │   └── index.ts
│   └── utils/               # Pure utilities
│       ├── async.ts
│       ├── string.ts
│       ├── object.ts
│       ├── network.ts
│       ├── format.ts
│       ├── runtime.ts
│       └── index.ts
│
└── index.ts                 # Public API (unchanged exports)
```

### 2.2 Dependency Rules

**Allowed Dependencies:**
```
core → infrastructure, domain, security, shared
infrastructure → shared (only)
domain → shared (only)
security → shared (only)
shared → (no internal dependencies)
```

**Forbidden:**
- infrastructure → core
- domain → core, infrastructure
- security → core, infrastructure, domain
- shared → any internal module

### 2.3 Migration Strategy

**Step 1: Create new structure (empty)**
```bash
mkdir -p src/{core/{client,services},infrastructure/{http,cache,bootstrap},domain/{models,validators,normalizers},security/{ssrf,privacy},shared/{types,errors,utils}}
```

**Step 2: Move files with compatibility shims**

For each moved file:
1. Move to new location
2. Create shim at old location that re-exports
3. Update internal imports in moved file
4. Run tests
5. Once stable, update all imports
6. Remove shim

**Example:**
```typescript
// OLD: src/fetcher/Fetcher.ts
// NEW: src/infrastructure/http/Fetcher.ts
// SHIM: src/fetcher/Fetcher.ts
export { Fetcher } from '../infrastructure/http/Fetcher';
export type { FetcherOptions } from '../infrastructure/http/Fetcher';
```

**Step 3: Extract and refactor**

Files that need splitting:
1. `RDAPClient.ts` → extract retry logic to `infrastructure/http/RetryPolicy.ts`
2. `BootstrapDiscovery.ts` → extract cache to `infrastructure/bootstrap/BootstrapCache.ts`
3. `types/responses.ts` → split into `domain/models/*.ts`
4. `types/errors.ts` → split into `shared/errors/*.ts`
5. `utils/validators.ts` → split into `domain/validators/*.ts`
6. `utils/helpers.ts` → split into `shared/utils/*.ts`

**Step 4: Update public API (src/index.ts)**

Ensure all exports still work:
```typescript
// Re-export from new locations
export { RDAPClient } from './core/client/RDAPClient';
export type { DomainResponse } from './domain/models/DomainResponse';
// ... etc
```

**Step 5: Remove shims**

Once all internal imports updated and tests pass:
1. Delete compatibility shims
2. Run full test suite
3. Run build
4. Verify package exports

### 2.4 Verification Checklist

After each major move:
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all 146 tests)
- [ ] `npm run build` succeeds
- [ ] Public API exports unchanged (verify with script)
- [ ] No circular dependencies (check with madge or similar)

---

## PHASE 3: PUBLIC API LOCK

### 3.1 API Snapshot Script

Create `scripts/verify-api.js`:
```javascript
const api = require('../dist/index.js');
const fs = require('fs');

const exports = Object.keys(api).sort();
const snapshot = JSON.stringify(exports, null, 2);

const snapshotPath = './api-snapshot.json';

if (fs.existsSync(snapshotPath)) {
  const existing = fs.readFileSync(snapshotPath, 'utf8');
  if (existing !== snapshot) {
    console.error('❌ Public API has changed!');
    console.error('Expected:', existing);
    console.error('Got:', snapshot);
    process.exit(1);
  }
  console.log('✅ Public API unchanged');
} else {
  fs.writeFileSync(snapshotPath, snapshot);
  console.log('✅ API snapshot created');
}
```

### 3.2 Add to package.json

```json
{
  "scripts": {
    "verify:api": "node scripts/verify-api.js",
    "verify": "npm run lint && npm run typecheck && npm test && npm run build && npm run verify:api"
  }
}
```

### 3.3 Create Initial Snapshot

```bash
npm run build
node scripts/verify-api.js
git add api-snapshot.json
```

---

## PHASE 4: TESTS, QUALITY, DOCUMENTATION

### 4.1 Test Structure (Keep Existing)

```
tests/
├── unit/           # Unit tests (keep as-is)
├── integration/    # Integration tests (keep as-is)
└── fixtures/       # Test data (keep as-is)
```

**Actions:**
- Update import paths in tests to match new structure
- Add boundary tests if needed
- Ensure SSRF and PII tests remain comprehensive

### 4.2 Architecture Documentation

Create `docs/architecture/overview.md`:
```markdown
# Architecture Overview

## Layered Architecture

RDAPify follows a strict layered architecture with clear boundaries:

### Core Layer
- **Purpose:** Public API and business logic orchestration
- **Dependencies:** Can use all other layers
- **Key Components:** RDAPClient, QueryOrchestrator

### Infrastructure Layer
- **Purpose:** Technical capabilities (HTTP, caching, bootstrap)
- **Dependencies:** Shared layer only
- **Key Components:** Fetcher, CacheManager, BootstrapDiscovery

### Domain Layer
- **Purpose:** Business models, validation, normalization
- **Dependencies:** Shared layer only
- **Key Components:** Response models, validators, normalizers

### Security Layer
- **Purpose:** Security controls (SSRF, PII)
- **Dependencies:** Shared layer only
- **Key Components:** SSRFProtection, PIIRedactor

### Shared Layer
- **Purpose:** Common contracts and utilities
- **Dependencies:** None (leaf layer)
- **Key Components:** Types, errors, utilities

## Data Flow

[Include Mermaid diagram]
```

### 4.3 Update Existing Docs

- Update `README.md` if architecture is mentioned
- Update `ROADMAP.md` to reflect new structure
- Ensure no contradictions in docs/

---

## PHASE 5: ORG-READY OSS TOOLING

### 5.1 GitHub Actions CI

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run verify:api
```

### 5.2 Security Tooling

Create `.github/workflows/codeql.yml`:
```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    
    steps:
      - uses: actions/checkout@v3
      - uses: github/codeql-action/init@v2
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v2
```

### 5.3 GitHub Templates

**Already exist:**
- ✅ `.github/ISSUE_TEMPLATE/`
- ✅ `.github/pull_request_template.md`
- ✅ `.github/CODEOWNERS`

**Verify and update if needed**

### 5.4 Release Automation (Optional)

Recommend but don't implement:
- `release-please` for automated releases
- `changesets` for version management
- Document in `CONTRIBUTING.md`

---

## PHASE 6: PACKAGING VERIFICATION

### 6.1 NPM Pack Test

```bash
npm pack
tar -tzf rdapify-*.tgz
```

**Verify:**
- Only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md` included
- No `src/`, `tests/`, `docs/`, `examples/`
- No `.git/`, `node_modules/`

### 6.2 Package Exports Test

Create `test-package.js`:
```javascript
// Test CJS
const RDAPClient = require('./dist/index.js').RDAPClient;
console.log('CJS:', typeof RDAPClient);

// Test ESM (if supported)
import('./dist/index.js').then(mod => {
  console.log('ESM:', typeof mod.RDAPClient);
});
```

### 6.3 TypeScript Types Test

Create `test-types.ts`:
```typescript
import { RDAPClient, DomainResponse } from './dist/index';

const client = new RDAPClient();
const result: Promise<DomainResponse> = client.domain('example.com');
```

Run: `tsc --noEmit test-types.ts`

---

## PHASE 7: PUBLIC RELEASE CHECKLIST

### 7.1 Pre-Public Checklist

- [ ] All internal docs moved to `docs/internal/`
- [ ] Root directory clean (11 essential files)
- [ ] No secrets or sensitive data in history
- [ ] All tests passing (146/146)
- [ ] Build succeeds
- [ ] Public API verified unchanged
- [ ] Architecture documented
- [ ] CI/CD workflows active
- [ ] Security policy confirmed
- [ ] License confirmed (MIT)
- [ ] README accurate and welcoming
- [ ] CONTRIBUTING.md clear
- [ ] CODE_OF_CONDUCT.md present

### 7.2 Organization Transfer Checklist

- [ ] Repository settings reviewed
- [ ] Branch protection rules configured:
  - Require PR reviews (2 approvals)
  - Require status checks (CI)
  - Require up-to-date branches
  - No force push
  - No deletions
- [ ] Required CI checks configured
- [ ] CODEOWNERS file active
- [ ] Security policy active
- [ ] Issue templates working
- [ ] PR template working
- [ ] Dependabot configured
- [ ] GitHub Pages (if applicable)

### 7.3 Post-Transfer Verification

- [ ] Clone fresh repository
- [ ] `npm install`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm pack` and inspect
- [ ] Verify all links in README work
- [ ] Verify documentation site (if applicable)

---

## EXECUTION ORDER

1. **Phase 1** (Hygiene) - ~30 minutes
2. **Phase 3** (API Lock) - ~15 minutes
3. **Phase 2** (Architecture) - ~4-6 hours (incremental)
4. **Phase 4** (Tests/Docs) - ~2 hours
5. **Phase 5** (Tooling) - ~1 hour
6. **Phase 6** (Packaging) - ~30 minutes
7. **Phase 7** (Checklist) - ~1 hour

**Total Estimated Time:** 8-10 hours of focused work

---

## ROLLBACK PLAN

At any point, if issues arise:

1. **Immediate:** Revert last commit
   ```bash
   git reset --hard HEAD~1
   ```

2. **If tests fail:** Check test output, fix imports, re-run

3. **If API breaks:** Check `npm run verify:api` output, fix exports

4. **Nuclear option:** Revert to baseline
   ```bash
   git reset --hard <baseline-commit-sha>
   ```

---

## SUCCESS CRITERIA

✅ All 146 tests passing
✅ Public API unchanged (verified by script)
✅ Build succeeds (ESM + CJS)
✅ Root directory clean (<15 files)
✅ Architecture documented
✅ CI/CD active
✅ Package verified (npm pack)
✅ Ready for public release
✅ Ready for org transfer

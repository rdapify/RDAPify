# RDAPify Refactoring Plan

## 📊 Current State Analysis

### Test Status
✅ **All 146 tests passing** (7 test suites)
- Unit tests: 6 suites
- Integration tests: 1 suite
- Coverage: Good (cache, validators, helpers, SSRF, bootstrap, errors)

### File Structure
```
src/
├── cache/           (2 files, 373 LOC)
├── client/          (1 file, 339 LOC) ⚠️
├── fetcher/         (3 files, 639 LOC)
├── normalizer/      (2 files, 379 LOC)
├── types/           (3 files, 603 LOC)
├── utils/           (2 files, 477 LOC)
└── index.ts         (104 LOC)
```

### Public API Surface (src/index.ts)
**Exports (40+ items):**
- 1 class: `RDAPClient`
- 18 types: Response types, enums, options
- 10 error classes + 5 type guards
- 11 validator/normalizer utilities
- 1 interface: `ICache`
- 1 constant: `VERSION`
- 1 default export: `RDAPClient`

### Issues Identified

#### 1. Large Files (>250 LOC)
- ✅ `RDAPClient.ts` (339 LOC) - Orchestration + retry + config
- ⚠️ `validators.ts` (243 LOC) - Domain, IP, ASN validators mixed
- ⚠️ `types/index.ts` (248 LOC) - All type definitions
- ⚠️ `Normalizer.ts` (239 LOC) - Multiple normalizers
- ⚠️ `helpers.ts` (234 LOC) - Unrelated utilities

#### 2. Responsibility Mixing
- **RDAPClient**: Handles orchestration, retry logic, option normalization, cache coordination
- **fetcher/**: Contains BootstrapDiscovery (not just fetching)
- **normalizer/**: Contains PIIRedactor (not just normalization)
- **utils/**: Mixed concerns (async, string, network, runtime detection)

#### 3. Code Duplication
- Cache checking pattern repeated in `domain()`, `ip()`, `asn()` methods
- Validation + normalization pattern repeated
- Retry logic could be extracted

#### 4. Naming Inconsistencies
- `fetcher/` contains non-fetching code
- `normalizer/` contains privacy code
- `utils/` is too generic

#### 5. Missing Abstractions
- No query service layer
- No protocol-specific handlers
- Retry logic embedded in client

## 🎯 Refactoring Goals

### Primary Goals
1. ✅ **Preserve public API** - No breaking changes
2. ✅ **Keep all tests passing** - Run after each step
3. ✅ **Improve maintainability** - Clear separation of concerns
4. ✅ **Reduce file sizes** - Split large files (<250 LOC target)
5. ✅ **Remove duplication** - DRY principle

### Secondary Goals
1. Better internal organization
2. Clearer module boundaries
3. Easier to extend
4. Better for new contributors

## 📋 Incremental Refactoring Steps

### Phase 1: API Lock & Baseline ✅
**Status: COMPLETE**
- [x] Document current exports
- [x] Run all tests (146 passing)
- [x] Create refactor plan

### Phase 2: Internal Modularization (No File Moves)
**Goal: Split large files, extract helpers, remove duplication**

#### Step 2.1: Extract Query Orchestration ✅
- [x] Create `client/QueryOrchestrator.ts`
- [x] Extract common query pattern (validate → cache check → fetch → normalize → cache set → redact)
- [x] Update `RDAPClient` to use orchestrator
- [x] **Checkpoint: Run tests** - ✅ 146/146 passing
- [x] **Result**: RDAPClient reduced from 339 LOC to 242 LOC (-97 lines)

#### Step 2.2: Split Validators
- Create `utils/validators/` directory
- Split into: `domain.ts`, `ip.ts`, `asn.ts`, `network.ts`
- Keep `utils/validators.ts` as re-export barrel
- **Checkpoint: Run tests**

#### Step 2.3: Split Helpers
- Create `utils/helpers/` directory
- Split into: `async.ts`, `string.ts`, `network.ts`, `runtime.ts`
- Keep `utils/helpers.ts` as re-export barrel
- **Checkpoint: Run tests**

#### Step 2.4: Extract Retry Logic
- Create `client/RetryHandler.ts`
- Move retry logic from `RDAPClient`
- **Checkpoint: Run tests**

### Phase 3: Gradual Reorganization (With Compatibility Shims)
**Goal: Move to clearer structure with backward compatibility**

#### Step 3.1: Create New Structure
```
src/
├── core/
│   ├── client/
│   │   ├── RDAPClient.ts
│   │   ├── QueryOrchestrator.ts
│   │   └── RetryHandler.ts
│   └── services/
│       └── (future)
├── infrastructure/
│   ├── cache/
│   │   ├── CacheManager.ts
│   │   └── InMemoryCache.ts
│   ├── http/
│   │   └── Fetcher.ts
│   └── bootstrap/
│       └── BootstrapDiscovery.ts
├── domain/
│   ├── models/
│   │   └── (types from types/index.ts)
│   ├── normalizers/
│   │   ├── Normalizer.ts
│   │   └── PIIRedactor.ts
│   └── validators/
│       └── (split validators)
├── security/
│   └── SSRFProtection.ts
├── shared/
│   ├── types/
│   │   ├── errors.ts
│   │   └── options.ts
│   └── utils/
│       └── (split helpers)
└── index.ts (unchanged public API)
```

#### Step 3.2: Move with Shims
- Move files to new locations
- Create re-export shims in old locations
- Update internal imports gradually
- **Checkpoint: Run tests after each module move**

#### Step 3.3: Update Internal Imports
- Replace old paths with new paths
- Remove shims one by one
- **Checkpoint: Run tests**

### Phase 4: Cleanup & Documentation
**Goal: Remove shims, update docs, verify**

#### Step 4.1: Remove Compatibility Shims
- Delete old re-export files
- Verify no internal imports remain
- **Checkpoint: Run tests**

#### Step 4.2: Update Documentation
- Update internal architecture docs
- Add migration notes (if needed)
- Update README if structure mentioned

#### Step 4.3: Final Verification
- Run full test suite
- Run build
- Run lint
- Verify public API unchanged

## 🔒 Constraints & Safety Measures

### Hard Constraints
1. ✅ Public API in `src/index.ts` must remain identical
2. ✅ All 146 tests must pass after each checkpoint
3. ✅ No behavior changes (logic stays identical)
4. ✅ ESM + CJS support maintained
5. ✅ Security guarantees preserved (SSRF + PII)

### Safety Measures
1. Run tests after every file change
2. Use re-export shims during transition
3. Keep git commits small and atomic
4. Document each step
5. Rollback if tests fail

## 📝 Success Criteria

### Must Have
- [ ] All 146 tests passing
- [ ] Public API unchanged
- [ ] Build succeeds
- [ ] Lint passes
- [ ] No breaking changes

### Nice to Have
- [ ] All files <250 LOC
- [ ] Clear module boundaries
- [ ] Reduced duplication
- [ ] Better internal docs

## 🚀 Execution Plan

### Immediate Next Steps
1. Start Phase 2.1: Extract QueryOrchestrator
2. Run tests
3. Commit
4. Continue to Phase 2.2

### Estimated Timeline
- Phase 2: 4-6 steps (internal modularization)
- Phase 3: 8-10 steps (reorganization with shims)
- Phase 4: 3-4 steps (cleanup)
- Total: ~15-20 checkpoints with tests

---

**Status: Ready to begin Phase 2.1**
**Last Test Run: 146/146 passing ✅**

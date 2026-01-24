# Release Process

Official release process for RDAPify maintainers.

## Versioning Strategy

RDAPify follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE]

Examples:
- 0.1.0-alpha.4  (current)
- 0.2.0-beta.1   (upcoming)
- 1.0.0          (stable)
- 1.1.0          (feature)
- 1.1.1          (bugfix)
```

### Version Increments

- **MAJOR**: Breaking changes (API changes, removed features)
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)
- **PRERELEASE**: Alpha, beta, rc (release candidate)

## Release Cycle

### Standard Releases
- **Frequency**: Monthly (first week of month)
- **Type**: Minor or Patch
- **Support**: Until next release

### LTS Releases
- **Frequency**: Bi-annual (January, July)
- **Type**: Major or Minor
- **Support**: 12 months
- **Security**: 18 months

### Security Releases
- **Frequency**: Immediate (as needed)
- **Type**: Patch
- **Support**: All active versions

## Release Types

### Alpha (0.x.x-alpha.x)
- **Purpose**: Early testing, unstable API
- **Audience**: Early adopters, contributors
- **Support**: None
- **Breaking Changes**: Allowed

### Beta (0.x.x-beta.x)
- **Purpose**: Feature complete, API stabilizing
- **Audience**: Testers, early production users
- **Support**: Best effort
- **Breaking Changes**: Discouraged

### Release Candidate (x.x.x-rc.x)
- **Purpose**: Final testing before stable
- **Audience**: Production users (cautious)
- **Support**: Full support
- **Breaking Changes**: Not allowed

### Stable (x.x.x)
- **Purpose**: Production ready
- **Audience**: All users
- **Support**: Full support
- **Breaking Changes**: Only in MAJOR versions

## Release Checklist

### 1. Pre-Release (1 week before)

#### Code Freeze
- [ ] Create release branch: `release/v0.2.0`
- [ ] Announce code freeze to team
- [ ] Only bug fixes allowed

#### Testing
- [ ] All tests passing: `npm test`
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Performance benchmarks acceptable
- [ ] Security audit passed: `npm audit`
- [ ] Cross-platform testing (Node 16, 18, 20)

#### Documentation
- [ ] Update CHANGELOG.md with all changes
- [ ] Update version in package.json
- [ ] Update version in documentation
- [ ] Review and update README.md
- [ ] Update API documentation
- [ ] Update migration guide (if breaking changes)

#### Quality Checks
- [ ] `npm run verify` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npm run verify:api` passes (no breaking changes)
- [ ] Code coverage >90%

### 2. Release Day

#### Version Bump
```bash
# For patch release
npm version patch

# For minor release
npm version minor

# For major release
npm version major

# For prerelease
npm version prerelease --preid=alpha
```

#### Build & Test
```bash
# Clean build
npm run clean
npm install
npm run build

# Final verification
npm run verify

# Test package locally
npm pack
npm install -g rdapify-0.2.0.tgz
```

#### Git Operations
```bash
# Commit version bump
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v0.2.0"

# Create tag
git tag -a v0.2.0 -m "Release v0.2.0"

# Push to remote
git push origin main
git push origin v0.2.0
```

#### Publish to npm
```bash
# Dry run first
npm publish --dry-run

# Publish (stable)
npm publish

# Publish (prerelease)
npm publish --tag alpha
npm publish --tag beta
npm publish --tag next
```

#### GitHub Release
1. Go to https://github.com/rdapify/rdapify/releases
2. Click "Draft a new release"
3. Select tag: `v0.2.0`
4. Title: `v0.2.0 - Release Name`
5. Copy content from CHANGELOG.md
6. Attach built artifacts (if any)
7. Mark as pre-release (if applicable)
8. Publish release

### 3. Post-Release

#### Announcements
- [ ] Update website with new version
- [ ] Post on GitHub Discussions
- [ ] Tweet announcement (if applicable)
- [ ] Update Discord (if applicable)
- [ ] Email newsletter (if applicable)

#### Documentation
- [ ] Deploy updated documentation
- [ ] Update examples with new version
- [ ] Update integration guides

#### Monitoring
- [ ] Monitor npm downloads
- [ ] Monitor GitHub issues
- [ ] Monitor error tracking (if configured)
- [ ] Check CI/CD pipelines

#### Cleanup
- [ ] Merge release branch to main
- [ ] Delete release branch
- [ ] Close milestone (if used)
- [ ] Update project board

## Hotfix Process

For critical bugs in production:

```bash
# Create hotfix branch from tag
git checkout -b hotfix/v1.0.1 v1.0.0

# Fix the bug
# ... make changes ...

# Test thoroughly
npm run verify

# Version bump (patch)
npm version patch

# Commit and tag
git commit -am "fix: critical bug in cache"
git tag -a v1.0.1 -m "Hotfix v1.0.1"

# Merge to main and develop
git checkout main
git merge hotfix/v1.0.1
git checkout develop
git merge hotfix/v1.0.1

# Push
git push origin main develop v1.0.1

# Publish
npm publish
```

## Rollback Process

If a release has critical issues:

```bash
# Deprecate bad version
npm deprecate rdapify@0.2.0 "Critical bug, use 0.2.1 instead"

# Publish fixed version immediately
npm version patch
npm publish

# Update documentation
# Announce rollback
```

## Version Support Matrix

| Version | Status | Release Date | End of Support | Security Fixes |
|---------|--------|--------------|----------------|----------------|
| 0.1.x   | Alpha  | Jan 2026     | Feb 2026       | No             |
| 0.2.x   | Beta   | Feb 2026     | Mar 2026       | Best effort    |
| 1.0.x   | LTS    | Jul 2026     | Jul 2027       | Jul 2027       |
| 1.1.x   | Current| Aug 2026     | Sep 2026       | Sep 2026       |

## Breaking Changes Policy

### Major Version (x.0.0)
- API changes allowed
- Deprecation warnings in previous minor
- Migration guide required
- 6-month notice period

### Minor Version (0.x.0)
- New features only
- No breaking changes
- Deprecation warnings allowed
- Backward compatible

### Patch Version (0.0.x)
- Bug fixes only
- No new features
- No breaking changes
- No deprecations

## Deprecation Process

1. **Announce**: Add deprecation warning in code
2. **Document**: Update documentation with alternatives
3. **Wait**: Keep for at least one minor version
4. **Remove**: Remove in next major version

```typescript
/**
 * @deprecated Use newMethod() instead. Will be removed in v2.0.0
 */
function oldMethod() {
  console.warn('oldMethod is deprecated, use newMethod instead');
  return newMethod();
}
```

## Emergency Release

For critical security vulnerabilities:

1. **Immediate**: Fix and test
2. **Fast-track**: Skip normal release cycle
3. **Publish**: Release within 24 hours
4. **Notify**: Security advisory on GitHub
5. **Backport**: Apply to all supported versions

## Release Automation

### GitHub Actions
- Automated testing on PR
- Automated build on merge
- Automated publish on tag (future)
- Automated changelog generation (future)

### npm Scripts
```bash
npm run release:patch   # Patch release
npm run release:minor   # Minor release
npm run release:major   # Major release
```

## Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [0.2.0] - 2026-02-01

### Added
- New Redis cache adapter
- Batch query support

### Changed
- Improved error messages
- Updated dependencies

### Deprecated
- Old cache API (use CacheManager instead)

### Removed
- Legacy bootstrap method

### Fixed
- Memory leak in cache
- Type errors in normalizer

### Security
- Fixed SSRF vulnerability in fetcher
```

## Resources

- **Semantic Versioning**: https://semver.org/
- **Keep a Changelog**: https://keepachangelog.com/
- **Conventional Commits**: https://www.conventionalcommits.org/

## Contact

For release questions:
- **Maintainers**: See MAINTAINERS.md
- **Security**: See SECURITY.md
- **Issues**: https://github.com/rdapify/rdapify/issues

---

**Last Updated**: January 24, 2026  
**Version**: 0.1.0-alpha.4

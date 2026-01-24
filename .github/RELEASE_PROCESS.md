# Release Process for RDAPify

This document describes the release process for RDAPify maintainers.

## Release Types

### Alpha Releases (0.x.x-alpha.y)
- **Frequency**: As needed (weekly during active development)
- **Purpose**: Early testing, breaking changes allowed
- **Stability**: Experimental
- **Support**: No support guarantee

### Beta Releases (0.x.x-beta.y)
- **Frequency**: Monthly
- **Purpose**: Feature complete, API stabilizing
- **Stability**: Mostly stable
- **Support**: Bug fixes only

### Stable Releases (x.y.z)
- **Frequency**: Quarterly
- **Purpose**: Production-ready
- **Stability**: Stable
- **Support**: Full support

### LTS Releases (x.0.0-lts)
- **Frequency**: Every 6 months
- **Purpose**: Long-term support
- **Stability**: Very stable
- **Support**: 18 months of support

## Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

- **Major (X.0.0)**: Breaking changes
- **Minor (0.X.0)**: New features (backward compatible)
- **Patch (0.0.X)**: Bug fixes (backward compatible)

### Pre-release Tags
- `alpha`: Early development
- `beta`: Feature complete, stabilizing
- `rc`: Release candidate

## Release Checklist

### 1. Pre-Release (1 week before)

- [ ] **Review Roadmap**
  - Check completed features
  - Move incomplete items to next release

- [ ] **Update Dependencies**
  ```bash
  npm outdated
  npm update
  npm audit fix
  ```

- [ ] **Run Full Test Suite**
  ```bash
  npm run verify
  npm run test:coverage
  npm run benchmark
  ```

- [ ] **Check Documentation**
  - API docs up to date
  - Examples working
  - Migration guide (if breaking changes)

- [ ] **Security Audit**
  ```bash
  npm audit
  npm run test:security
  ```

### 2. Prepare Release (2-3 days before)

- [ ] **Create Release Branch**
  ```bash
  git checkout -b release/v0.2.0
  ```

- [ ] **Update Version**
  ```bash
  npm version 0.2.0 --no-git-tag-version
  ```

- [ ] **Update CHANGELOG.md**
  ```markdown
  ## [0.2.0] - 2025-01-24
  
  ### Added
  - New feature X
  - New feature Y
  
  ### Changed
  - Improved performance of Z
  
  ### Fixed
  - Bug in component A
  
  ### Breaking Changes
  - Renamed method B to C
  ```

- [ ] **Update README.md**
  - Version badges
  - New features mentioned
  - Updated examples

- [ ] **Update Migration Guide** (if breaking changes)
  - Create `docs/migrations/v0.1-to-v0.2.md`
  - Document all breaking changes
  - Provide migration examples

- [ ] **Generate Release Notes**
  ```bash
  # Use GitHub CLI
  gh release create v0.2.0 --generate-notes --draft
  ```

### 3. Testing Phase (1-2 days)

- [ ] **Integration Testing**
  ```bash
  npm run test:integration
  npm run test:e2e
  ```

- [ ] **Performance Testing**
  ```bash
  npm run benchmark
  # Compare with previous release
  ```

- [ ] **Compatibility Testing**
  - Test on Node.js 16, 18, 20
  - Test on Windows, macOS, Linux
  - Test with different package managers (npm, yarn, pnpm)

- [ ] **Documentation Review**
  - Technical review by docs team
  - Spelling and grammar check
  - Link validation

- [ ] **Security Review**
  - Review by security team
  - Check for new vulnerabilities
  - Verify SSRF protection
  - Verify PII redaction

### 4. Release Day

- [ ] **Final Checks**
  ```bash
  npm run verify
  npm pack --dry-run
  ```

- [ ] **Merge Release Branch**
  ```bash
  git checkout main
  git merge release/v0.2.0
  ```

- [ ] **Create Git Tag**
  ```bash
  git tag -a v0.2.0 -m "Release v0.2.0"
  ```

- [ ] **Push to GitHub**
  ```bash
  git push origin main
  git push origin v0.2.0
  ```

- [ ] **Verify CI/CD**
  - Wait for GitHub Actions to complete
  - Verify all checks pass
  - Verify npm publish succeeds

- [ ] **Verify npm Package**
  ```bash
  npm view rdapify@0.2.0
  npm install rdapify@0.2.0
  ```

- [ ] **Create GitHub Release**
  - Go to https://github.com/rdapify/rdapify/releases
  - Edit draft release
  - Add release notes from CHANGELOG
  - Attach any binaries (if applicable)
  - Publish release

### 5. Post-Release (same day)

- [ ] **Announce Release**
  - GitHub Discussions (Announcements)
  - Twitter/Social media (if available)
  - Discord/Matrix (if available)
  - Email newsletter (if available)

- [ ] **Update Documentation Site**
  - Deploy new version docs
  - Update version selector
  - Update homepage

- [ ] **Monitor for Issues**
  - Watch GitHub Issues
  - Monitor npm downloads
  - Check error tracking (if configured)

- [ ] **Update Project Board**
  - Move completed items to "Done"
  - Create milestone for next release

### 6. Follow-up (1 week after)

- [ ] **Gather Feedback**
  - Review GitHub Issues
  - Check Discussions
  - Monitor social media

- [ ] **Plan Patch Release** (if needed)
  - Critical bugs
  - Security issues
  - Documentation fixes

- [ ] **Update Roadmap**
  - Plan next release
  - Prioritize features
  - Update ROADMAP.md

## Emergency Releases

For critical security issues or major bugs:

### Fast-Track Process

1. **Identify Issue**
   - Severity assessment
   - Impact analysis

2. **Create Hotfix Branch**
   ```bash
   git checkout -b hotfix/v0.2.1 v0.2.0
   ```

3. **Fix and Test**
   - Minimal changes
   - Focused testing
   - Security review

4. **Release Immediately**
   - Skip normal waiting period
   - Expedited review
   - Immediate announcement

5. **Post-Mortem**
   - Document what happened
   - Improve processes
   - Update tests

## Release Automation

### GitHub Actions

Our CI/CD automatically:
- Runs tests on tag push
- Builds package
- Publishes to npm
- Creates GitHub release
- Notifies team

### Manual Steps

Some steps require manual intervention:
- Version number decision
- CHANGELOG writing
- Release notes editing
- Announcement writing

## Release Roles

### Release Manager
- Coordinates release
- Ensures checklist completion
- Makes final go/no-go decision
- Announces release

### Reviewers
- Review code changes
- Test release candidate
- Approve release

### Security Team
- Security review
- Vulnerability assessment
- Approve security-sensitive changes

## Communication

### Before Release
- Announce in Discussions (1 week before)
- Notify contributors of deadline
- Request testing help

### During Release
- Status updates in Discussions
- Real-time updates in chat (if available)

### After Release
- Release announcement
- Thank contributors
- Highlight new features

## Rollback Procedure

If critical issues found after release:

1. **Assess Severity**
   - Can it wait for patch?
   - Does it require immediate rollback?

2. **Deprecate Version** (if needed)
   ```bash
   npm deprecate rdapify@0.2.0 "Critical bug, use 0.2.1"
   ```

3. **Release Patch**
   - Follow emergency release process
   - Fix issue
   - Release new version

4. **Communicate**
   - Announce issue
   - Provide workaround
   - Announce fix

## Metrics to Track

- **Release Frequency**: Target vs actual
- **Time to Release**: From branch to publish
- **Bug Count**: Issues found post-release
- **Adoption Rate**: npm downloads
- **Feedback**: Community response

## Tools

- **GitHub CLI**: `gh` for release management
- **npm**: Package publishing
- **Semantic Release**: Automated versioning (optional)
- **Changesets**: Changelog management (optional)

## Resources

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [npm Publishing](https://docs.npmjs.com/cli/v8/commands/npm-publish)

---

**Last Updated:** 2025-01-24  
**Next Review:** 2025-04-24  
**Questions?** Contact @rdapify/core

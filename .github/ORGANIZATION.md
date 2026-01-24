# RDAPify GitHub Organization Guide

## Overview

RDAPify is organized as a GitHub Organization to facilitate collaboration, maintain code quality, and provide a professional open-source experience.

## Organization Structure

### Teams

#### 1. Core Team (@rdapify/core)
**Responsibilities:**
- Review and merge pull requests
- Make architectural decisions
- Manage releases
- Set project direction

**Permissions:** Admin access to all repositories

**Members:**
- Project maintainers (see MAINTAINERS.md)

#### 2. Contributors Team (@rdapify/contributors)
**Responsibilities:**
- Submit pull requests
- Review code
- Report and fix bugs
- Improve documentation

**Permissions:** Write access after first merged PR

**How to join:**
- Make meaningful contributions
- Get nominated by a core team member

#### 3. Documentation Team (@rdapify/docs)
**Responsibilities:**
- Maintain documentation
- Write tutorials and guides
- Translate documentation
- Improve examples

**Permissions:** Write access to docs/ and website/

**How to join:**
- Submit documentation improvements
- Express interest in GitHub Discussions

#### 4. Security Team (@rdapify/security)
**Responsibilities:**
- Review security reports
- Implement security fixes
- Conduct security audits
- Maintain security documentation

**Permissions:** Access to security advisories

**How to join:**
- Demonstrate security expertise
- Get invited by core team

### Repositories

#### Main Repository: `rdapify/rdapify`
- Core library code
- Main documentation
- Issue tracking
- Release management

#### Documentation Site: `rdapify/rdapify.com` (planned)
- Website source code
- Interactive examples
- API documentation
- Blog posts

#### Examples Repository: `rdapify/examples` (planned)
- Real-world use cases
- Integration examples
- Starter templates
- Best practices

## Joining the Organization

### For New Contributors

1. **Start Contributing:**
   - Fork the repository
   - Make improvements
   - Submit pull requests
   - Participate in discussions

2. **Get Recognized:**
   - After 3+ merged PRs, you may be invited to join
   - Core team will reach out via GitHub

3. **Accept Invitation:**
   - Check your email for GitHub invitation
   - Accept and set your membership visibility

### For Team Members

**Expectations:**
- Follow CODE_OF_CONDUCT.md
- Respect CONTRIBUTING.md guidelines
- Participate actively
- Help newcomers
- Maintain code quality

**Benefits:**
- Direct commit access (for contributors team)
- Listed in organization members
- Influence project direction
- Early access to features
- Recognition in releases

## Communication Channels

### GitHub Discussions
- General questions
- Feature proposals
- Community chat
- Show and tell

### GitHub Issues
- Bug reports
- Feature requests
- Task tracking

### Pull Requests
- Code reviews
- Implementation discussions
- Technical decisions

### Security
- Private security advisories
- Email: security@rdapify.com (planned)

## Decision Making

### Minor Changes
- Any team member can approve
- 1 approval required
- Automated checks must pass

### Major Changes
- Core team discussion required
- 2+ approvals from core team
- Community feedback considered
- RFC process for breaking changes

### Breaking Changes
- RFC (Request for Comments) required
- Community discussion period (2 weeks)
- Core team consensus
- Migration guide required

## Repository Settings

### Branch Protection (main)
- ✅ Require pull request reviews (1 approval)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Require signed commits (recommended)
- ✅ Include administrators

### Required Status Checks
- CI tests (all Node.js versions)
- Linting
- Type checking
- Security audit
- Build success

### Labels
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `security` - Security-related issues
- `breaking change` - Breaking API changes
- `needs discussion` - Requires team discussion

## Release Process

### Version Numbering
Follow Semantic Versioning (semver):
- **Major (X.0.0):** Breaking changes
- **Minor (0.X.0):** New features (backward compatible)
- **Patch (0.0.X):** Bug fixes

### Release Cycle
- **Alpha:** Weekly (as needed)
- **Beta:** Monthly
- **Stable:** Quarterly
- **LTS:** Every 6 months

### Release Checklist
1. Update CHANGELOG.md
2. Update version in package.json
3. Run full test suite
4. Create git tag
5. Push tag (triggers CI/CD)
6. Verify npm publish
7. Create GitHub release
8. Announce in discussions

## Code of Conduct Enforcement

### Reporting
- Email: conduct@rdapify.com (planned)
- Private message to core team member
- GitHub private security advisory

### Response
- Core team reviews within 48 hours
- Investigation conducted
- Action taken if needed
- Reporter notified of outcome

### Actions
- Warning
- Temporary ban
- Permanent ban
- Removal from organization

## Resources

- **Main Repository:** https://github.com/rdapify/rdapify
- **Documentation:** https://github.com/rdapify/rdapify/tree/main/docs
- **Contributing Guide:** https://github.com/rdapify/rdapify/blob/main/CONTRIBUTING.md
- **Code of Conduct:** https://github.com/rdapify/rdapify/blob/main/CODE_OF_CONDUCT.md
- **Security Policy:** https://github.com/rdapify/rdapify/blob/main/SECURITY.md

## Questions?

- Open a discussion: https://github.com/rdapify/rdapify/discussions
- Email core team: team@rdapify.com (planned)
- Check FAQ: https://github.com/rdapify/rdapify/discussions/categories/q-a

---

**Last Updated:** 2025-01-24  
**Version:** 1.0

# GitHub Organization Setup Guide for RDAPify

This guide walks you through setting up the RDAPify GitHub Organization professionally.

## Prerequisites

- GitHub account with organization creation permissions
- Admin access to rdapify repository
- Understanding of GitHub Organizations

## Step 1: Create GitHub Organization

### 1.1 Create Organization

1. Go to https://github.com/organizations/new
2. Choose organization name: `rdapify`
3. Contact email: `team@rdapify.com` (or your email)
4. Organization type: **Open Source** (free)
5. Click "Create organization"

### 1.2 Configure Organization Profile

1. Go to https://github.com/rdapify
2. Click "Settings"
3. Fill in:
   - **Display name**: RDAPify
   - **Description**: Unified, secure, high-performance RDAP client for enterprise applications
   - **URL**: https://rdapify.com (or GitHub Pages URL)
   - **Email**: team@rdapify.com
   - **Location**: Global
   - **Twitter**: @rdapify (if available)

### 1.3 Add Organization README

1. Create repository: `rdapify/.github`
2. Add `profile/README.md`:

```markdown
# RDAPify

> Unified, secure, high-performance RDAP client for enterprise applications

## 🚀 Projects

- **[rdapify](https://github.com/rdapify/rdapify)** - Core library
- **[rdapify.com](https://github.com/rdapify/rdapify.com)** - Documentation site (planned)
- **[examples](https://github.com/rdapify/examples)** - Real-world examples (planned)

## 📚 Resources

- [Documentation](https://github.com/rdapify/rdapify/tree/main/docs)
- [Contributing Guide](https://github.com/rdapify/rdapify/blob/main/CONTRIBUTING.md)
- [Community](https://github.com/rdapify/rdapify/discussions)

## 🤝 Get Involved

We welcome contributions! Check out our [Contributing Guide](https://github.com/rdapify/rdapify/blob/main/CONTRIBUTING.md).
```

## Step 2: Transfer Repository

### 2.1 Prepare Repository

Before transferring, ensure:
- [ ] All issues are closed or documented
- [ ] All PRs are merged or documented
- [ ] README.md references are updated
- [ ] CI/CD secrets are documented
- [ ] Collaborators are notified

### 2.2 Transfer Process

1. Go to repository Settings
2. Scroll to "Danger Zone"
3. Click "Transfer ownership"
4. Enter: `rdapify/rdapify`
5. Confirm transfer

### 2.3 Post-Transfer Updates

Update these URLs in all files:
- `package.json`: repository.url
- `README.md`: all GitHub links
- `CONTRIBUTING.md`: all GitHub links
- `.github/workflows/*.yml`: any hardcoded URLs

```bash
# Find and replace (review before running)
find . -type f -name "*.md" -exec sed -i 's|github.com/YOUR_USERNAME/rdapify|github.com/rdapify/rdapify|g' {} +
```

## Step 3: Create Teams

### 3.1 Core Team

1. Go to https://github.com/orgs/rdapify/teams
2. Click "New team"
3. Name: `core`
4. Description: Core maintainers with full access
5. Visibility: Visible
6. Click "Create team"
7. Add members (initial maintainers)
8. Set repository permissions:
   - rdapify/rdapify: **Admin**

### 3.2 Contributors Team

1. Create team: `contributors`
2. Description: Active contributors with write access
3. Visibility: Visible
4. Repository permissions:
   - rdapify/rdapify: **Write**

### 3.3 Documentation Team

1. Create team: `docs`
2. Description: Documentation maintainers
3. Visibility: Visible
4. Repository permissions:
   - rdapify/rdapify: **Write** (docs/ and website/ only - configure via branch protection)

### 3.4 Security Team

1. Create team: `security`
2. Description: Security review and response
3. Visibility: Secret (for security advisories)
4. Repository permissions:
   - rdapify/rdapify: **Maintain**

## Step 4: Configure Repository Settings

### 4.1 General Settings

1. Go to repository Settings
2. Configure:
   - [ ] **Features**:
     - ✅ Issues
     - ✅ Projects
     - ✅ Discussions
     - ✅ Wiki (optional)
   - [ ] **Pull Requests**:
     - ✅ Allow squash merging
     - ✅ Allow auto-merge
     - ✅ Automatically delete head branches
   - [ ] **Archives**:
     - ❌ Do not archive

### 4.2 Branch Protection Rules

#### Main Branch Protection

1. Go to Settings → Branches
2. Add rule for `main`:
   - [ ] **Require pull request reviews**:
     - Required approvals: 1
     - Dismiss stale reviews: ✅
     - Require review from Code Owners: ✅
   - [ ] **Require status checks**:
     - ✅ Require branches to be up to date
     - Required checks:
       - `test (ubuntu-latest, 16.x)`
       - `test (ubuntu-latest, 18.x)`
       - `test (ubuntu-latest, 20.x)`
       - `build`
       - `security`
   - [ ] **Require conversation resolution**: ✅
   - [ ] **Require signed commits**: ✅ (recommended)
   - [ ] **Include administrators**: ✅
   - [ ] **Restrict pushes**: core team only

#### Develop Branch Protection (if using)

Same as main, but:
- Required approvals: 1
- Can be less strict for experimentation

### 4.3 Code Security and Analysis

1. Go to Settings → Security & analysis
2. Enable:
   - [ ] **Dependency graph**: ✅
   - [ ] **Dependabot alerts**: ✅
   - [ ] **Dependabot security updates**: ✅
   - [ ] **Code scanning**: ✅ (CodeQL)
   - [ ] **Secret scanning**: ✅

### 4.4 Secrets and Variables

Add these secrets (Settings → Secrets and variables → Actions):

**Required:**
- `NPM_TOKEN`: npm publish token

**Optional:**
- `CODECOV_TOKEN`: Code coverage reporting
- `SNYK_TOKEN`: Security scanning

**How to get NPM_TOKEN:**
```bash
# Login to npm
npm login

# Create token
npm token create --read-only=false

# Add to GitHub Secrets
```

## Step 5: Configure GitHub Actions

### 5.1 Actions Permissions

1. Go to Settings → Actions → General
2. Configure:
   - [ ] **Actions permissions**: Allow all actions
   - [ ] **Workflow permissions**: Read and write
   - [ ] **Allow GitHub Actions to create PRs**: ✅

### 5.2 Required Workflows

Ensure these workflows exist:
- [ ] `.github/workflows/ci.yml` - Continuous Integration
- [ ] `.github/workflows/release.yml` - Release automation
- [ ] `.github/workflows/codeql.yml` - Security scanning

## Step 6: Configure Issue Templates

Already created in `.github/ISSUE_TEMPLATE/`:
- [ ] `bug_report.md`
- [ ] `feature_request.md`
- [ ] `security_vulnerability.md`

Verify they appear when creating new issues.

## Step 7: Configure Labels

### 7.1 Default Labels

Keep these default labels:
- `bug`
- `documentation`
- `duplicate`
- `enhancement`
- `good first issue`
- `help wanted`
- `invalid`
- `question`
- `wontfix`

### 7.2 Add Custom Labels

Add these labels (Settings → Labels):

**Priority:**
- `priority: critical` (red) - Critical issues
- `priority: high` (orange) - High priority
- `priority: medium` (yellow) - Medium priority
- `priority: low` (green) - Low priority

**Type:**
- `type: security` (red) - Security issues
- `type: performance` (blue) - Performance improvements
- `type: breaking` (red) - Breaking changes
- `type: refactor` (purple) - Code refactoring

**Status:**
- `status: needs-discussion` (yellow) - Needs discussion
- `status: needs-review` (orange) - Needs review
- `status: blocked` (red) - Blocked
- `status: in-progress` (blue) - In progress

**Area:**
- `area: core` (blue) - Core functionality
- `area: docs` (green) - Documentation
- `area: tests` (purple) - Testing
- `area: ci` (gray) - CI/CD

## Step 8: Configure Discussions

### 8.1 Enable Discussions

1. Go to Settings → Features
2. Enable Discussions: ✅

### 8.2 Configure Categories

Create these categories:

1. **Announcements** (Announcement type)
   - Description: Official project announcements
   - Format: Announcement

2. **Q&A** (Q&A type)
   - Description: Ask and answer questions
   - Format: Question/Answer

3. **Ideas** (Open discussion)
   - Description: Share ideas for new features
   - Format: Open-ended

4. **Show and Tell** (Open discussion)
   - Description: Share your projects using RDAPify
   - Format: Open-ended

5. **General** (Open discussion)
   - Description: General discussions
   - Format: Open-ended

## Step 9: Configure Projects (Optional)

### 9.1 Create Project Board

1. Go to Projects tab
2. Create new project: "RDAPify Roadmap"
3. Template: Kanban
4. Columns:
   - Backlog
   - To Do
   - In Progress
   - Review
   - Done

### 9.2 Link Issues

Link issues to project board automatically via automation.

## Step 10: Configure GitHub Pages (Optional)

### 10.1 Enable GitHub Pages

1. Go to Settings → Pages
2. Source: Deploy from branch
3. Branch: `gh-pages` or `main` (docs/)
4. Custom domain: `rdapify.com` (if available)

### 10.2 Add CNAME

If using custom domain:
```bash
echo "rdapify.com" > CNAME
git add CNAME
git commit -m "Add CNAME for GitHub Pages"
git push
```

## Step 11: Configure Webhooks (Optional)

### 11.1 Discord Webhook

For Discord notifications:
1. Create Discord webhook in your server
2. Go to Settings → Webhooks
3. Add webhook URL
4. Select events: Releases, Issues, Pull requests

### 11.2 Slack Webhook

Similar process for Slack integration.

## Step 12: Post-Setup Verification

### Checklist

- [ ] Organization profile complete
- [ ] Repository transferred
- [ ] Teams created and configured
- [ ] Branch protection enabled
- [ ] Security features enabled
- [ ] Secrets configured
- [ ] GitHub Actions working
- [ ] Issue templates working
- [ ] Labels configured
- [ ] Discussions enabled
- [ ] All links updated
- [ ] CI/CD passing

### Test Everything

1. **Create test issue**: Verify templates work
2. **Create test PR**: Verify CI runs
3. **Test discussions**: Create test discussion
4. **Test labels**: Apply labels to issues
5. **Test team permissions**: Verify access levels

## Step 13: Announce Migration

### 13.1 Create Announcement

Post in Discussions → Announcements:

```markdown
# 🎉 RDAPify is now a GitHub Organization!

We're excited to announce that RDAPify has moved to its own GitHub Organization!

## What's Changed

- **New URL**: https://github.com/rdapify/rdapify
- **Organization**: https://github.com/rdapify
- **Teams**: Core, Contributors, Docs, Security

## What's the Same

- Same codebase
- Same maintainers
- Same license (MIT)
- Same npm package

## What's New

- Professional organization structure
- Better team collaboration
- Clearer governance
- More resources for growth

## Action Required

If you have:
- **Forked the repo**: Update your fork's upstream
- **Cloned the repo**: Update your remote URL
- **Open PRs**: They've been transferred automatically

## Questions?

Ask in this discussion or open a new one!

Thank you for being part of the RDAPify community! 🚀
```

### 13.2 Update External Links

Update links on:
- [ ] npm package page
- [ ] Social media profiles
- [ ] Blog posts
- [ ] Documentation sites
- [ ] Stack Overflow tag wiki

## Maintenance

### Regular Tasks

**Weekly:**
- Review new issues
- Triage discussions
- Check CI/CD status

**Monthly:**
- Review team memberships
- Update documentation
- Check security alerts

**Quarterly:**
- Review governance
- Update roadmap
- Community survey

## Troubleshooting

### Common Issues

**Issue**: CI failing after transfer
**Solution**: Update secrets and repository URLs in workflows

**Issue**: Team members can't access
**Solution**: Check team membership and repository permissions

**Issue**: Branch protection too strict
**Solution**: Adjust rules in Settings → Branches

## Resources

- [GitHub Organizations Docs](https://docs.github.com/en/organizations)
- [Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

**Last Updated:** 2025-01-24  
**Questions?** Open a discussion or contact maintainers

# New Developer Onboarding Guide

Welcome to the RDAPify team! This guide will help you get started.

## Day 1: Setup

### 1. Development Environment
```bash
# Clone repository
git clone https://github.com/rdapify/rdapify.git
cd rdapify

# Install dependencies
npm install

# Verify setup
npm run verify
```

### 2. IDE Setup
- **Recommended**: VS Code
- Install recommended extensions (see `.vscode/extensions.json`)
- Settings are pre-configured in `.vscode/settings.json`

### 3. Read Documentation
- [ ] `README.md` - Project overview
- [ ] `ARCHITECTURE.md` - Architecture overview
- [ ] `DEVELOPMENT.md` - Development guide
- [ ] `CONTRIBUTING.md` - Contribution guidelines
- [ ] `src/README.md` - Source code structure

## Day 2-3: Understanding the Codebase

### Architecture
RDAPify uses **Clean Architecture** with 4 layers:
1. **Core** - Business logic (framework-agnostic)
2. **Infrastructure** - External implementations
3. **Application** - Orchestration
4. **Shared** - Cross-cutting concerns

### Key Components
- `RDAPClient` - Main entry point
- `QueryOrchestrator` - Query coordination
- `Fetcher` - HTTP client
- `BootstrapDiscovery` - Registry discovery
- `Normalizer` - Data transformation
- `CacheManager` - Caching layer
- `SSRFProtection` - Security validation
- `PIIRedactor` - Privacy protection

### Run Examples
```bash
# Try basic examples
node examples/basic/domain-lookup.js
node examples/basic/ip-lookup.js
node examples/basic/asn-lookup.js
```

## Week 1: First Contribution

### 1. Pick a Good First Issue
- Look for issues labeled `good-first-issue`
- Ask questions in issue comments
- Discuss approach before coding

### 2. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes
- Follow coding standards (see `DEVELOPMENT.md`)
- Write tests for new code
- Update documentation

### 4. Submit PR
```bash
# Run verification
npm run verify

# Commit changes
git add .
git commit -m "feat: add your feature"

# Push and create PR
git push origin feature/your-feature-name
```

## Week 2-4: Deep Dive

### Learn the Domain
- Read RDAP RFCs (see `docs/resources/rfcs.md`)
- Understand IANA Bootstrap
- Study test vectors in `test-vectors/`

### Explore Advanced Topics
- Security architecture (`docs/security/`)
- Performance optimization (`docs/performance/`)
- Plugin system (`docs/advanced/plugin-system.md`)

### Pair Programming
- Schedule sessions with team members
- Review PRs from other developers
- Ask questions in team chat

## Resources

### Documentation
- **Public Docs**: `docs/`
- **Internal Docs**: `.project/internal/`
- **Team Docs**: `.project/team/`

### Communication
- **GitHub Issues**: Bug reports and features
- **GitHub Discussions**: Questions and ideas
- **Discord**: (coming soon)

### Tools
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Husky**: Git hooks

## Common Tasks

### Run Tests
```bash
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:watch          # Watch mode
```

### Code Quality
```bash
npm run lint                # Check code style
npm run lint:fix            # Fix code style
npm run typecheck           # Type checking
npm run format              # Format code
```

### Build
```bash
npm run build               # Production build
npm run dev                 # Development mode (watch)
npm run clean               # Clean dist/
```

## Getting Help

### Questions?
1. Check documentation first
2. Search existing issues
3. Ask in team chat
4. Create discussion on GitHub

### Stuck?
- Don't hesitate to ask for help
- Schedule 1-on-1 with mentor
- Pair program with team member

### Found a Bug?
1. Check if already reported
2. Create minimal reproduction
3. Open issue with details
4. Tag with appropriate labels

## Team Culture

### Values
- **Quality**: We care about code quality
- **Collaboration**: We help each other
- **Learning**: We learn together
- **Respect**: We respect everyone

### Best Practices
- Write clear commit messages
- Keep PRs small and focused
- Review others' code thoughtfully
- Update documentation
- Write tests

### Code Review
- Be constructive and kind
- Explain your suggestions
- Ask questions to understand
- Approve when satisfied

## Next Steps

After onboarding:
1. Join team meetings
2. Pick up regular issues
3. Contribute to documentation
4. Help onboard new members

Welcome to the team! 🎉

---

**Questions?** Contact your mentor or team lead.

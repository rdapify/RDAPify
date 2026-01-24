# Kiro Configuration

This directory contains configuration for the Kiro AI assistant to provide context-aware assistance for the RDAPify project.

## Directory Structure

```
.kiro/
├── steering/          # High-level project context (always loaded)
│   ├── product.md
│   ├── tech.md
│   ├── structure.md
│   └── code-generation-rules.md
└── skills/           # Detailed implementation guides (loaded on demand)
    ├── rdapify-core-implementation/
    ├── rdapify-documentation/
    └── rdapify-testing/
```

## Steering Rules (Always Active)

- **product.md** - Product overview and value proposition
- **tech.md** - Technical stack, build commands, and development tools
- **structure.md** - Project organization and directory structure
- **code-generation-rules.md** - Critical rules for code generation quality

## Agent Skills (Progressive Disclosure)

Skills provide deep expertise for specific tasks:
- **rdapify-core-implementation** - Core library implementation patterns
- **rdapify-documentation** - Documentation standards and formats
- **rdapify-testing** - Testing strategies and patterns

See `../skills/README.md` for detailed skill documentation.

## How It Works

1. **Steering rules** are always loaded - they provide high-level context
2. **Skills** are loaded dynamically when relevant to the current task
3. Skills can reference additional files for deeper context
4. This keeps the AI focused while providing expertise on demand

## Updating Configuration

### Steering Rules
Update when:
- Project goals or architecture change
- New development workflows are established
- Critical patterns need to be enforced

### Skills
Update when:
- Implementation patterns evolve
- New best practices are discovered
- Security requirements change

Keep both concise and actionable.

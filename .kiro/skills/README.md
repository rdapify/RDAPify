# RDAPify Agent Skills

Agent Skills are modular capabilities that guide Kiro in implementing RDAPify features with precision and consistency.

## Available Skills

### 1. rdapify-core-implementation
**Purpose**: Implements core RDAP client functionality

**When to use**: Creating or modifying core library components (Client, Fetcher, Normalizer, Cache)

**Key files**:
- `SKILL.md` - Main implementation guide
- `architecture-patterns.md` - Design patterns and code structure
- `security-checklist.md` - Security validation requirements
- `test-vectors-guide.md` - How to use test vectors

### 2. rdapify-documentation
**Purpose**: Creates and maintains project documentation

**When to use**: Writing API docs, guides, or tutorials

**Key principles**:
- Code examples first
- Minimal explanations
- Real-world focus
- Security warnings included

### 3. rdapify-testing
**Purpose**: Implements comprehensive test suites

**When to use**: Writing unit, integration, or security tests

**Key principles**:
- Test behavior, not implementation
- Use real test vectors
- Fast and deterministic tests
- 80%+ code coverage

## How Skills Work

Skills use **progressive disclosure**:

1. **Level 1**: Skill name and description (always loaded)
2. **Level 2**: Full SKILL.md content (loaded when relevant)
3. **Level 3**: Additional reference files (loaded on demand)

This keeps context efficient while providing deep expertise when needed.

## Skill Structure

```
skill-name/
├── SKILL.md              # Main skill file with YAML frontmatter
├── reference-1.md        # Additional context (optional)
├── reference-2.md        # Additional context (optional)
└── scripts/              # Executable scripts (optional)
```

## Creating New Skills

When creating a new skill:

1. Create directory: `.kiro/skills/skill-name/`
2. Add `SKILL.md` with YAML frontmatter:
```yaml
---
name: Skill Name
description: Brief description of what this skill does
---
```
3. Add implementation guidance in markdown
4. Reference additional files using: `[[file:filename.md]]`
5. Update this README

## Best Practices

- Keep SKILL.md focused and concise
- Use code examples over explanations
- Include anti-patterns (what NOT to do)
- Reference test vectors when applicable
- Maintain security checklists for critical operations

## Integration with Steering Rules

Skills complement steering rules:
- **Steering rules**: High-level project context and principles
- **Skills**: Detailed implementation guidance for specific tasks

Both work together to ensure consistent, high-quality code generation.

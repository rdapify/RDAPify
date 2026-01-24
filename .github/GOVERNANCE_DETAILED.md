# RDAPify Governance Model - Detailed

This document provides detailed governance procedures for the RDAPify project.

## Table of Contents

- [Overview](#overview)
- [Roles and Responsibilities](#roles-and-responsibilities)
- [Decision Making Process](#decision-making-process)
- [RFC Process](#rfc-process)
- [Conflict Resolution](#conflict-resolution)
- [Voting Procedures](#voting-procedures)
- [Maintainer Nomination](#maintainer-nomination)
- [Code of Conduct Enforcement](#code-of-conduct-enforcement)

## Overview

RDAPify follows a **meritocratic governance model** where influence is earned through contributions and demonstrated expertise. The project is managed by a core team of maintainers who make decisions through consensus when possible, and voting when necessary.

### Principles

1. **Meritocracy**: Influence earned through contributions
2. **Transparency**: Open decision-making processes
3. **Inclusivity**: All voices heard and considered
4. **Consensus**: Prefer agreement over voting
5. **Accountability**: Clear responsibilities and expectations

## Roles and Responsibilities

### 1. Users

**Who:** Anyone using RDAPify

**Rights:**
- Use the software freely (MIT License)
- Report bugs and request features
- Participate in discussions
- Provide feedback

**Responsibilities:**
- Follow Code of Conduct
- Provide constructive feedback
- Help others when possible

### 2. Contributors

**Who:** Anyone who has submitted accepted contributions

**Rights:**
- All user rights
- Recognition in contributors list
- Influence through contributions
- Participate in technical discussions

**Responsibilities:**
- Follow contribution guidelines
- Maintain code quality
- Respond to feedback on PRs
- Help review others' contributions

**How to become:** Submit and get merged pull requests

### 3. Committers

**Who:** Regular contributors with write access

**Rights:**
- All contributor rights
- Direct commit access
- Merge pull requests
- Triage issues
- Label and organize issues/PRs

**Responsibilities:**
- Review pull requests
- Maintain code quality standards
- Help onboard new contributors
- Participate in project discussions
- Follow merge guidelines

**How to become:** 
- 10+ merged pull requests
- Demonstrated expertise
- Nomination by maintainer
- Approval by 2+ maintainers

### 4. Maintainers

**Who:** Core team members with full project access

**Rights:**
- All committer rights
- Admin access to repositories
- Make architectural decisions
- Manage releases
- Nominate new maintainers
- Vote on major decisions

**Responsibilities:**
- Set project direction
- Review and approve RFCs
- Manage releases
- Enforce Code of Conduct
- Mentor contributors
- Represent project publicly

**How to become:**
- 50+ merged pull requests
- 6+ months as committer
- Demonstrated leadership
- Nomination by existing maintainer
- Unanimous approval by maintainers

### 5. Project Lead (Planned)

**Who:** Single individual providing final decision authority

**Rights:**
- All maintainer rights
- Final decision on deadlocks
- Represent project officially
- Manage organization settings

**Responsibilities:**
- Break deadlocks
- Ensure project health
- Coordinate releases
- Manage conflicts
- Strategic planning

**How to become:**
- Elected by maintainers
- 2-year term
- Can be re-elected

## Decision Making Process

### Level 1: Routine Decisions

**Examples:** Bug fixes, documentation updates, minor improvements

**Process:**
1. Contributor submits PR
2. One maintainer reviews
3. Automated checks pass
4. Merge

**Timeline:** 24-48 hours

### Level 2: Feature Decisions

**Examples:** New features, API changes (non-breaking)

**Process:**
1. Contributor opens issue/discussion
2. Community feedback (1 week)
3. Maintainer approval
4. Implementation via PR
5. Code review
6. Merge

**Timeline:** 1-2 weeks

### Level 3: Architectural Decisions

**Examples:** Major refactoring, breaking changes, new dependencies

**Process:**
1. RFC submitted (see RFC Process below)
2. Community discussion (2 weeks)
3. Maintainer review
4. Consensus or vote
5. Implementation
6. Documentation update

**Timeline:** 3-4 weeks

### Level 4: Governance Decisions

**Examples:** Maintainer nominations, governance changes, CoC enforcement

**Process:**
1. Private maintainer discussion
2. Proposal drafted
3. Maintainer vote
4. Public announcement
5. Implementation

**Timeline:** 1-2 weeks

## RFC Process

### When to Use RFC

Use RFC (Request for Comments) for:
- Breaking API changes
- New major features
- Architectural changes
- Significant dependency additions
- Changes affecting multiple components

### RFC Template

```markdown
# RFC: [Title]

## Summary
Brief description (2-3 sentences)

## Motivation
Why is this needed? What problem does it solve?

## Detailed Design
Technical specification of the proposed change

## Drawbacks
What are the downsides?

## Alternatives
What other approaches were considered?

## Adoption Strategy
How will existing users migrate?

## Unresolved Questions
What needs to be figured out?
```

### RFC Lifecycle

1. **Draft**: Author creates RFC in `docs/rfcs/`
2. **Discussion**: 2-week community feedback period
3. **Review**: Maintainers review and provide feedback
4. **Decision**: Consensus or vote
5. **Implementation**: If accepted, implementation begins
6. **Completion**: RFC marked as implemented

### RFC Outcomes

- **Accepted**: Approved for implementation
- **Rejected**: Not approved, with reasoning
- **Deferred**: Good idea, but not now
- **Superseded**: Replaced by another RFC

## Conflict Resolution

### Technical Conflicts

1. **Discussion**: Parties discuss in issue/PR
2. **Mediation**: Maintainer facilitates discussion
3. **Consensus**: Try to reach agreement
4. **Vote**: If consensus fails, maintainers vote
5. **Final**: Project lead decides if vote ties

### Interpersonal Conflicts

1. **Private Discussion**: Parties discuss privately
2. **Mediation**: Neutral maintainer mediates
3. **CoC Review**: If CoC violation suspected
4. **Action**: Appropriate action taken

### Process Conflicts

1. **Clarification**: Review governance docs
2. **Discussion**: Maintainers discuss
3. **Amendment**: Update governance if needed
4. **Communication**: Announce changes

## Voting Procedures

### When to Vote

- Consensus cannot be reached
- Time-sensitive decisions
- Governance changes
- Maintainer nominations
- Major architectural changes

### Voting Eligibility

- **Maintainers**: Full voting rights
- **Committers**: Advisory votes (non-binding)
- **Contributors**: Voice in discussions

### Voting Process

1. **Proposal**: Clear proposal stated
2. **Discussion**: Minimum 48 hours
3. **Vote Call**: Maintainer calls for vote
4. **Voting Period**: 7 days
5. **Counting**: Votes tallied
6. **Result**: Announced publicly

### Vote Types

**Simple Majority** (>50%)
- Feature decisions
- RFC approvals
- Minor governance changes

**Supermajority** (≥66%)
- Breaking changes
- Major governance changes
- Maintainer removal

**Unanimous** (100%)
- Maintainer nominations
- Project lead election
- License changes

### Vote Options

- **+1**: Approve
- **0**: Abstain
- **-1**: Reject (must provide reasoning)

## Maintainer Nomination

### Eligibility Criteria

- 50+ merged pull requests
- 6+ months as committer
- Demonstrated technical expertise
- Active participation in discussions
- Mentored other contributors
- Upheld Code of Conduct

### Nomination Process

1. **Nomination**: Existing maintainer nominates candidate
2. **Notification**: Candidate notified privately
3. **Acceptance**: Candidate accepts nomination
4. **Review**: Maintainers review contributions
5. **Discussion**: Private maintainer discussion (1 week)
6. **Vote**: Unanimous approval required
7. **Announcement**: Public announcement if approved
8. **Onboarding**: New maintainer onboarded

### Maintainer Responsibilities

- Commit to 5+ hours/week
- Respond to mentions within 48 hours
- Participate in maintainer meetings
- Review PRs regularly
- Uphold Code of Conduct
- Mentor contributors

### Maintainer Removal

**Voluntary:**
- Maintainer can step down anytime
- Transition period (2 weeks)
- Emeritus status offered

**Involuntary:**
- Inactivity (3+ months without communication)
- Code of Conduct violations
- Breach of trust
- Requires supermajority vote

## Code of Conduct Enforcement

### Reporting

**Channels:**
- Email: conduct@rdapify.com (planned)
- Private message to any maintainer
- GitHub Security Advisory (for serious cases)

**Confidentiality:** All reports handled confidentially

### Response Process

1. **Receipt**: Acknowledge within 24 hours
2. **Review**: Maintainers review (48 hours)
3. **Investigation**: Gather information
4. **Decision**: Determine action
5. **Action**: Implement decision
6. **Follow-up**: Check with reporter

### Possible Actions

**Warning:**
- First-time minor violations
- Private communication
- Documented in private records

**Temporary Ban:**
- Repeated violations
- Serious one-time violations
- Duration: 1 week to 3 months
- Public announcement (anonymized)

**Permanent Ban:**
- Severe violations
- Repeated serious violations
- Threat to community safety
- Public announcement
- Removal from all project spaces

### Appeals

- Can appeal within 30 days
- Email: conduct-appeals@rdapify.com (planned)
- Different maintainer reviews
- Final decision binding

## Amendments

This governance document can be amended:

1. **Proposal**: Maintainer proposes change
2. **Discussion**: 2-week discussion period
3. **Vote**: Supermajority (≥66%) required
4. **Implementation**: Update document
5. **Announcement**: Announce changes

## Questions

For questions about governance:
- Open a [Discussion](https://github.com/rdapify/rdapify/discussions)
- Email: governance@rdapify.com (planned)
- Contact any maintainer

---

**Version:** 1.0  
**Last Updated:** 2025-01-24  
**Next Review:** 2025-07-24

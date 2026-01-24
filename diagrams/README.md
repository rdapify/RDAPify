# RDAPify Architecture Diagrams

Visual documentation of RDAPify's architecture, data flows, and processes using Mermaid diagrams.

## Available Diagrams

### 1. Architecture Overview (`architecture_overview.mmd`)
High-level system architecture showing the Clean Architecture layers:
- Application Layer (RDAPClient, QueryOrchestrator)
- Core Layer (Use Cases, Ports/Interfaces)
- Infrastructure Layer (Cache, Fetcher, Bootstrap, Security)
- Shared Layer (Types, Utils, Errors)

**Use Case**: Understanding the overall system structure and dependencies.

### 2. Data Flow (`data_flow.mmd`)
Sequence diagram showing the complete request/response flow:
- User query initiation
- Cache lookup
- Bootstrap discovery
- SSRF validation
- Data fetching
- Normalization
- PII redaction

**Use Case**: Understanding how a query flows through the system.

### 3. Cache Strategy (`cache_strategy.mmd`)
Flowchart of the caching mechanism:
- Cache hit/miss logic
- TTL validation
- LRU eviction
- Entry management

**Use Case**: Understanding caching behavior and optimization.

### 4. Discovery Flow (`discovery_flow.mmd`)
Bootstrap discovery process:
- Input type detection (Domain/IP/ASN)
- IANA Bootstrap querying
- Registry matching
- URL construction

**Use Case**: Understanding how RDAP servers are discovered.

### 5. Error State Machine (`error_state_machine.mmd`)
State diagram of error handling:
- Validation errors
- Network errors
- Timeout handling
- Retry logic with exponential backoff
- SSRF protection

**Use Case**: Understanding error handling and retry mechanisms.

### 6. Normalization Pipeline (`normalization_pipeline.mmd`)
Data transformation process:
- Schema validation
- Field extraction
- Data normalization
- Metadata enrichment

**Use Case**: Understanding how raw RDAP data is normalized.

### 7. Anomaly Detection (`anomaly_detection.mmd`)
Response validation and anomaly detection:
- Size checks
- Field validation
- Status verification
- Date logic validation
- Entity and link checks

**Use Case**: Understanding data quality and security checks.

## Viewing Diagrams

### Online Viewers
- **Mermaid Live Editor**: https://mermaid.live/
- **GitHub**: Automatically renders `.mmd` files
- **VS Code**: Install "Markdown Preview Mermaid Support" extension

### Command Line
```bash
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Generate PNG
mmdc -i architecture_overview.mmd -o architecture_overview.png

# Generate SVG
mmdc -i data_flow.mmd -o data_flow.svg
```

### In Documentation
These diagrams are referenced in:
- `docs/architecture/overview.md`
- `docs/core_concepts/architecture.md`
- `ARCHITECTURE.md`

## Diagram Format

All diagrams use **Mermaid** syntax:
- **Graph TB/LR**: Flowcharts and architecture diagrams
- **sequenceDiagram**: Sequence/interaction diagrams
- **stateDiagram-v2**: State machines

## Color Coding

- 🟢 **Green** (#4CAF50): Success states, entry/exit points
- 🔵 **Blue** (#2196F3): Core logic, decision points
- 🟠 **Orange** (#FF9800): Infrastructure, external calls
- 🔴 **Red** (#F44336): Errors, security checks

## Updating Diagrams

When updating architecture:
1. Update relevant `.mmd` files
2. Regenerate images if needed
3. Update documentation references
4. Test rendering in GitHub

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:
- Adding new diagrams
- Diagram naming conventions
- Style guidelines
- Documentation requirements

---

**Last Updated**: January 24, 2026  
**Version**: 0.1.0-alpha.4

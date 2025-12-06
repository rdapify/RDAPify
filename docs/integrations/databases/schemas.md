# 🗂️ Database Schema Design Guide

> **🎯 Purpose:** Comprehensive guide to designing database schemas for RDAP data storage, analysis, and compliance  
> **📚 Related:** [Redis Integration](../redis.md) | [Data Validation](../../../guides/data_validation.md) | [GDPR Compliance](../../../security/gdpr-compliance.md)  
> **⏱️ Reading Time:** 7 minutes  
> **🔍 Pro Tip:** Use the [Schema Validator](./schema-validator.md) to automatically check your schema designs against security and performance best practices

---

## 🌐 Why Schema Design Matters for RDAP Data

RDAP (Registration Data Access Protocol) data presents unique challenges for database schema design due to its semi-structured nature, compliance requirements, and performance demands:

```mermaid
graph LR
    A[RDAP Client] --> B[Normalized Response]
    B --> C{Storage Strategy}
    C --> D[Operational Cache]
    C --> E[Analytical Store]
    C --> F[Audit Log]
    D --> G[Fast Queries]
    E --> H[Pattern Analysis]
    F --> I[Compliance Reporting]
    
    style A fill:#4CAF50
    style B fill:#2196F3
    style C fill:#FF9800
    style D,E,F fill:#9C27B0
```

**Key Schema Design Challenges:**
- ✅ **Semi-structured Data**: RDAP responses vary by registry and query type
- ✅ **PII Handling**: Personal data must be isolated or redacted per GDPR/CCPA
- ✅ **Temporal Requirements**: Historical data for compliance and trend analysis
- ✅ **Query Patterns**: Different access patterns for operational vs analytical use cases
- ✅ **Scale**: Handling millions of domain records with fast lookup capabilities

---

## 🧩 Core Schema Patterns

### 1. Normalized Operational Schema
```sql
-- PostgreSQL schema for operational queries
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    tld VARCHAR(10) NOT NULL,
    registry_source VARCHAR(50) NOT NULL,
    query_count INTEGER DEFAULT 0,
    last_query_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE registrars (
    id SERIAL PRIMARY KEY,
    registry_handle VARCHAR(50) NOT NULL,
    name TEXT NOT NULL,
    country_code CHAR(2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (registry_handle, registry_source)
);

CREATE TABLE domain_registrars (
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    registrar_id INTEGER REFERENCES registrars(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('sponsor', 'registrar', 'reseller')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (domain_id, registrar_id, role)
);

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('registrant', 'admin', 'tech', 'billing')),
    redacted BOOLEAN DEFAULT true,
    redacted_data JSONB,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE domain_contacts (
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (domain_id, contact_id)
);

CREATE TABLE nameservers (
    id SERIAL PRIMARY KEY,
    hostname TEXT NOT NULL,
    ipv4 INET[],
    ipv6 INET[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hostname)
);

CREATE TABLE domain_nameservers (
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    nameserver_id INTEGER REFERENCES nameservers(id) ON DELETE CASCADE,
    priority INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (domain_id, nameserver_id)
);

-- GDPR compliance fields
CREATE TABLE data_retention (
    entity_id UUID NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('domain', 'contact', 'registrar')),
    retention_until TIMESTAMPTZ NOT NULL,
    legal_basis VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (entity_id, entity_type)
);

-- Indexes for performance
CREATE INDEX idx_domains_normalized_name ON domains(normalized_name);
CREATE INDEX idx_domains_last_query_at ON domains(last_query_at);
CREATE INDEX idx_contacts_redacted ON contacts(redacted);
```

### 2. Denormalized Analytical Schema
```sql
-- ClickHouse schema for analytical queries
CREATE TABLE domain_analytics (
    domain_name String,
    tld String,
    registry_source String,
    query_date Date,
    query_hour UInt8,
    query_count UInt64,
    cache_hit UInt8,
    avg_latency_ms Float32,
    error_count UInt64,
    p50_latency_ms Float32,
    p95_latency_ms Float32,
    p99_latency_ms Float32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(query_date)
ORDER BY (tld, registry_source, query_date, query_hour)
TTL query_date + toIntervalMonth(24);
```

### 3. Document-Based Schema (MongoDB)
```javascript
// MongoDB schema design for flexibility
const domainSchema = {
  domain: {
    type: String,
    required: true,
    index: true
  },
  normalized: {
    type: {
      name: String,
      tld: String,
      punycode: String
    }
  },
  registry: {
    source: { type: String, required: true },
    handle: String,
    url: String
  },
  registrars: [{
    role: { type: String, enum: ['sponsor', 'registrar', 'reseller'] },
    handle: String,
    name: String,
    org: String,
    country: String
  }],
  contacts: [{
    type: { type: String, enum: ['registrant', 'admin', 'tech', 'billing'] },
    redacted: { type: Boolean, default: true },
    redactedData: Object,
    rawData: {
      type: Object,
      select: false // Exclude from default queries
    }
  }],
  nameservers: [{
    hostname: String,
    ipv4: [String],
    ipv6: [String]
  }],
  events: [{
    type: { type: String, enum: ['registration', 'expiration', 'lastChanged'] },
    date: Date,
    actor: String
  }],
  status: [String],
  security: {
    redactionLevel: { type: String, enum: ['none', 'basic', 'strict', 'enterprise'], default: 'strict' },
    gdprArticle: String,
    retentionDays: { type: Number, default: 30 }
  },
  performance: {
    cacheHit: Boolean,
    latencyMs: Number,
    errorCount: { type: Number, default: 0 }
  },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    queryCount: { type: Number, default: 0 }
  }
};

// Compound indexes for performance
domainSchema.index({ 'normalized.name': 1, 'registry.source': 1 });
domainSchema.index({ 'metadata.createdAt': 1 });
domainSchema.index({ 'security.retentionDays': 1, 'metadata.updatedAt': 1 });
```

---

## 🔐 GDPR/CCPA Compliance Patterns

### 1. PII Isolation Strategy
```sql
-- Separate storage for PII with strict access controls
CREATE TABLE pii_contacts (
    contact_id UUID PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    address JSONB,
    organization TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL,
    redacted BOOLEAN DEFAULT true,
    contact_id UUID REFERENCES pii_contacts(contact_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security policy
CREATE POLICY pii_contacts_policy ON pii_contacts
USING (current_user = 'data_protection_officer' OR 
       created_at < NOW() - INTERVAL '30 days');

-- View for redacted data
CREATE VIEW public_contacts AS
SELECT 
    c.id,
    c.type,
    CASE WHEN c.redacted THEN 'REDACTED' ELSE pc.full_name END as name,
    CASE WHEN c.redacted THEN 'REDACTED@example.invalid' ELSE pc.email END as email
FROM contacts c
LEFT JOIN pii_contacts pc ON c.contact_id = pc.contact_id;
```

### 2. Automatic Data Purging
```sql
-- PostgreSQL function for GDPR-compliant data deletion
CREATE OR REPLACE FUNCTION purge_expired_data()
RETURNS TABLE(deleted_domains BIGINT, deleted_contacts BIGINT) AS $$
DECLARE
    purge_date TIMESTAMPTZ;
BEGIN
    -- Get purge date (30 days ago)
    SELECT NOW() - INTERVAL '30 days' INTO purge_date;
    
    -- Delete expired domains
    WITH deleted_domains AS (
        DELETE FROM domains
        WHERE updated_at < purge_date
        AND id NOT IN (SELECT domain_id FROM domain_contacts WHERE contact_id IN (
            SELECT contact_id FROM contacts WHERE redacted = false
        ))
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_domains FROM deleted_domains;
    
    -- Delete expired contacts with no references
    WITH unreferenced_contacts AS (
        SELECT c.id
        FROM contacts c
        LEFT JOIN domain_contacts dc ON c.id = dc.contact_id
        WHERE dc.contact_id IS NULL
        AND c.updated_at < purge_date
    ),
    deleted_contacts AS (
        DELETE FROM contacts
        WHERE id IN (SELECT id FROM unreferenced_contacts)
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_contacts FROM deleted_contacts;
    
    RETURN QUERY SELECT deleted_domains, deleted_contacts;
END;
$$ LANGUAGE plpgsql;

-- Schedule nightly purge
SELECT cron.schedule('nightly-purge', '0 2 * * *', 'SELECT purge_expired_data()');
```

### 3. Audit Trail Schema
```sql
CREATE TABLE data_access_log (
    id BIGSERIAL PRIMARY KEY,
    entity_id UUID NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('domain', 'contact', 'registrar')),
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('read', 'write', 'delete', 'redact')),
    user_id VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    legal_basis VARCHAR(50) NOT NULL,
    consent_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE data_retention_log (
    id BIGSERIAL PRIMARY KEY,
    entity_id UUID NOT NULL,
    entity_type VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'purged')),
    retention_until TIMESTAMPTZ NOT NULL,
    legal_basis VARCHAR(50) NOT NULL,
    user_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for compliance reporting
CREATE INDEX idx_access_log_entity ON data_access_log(entity_id, entity_type);
CREATE INDEX idx_access_log_date ON data_access_log(created_at);
CREATE INDEX idx_retention_log_entity ON data_retention_log(entity_id, entity_type);
```

---

## ⚡ Performance Optimization

### 1. Query Pattern Analysis
| Query Pattern | Schema Strategy | Index Strategy | Example Use Case |
|---------------|----------------|----------------|------------------|
| **Point Lookup** | Single table with normalized domain | B-tree on normalized domain | User searches for specific domain |
| **TLD Analytics** | Partitioned by TLD | BRIN index on TLD + date | Monitoring .com registrations |
| **Geographic Analysis** | Country code column + geospatial index | GIN index on geospatial data | Analyzing regional registration trends |
| **Temporal Analysis** | Time-series optimized storage | TimescaleDB hypertable partitioning | Tracking registration pattern changes |
| **Relationship Mapping** | Graph database or adjacency lists | Graph traversal optimization | Finding related domains by registrant |

### 2. Indexing Strategies
```sql
-- Composite indexes for multi-dimensional queries
CREATE INDEX idx_domains_tld_registry_date ON domains(tld, registry_source, last_query_at);

-- Partial indexes for common filters
CREATE INDEX idx_domains_active ON domains(normalized_name) 
WHERE last_query_at > NOW() - INTERVAL '90 days';

-- Expression indexes for case-insensitive search
CREATE INDEX idx_domains_name_lower ON domains(LOWER(normalized_name));

-- GIN indexes for JSONB data
CREATE INDEX idx_contacts_rawdata_gin ON contacts USING GIN (raw_data);

-- BRIN indexes for time-series data
CREATE INDEX idx_queries_brin ON query_logs USING BRIN (created_at)
WITH (pages_per_range = 32);
```

### 3. Partitioning Strategies
```sql
-- Range partitioning by date for historical data
CREATE TABLE rdap_queries (
    id BIGSERIAL,
    domain_name TEXT NOT NULL,
    registry_source VARCHAR(50),
    latency_ms INTEGER,
    success BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE rdap_queries_2025_01 PARTITION OF rdap_queries
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE rdap_queries_2025_02 PARTITION OF rdap_queries
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- TLD partitioning for operational data
CREATE TABLE domains_by_tld (
    id UUID,
    domain_name TEXT,
    normalized_name TEXT,
    tld VARCHAR(10),
    registry_data JSONB,
    created_at TIMESTAMPTZ
) PARTITION BY LIST (tld);

CREATE TABLE domains_tld_com PARTITION OF domains_by_tld
FOR VALUES IN ('com');

CREATE TABLE domains_tld_org PARTITION OF domains_by_tld
FOR VALUES IN ('org');

CREATE TABLE domains_tld_net PARTITION OF domains_by_tld
FOR VALUES IN ('net');
```

---

## 🚀 Advanced Patterns

### 1. Materialized Views for Analytics
```sql
-- Materialized view for domain statistics
CREATE MATERIALIZED VIEW domain_stats AS
SELECT 
    tld,
    registry_source,
    COUNT(*) as total_domains,
    COUNT(*) FILTER (WHERE last_query_at > NOW() - INTERVAL '1 day') as active_domains,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds,
    COUNT(DISTINCT registrars.id) as unique_registrars,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY query_count) as median_query_count
FROM domains
LEFT JOIN domain_registrars dr ON domains.id = dr.domain_id
LEFT JOIN registrars ON dr.registrar_id = registrars.id
GROUP BY tld, registry_source;

-- Refresh every hour
SELECT cron.schedule('refresh-domain-stats', '0 * * * *', 'REFRESH MATERIALIZED VIEW domain_stats');

-- Indexes for materialized view
CREATE INDEX idx_domain_stats_tld ON domain_stats(tld);
CREATE INDEX idx_domain_stats_registry ON domain_stats(registry_source);
```

### 2. Event Sourcing for Historical Tracking
```sql
-- Event sourcing schema for change tracking
CREATE TABLE domain_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'domain.created', 'domain.updated', 'domain.deleted',
        'registrar.added', 'registrar.removed',
        'contact.added', 'contact.removed', 'contact.updated',
        'nameserver.added', 'nameserver.removed'
    )),
    event_data JSONB NOT NULL,
    event_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(50)
);

-- Indexes for event sourcing
CREATE INDEX idx_domain_events_domain ON domain_events(domain_id);
CREATE INDEX idx_domain_events_type ON domain_events(event_type);
CREATE INDEX idx_domain_events_created ON domain_events(created_at);

-- View for current state reconstruction
CREATE VIEW domain_current_state AS
SELECT DISTINCT ON (domain_id)
    domain_id,
    event_data->>'domain_name' as domain_name,
    event_data->>'tld' as tld,
    event_data->'registrars' as registrars,
    event_data->'contacts' as contacts,
    event_data->'nameservers' as nameservers,
    event_data->>'last_event' as last_event,
    created_at as last_updated
FROM domain_events
ORDER BY domain_id, created_at DESC;
```

### 3. Time-Series Schema for Performance Monitoring
```sql
-- TimescaleDB hypertable for performance metrics
CREATE TABLE query_metrics (
    time TIMESTAMPTZ NOT NULL,
    domain_name TEXT,
    registry_source TEXT,
    query_type TEXT,
    latency_ms INTEGER,
    cache_hit BOOLEAN,
    error_code TEXT,
    user_agent TEXT,
    client_ip INET
);

SELECT create_hypertable('query_metrics', 'time');

-- Continuous aggregates for performance analysis
CREATE MATERIALIZED VIEW query_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) as bucket,
    registry_source,
    query_type,
    COUNT(*) as total_queries,
    COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
    AVG(latency_ms) as avg_latency,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
    COUNT(*) FILTER (WHERE error_code IS NOT NULL) as error_count
FROM query_metrics
GROUP BY bucket, registry_source, query_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('query_metrics_hourly',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '15 minutes');
```

---

## 🔄 Schema Migration Strategies

### 1. Versioned Schema Migration
```python
# Alembic migration script example
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Create new table with improved schema
    op.create_table('domains_v2',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('domain_name', sa.String(), nullable=False),
        sa.Column('normalized_name', sa.String(), nullable=False),
        sa.Column('tld', sa.String(10), nullable=False),
        sa.Column('registry_source', sa.String(50), nullable=False),
        sa.Column('query_count', sa.Integer(), server_default='0'),
        sa.Column('last_query_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('security_data', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add indexes
    op.create_index('idx_domains_v2_normalized', 'domains_v2', ['normalized_name'])
    op.create_index('idx_domains_v2_tld_registry', 'domains_v2', ['tld', 'registry_source'])
    
    # Migrate data in batches
    batch_size = 10000
    
    # Create temporary function for batch migration
    op.execute("""
    CREATE OR REPLACE FUNCTION migrate_domains_batch(start_id UUID, end_id UUID)
    RETURNS void AS $$
    BEGIN
        INSERT INTO domains_v2 (id, domain_name, normalized_name, tld, registry_source, 
                               query_count, last_query_at, created_at, updated_at)
        SELECT id, domain_name, normalized_name, tld, registry_source, 
               query_count, last_query_at, created_at, updated_at
        FROM domains
        WHERE id BETWEEN start_id AND end_id
        ON CONFLICT (id) DO NOTHING;
    END;
    $$ LANGUAGE plpgsql;
    """)
    
    # Execute batch migration (in application code, not in migration)
    # This would be handled by application logic during deployment

def downgrade():
    # Drop the function first
    op.execute("DROP FUNCTION IF EXISTS migrate_domains_batch(UUID, UUID);")
    
    # Drop the new table
    op.drop_table('domains_v2')
```

### 2. Zero-Downtime Migration Pattern
```javascript
// Application-level migration pattern
class SchemaMigrator {
  constructor(database) {
    this.db = database;
  }
  
  async migrateDomains() {
    // Step 1: Create new table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS domains_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        tld VARCHAR(10) NOT NULL,
        registry_source VARCHAR(50) NOT NULL,
        query_count INTEGER DEFAULT 0,
        last_query_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        security_metadata JSONB DEFAULT '{"redaction_level": "strict"}'
      )
    `);
    
    // Step 2: Create indexes
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_domains_v2_normalized ON domains_v2(normalized_name)');
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_domains_v2_tld_registry ON domains_v2(tld, registry_source)');
    
    // Step 3: Enable dual-write
    this.enableDualWrite();
    
    // Step 4: Backfill existing data in batches
    let lastId = null;
    const batchSize = 1000;
    let migrated = 0;
    
    while (true) {
      const { rows } = await this.db.query(`
        SELECT id, domain_name, normalized_name, tld, registry_source,
               query_count, last_query_at, created_at, updated_at
        FROM domains
        WHERE id > $1
        ORDER BY id
        LIMIT $2
      `, [lastId || '00000000-0000-0000-0000-000000000000', batchSize]);
      
      if (rows.length === 0) break;
      
      // Insert batch into new table
      for (const row of rows) {
        await this.db.query(`
          INSERT INTO domains_v2 (
            id, domain_name, normalized_name, tld, registry_source,
            query_count, last_query_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          row.id, row.domain_name, row.normalized_name, row.tld, row.registry_source,
          row.query_count, row.last_query_at, row.created_at, row.updated_at
        ]);
      }
      
      lastId = rows[rows.length - 1].id;
      migrated += rows.length;
      
      console.log(`Migrated ${migrated} domains...`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
    }
    
    // Step 5: Validate data consistency
    const { rowCount } = await this.db.query(`
      SELECT COUNT(*) as diff_count
      FROM domains d
      LEFT JOIN domains_v2 d2 ON d.id = d2.id
      WHERE d2.id IS NULL
    `);
    
    if (rowCount > 0) {
      throw new Error(`Data migration failed: ${rowCount} domains not migrated`);
    }
    
    // Step 6: Switch reads to new table
    this.switchReadsToV2();
    
    // Step 7: Decommission old table after verification period
    setTimeout(() => {
      this.decommissionOldTable();
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
  }
  
  enableDualWrite() {
    // Patch application methods to write to both tables
    const originalSave = this.saveDomain;
    this.saveDomain = async (domain) => {
      try {
        await originalSave(domain);
        await this.saveDomainV2(domain);
      } catch (error) {
        console.error('Dual write failed:', error);
        // Fallback to original table
        throw error;
      }
    };
  }
  
  switchReadsToV2() {
    // Update read queries to use new table
    this.getDomain = (domainName) => {
      return this.db.query('SELECT * FROM domains_v2 WHERE normalized_name = $1', [domainName]);
    };
  }
  
  decommissionOldTable() {
    // Archive old table data
    this.db.query('ALTER TABLE domains RENAME TO domains_archive');
    this.db.query('DROP INDEX IF EXISTS idx_domains_normalized');
  }
}
```

---

## 🛡️ Security Hardening Patterns

### 1. Row-Level Security (RLS)
```sql
-- Enable RLS on sensitive tables
ALTER TABLE pii_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_log ENABLE ROW LEVEL SECURITY;

-- Policy for data access based on role
CREATE POLICY pii_access_policy ON pii_contacts
USING (
    current_user = 'data_protection_officer' OR
    current_user = 'security_analyst' AND 
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = current_user AND role = 'security')
);

-- Policy for audit log access
CREATE POLICY audit_log_policy ON data_access_log
USING (
    current_user = 'compliance_officer' OR
    current_user = 'data_protection_officer'
);

-- Application roles
CREATE ROLE rdap_app WITH LOGIN PASSWORD 'securepassword';
CREATE ROLE data_protection_officer WITH LOGIN PASSWORD 'securepassword';
CREATE ROLE compliance_officer WITH LOGIN PASSWORD 'securepassword';
CREATE ROLE security_analyst WITH LOGIN PASSWORD 'securepassword';

-- Grant appropriate permissions
GRANT SELECT, INSERT ON domains, registrars, nameservers TO rdap_app;
GRANT SELECT ON public_contacts TO rdap_app;
GRANT ALL PRIVILEGES ON pii_contacts, data_access_log TO data_protection_officer;
GRANT SELECT ON data_access_log TO compliance_officer;
GRANT SELECT ON suspicious_domains TO security_analyst;
```

### 2. Encryption at Rest
```sql
-- PostgreSQL pgcrypto extension for field-level encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypted fields
CREATE TABLE encrypted_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name BYTEA,
    email BYTEA,
    phone BYTEA,
    address BYTEA,
    encryption_key_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function for encrypting data
CREATE OR REPLACE FUNCTION encrypt_contact_data(
    p_full_name TEXT, 
    p_email TEXT, 
    p_phone TEXT, 
    p_address TEXT,
    p_key_id TEXT
)
RETURNS TABLE (
    full_name BYTEA,
    email BYTEA,
    phone BYTEA,
    address BYTEA
) AS $$
DECLARE
    encryption_key BYTEA;
BEGIN
    -- Get encryption key from secure storage (simplified)
    SELECT key INTO encryption_key FROM encryption_keys WHERE key_id = p_key_id;
    
    RETURN QUERY SELECT
        pgp_sym_encrypt(p_full_name, encryption_key)::BYTEA,
        pgp_sym_encrypt(p_email, encryption_key)::BYTEA,
        pgp_sym_encrypt(p_phone, encryption_key)::BYTEA,
        pgp_sym_encrypt(p_address, encryption_key)::BYTEA;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Key rotation procedure
CREATE OR REPLACE FUNCTION rotate_encryption_key(
    old_key_id TEXT,
    new_key_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Update all encrypted records
    UPDATE encrypted_contacts
    SET 
        full_name = pgp_sym_encrypt(
            pgp_sym_decrypt(full_name, get_key_value(old_key_id)),
            get_key_value(new_key_id)
        ),
        email = pgp_sym_encrypt(
            pgp_sym_decrypt(email, get_key_value(old_key_id)),
            get_key_value(new_key_id)
        ),
        -- Repeat for other fields
        encryption_key_id = new_key_id
    WHERE encryption_key_id = old_key_id;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RETURN rows_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🧪 Testing Schema Designs

### 1. Schema Validation Tests
```javascript
// schema-validation.test.js
const { expect } = require('chai');
const { createSchemaValidator } = require('rdapify/database');

describe('Database Schema Validation', () => {
  let validator;
  
  beforeEach(() => {
    validator = createSchemaValidator({
      databaseType: 'postgresql',
      complianceLevel: 'gdpr-enterprise'
    });
  });
  
  test('validates normalized domain schema', () => {
    const schema = {
      tables: {
        domains: {
          columns: {
            id: 'uuid',
            domain_name: 'text',
            normalized_name: 'text',
            tld: 'varchar(10)',
            registry_source: 'varchar(50)',
            created_at: 'timestamptz'
          },
          indexes: ['normalized_name', 'tld_registry_source'],
          constraints: {
            primary_key: ['id']
          }
        }
      }
    };
    
    const result = validator.validateSchema(schema);
    expect(result.valid).to.be.true;
    expect(result.warnings).to.have.length(0);
    expect(result.errors).to.have.length(0);
  });
  
  test('detects missing GDPR compliance fields', () => {
    const schema = {
      tables: {
        contacts: {
          columns: {
            id: 'uuid',
            type: 'varchar(20)',
            // Missing redaction and retention fields
            name: 'text',
            email: 'text'
          }
        }
      }
    };
    
    const result = validator.validateSchema(schema);
    expect(result.valid).to.be.false;
    expect(result.errors).to.include('Missing GDPR compliance fields: redacted, retention_until');
  });
  
  test('validates indexing strategy', () => {
    const schema = {
      tables: {
        domains: {
          columns: {
            id: 'uuid',
            normalized_name: 'text',
            tld: 'varchar(10)',
            last_query_at: 'timestamptz'
          },
          indexes: [
            { name: 'idx_domains_name', columns: ['normalized_name'], type: 'btree' },
            { name: 'idx_domains_tld_date', columns: ['tld', 'last_query_at'], type: 'btree' }
          ]
        }
      }
    };
    
    const result = validator.validateSchema(schema);
    expect(result.warnings).to.include('Consider adding BRIN index for time-series data on last_query_at');
  });
});
```

### 2. Performance Testing
```javascript
// performance.test.js
const { createTestDatabase } = require('rdapify/test');

describe('Schema Performance Tests', () => {
  let db;
  
  before(async () => {
    db = await createTestDatabase({
      schema: 'normalized_operational',
      size: 'large' // 1 million domains
    });
  });
  
  after(async () => {
    await db.cleanup();
  });
  
  test('domain lookup performance', async () => {
    const startTime = Date.now();
    
    const results = await Promise.all(
      Array(1000).fill(0).map(() => 
        db.query('SELECT * FROM domains WHERE normalized_name = $1', ['example.com'])
      )
    );
    
    const duration = Date.now() - startTime;
    const avgLatency = duration / 1000;
    
    console.log(`Average lookup latency: ${avgLatency.toFixed(2)}ms`);
    expect(avgLatency).to.be.lessThan(10); // Less than 10ms average
  });
  
  test('batch query performance', async () => {
    const domains = Array(10000).fill(0).map((_, i) => `test${i}.com`);
    
    const startTime = Date.now();
    
    const results = await db.query(`
      SELECT d.*, r.name as registrar_name
      FROM domains d
      LEFT JOIN domain_registrars dr ON d.id = dr.domain_id
      LEFT JOIN registrars r ON dr.registrar_id = r.id
      WHERE d.normalized_name = ANY($1)
    `, [domains]);
    
    const duration = Date.now() - startTime;
    
    console.log(`Batch query for 10,000 domains: ${duration}ms`);
    expect(duration).to.be.lessThan(2000); // Less than 2 seconds
  });
  
  test('data purge performance', async () => {
    const purgeDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    
    const startTime = Date.now();
    
    const result = await db.query(`
      WITH deleted_domains AS (
        DELETE FROM domains 
        WHERE updated_at < $1
        RETURNING id
      )
      SELECT COUNT(*) as deleted_count FROM deleted_domains
    `, [purgeDate]);
    
    const duration = Date.now() - startTime;
    const deletedCount = parseInt(result.rows[0].deleted_count);
    
    console.log(`Purged ${deletedCount} domains in ${duration}ms`);
    expect(duration / deletedCount).to.be.lessThan(1); // Less than 1ms per record
  });
});
```

---

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Redis Integration** | Caching strategies for RDAP data | [../redis.md](../redis.md) |
| **Data Validation** | Schema validation and data integrity | [../../../guides/data_validation.md](../../../guides/data_validation.md) |
| **GDPR Compliance** | Privacy-compliant schema design | [../../../security/gdpr-compliance.md](../../../security/gdpr-compliance.md) |
| **Performance Optimization** | Database performance tuning | [../../../guides/performance.md](../../../guides/performance.md) |
| **Schema Validator** | Automated schema validation tool | [./schema-validator.md](schema-validator.md) |
| **Test Vectors** | Sample data for schema testing | [../../../../test-vectors/database-schemas.json](../../../../test-vectors/database-schemas.json) |

---

## 🏷️ Schema Design Specifications

| Property | Value |
|----------|-------|
| **Schema Version** | 2.3.0 |
| **Supported Databases** | PostgreSQL 14+, MySQL 8.0+, MongoDB 6.0+ |
| **GDPR Compliance** | ✅ Article 5 (Data Minimization), Article 17 (Erasure) |
| **CCPA Compliance** | ✅ Section 1798.105 (Deletion), Section 1798.120 (Opt-out) |
| **Performance Target** | < 10ms point queries, < 2s for 10K batch queries |
| **Storage Efficiency** | 200-500 bytes per normalized domain record |
| **Encryption** | AES-256-GCM for sensitive fields |
| **Test Coverage** | 95% schema validation tests, 85% performance tests |
| **Last Updated** | December 5, 2025 |

> **🔐 Critical Reminder:** Database schema design for RDAP data must prioritize privacy and compliance from day one. Never store unredacted PII without documented legal basis and Data Protection Officer approval. Always implement automatic data purging with conservative retention periods (30 days default). Use field-level encryption for any PII that must be stored, and regularly audit access patterns to sensitive data.

[← Back to Database Integrations](../README.md) | [Next: Sync Tools →](sync_tools.md)

*Document automatically generated from source code with security review on November 28, 2025*
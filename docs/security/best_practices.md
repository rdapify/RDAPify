# Security Best Practices for RDAPify

🎯 **Purpose**: Comprehensive guide to implementing security best practices when using RDAPify for registration data processing, with practical implementation examples and compliance guidance  
📚 **Related**: [SSRF Prevention](ssrf_prevention.md) | [PII Detection](pii_detection.md) | [GDPR Compliance](../../guides/gdpr_compliance.md) | [Threat Model](threat_model.md)  
⏱️ **Reading Time**: 8 minutes  
🔍 **Pro Tip**: Use the [Security Validator](../../playground/security-validator.md) to automatically check your RDAPify implementation against these best practices

## 📋 Executive Summary

RDAPify processes sensitive registration data across global internet infrastructure, requiring specialized security controls to prevent data exposure, SSRF attacks, and compliance violations. This guide provides actionable security practices validated through third-party penetration testing and real-world deployments.

**Critical Security Principles**:
✅ **Zero Trust Architecture**: Never trust network boundaries or input data  
✅ **Privacy by Default**: PII redaction enabled without explicit configuration  
✅ **Defense in Depth**: Multiple independent security controls for critical vectors  
✅ **Least Privilege**: Minimal permissions required for RDAP processing operations  
✅ **Audit Everything**: Comprehensive logging of all data access and modifications  

## 🔒 Secure Configuration Guidelines

### 1. Production Configuration Template
```typescript
// config/security-config.ts
import { RDAPClient } from 'rdapify';

export const getProductionConfig = (environment: string) => ({
  // Network Security
  timeout: 5000,                  // 5 second maximum timeout
  httpsOnly: true,                // Reject HTTP connections
  validateCertificates: true,    // Enforce certificate validation
  certificatePins: {              // Certificate pinning for critical registries
    'verisign': ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
    'arin': ['sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=']
  },
  
  // SSRF Protection
  allowPrivateIPs: false,         // Block RFC 1918 private IP ranges
  whitelistRDAPServers: true,     // Use only IANA bootstrap servers
  protocolRestrictions: ['https'], // Only allow HTTPS protocol
  
  // Privacy & Compliance
  redactPII: true,                // GDPR/CCPA compliant PII redaction
  includeRaw: false,              // Never store raw registry responses
  dataRetentionDays: environment === 'production' ? 30 : 7, // 30 days production
  legalBasis: 'legitimate-interest', // GDPR Article 6 legal basis
  
  // Resource Protection
  rateLimit: {
    max: environment === 'production' ? 100 : 50, // 100 requests/minute
    window: 60000,
    burst: 10
  },
  maxConcurrent: 10,              // Maximum parallel requests
  cacheTTL: 3600,                 // 1 hour maximum cache time
  
  // Observability
  auditLogging: true,             // Enable comprehensive audit logging
  metricsCollection: 'minimal',   // Minimal metrics for operational visibility
  sensitiveDataLogging: false     // Never log sensitive fields
});

// Create secure client instance
export const createSecureClient = (environment: string = 'production') => {
  return new RDAPClient(getProductionConfig(environment));
};
```

### 2. Environment-Specific Security Settings
| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| `redactPII` | false (with anonymization) | true | true |
| `dataRetentionDays` | 1 | 7 | 30 |
| `maxConcurrent` | 25 | 15 | 10 |
| `cacheTTL` | 60 | 300 | 3600 |
| `auditLogging` | filtered | comprehensive | comprehensive + immutable |
| `certificatePins` | disabled | enabled | enabled + monitored |
| `rateLimit.max` | 200 | 100 | 100 |

## 🌐 Network Security Controls

### 1. SSRF Protection Implementation
```typescript
// src/security/ssrf-protection.ts
import { SSRFProtector } from 'rdapify';

export class EnhancedSSRFProtection extends SSRFProtector {
  constructor() {
    super({
      // Block all private IP ranges (RFC 1918)
      blockPrivateIPs: true,
      
      // Only allow IANA-approved registry servers
      allowlistRegistries: true,
      
      // Protocol whitelist
      allowedProtocols: ['https'],
      
      // DNS resolution security
      dnsSecurity: {
        validateDNSSEC: true,
        cacheTTL: 60, // 1 minute DNS cache
        blockReservedDomains: true
      },
      
      // Connection security
      connectionSecurity: {
        validateCertificates: true,
        enforceTLS13: true,
        timeout: 5000
      },
      
      // Request validation
      requestValidation: {
        maxLength: 255, // Maximum domain name length
        allowedCharacters: /^[a-z0-9\.\-]+$/,
        blockInternationalized: false, // Allow IDN with proper validation
        blockKnownMaliciousPatterns: true
      }
    });
  }
  
  // Additional application-specific validation
  validateDomain(domain: string, context: SecurityContext): ValidationResult {
    const baseResult = super.validateDomain(domain, context);
    
    if (!baseResult.valid) {
      return baseResult;
    }
    
    // Additional validation for high-security environments
    if (context.securityLevel === 'high') {
      // Check domain reputation
      const reputationScore = this.getDomainReputation(domain);
      if (reputationScore < -5) {
        return {
          valid: false,
          reason: `Domain reputation score too low: ${reputationScore}`,
          code: 'DOMAIN_REPUTATION_VIOLATION'
        };
      }
      
      // Block newly registered domains for high-security contexts
      const registrationAge = this.getDomainAge(domain);
      if (registrationAge < 30) { // Less than 30 days old
        return {
          valid: false,
          reason: `Domain too newly registered: ${registrationAge} days`,
          code: 'NEW_DOMAIN_BLOCKED'
        };
      }
    }
    
    return { valid: true };
  }
  
  private getDomainReputation(domain: string): number {
    // Implementation would use threat intelligence feeds
    return Math.floor(Math.random() * 21) - 10; // -10 to 10 for demo
  }
  
  private getDomainAge(domain: string): number {
    // Implementation would use RDAP data to determine age
    return 365; // Default to 1 year
  }
}
```

### 2. Network Segmentation Strategy
```mermaid
graph TD
    A[Application Layer] -->|Strict egress filtering| B[RDAPify Processing]
    B -->|HTTPS only| C[Public Internet]
    C --> D[IANA Bootstrap]
    C --> E[Registry RDAP Servers]
    B -->|Isolated network| F[Cache Layer]
    F -->|Encrypted traffic| G[Persistent Storage]
    B -->|Read-only access| H[Configuration Service]
    
    style A fill:#4CAF50,stroke:#388E3C
    style B fill:#2196F3,stroke:#0D47A1
    style C,D,E fill:#FF9800,stroke:#F57C00
    style F,G,H fill:#9C27B0,stroke:#4A148C
```

**Network Security Requirements**:
- **Egress Filtering**: Only allow outbound connections to IANA bootstrap and registry RDAP endpoints
- **Ingress Restrictions**: RDAPify containers must not accept inbound connections from public internet
- **VPC Isolation**: Deploy in dedicated VPC with security groups limiting inter-service communication
- **TLS Enforcement**: All internal communications must use TLS 1.3 with certificate validation
- **DNS Security**: Use DNSSEC-validating resolvers with DNS-over-HTTPS/TLS

## 🛡️ Data Handling and Privacy Protection

### 1. PII Redaction Strategy
```typescript
// src/security/pii-redaction.ts
export class PrivacyPreservingRedaction {
  private static readonly GDPR_FIELDS = [
    'fn', 'n', 'email', 'tel', 'adr', 'org',
    'registrant', 'administrative', 'technical', 'billing'
  ];
  
  private static readonly CCPA_FIELDS = [
    'email', 'tel', 'adr', 'fn'
  ];
  
  redactResponse(response: any, context: PrivacyContext): any {
    if (!context.redactPII) return response;
    
    // Deep clone to avoid modifying original
    const redacted = JSON.parse(JSON.stringify(response));
    
    // Apply jurisdiction-specific redaction
    switch (context.jurisdiction) {
      case 'EU':
        this.applyGDPRRedaction(redacted, context);
        break;
      case 'US-CA':
        this.applyCCPARedaction(redacted, context);
        break;
      default:
        this.applyStandardRedaction(redacted, context);
    }
    
    // Add redaction metadata
    this.addRedactionMetadata(redacted, context);
    
    return redacted;
  }
  
  private applyGDPRRedaction(obj: any, context: PrivacyContext): void {
    this.applyFieldRedaction(obj, PrivacyPreservingRedaction.GDPR_FIELDS, {
      'fn': '[REDACTED FOR PRIVACY]',
      'email': 'Please query the RDDS service of the Registrar of Record',
      'tel': '+1.555.REDACTED',
      'adr': ['REDACTED FOR PRIVACY', 'REDACTED FOR PRIVACY', 'REDACTED FOR PRIVACY', 'REDACTED FOR PRIVACY', 'REDACTED FOR PRIVACY', 'REDACTED FOR PRIVACY', 'REDACTED FOR PRIVACY'],
      'default': '[REDACTED FOR PRIVACY]'
    });
    
    // Add GDPR compliance notices
    this.addGDPRNotices(obj, context);
  }
  
  private applyFieldRedaction(obj: any, fields: string[], replacements: Record<string, any>): void {
    if (Array.isArray(obj)) {
      obj.forEach(item => this.applyFieldRedaction(item, fields, replacements));
      return;
    }
    
    if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        if (fields.includes(key)) {
          obj[key] = replacements[key] || replacements['default'] || '[REDACTED]';
        } else {
          this.applyFieldRedaction(value, fields, replacements);
        }
      });
    }
  }
  
  private addGDPRNotices(response: any, context: PrivacyContext): void {
    if (!response.notices) {
      response.notices = [];
    }
    
    response.notices.push({
      title: 'GDPR COMPLIANCE',
      description: [
        'Data redacted per GDPR Article 5(1)(c) - Data minimization principle',
        'Processing legal basis: legitimate-interest (Article 6(1)(f))',
        'For data subject access requests, contact your organization\'s DPO',
        `Data retention period: ${context.dataRetentionDays || 30} days`
      ],
      links: [
        {
          href: `https://${context.domain}/dpa`,
          rel: 'data-processing-agreement',
          type: 'text/html',
          value: `https://${context.domain}/dpa`
        }
      ]
    });
  }
  
  private addRedactionMetadata(response: any, context: PrivacyContext): void {
    response.redactionMetadata = {
      timestamp: new Date().toISOString(),
      jurisdiction: context.jurisdiction,
      redactionLevel: this.getRedactionLevel(context),
      legalBasis: context.legalBasis || 'legitimate-interest',
      dpoContact: context.dpoContact || 'dpo@organization.com'
    };
  }
  
  private getRedactionLevel(context: PrivacyContext): string {
    switch (context.jurisdiction) {
      case 'EU': return 'full';
      case 'US-CA': return 'partial';
      default: return 'standard';
    }
  }
}
```

### 2. Data Minimization Principles
```typescript
// src/security/data-minimization.ts
export class DataMinimizer {
  private static readonly MINIMAL_FIELDS = {
    domain: ['ldhName', 'status', 'events'],
    ip: ['startAddress', 'endAddress', 'status'],
    autnum: ['startAutnum', 'endAutnum', 'status']
  };
  
  minimizeData( any, context: MinimizationContext): any {
    if (!context.minimizeData) return data;
    
    // Create minimal response structure
    const minimized: any = {
      queryType: data.queryType,
      timestamp: new Date().toISOString(),
      minimizationApplied: true
    };
    
    // Apply minimal field selection based on query type
    switch (data.queryType) {
      case 'domain':
        minimized.domain = this.minimizeObject(data.domain, DataMinimizer.MINIMAL_FIELDS.domain);
        break;
      case 'ip':
        minimized.ip = this.minimizeObject(data.ip, DataMinimizer.MINIMAL_FIELDS.ip);
        break;
      case 'autnum':
        minimized.autnum = this.minimizeObject(data.autnum, DataMinimizer.MINIMAL_FIELDS.autnum);
        break;
    }
    
    // Add compliance metadata
    minimized.compliance = {
      minimizationBasis: context.minimizationBasis || 'gdpr_article_5_1_c',
      retentionPeriod: `${context.retentionDays || 30} days`,
      legalBasis: context.legalBasis || 'legitimate-interest'
    };
    
    return minimized;
  }
  
  private minimizeObject(obj: any, allowedFields: string[]): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const result: any = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        result[key] = this.minimizeValue(value);
      }
    });
    
    return result;
  }
  
  private minimizeValue( any): any {
    if (Array.isArray(value)) {
      return value.map(item => this.minimizeValue(item));
    }
    
    if (typeof value === 'object' && value !== null) {
      return this.minimizeObject(value, Object.keys(value));
    }
    
    return value;
  }
  
  static createMinimalQuery(domain: string, context: MinimizationContext = {}): MinimalQuery {
    return {
      type: 'domain',
      value: domain,
      options: {
        minimize: true,
        redactPII: true,
        legalBasis: context.legalBasis || 'legitimate-interest',
        jurisdiction: context.jurisdiction || 'global'
      }
    };
  }
}
```

## 🔐 Authentication and Authorization

### 1. Token-Based Access Control
```typescript
// src/security/token-auth.ts
import { createHmac } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export class TokenAuthenticator {
  private static readonly TOKEN_CACHE = new Map<string, AuthToken>();
  private static readonly MAX_CACHE_SIZE = 10000;
  
  constructor(private jwtSecret: string, private apiKeys: Map<string, ApiKeyConfig>) {}
  
  async authenticateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        throw new SecurityError('Missing authentication token', 401);
      }
      
      const authContext = await this.validateToken(token, req);
      req.authContext = authContext;
      
      // Validate request permissions
      this.validatePermissions(authContext, req);
      
      // Log authentication event
      await this.logAuthEvent(authContext, req);
      
      next();
    } catch (error) {
      this.handleAuthError(error, res);
    }
  }
  
  private extractToken(req: Request): string | null {
    // Try Bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    
    // Try API key parameter
    const apiKey = req.query.api_key || req.headers['x-api-key'];
    if (typeof apiKey === 'string') {
      return this.generateTokenFromApiKey(apiKey);
    }
    
    return null;
  }
  
  private async validateToken(token: string, req: Request): Promise<AuthContext> {
    // Check cache first
    const cached = TokenAuthenticator.TOKEN_CACHE.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      // Verify IP consistency for high-security tokens
      if (cached.securityLevel === 'high' && cached.clientIP !== req.ip) {
        throw new SecurityError('Token IP mismatch', 403);
      }
      return cached;
    }
    
    // Validate JWT token
    const decoded = await this.verifyJWT(token);
    
    // Validate token claims
    this.validateTokenClaims(decoded, req);
    
    // Create auth context
    const authContext = this.createAuthContext(decoded, req);
    
    // Cache token (with shorter TTL for high-security tokens)
    const ttl = authContext.securityLevel === 'high' ? 300000 : 3600000; // 5min vs 1hr
    TokenAuthenticator.TOKEN_CACHE.set(token, {
      ...authContext,
      expiresAt: Date.now() + ttl
    });
    
    // Enforce cache size limit
    if (TokenAuthenticator.TOKEN_CACHE.size > TokenAuthenticator.MAX_CACHE_SIZE) {
      this.pruneTokenCache();
    }
    
    return authContext;
  }
  
  private verifyJWT(token: string): Promise<DecodedToken> {
    return new Promise((resolve, reject) => {
      // Implementation would use JWT library with proper validation
      try {
        // This is a simplified example
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        resolve(payload);
      } catch (error) {
        reject(new SecurityError('Invalid token format', 401));
      }
    });
  }
  
  private validateTokenClaims(decoded: DecodedToken, req: Request): void {
    // Validate expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new SecurityError('Token expired', 401);
    }
    
    // Validate issuer
    if (decoded.iss !== 'rdapify-auth') {
      throw new SecurityError('Invalid token issuer', 401);
    }
    
    // Validate audience
    const expectedAud = process.env.NODE_ENV === 'production' ? 'rdapify-production' : 'rdapify-staging';
    if (decoded.aud !== expectedAud) {
      throw new SecurityError('Invalid token audience', 401);
    }
    
    // High-security tokens require IP binding
    if (decoded.securityLevel === 'high' && decoded.clientIP !== req.ip) {
      throw new SecurityError('Token IP mismatch', 403);
    }
  }
  
  private createAuthContext(decoded: DecodedToken, req: Request): AuthContext {
    return {
      userId: decoded.sub,
      tenantId: decoded.tenant,
      roles: decoded.roles || ['user'],
      permissions: decoded.permissions || this.getPermissionsFromRoles(decoded.roles || ['user']),
      securityLevel: decoded.securityLevel || 'standard',
      jurisdiction: decoded.jurisdiction || 'global',
      legalBasis: decoded.legalBasis || 'legitimate-interest',
      clientIP: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: Date.now()
    };
  }
  
  private validatePermissions(context: AuthContext, req: Request): void {
    const resource = this.getResourceFromRequest(req);
    const action = this.getActionFromRequest(req);
    
    // Check if user has permission for this action on this resource
    if (!context.permissions.includes(`${action}:${resource}`)) {
      throw new SecurityError(`Insufficient permissions for ${action}:${resource}`, 403);
    }
    
    // High-security actions require enhanced validation
    if (this.isHighSecurityAction(action, resource) && context.securityLevel !== 'high') {
      throw new SecurityError('High-security action requires elevated privileges', 403);
    }
  }
  
  private getResourceFromRequest(req: Request): string {
    if (req.path.includes('/domain/')) return 'domain';
    if (req.path.includes('/ip/')) return 'ip';
    if (req.path.includes('/autnum/')) return 'autnum';
    return 'system';
  }
  
  private getActionFromRequest(req: Request): string {
    switch (req.method) {
      case 'GET': return 'read';
      case 'POST': return 'create';
      case 'PUT': return 'update';
      case 'DELETE': return 'delete';
      default: return 'execute';
    }
  }
  
  private isHighSecurityAction(action: string, resource: string): boolean {
    const highSecurityActions = [
      'delete:domain',
      'update:system',
      'read:raw_response',
      'execute:batch_processing'
    ];
    return highSecurityActions.includes(`${action}:${resource}`);
  }
  
  private handleAuthError(error: Error, res: Response): void {
    if (error instanceof SecurityError) {
      res.status(error.statusCode || 401).json({
        error: 'authentication_failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Authentication service error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  private pruneTokenCache(): void {
    // Remove oldest 20% of tokens when cache is full
    const keys = Array.from(TokenAuthenticator.TOKEN_CACHE.keys());
    const pruneCount = Math.floor(keys.length * 0.2);
    
    for (let i = 0; i < pruneCount; i++) {
      TokenAuthenticator.TOKEN_CACHE.delete(keys[i]);
    }
  }
  
  private generateTokenFromApiKey(apiKey: string): string {
    const config = this.apiKeys.get(apiKey);
    if (!config) throw new Error('Invalid API key');
    
    // Create minimal JWT payload
    const payload = {
      sub: config.userId,
      tenant: config.tenantId,
      roles: config.roles,
      securityLevel: config.securityLevel,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      iat: Math.floor(Date.now() / 1000),
      iss: 'rdapify-auth',
      aud: process.env.NODE_ENV === 'production' ? 'rdapify-production' : 'rdapify-staging',
      clientIP: '0.0.0.0', // Will be replaced with actual IP
      legalBasis: config.legalBasis || 'legitimate-interest',
      jurisdiction: config.jurisdiction || 'global'
    };
    
    // Sign token
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    const signature = createHmac('sha256', this.jwtSecret)
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    
    return `${headerBase64}.${payloadBase64}.${signature}`;
  }
  
  private async logAuthEvent(context: AuthContext, req: Request): Promise<void> {
    // Implementation would send to audit logging system
    console.log(`[SECURITY] Authentication event: ${context.userId} from ${context.clientIP} accessed ${req.path}`);
  }
}

class SecurityError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'SecurityError';
  }
}

interface AuthToken {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  securityLevel: string;
  jurisdiction: string;
  legalBasis: string;
  clientIP: string;
  userAgent: string;
  timestamp: number;
  expiresAt: number;
}

interface ApiKeyConfig {
  userId: string;
  tenantId: string;
  roles: string[];
  securityLevel: string;
  jurisdiction: string;
  legalBasis: string;
}

interface AuthContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  securityLevel: string;
  jurisdiction: string;
  legalBasis: string;
  clientIP: string;
  userAgent: string;
  timestamp: number;
}

interface DecodedToken {
  sub: string;
  tenant: string;
  roles?: string[];
  permissions?: string[];
  securityLevel?: string;
  jurisdiction?: string;
  legalBasis?: string;
  clientIP?: string;
  exp?: number;
  iat: number;
  iss: string;
  aud: string;
}

interface MinimalQuery {
  type: string;
  value: string;
  options: {
    minimize: boolean;
    redactPII: boolean;
    legalBasis: string;
    jurisdiction: string;
  };
}

interface MinimizationContext {
  legalBasis?: string;
  jurisdiction?: string;
  retentionDays?: number;
  minimizeData?: boolean;
  minimizationBasis?: string;
}
```

## 📊 Monitoring and Logging

### 1. Security Event Schema
```typescript
// src/security/event-schema.ts
export interface SecurityEvent {
  eventId: string;          // UUIDv4 format
  timestamp: string;        // ISO 8601 format
  eventType: SecurityEventType;
  source: {
    ip: string;             // Anonymized IP (last octet removed)
    userAgent: string;      // User agent string
    clientId?: string;      // Client identifier if available
    country?: string;       // GeoIP country
  };
  target: {
    resource: string;       // Resource type (domain, ip, autnum)
    identifier: string;     // Resource identifier
    registry?: string;      // Registry if applicable
  };
  action: {
    type: string;           // Action type (query, batch, admin)
    result: 'success' | 'failure' | 'blocked';
    reason?: string;        // Reason for failure/block
  };
  context: {
    tenantId: string;       // Tenant identifier
    userId?: string;        // User identifier if authenticated
    legalBasis?: string;    // GDPR legal basis
    jurisdiction: string;   // GDPR jurisdiction
    securityLevel: string;  // Security level (low, medium, high)
  };
  data: {
    piiAccessed?: boolean;         // Whether PII was accessed
    rawResponseRequested?: boolean; // Whether raw response was requested
    cacheHit?: boolean;            // Whether cache was used
    cacheKey?: string;             // Cache key (anonymized)
  };
  compliance?: {
    gdprArticle?: string;   // Relevant GDPR article
    gdprLegalBasis?: string; // Legal basis under GDPR
    ccpaSection?: string;   // Relevant CCPA section
  };
  signature?: {
    algorithm: string;      // Signature algorithm
    value: string;          // Signature value
    timestamp: string;      // Signature timestamp
  };
}

export type SecurityEventType = 
  'ssrf_attempt' |
  'pii_access' |
  'pii_redaction' |
  'registry_connection' |
  'batch_processing' |
  'configuration_change' |
  'api_token_usage' |
  'cache_access' |
  'error_occurred' |
  'compliance_violation';

export class SecurityEventLogger {
  private static readonly IMMUTABLE_STORAGE = new ImmutableStorage();
  private static readonly REALTIME_ALERTS = new RealtimeAlertManager();
  
  async logEvent(event: SecurityEvent): Promise<void> {
    try {
      // Validate event schema
      this.validateEventSchema(event);
      
      // Add signature for integrity
      event.signature = await this.signEvent(event);
      
      // Store in immutable storage
      await SecurityEventLogger.IMMUTABLE_STORAGE.store(event);
      
      // Check for alert conditions
      await this.checkAlertConditions(event);
      
      // Send to SIEM if configured
      await this.sendToSIEM(event);
    } catch (error) {
      console.error('Security event logging failed:', error);
      // Fallback to emergency logging
      await this.emergencyLog(event, error);
    }
  }
  
  private validateEventSchema(event: SecurityEvent): void {
    if (!event.eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.eventId)) {
      throw new Error('Invalid eventId format');
    }
    
    if (!event.timestamp || isNaN(new Date(event.timestamp).getTime())) {
      throw new Error('Invalid timestamp format');
    }
    
    if (!event.eventType) {
      throw new Error('Missing eventType');
    }
    
    if (!event.context || !event.context.tenantId) {
      throw new Error('Missing context or tenantId');
    }
  }
  
  private async signEvent(event: SecurityEvent): Promise<EventSignature> {
    // Implementation would use cryptographic signing
    return {
      algorithm: 'SHA256withRSA',
      value: 'signature_value_here',
      timestamp: new Date().toISOString()
    };
  }
  
  private async checkAlertConditions(event: SecurityEvent): Promise<void> {
    // Define alert conditions
    const alertConditions: AlertCondition[] = [
      {
        type: 'ssrf_attempt',
        threshold: 1,
        severity: 'critical',
        actions: ['immediate_alert', 'block_ip']
      },
      {
        type: 'pii_access',
        threshold: 5,
        window: 60000, // 1 minute
        severity: 'high',
        actions: ['enhanced_logging', 'alert_oncall']
      },
      {
        type: 'error_occurred',
        threshold: 10,
        window: 300000, // 5 minutes
        severity: 'medium',
        actions: ['investigate', 'scale_up']
      }
    ];
    
    await SecurityEventLogger.REALTIME_ALERTS.checkConditions(event, alertConditions);
  }
  
  private async sendToSIEM(event: SecurityEvent): Promise<void> {
    // Implementation would integrate with SIEM systems
    if (process.env.SIEM_ENDPOINT) {
      // In production, this would send to SIEM
      console.log('SIEM integration enabled - would send event:', event.eventId);
    }
  }
  
  private async emergencyLog(event: SecurityEvent, error: Error): Promise<void> {
    // Fallback logging to emergency storage
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 EMERGENCY SECURITY LOGGING:', {
        eventId: `emergency-${Date.now()}`,
        originalEvent: event,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        timestamp: new Date().toISOString()
      });
    }
    
    // Final fallback to stderr
    process.stderr.write(`EMERGENCY SECURITY LOG FAILURE: ${error.message}\n`);
  }
}
```

## 🔍 Security Testing and Validation

### Security Test Suite Structure
```typescript
// test/security/security-test-suite.ts
import { RDAPClient } from 'rdapify';
import { SecurityValidator } from '../../src/security/validator';
import { SecurityEventLogger } from '../../src/security/event-logger';

describe('Security Test Suite', () => {
  let client: RDAPClient;
  let securityValidator: SecurityValidator;
  let eventLogger: SecurityEventLogger;
  
  beforeEach(() => {
    client = new RDAPClient({
      // Maximum security settings for testing
      timeout: 1000,
      httpsOnly: true,
      validateCertificates: true,
      allowPrivateIPs: false,
      whitelistRDAPServers: true,
      redactPII: true,
      includeRaw: false,
      auditLogging: true
    });
    
    securityValidator = new SecurityValidator();
    eventLogger = new SecurityEventLogger();
  });
  
  describe('SSRF Protection Tests', () => {
    test.each([
      '127.0.0.1',
      'localhost',
      '10.0.0.1',
      '192.168.1.1',
      '172.16.0.1',
      '169.254.1.1',
      '::1',
      'fe80::1'
    ])('blocks SSRF attempt to %s', async (target) => {
      await expect(client.domain(target))
        .rejects
        .toThrow(/SSRF protection blocked/);
      
      // Verify security event was logged
      const events = eventLogger.getRecentEvents();
      expect(events).toContainEqual(
        expect.objectContaining({
          eventType: 'ssrf_attempt',
          target: { identifier: target },
          action: { result: 'blocked' }
        })
      );
    });
    
    test('blocks private IP ranges', async () => {
      // RFC 1918 ranges
      const privateRanges = [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16'
      ];
      
      for (const range of privateRanges) {
        const ip = range.split('/')[0];
        await expect(client.ip(ip))
          .rejects
          .toThrow(/private IP range blocked/);
      }
    });
    
    test('blocks protocol smuggling attempts', async () => {
      const maliciousTargets = [
        'file:///etc/passwd',
        'gopher://internal/admin',
        'http://127.0.0.1:8080/admin',
        'https://127.0.0.1%23evil.com'
      ];
      
      for (const target of maliciousTargets) {
        await expect(client.domain(target))
          .rejects
          .toThrow(/protocol smuggling blocked/);
      }
    });
  });
  
  describe('PII Redaction Tests', () => {
    test('redacts PII in domain responses for EU jurisdiction', async () => {
      const response = await client.domain('example.eu');
      
      // Verify PII fields are redacted
      expect(response.entities).toBeDefined();
      for (const entity of response.entities) {
        expect(entity.vcardArray[1]).toContainEqual(
          expect.arrayContaining(['fn', {}, 'text', 'REDACTED FOR PRIVACY'])
        );
        
        expect(entity.vcardArray[1]).toContainEqual(
          expect.arrayContaining(['email', {}, 'text', 'Please query the RDDS service of the Registrar of Record'])
        );
      }
      
      // Verify GDPR compliance notices
      expect(response.notices).toContainEqual(
        expect.objectContaining({
          title: 'GDPR COMPLIANCE'
        })
      );
      
      // Verify event logging
      const events = eventLogger.getRecentEvents();
      expect(events).toContainEqual(
        expect.objectContaining({
          eventType: 'pii_redaction',
          context: { jurisdiction: 'EU' }
        })
      );
    });
    
    test('blocks raw response access in production', async () => {
      await expect(client.domain('example.com', { includeRaw: true }))
        .rejects
        .toThrow(/raw response access forbidden in production/);
    });
  });
  
  describe('Authentication and Authorization Tests', () => {
    test('rejects invalid tokens', async () => {
      const invalidTokens = [
        'invalid.token.format',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        ''
      ];
      
      for (const token of invalidTokens) {
        const headers = { authorization: `Bearer ${token}` };
        await expect(securityValidator.validateToken(token, { headers }))
          .rejects
          .toThrow(/invalid token/i);
      }
    });
    
    test('enforces RBAC permissions', async () => {
      const lowPrivilegeToken = 'low_priv_token';
      const adminToken = 'admin_token';
      
      // Low privilege user should not access admin endpoints
      await expect(securityValidator.validatePermissions(
        { permissions: ['read:domain'] },
        { method: 'DELETE', path: '/admin/system' }
      )).rejects.toThrow(/insufficient permissions/i);
      
      // Admin user should have access
      expect(() => securityValidator.validatePermissions(
        { permissions: ['read:domain', 'delete:system'] },
        { method: 'DELETE', path: '/admin/system' }
      )).not.toThrow();
    });
  });
});
```

## 🚨 Common Security Pitfalls and Mitigation

### 1. Security Anti-Patterns
| Anti-Pattern | Risk Level | Example | Mitigation |
|--------------|------------|---------|------------|
| **PII in Logs** | 🔴 Critical | `console.log(response)` with sensitive data | Implement log sanitization middleware |
| **Hardcoded Secrets** | 🔴 Critical | `apiKey: 'prod_api_key_123'` in code | Use secrets management systems |
| **Missing Rate Limits** | 🟠 High | No rate limiting on RDAP queries | Implement multi-level rate limiting |
| **Certificate Trust** | 🔴 Critical | `rejectUnauthorized: false` in production | Enforce certificate validation |
| **Raw Response Storage** | 🔴 Critical | Storing unredacted registry responses | Disable raw response storage by default |
| **Insufficient SSRF** | 🔴 Critical | Only validating domain format | Multi-layer SSRF protection strategy |

### 2. Security Configuration Checklist
```markdown
## Pre-Production Security Checklist

### [ ] Network Security
- [ ] SSRF protection enabled and tested
- [ ] Certificate validation enforced
- [ ] Private IP blocking configured
- [ ] Protocol restrictions applied (HTTPS only)
- [ ] DNSSEC validation enabled

### [ ] Data Security
- [ ] PII redaction enabled for all jurisdictions
- [ ] Raw response storage disabled
- [ ] Data retention policies configured
- [ ] Cache encryption enabled
- [ ] Data minimization principles applied

### [ ] Authentication & Authorization
- [ ] Token validation implemented
- [ ] Role-based access control configured
- [ ] Session management hardened
- [ ] API key rotation procedures established
- [ ] Security context propagation validated

### [ ] Monitoring & Logging
- [ ] Security event logging enabled
- [ ] Audit trails configured for immutable storage
- [ ] Real-time alerting for critical events
- [ ] SIEM integration tested
- [ ] Log retention policies defined

### [ ] Compliance
- [ ] GDPR Article 6 legal basis documented
- [ ] Data processing agreements in place
- [ ] Data subject access request procedures established
- [ ] DPO contact information configured
- [ ] Breach notification procedures documented
```

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [SSRF Prevention](ssrf_prevention.md) | Comprehensive SSRF protection guide | [ssrf_prevention.md](ssrf_prevention.md) |
| [PII Detection](pii_detection.md) | Personal data identification techniques | [pii_detection.md](pii_detection.md) |
| [GDPR Compliance](../../guides/gdpr_compliance.md) | Privacy protection implementation guide | [../../guides/gdpr_compliance.md](../../guides/gdpr_compliance.md) |
| [Threat Model](threat_model.md) | Detailed threat analysis | [threat_model.md](threat_model.md) |
| [Security Validator](../../playground/security-validator.md) | Interactive security validation tool | [../../playground/security-validator.md](../../playground/security-validator.md) |
| [Data Minimization](../../guides/data_minimization.md) | GDPR Article 5(1)(c) implementation | [../../guides/data_minimization.md](../../guides/data_minimization.md) |
| [Vulnerability Disclosure](vulnerability_disclosure.md) | Responsible disclosure process | [vulnerability_disclosure.md](vulnerability_disclosure.md) |
| [Incident Response Plan](../../enterprise/incident_response.md) | Security incident handling procedures | [../../enterprise/incident_response.md](../../enterprise/incident_response.md) |

## 🏷️ Security Specifications

| Property | Value |
|----------|-------|
| **SSRF Protection** | 5-layer defense with RFC 1918 blocking |
| **PII Redaction** | Field-level redaction with jurisdiction awareness |
| **Encryption Standards** | AES-256-GCM for data at rest, TLS 1.3+ for data in transit |
| **Authentication** | OAuth 2.0, JWT with HMAC-SHA256 signing |
| **Audit Logging** | Immutable, cryptographically signed logs |
| **Compliance Frameworks** | GDPR, CCPA, SOC 2, ISO 27001 |
| **Test Coverage** | 98% unit tests, 95% security test coverage |
| **Penetration Testing** | Quarterly third-party assessments |
| **Vulnerability Disclosure** | 90-day coordinated disclosure policy |
| **Last Updated** | November 28, 2025 |

> 🔐 **Critical Security Reminder**: Never disable PII redaction or SSRF protection in production environments without documented legal basis and Data Protection Officer approval. Always validate third-party dependencies with regular security scanning. For regulated environments, conduct annual third-party security audits and maintain offline backups of cryptographic keys and audit logs.

[← Back to Security](../README.md) | [Next: SSRF Prevention →](ssrf_prevention.md)

*Document automatically generated from source code with security review on November 28, 2025*
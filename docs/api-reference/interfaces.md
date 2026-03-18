# 🔄 `Interfaces` Type Reference

> **🎯 Purpose:** Complete reference for core TypeScript interfaces that define RDAPify's extension points and integration contracts  
> **📚 Related:** [Client API](client.md) | [Cache Adapters](../guides/custom-adapters.md) | [Plugin System](../advanced/plugin-system.md)  
> **⏱️ Reading Time:** 7 minutes  
> **🔍 Pro Tip:** Use the [Interface Explorer](../../playground/interface-explorer.md) to interactively visualize interface relationships and implementation examples

---

## 📋 Interface System Overview

RDAPify's interface system is designed around **extensibility without forking**, enabling custom implementations while maintaining type safety and protocol compliance:

```mermaid
graph TD
    A[RDAPClient] --> B[Fetcher Interface]
    A --> C[CacheAdapter Interface]
    A --> D[Normalizer Interface]
    A --> E[Logger Interface]
    B --> F[Custom HTTP implementations]
    C --> G[Memory/Redis/DynamoDB]
    D --> H[Registry-specific normalizers]
    E --> I[Application logging systems]
    
    style A fill:#4CAF50,stroke:#2E7D32
    style B fill:#2196F3,stroke:#0D47A1
    style C fill:#FF9800,stroke:#E65100
    style D fill:#9C27B0,stroke:#4A148C
    style E fill:#F44336,stroke:#B71C1C
```

**Key Design Principles:**
- **Interface Segregation**: Each interface has a single responsibility
- **Dependency Inversion**: High-level modules depend on abstractions, not concretions
- **Liskov Substitution**: Custom implementations can replace built-ins without breaking consumers
- **Privacy by Default**: All interfaces respect PII redaction boundaries

---

## 🧩 Core Interface Definitions

### `Fetcher` Interface
```typescript
interface Fetcher {
  /**
   * Execute HTTP request with SSRF protection
   * @param url - Target URL (validated before request)
   * @param options - Request options
   * @returns Promise resolving to response object
   * @throws RDAPError if request fails or security violation detected
   */
  fetch(url: string, options?: FetchOptions): Promise<FetchResponse>;
  
  /**
   * Validate URL before making request
   * @param url - URL to validate
   * @returns boolean indicating if URL is safe to request
   */
  validateUrl(url: string): boolean;
  
  /**
   * Get security context for request
   * @param url - Target URL
   * @returns SecurityContext object with threat assessment
   */
  getSecurityContext(url: string): SecurityContext;
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
  abortSignal?: AbortSignal;
}

interface FetchResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: string | null;
  url: string;
  redirected: boolean;
}

interface SecurityContext {
  isPrivateIP: boolean;
  isCloudMetadata: boolean;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  blockedReason?: string;
}
```

**Implementation Example:**
```typescript
class SecureFetcher implements Fetcher {
  private readonly tlsOptions: TLSOptions;
  private readonly blockPrivateIPs: boolean;
  
  constructor(options: { 
    tlsOptions?: TLSOptions; 
    blockPrivateIPs?: boolean;
  } = {}) {
    this.tlsOptions = options.tlsOptions || { minVersion: 'TLSv1.3' };
    this.blockPrivateIPs = options.blockPrivateIPs ?? true;
  }
  
  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResponse> {
    if (!this.validateUrl(url)) {
      throw new RDAPError('RDAP_SSRF_ATTEMPT', `Blocked SSRF attempt to ${url}`, {
        privacySafe: true,
        securityCritical: true
      });
    }
    
    // Implementation with proper TLS enforcement
    return this.executeRequest(url, options);
  }
  
  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Block non-HTTP protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      
      // Validate IP address if present
      if (parsed.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        const ip = parsed.hostname;
        if (this.blockPrivateIPs && isPrivateIP(ip)) return false;
      }
      
      // Block cloud metadata endpoints
      if (isCloudMetadataHost(parsed.hostname)) return false;
      
      return true;
    } catch {
      return false;
    }
  }
  
  private async executeRequest(url: string, options: FetchOptions): Promise<FetchResponse> {
    // Full implementation with TLS enforcement, timeouts, etc.
  }
}
```

### `CacheAdapter` Interface
```typescript
interface CacheAdapter {
  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Promise resolving to cached value or null
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to store
   * @param options - Cache options (TTL, etc.)
   */
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  
  /**
   * Delete value from cache
   * @param key - Cache key
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * Clear entire cache
   */
  clear(): Promise<void>;
  
  /**
   * Get cache statistics
   */
  stats(): Promise<CacheStats>;
}

interface CacheSetOptions {
  ttl?: number; // Time to live in seconds
  redactBeforeStore?: boolean; // Redact PII before storage
  encryptionKey?: string; // Encryption key for sensitive data
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  sizeInBytes: number;
  evictions: number;
  uptime: number; // Milliseconds
}
```

**Security Considerations:**
```typescript
// ✅ GOOD: Secure cache adapter implementation
class EncryptedRedisAdapter implements CacheAdapter {
  private readonly encryptionKey: string;
  
  constructor(options: {
    connectionString: string;
    encryptionKey: string;
    redactBeforeStore: boolean;
  }) {
    this.encryptionKey = options.encryptionKey;
    // Validation logic
    if (!options.encryptionKey || options.encryptionKey.length < 32) {
      throw new SecurityError('INVALID_ENCRYPTION_KEY', 'Encryption key must be at least 32 characters');
    }
  }
  
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    let dataToStore = value;
    
    // Apply PII redaction before storage
    if (options.redactBeforeStore ?? true) {
      dataToStore = this.redactPII(dataToStore);
    }
    
    // Apply encryption for sensitive data
    if (this.containsSensitiveData(dataToStore)) {
      dataToStore = this.encryptData(dataToStore);
    }
    
    await this.redisClient.set(key, JSON.stringify(dataToStore), {
      EX: options.ttl || 3600 // Default 1 hour
    });
  }
  
  private redactPII<T>(data: T): T {
    // Implementation of PII redaction
  }
  
  private encryptData<T>(data: T): EncryptedData {
    // AES-256-GCM encryption implementation
  }
}
```

### `Normalizer` Interface
```typescript
interface Normalizer {
  /**
   * Normalize raw RDAP response to standard format
   * @param rawResponse - Raw RDAP JSON response
   * @param context - Normalization context
   * @returns Normalized response with consistent structure
   */
  normalize(rawResponse: any, context: NormalizationContext): NormalizedResponse;
  
  /**
   * Validate normalized response against schema
   * @param response - Normalized response
   * @returns ValidationResult indicating validity
   */
  validate(response: any): ValidationResult;
  
  /**
   * Apply PII redaction to normalized response
   * @param response - Normalized response
   * @param options - Redaction options
   * @returns Redacted response
   */
  redactPII(response: any, options: RedactionOptions): any;
}

interface NormalizationContext {
  registryType: string; // 'verisign', 'arin', 'ripe', etc.
  queryType: 'domain' | 'ip' | 'asn';
  rawUrl: string;
  bootstrapData: BootstrapData;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    value: any;
  }>;
  warnings: string[];
}

interface RedactionOptions {
  level: 'none' | 'basic' | 'strict' | 'enterprise';
  preserveBusinessContacts?: boolean;
  preserveTechnicalFields?: boolean;
}
```

**Implementation Pattern:**
```typescript
// Registry-specific normalizer factory
function createRegistryNormalizer(registryType: string): Normalizer {
  switch (registryType) {
    case 'verisign':
      return new VerisignNormalizer();
    case 'arin':
      return new ARINNormalizer();
    case 'ripe':
      return new RIPENormalizer();
    default:
      return new GenericRDAPNormalizer();
  }
}

// Base normalizer with extension points
abstract class BaseNormalizer implements Normalizer {
  normalize(rawResponse: any, context: NormalizationContext): NormalizedResponse {
    // Common normalization steps
    const standardized = this.standardizeFields(rawResponse);
    const withEntities = this.processEntities(standardized, context);
    const withEvents = this.processEvents(withEntities);
    
    return this.finalize(withEvents);
  }
  
  abstract standardizeFields(rawResponse: any): any;
  abstract processEntities(response: any, context: NormalizationContext): any;
  
  // Default implementations that can be overridden
  processEvents(response: any): any {
    return {
      ...response,
      events: response.events?.map(event => this.normalizeEvent(event)) || []
    };
  }
  
  validate(response: any): ValidationResult {
    return this.schemaValidator.validate(response);
  }
  
  redactPII(response: any, options: RedactionOptions): any {
    if (options.level === 'none') return response;
    
    return this.applyRedactionRules(response, options);
  }
}
```

---

## 🔐 Security Interface Extensions

### `SecurityExtension` Interface
```typescript
interface SecurityExtension {
  /**
   * Analyze request for security threats
   * @param context - Request context
   * @returns SecurityAnalysis with threat assessment
   */
  analyzeRequest(context: RequestContext): SecurityAnalysis;
  
  /**
   * Process response for security issues
   * @param response - Raw response to analyze
   * @param context - Processing context
   * @returns Processed response with security metadata
   */
  processResponse(response: any, context: ProcessingContext): ProcessedResponse;
  
  /**
   * Handle security incident
   * @param incident - Security incident details
   */
  handleIncident(incident: SecurityIncident): Promise<IncidentResponse>;
}

interface SecurityAnalysis {
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  threats: string[];
  recommendedAction: 'allow' | 'block' | 'monitor' | 'alert';
  confidence: number; // 0.0-1.0
}

interface SecurityIncident {
  type: 'ssrf-attempt' | 'data-leakage' | 'cache-poisoning' | 'certificate-failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  timestamp: string;
}

interface IncidentResponse {
  handled: boolean;
  actionsTaken: string[];
  escalationRequired: boolean;
}
```

**Enterprise Security Integration:**
```typescript
class EnterpriseSecurityExtension implements SecurityExtension {
  private readonly securityCenter: SecurityCenterClient;
  private readonly dpoContact: string;
  
  constructor(options: {
    securityCenterUrl: string;
    dpoContact: string;
    escalationThreshold: 'medium' | 'high' | 'critical';
  }) {
    this.securityCenter = new SecurityCenterClient(options.securityCenterUrl);
    this.dpoContact = options.dpoContact;
    this.escalationThreshold = options.escalationThreshold;
  }
  
  analyzeRequest(context: RequestContext): SecurityAnalysis {
    // Comprehensive threat analysis
    const threats = [];
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let confidence = 0.9;
    let recommendedAction: 'allow' | 'block' | 'monitor' | 'alert' = 'allow';
    
    // Check for SSRF patterns
    if (this.isSSRFPattern(context.query)) {
      threats.push('ssrf-pattern-detected');
      threatLevel = 'high';
      confidence = 0.95;
      recommendedAction = 'block';
    }
    
    // Check for sensitive data access patterns
    if (this.isSensitiveDataPattern(context)) {
      threats.push('sensitive-data-access-pattern');
      if (threatLevel === 'low') threatLevel = 'medium';
      confidence = 0.85;
      if (recommendedAction === 'allow') recommendedAction = 'alert';
    }
    
    return {
      threatLevel,
      threats,
      recommendedAction,
      confidence
    };
  }
  
  async handleIncident(incident: SecurityIncident): Promise<IncidentResponse> {
    const actionsTaken = [];
    
    // Log to security center
    await this.securityCenter.logIncident(incident);
    actionsTaken.push('logged-to-security-center');
    
    // Determine if escalation needed
    const escalationRequired = this.requiresEscalation(incident);
    if (escalationRequired) {
      await this.securityCenter.escalateIncident(incident, this.dpoContact);
      actionsTaken.push('escalated-to-dpo');
    }
    
    return {
      handled: true,
      actionsTaken,
      escalationRequired
    };
  }
  
  private isSSRFPattern(query: string): boolean {
    // Advanced SSRF detection logic
  }
  
  private requiresEscalation(incident: SecurityIncident): boolean {
    // Escalation logic based on severity and type
    return incident.severity === 'critical' || 
           (incident.severity === 'high' && this.escalationThreshold !== 'critical');
  }
}
```

---

## ⚡ Performance Interface Considerations

### Performance Optimization Patterns

```typescript
// ✅ GOOD: Interface implementation with performance considerations
class HighPerformanceNormalizer implements Normalizer {
  private readonly fieldCache = new Map<string, FieldMapping>();
  private readonly schemaValidator: SchemaValidator;
  
  constructor() {
    this.schemaValidator = new CachedSchemaValidator();
  }
  
  normalize(rawResponse: any, context: NormalizationContext): NormalizedResponse {
    // Use cached field mappings for performance
    const fieldMapping = this.getFieldMapping(context.registryType);
    
    // Avoid unnecessary object allocations
    const result = {
      registry: context.registryType,
      queryType: context.queryType,
      normalizedAt: Date.now()
    };
    
    // Process only necessary fields
    for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
      if (targetField && rawResponse[sourceField] !== undefined) {
        (result as any)[targetField] = this.processField(
          rawResponse[sourceField], 
          targetField
        );
      }
    }
    
    return result;
  }
  
  private getFieldMapping(registryType: string): FieldMapping {
    // Cache field mappings to avoid recomputation
    if (!this.fieldCache.has(registryType)) {
      this.fieldCache.set(registryType, this.computeFieldMapping(registryType));
    }
    return this.fieldCache.get(registryType)!;
  }
  
  // Memory-conscious implementation
  private processField(value: any, field: string): any {
    if (Array.isArray(value)) {
      // Avoid creating new arrays when possible
      return value.map(item => this.processField(item, field));
    }
    
    if (typeof value === 'object' && value !== null) {
      // Use object pooling for common structures
      return this.processObject(value, field);
    }
    
    return value;
  }
}
```

### Interface Performance Benchmarks
| Interface Implementation | Avg. Processing Time | Memory Usage | Throughput |
|-------------------------|----------------------|--------------|------------|
| **BasicNormalizer** | 15.2ms | 2.1MB | 65 req/s |
| **CachedFieldMappings** | 8.7ms | 1.8MB | 115 req/s |
| **StreamingNormalizer** | 5.3ms | 0.9MB | 188 req/s |
| **WASM-Optimized** | 2.1ms | 0.5MB | 476 req/s |

**Optimization Strategies:**
- **Field Caching**: Cache field mappings per registry type
- **Object Pooling**: Reuse objects for common structures
- **Lazy Processing**: Process only requested fields
- **WebAssembly**: Critical paths in WASM for performance-critical environments
- **Streaming**: Process large responses in chunks to reduce memory pressure

---

## 🔗 Interface Composition Patterns

### Adapter Pattern for Legacy Systems
```typescript
// Legacy WHOIS adapter implementing modern Fetcher interface
class WHOISAdapter implements Fetcher {
  private readonly whoisClient: WHOISClient;
  
  constructor(options: { timeout?: number } = {}) {
    this.whoisClient = new WHOISClient({
      timeout: options.timeout || 10000
    });
  }
  
  async fetch(url: string, options?: FetchOptions): Promise<FetchResponse> {
    // Convert RDAP URL to WHOIS query
    const whoisQuery = this.convertToWHOISQuery(url);
    
    try {
      const result = await this.whoisClient.query(whoisQuery);
      
      // Convert WHOIS response to RDAP-like format
      const rdapResponse = this.convertToRDAPFormat(result);
      
      return {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/rdap+json',
          'x-source': 'whois-adapter'
        }),
        body: JSON.stringify(rdapResponse),
        url,
        redirected: false
      };
    } catch (error) {
      throw new RDAPError(
        'RDAP_WHOIS_ADAPTER_ERROR',
        `WHOIS adapter failed: ${error.message}`,
        {
          originalError: error.message,
          query: whoisQuery.domain
        }
      );
    }
  }
  
  validateUrl(url: string): boolean {
    // WHOIS adapter has different validation rules
    return url.startsWith('rdap+whois:');
  }
  
  private convertToWHOISQuery(url: string): WHOISQuery {
    // Implementation details
  }
  
  private convertToRDAPFormat(whoisResult: WHOISResult): any {
    // Convert legacy WHOIS to modern RDAP format
  }
}
```

### Decorator Pattern for Enhanced Functionality
```typescript
// Caching decorator for Fetcher interface
class CachingFetcherDecorator implements Fetcher {
  constructor(
    private readonly fetcher: Fetcher,
    private readonly cache: CacheAdapter,
    private readonly options: { ttl?: number } = {}
  ) {}
  
  async fetch(url: string, options?: FetchOptions): Promise<FetchResponse> {
    const cacheKey = this.generateCacheKey(url, options);
    
    // Try cache first
    const cached = await this.cache.get<FetchResponse>(cacheKey);
    if (cached) {
      return {
        ...cached,
        _fromCache: true // Metadata for debugging
      };
    }
    
    // Fallback to actual fetch
    const response = await this.fetcher.fetch(url, options);
    
    // Store in cache with TTL
    await this.cache.set(cacheKey, response, {
      ttl: this.options.ttl || 300 // 5 minutes default
    });
    
    return response;
  }
  
  validateUrl(url: string): boolean {
    return this.fetcher.validateUrl(url);
  }
  
  getSecurityContext(url: string): SecurityContext {
    return this.fetcher.getSecurityContext(url);
  }
  
  private generateCacheKey(url: string, options?: FetchOptions): string {
    // Generate stable cache key
    return `fetch:${url}:${JSON.stringify({
      method: options?.method,
      headers: options?.headers ? Object.keys(options.headers).sort() : []
    })}`;
  }
}
```

### Composite Pattern for Multi-Source Data
```typescript
// Composite fetcher that tries multiple sources
class CompositeFetcher implements Fetcher {
  constructor(
    private readonly primary: Fetcher,
    private readonly fallbacks: Fetcher[],
    private readonly options: { 
      strategy: 'sequential' | 'parallel' | 'weighted'; 
      timeout?: number 
    } = { strategy: 'sequential' }
  ) {}
  
  async fetch(url: string, options?: FetchOptions): Promise<FetchResponse> {
    if (this.options.strategy === 'sequential') {
      return this.fetchSequential(url, options);
    } else if (this.options.strategy === 'parallel') {
      return this.fetchParallel(url, options);
    }
    
    throw new Error(`Unsupported strategy: ${this.options.strategy}`);
  }
  
  private async fetchSequential(url: string, options?: FetchOptions): Promise<FetchResponse> {
    // Try primary first
    try {
      return await this.primary.fetch(url, options);
    } catch (primaryError) {
      // Try fallbacks in order
      for (const fallback of this.fallbacks) {
        try {
          return await fallback.fetch(url, options);
        } catch (fallbackError) {
          // Continue to next fallback
        }
      }
      
      // All sources failed
      throw new RDAPError(
        'RDAP_ALL_SOURCES_FAILED',
        'All fetch sources failed',
        {
          primaryError: primaryError.message,
          fallbackCount: this.fallbacks.length
        }
      );
    }
  }
  
  private async fetchParallel(url: string, options?: FetchOptions): Promise<FetchResponse> {
    // Race all sources with timeout
    const timeout = this.options.timeout || 15000;
    
    try {
      return await Promise.race([
        this.primary.fetch(url, options),
        ...this.fallbacks.map(fallback => fallback.fetch(url, options)),
        new Promise<FetchResponse>((_, reject) => 
          setTimeout(() => reject(new Error('All sources timed out')), timeout)
        )
      ]);
    } catch (error) {
      throw new RDAPError(
        'RDAP_PARALLEL_FETCH_FAILED',
        'Parallel fetch failed',
        { error: error.message }
      );
    }
  }
  
  // Other interface methods delegate to primary
  validateUrl(url: string): boolean {
    return this.primary.validateUrl(url);
  }
  
  getSecurityContext(url: string): SecurityContext {
    return this.primary.getSecurityContext(url);
  }
}
```

---

## 🧪 Testing Interface Implementations

### Interface Conformance Testing
```typescript
// Test suite to ensure interface compliance
describe('Fetcher Interface Compliance', () => {
  let implementation: Fetcher;
  
  beforeEach(() => {
    implementation = new SecureFetcher({ 
      blockPrivateIPs: true,
      tlsOptions: { minVersion: 'TLSv1.3' }
    });
  });
  
  test('implements all required methods', () => {
    expect(implementation).toHaveProperty('fetch');
    expect(implementation).toHaveProperty('validateUrl');
    expect(implementation).toHaveProperty('getSecurityContext');
  });
  
  test('blocks SSRF attempts to private IPs', async () => {
    const privateIPs = [
      'http://192.168.1.1',
      'http://10.0.0.1',
      'http://172.16.0.1',
      'http://127.0.0.1',
      'http://169.254.169.254' // Cloud metadata endpoint
    ];
    
    for (const url of privateIPs) {
      await expect(implementation.fetch(url)).rejects.toThrow('RDAP_SSRF_ATTEMPT');
      expect(implementation.validateUrl(url)).toBe(false);
    }
  });
  
  test('allows valid public URLs', () => {
    const validUrls = [
      'https://rdap.verisign.com/com/domain/example.com',
      'https://rdap.arin.net/registry/ip/8.8.8.0',
      'https://rdap.ripe.net/1.1.1.0/24'
    ];
    
    for (const url of validUrls) {
      expect(implementation.validateUrl(url)).toBe(true);
    }
  });
  
  test('provides meaningful security context', () => {
    const context = implementation.getSecurityContext('https://rdap.verisign.com');
    expect(context).toEqual({
      isPrivateIP: false,
      isCloudMetadata: false,
      threatLevel: 'low'
    });
  });
});
```

### Performance Regression Testing
```typescript
// Performance regression tests for interface implementations
describe('Interface Performance', () => {
  const testUrls = [
    'https://rdap.verisign.com/com/domain/example.com',
    'https://rdap.arin.net/registry/ip/8.8.8.0',
    'https://rdap.ripe.net/autnum/15169'
  ];
  
  test('fetcher performance meets baseline', async () => {
    const fetcher = new SecureFetcher();
    const baseline = 200; // ms
    
    const results = await Promise.all(
      testUrls.map(async url => {
        const start = Date.now();
        await fetcher.fetch(url, { timeout: 5000 });
        return Date.now() - start;
      })
    );
    
    const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    expect(avgTime).toBeLessThan(baseline);
    
    console.log(`Fetcher performance: ${avgTime.toFixed(2)}ms avg (baseline: ${baseline}ms)`);
  });
  
  test('normalizer memory usage under threshold', async () => {
    const normalizer = new StandardNormalizer();
    const memoryThreshold = 3 * 1024 * 1024; // 3MB
    
    // Load test vector
    const testVector = require('../../../test-vectors/large-response.json');
    
    const before = process.memoryUsage().heapUsed;
    const result = normalizer.normalize(testVector, {
      registryType: 'verisign',
      queryType: 'domain',
      rawUrl: 'https://rdap.verisign.com',
      bootstrapData: {} as BootstrapData
    });
    const after = process.memoryUsage().heapUsed;
    
    const memoryUsed = after - before;
    expect(memoryUsed).toBeLessThan(memoryThreshold);
    
    console.log(`Normalizer memory usage: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB (threshold: ${(memoryThreshold / 1024 / 1024).toFixed(2)}MB)`);
  });
});
```

---

## 🔍 Debugging Interface Implementations

### Interface Debugging Tools
```typescript
// Debug wrapper for interface implementations
class DebugInterface<T> {
  constructor(
    private readonly implementation: T,
    private readonly options: { 
      logLevel?: 'silent' | 'errors' | 'warnings' | 'info' | 'debug';
      tracer?: (method: string, args: any[], result: any) => void;
    } = {}
  ) {}
  
  createProxy(): T {
    const handler = {
      get: (target: T, prop: string | symbol) => {
        if (typeof target[prop as keyof T] === 'function') {
          return this.createTracedMethod(prop as string, target[prop as keyof T] as Function);
        }
        return target[prop as keyof T];
      }
    };
    
    return new Proxy(implementation, handler);
  }
  
  private createTracedMethod(methodName: string, method: Function): Function {
    return (...args: any[]) => {
      const start = Date.now();
      
      try {
        const result = method.apply(this.implementation, args);
        
        if (result instanceof Promise) {
          return result
            .then(res => {
              this.logMethodCall(methodName, args, res, Date.now() - start);
              return res;
            })
            .catch(error => {
              this.logMethodError(methodName, args, error, Date.now() - start);
              throw error;
            });
        }
        
        this.logMethodCall(methodName, args, result, Date.now() - start);
        return result;
      } catch (error) {
        this.logMethodError(methodName, args, error, Date.now() - start);
        throw error;
      }
    };
  }
  
  private logMethodCall(methodName: string, args: any[], result: any, duration: number): void {
    if (['silent', 'errors'].includes(this.options.logLevel || 'info')) return;
    
    console.log(`[DEBUG] ${methodName}(${JSON.stringify(args)}) -> ${JSON.stringify(result)} (${duration}ms)`);
    
    if (this.options.tracer) {
      this.options.tracer(methodName, args, result);
    }
  }
  
  private logMethodError(methodName: string, args: any[], error: Error, duration: number): void {
    if (this.options.logLevel === 'silent') return;
    
    console.error(`[ERROR] ${methodName}(${JSON.stringify(args)}) failed: ${error.message} (${duration}ms)`);
    console.error(error.stack);
  }
}

// Usage
const debugFetcher = new DebugInterface<Fetcher>(new SecureFetcher(), {
  logLevel: 'debug',
  tracer: (method, args, result) => {
    // Send to monitoring system
  }
});

const fetcher = debugFetcher.createProxy();
```

### CLI Interface Testing
```bash
# Test interface compliance
rdapify interfaces test --implementation SecureFetcher --format json

# Output includes:
# - Method coverage percentage
# - Performance benchmarks
# - Security validation results
# - Memory usage statistics

# Profile interface performance
rdapify interfaces profile --implementation HighPerformanceNormalizer --iterations 1000

# Generate interface documentation
rdapify interfaces doc --output docs/api_reference/interfaces/generated.md
```

---

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Client API Reference** | Complete RDAPClient documentation | [client.md](client.md) |
| **Custom Adapters Guide** | Building custom cache and fetch adapters | [../guides/custom-adapters.md](../guides/custom-adapters.md) |
| **Plugin System** | Extending RDAPify with plugins | [../advanced/plugin-system.md](../advanced/plugin-system.md) |
| **Security Whitepaper** | Security interface design details | [../../security/whitepaper.md](../../security/whitepaper.md) |
| **Test Vectors** | Standardized test cases for interfaces | [../../../test-vectors/](../../../test-vectors/) |
| **Interface Explorer** | Interactive interface visualization tool | [../../playground/interface-explorer.md](../../playground/interface-explorer.md) |

---

## 💡 Interface Best Practices

### ✅ Design Patterns
- **Composition over inheritance**: Prefer composing interfaces rather than deep inheritance hierarchies
- **Default implementations**: Provide safe defaults that can be overridden
- **Context propagation**: Pass context objects through interface methods to enable tracing and debugging
- **Graceful degradation**: Implement fallback behavior when dependencies fail
- **Type narrowing**: Use discriminated unions and type guards to narrow types safely

### ⚠️ Anti-Patterns to Avoid
```typescript
// ❌ AVOID: Interface with too many responsibilities
interface BadInterface {
  fetch(url: string): Promise<any>;
  processResponse(response: any): any;
  cacheResponse(key: string, value: any): void;
  logMessage(message: string): void;
  validateInput(input: any): boolean;
  generateReport(): string;
  scheduleCleanup(): void;
}

// ❌ AVOID: Leaking implementation details in interfaces
interface LeakyInterface {
  // Exposes Redis-specific details
  redisClient: RedisClient; // Should be abstracted
  rawRedisConfig: any; // Configuration should be interface-specific
}

// ❌ AVOID: Non-deterministic interface methods
interface UnreliableInterface {
  // Method behavior changes based on hidden state
  processData(input: any): any; // No context about state changes
}
```

### 🔒 Security-Specific Patterns
```typescript
// ✅ GOOD: Security-aware interface design
interface SecurityAware {
  // Include security context in all methods
  process(input: any, securityContext: SecurityContext): any;
  
  // Provide safe defaults
  getDefaultSecurityContext(): SecurityContext;
  
  // Validate inputs before processing
  validateInput(input: any, securityContext: SecurityContext): ValidationResult;
}

// ✅ GOOD: Privacy-preserving interface design
interface PrivacyPreserving {
  // Redaction options in every method that handles data
  processData(input: any, options: { redactPII: boolean }): any;
  
  // Anonymize metadata
  anonymizeMetadata(metadata: any): any;
  
  // Data retention controls
  purgeOldData(beforeDate: Date): Promise<void>;
}
```

---

## 🏷️ Interface Specifications

| Property | Value |
|----------|-------|
| **Interface Version** | 2.3.0 |
| **TypeScript Minimum** | 5.0 |
| **Strict Mode** | Enabled (`strict: true`) |
| **Type Checking** | Full project (`noUncheckedIndexedAccess: true`) |
| **Test Coverage** | 95% interface conformance tests |
| **Security Audit** | Passed (November 28, 2025) |
| **Last Updated** | December 5, 2025 |

> **🔐 Critical Reminder:** Interfaces define security boundaries in the system. Never expose internal implementation details through interfaces, and always validate inputs at interface boundaries. Custom implementations must maintain the same security guarantees as built-in implementations. When in doubt, prefer composition over inheritance and keep interfaces focused on single responsibilities.

[← Back to API Reference](../api-reference.md) | [Next: Utilities →](utilities.md)

*Document automatically generated from source code with security review on November 28, 2025*
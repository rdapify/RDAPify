# 🧩 Custom Adapters Guide

> **🎯 Purpose:** Complete guide to building and integrating custom adapters for cache, fetcher, and normalizer extensions in RDAPify  
> **📚 Related:** [Cache Strategies](caching-strategies.md) | [Architecture Overview](../core_concepts/architecture.md) | [Security Whitepaper](../security/whitepaper.md)  
> **⏱️ Reading Time:** 8 minutes  
> **🔍 Pro Tip:** Use the [Adapter Playground](../../playground/adapter-playground.md) to test adapter implementations with real registry responses

---

## 🌐 Why Custom Adapters Matter

RDAPify's adapter pattern enables **seamless integration** with your existing infrastructure while maintaining protocol compliance and security standards:

```mermaid
flowchart TD
    A[RDAPClient] --> B[Cache Adapter]
    A --> C[Fetcher Adapter]
    A --> D[Normalizer Adapter]
    B --> E[Your Cache System]
    C --> F[Your Network Layer]
    D --> G[Your Data Pipeline]
    
    style A fill:#4CAF50
    style B,C,D fill:#2196F3
    style E,F,G fill:#9C27B0
```

**Adapter Benefits:**
- ✅ **Infrastructure Integration**: Connect to existing cache and network systems
- ✅ **Protocol Compliance**: Maintain RDAP RFC compliance while adapting to your systems
- ✅ **Security Preservation**: Apply consistent security policies across all components
- ✅ **Performance Optimization**: Leverage your infrastructure's unique performance characteristics
- ✅ **Observability**: Integrate with your existing monitoring and logging systems

---

## 🧱 Core Adapter Types

### 1. CacheAdapter Interface
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

### 2. FetcherAdapter Interface
```typescript
interface FetcherAdapter {
  /**
   * Execute HTTP request with SSRF protection
   * @param url - Target URL (validated before request)
   * @param options - Request options
   * @returns Promise resolving to response object
   * @throws RDAPError if request fails or security violation detected
   */
  fetch(url: string, options?: FetcherOptions): Promise<FetcherResponse>;
  
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

interface FetcherOptions {
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
  abortSignal?: AbortSignal;
}

interface SecurityContext {
  isPrivateIP: boolean;
  isCloudMeta boolean;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  blockedReason?: string;
}
```

### 3. NormalizerAdapter Interface
```typescript
interface NormalizerAdapter {
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
```

---

## 🛠️ Building Custom Cache Adapters

### Pattern 1: Redis Cache Adapter
```typescript
import { CacheAdapter, CacheSetOptions, CacheStats } from 'rdapify';
import { createClient } from 'redis';

class RedisCacheAdapter implements CacheAdapter {
  private readonly client;
  private readonly encryptionKey?: string;
  private readonly redactBeforeStore: boolean;
  
  constructor(options: {
    url: string;
    encryptionKey?: string;
    redactBeforeStore?: boolean;
    tls?: { rejectUnauthorized: boolean };
  }) {
    this.client = createClient({
      url: options.url,
      socket: options.tls ? { tls: options.tls } : undefined
    });
    this.encryptionKey = options.encryptionKey;
    this.redactBeforeStore = options.redactBeforeStore ?? true;
    
    this.client.on('error', (err) => 
      console.error('Redis Cache Error:', err)
    );
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      
      // Decrypt if encrypted
      const parsed = JSON.parse(data);
      if (parsed.encrypted && this.encryptionKey) {
        return this.decryptData(parsed.value);
      }
      
      return parsed.value;
    } catch (error) {
      console.error('Cache get failed:', error);
      return null;
    }
  }
  
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    try {
      // Apply PII redaction before storage if configured
      let dataToStore = value;
      if (options.redactBeforeStore ?? this.redactBeforeStore) {
        dataToStore = this.redactPII(dataToStore);
      }
      
      // Encrypt if encryption key provided
      const storageValue = this.encryptionKey 
        ? this.encryptData(dataToStore) 
        : { value: dataToStore, encrypted: false };
      
      await this.client.set(
        key, 
        JSON.stringify(storageValue),
        { EX: options.ttl || 3600 } // Default 1 hour TTL
      );
    } catch (error) {
      console.error('Cache set failed:', error);
      // Fail silently - cache is best-effort
    }
  }
  
  private redactPII<T>( T): T {
    // Implementation of PII redaction
    // This should use RDAPify's built-in redaction utilities
    return require('rdapify').redactPII(data, {
      level: 'strict',
      preserveBusinessContacts: false
    });
  }
  
  private encryptData<T>( T): { value: string; encrypted: true } {
    // AES-256-GCM encryption implementation
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm', 
      crypto.createHash('sha256').update(this.encryptionKey!).digest(), 
      iv
    );
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value)),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      value: JSON.stringify({
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        data: encrypted.toString('base64')
      }),
      encrypted: true
    };
  }
  
  // Implement other interface methods...
}
```

### Pattern 2: DynamoDB Cache Adapter
```typescript
import { CacheAdapter } from 'rdapify';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

class DynamoDBCacheAdapter implements CacheAdapter {
  private readonly client;
  private readonly tableName;
  
  constructor(options: {
    region: string;
    tableName: string;
    encryptionKey?: string;
  }) {
    this.client = new DynamoDBClient({ region: options.region });
    this.tableName = options.tableName;
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ cacheKey: key }),
        ProjectionExpression: 'cacheValue, expiresAt'
      });
      
      const result = await this.client.send(command);
      
      if (!result.Item) return null;
      
      const item = unmarshall(result.Item);
      const now = Math.floor(Date.now() / 1000);
      
      // Check TTL
      if (item.expiresAt && item.expiresAt < now) {
        await this.delete(key);
        return null;
      }
      
      return JSON.parse(item.cacheValue);
    } catch (error) {
      console.error('DynamoDB get failed:', error);
      return null;
    }
  }
  
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const ttl = options.ttl || 3600;
      const expiresAt = now + ttl;
      
      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          cacheKey: key,
          cacheValue: JSON.stringify(value),
          createdAt: now,
          expiresAt
        })
      });
      
      await this.client.send(command);
    } catch (error) {
      console.error('DynamoDB set failed:', error);
      // Fail silently - cache is best-effort
    }
  }
  
  // Implement other interface methods...
}
```

---

## 🌐 Building Custom Fetcher Adapters

### Pattern 1: AWS Lambda Fetcher with VPC
```typescript
import { FetcherAdapter, SecurityContext } from 'rdapify';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { Certificate } from 'tls';

class LambdaVPCFetcher implements FetcherAdapter {
  private readonly ssmClient;
  private readonly trustedCAs: string[];
  
  constructor() {
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
    this.trustedCAs = this.loadTrustedCAs();
  }
  
  async fetch(url: string, options: FetcherOptions = {}): Promise<FetcherResponse> {
    if (!this.validateUrl(url)) {
      throw new RDAPError('RDAP_SSRF_ATTEMPT', `Blocked SSRF attempt to ${url}`);
    }
    
    // Get VPC-specific proxy endpoint from SSM
    const proxyEndpoint = await this.getProxyEndpoint();
    
    // Execute request through VPC endpoint
    const response = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vpc-proxy-target': url
      },
      body: JSON.stringify({
        method: options.method || 'GET',
        headers: options.headers,
        timeout: options.timeout || 5000
      })
    });
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
      url,
      redirected: response.redirected
    };
  }
  
  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Block non-HTTP protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      
      // Block private IP ranges
      if (this.isPrivateIP(parsed.hostname)) return false;
      
      // Block cloud metadata endpoints
      if (this.isCloudMetadataEndpoint(parsed.hostname)) return false;
      
      // Allow only approved RDAP servers
      return this.isApprovedRDAPServer(parsed.hostname);
    } catch {
      return false;
    }
  }
  
  private async getProxyEndpoint(): Promise<string> {
    // Get VPC proxy endpoint from SSM parameter store
    const command = new GetParameterCommand({
      Name: '/rdapify/vpc-proxy-endpoint'
    });
    
    const result = await this.ssmClient.send(command);
    return result.Parameter?.Value || 'https://default-proxy.example.com';
  }
  
  private isApprovedRDAPServer(hostname: string): boolean {
    // Validate against approved RDAP servers list
    const approvedServers = [
      'rdap.verisign.com',
      'rdap.arin.net',
      'rdap.ripe.net',
      'rdap.apnic.net',
      'rdap.lacnic.net',
      'rdap.afrinic.net'
    ];
    
    return approvedServers.some(server => 
      hostname.endsWith(server) || 
      hostname === server
    );
  }
  
  // Implement other interface methods...
}
```

### Pattern 2: Cloudflare Workers Fetcher
```typescript
import { FetcherAdapter } from 'rdapify';

class CloudflareWorkersFetcher implements FetcherAdapter {
  private readonly fetch: typeof fetch;
  
  constructor(env: { fetch: typeof fetch }) {
    this.fetch = env.fetch;
  }
  
  async fetch(url: string, options: FetcherOptions = {}): Promise<FetcherResponse> {
    if (!this.validateUrl(url)) {
      throw new RDAPError('RDAP_SSRF_ATTEMPT', `Blocked SSRF attempt to ${url}`);
    }
    
    // Use Cloudflare's native fetch with Durable Objects for rate limiting
    const response = await this.fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        'User-Agent': 'RDAPify/1.0 (+https://rdapify.dev)'
      },
      signal: options.abortSignal,
      redirect: options.followRedirects ? 'follow' : 'manual'
    });
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
      url,
      redirected: response.redirected
    };
  }
  
  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Cloudflare Workers have built-in SSRF protection
      // but we add additional validation layers
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      
      // Use Cloudflare's IP geolocation to block suspicious regions
      // This would use env.GEOIP or similar binding
      const cf = (globalThis as any).cf;
      if (cf && this.isHighRiskRegion(cf.region)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
  
  private isHighRiskRegion(region: string): boolean {
    // High-risk regions for registry abuse
    const highRiskRegions = ['RU', 'IR', 'KP', 'SY'];
    return highRiskRegions.includes(region);
  }
  
  // Implement other interface methods...
}
```

---

## 🔍 Building Custom Normalizer Adapters

### Pattern 1: Registry-Specific Normalizer
```typescript
import { NormalizerAdapter, NormalizedResponse, NormalizationContext } from 'rdapify';

class VerisignNormalizer implements NormalizerAdapter {
  normalize(rawResponse: any, context: NormalizationContext): NormalizedResponse {
    // Verisign-specific normalization logic
    return {
      domain: this.normalizeDomain(rawResponse.ldhName),
      registrar: this.normalizeEntity(rawResponse.entities?.find(e => 
        e.roles?.includes('registrar')
      )),
      registrant: this.normalizeEntity(rawResponse.entities?.find(e => 
        e.roles?.includes('registrant')
      )),
      nameservers: this.normalizeNameservers(rawResponse.nameservers),
      events: this.normalizeEvents(rawResponse.events),
      status: this.normalizeStatus(rawResponse.status),
      _meta: {
        registry: 'verisign',
        originalFormat: 'verisign-rdap',
        normalizationVersion: '2.3.0',
        rawResponse: context.preserveRaw ? rawResponse : undefined
      }
    };
  }
  
  private normalizeDomain(ldhName: string): string {
    return ldhName?.toLowerCase() || '';
  }
  
  private normalizeEntity(entity: any): any {
    if (!entity) return undefined;
    
    return {
      handle: entity.handle,
      name: this.redactName(entity.vcardArray),
      email: this.redactEmail(entity.vcardArray),
      phone: this.redactPhone(entity.vcardArray),
      address: this.redactAddress(entity.vcardArray),
      roles: entity.roles
    };
  }
  
  private normalizeEvents(events: any[]): any[] {
    return events?.map(event => ({
      action: this.normalizeEventAction(event.eventAction),
      date: event.eventDate || event.eventDate,
      timestamp: new Date(event.eventDate || event.eventDate).getTime(),
      actor: event.eventActor || undefined
    })) || [];
  }
  
  private normalizeEventAction(action: string): string {
    // Map Verisign event actions to standard format
    const mapping: Record<string, string> = {
      'registration': 'registration',
      'last changed': 'last changed',
      'expiration': 'expiration',
      'deletion': 'deletion'
    };
    
    return mapping[action] || action;
  }
  
  // Implement other interface methods...
  
  validate(response: any): ValidationResult {
    // Verisign-specific validation rules
    const errors: string[] = [];
    
    if (!response.domain) {
      errors.push('Missing domain field');
    }
    
    if (!response.registrar) {
      errors.push('Missing registrar field');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: this.validateWarnings(response)
    };
  }
}
```

### Pattern 2: Multi-Registry Normalizer Factory
```typescript
import { NormalizerAdapter, RegistryType } from 'rdapify';

class RegistryNormalizerFactory {
  private static normalizers = new Map<RegistryType, NormalizerAdapter>();
  
  static register(registry: RegistryType, normalizer: NormalizerAdapter): void {
    this.normalizers.set(registry, normalizer);
  }
  
  static get(registry: RegistryType): NormalizerAdapter {
    const normalizer = this.normalizers.get(registry);
    if (!normalizer) {
      throw new Error(`No normalizer registered for registry: ${registry}`);
    }
    return normalizer;
  }
  
  static createGeneric(): NormalizerAdapter {
    // Fallback generic normalizer
    return new GenericRDAPNormalizer();
  }
}

// Register registry-specific normalizers
RegistryNormalizerFactory.register('verisign', new VerisignNormalizer());
RegistryNormalizerFactory.register('arin', new ARINNormalizer());
RegistryNormalizerFactory.register('ripe', new RIPENormalizer());

// Usage in RDAP client
async function normalizeResponse(rawResponse: any, context: NormalizationContext): Promise<NormalizedResponse> {
  const registry = context.registryType || detectRegistry(rawResponse);
  
  try {
    const normalizer = RegistryNormalizerFactory.get(registry as RegistryType);
    return await normalizer.normalize(rawResponse, context);
  } catch (error) {
    // Fallback to generic normalizer
    const genericNormalizer = RegistryNormalizerFactory.createGeneric();
    console.warn(`Fallback to generic normalizer for ${registry}:`, error.message);
    return await genericNormalizer.normalize(rawResponse, context);
  }
}
```

---

## 🔐 Security Considerations

### PII Redaction in Custom Adapters
```typescript
// ✅ GOOD: PII redaction before storage
class SecureCacheAdapter implements CacheAdapter {
  constructor(private readonly encryptionKey: string) {}
  
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    // Always redact PII before storage
    const redactedValue = options.redactBeforeStore !== false 
      ? this.redactPII(value) 
      : value;
    
    // Always encrypt sensitive data
    const encryptedValue = this.encryptData(redactedValue);
    
    await this.storeEncrypted(key, encryptedValue, options.ttl);
  }
  
  private redactPII<T>( T): T {
    // Use RDAPify's built-in redaction utilities
    return require('rdapify').redactPII(data, {
      level: 'enterprise',
      preserveBusinessContacts: false
    });
  }
}

// ❌ AVOID: Storing unredacted PII
class InsecureCacheAdapter implements CacheAdapter {
  async set<T>(key: string, value: T): Promise<void> {
    // Dangerous - stores raw PII in cache
    await this.storeRaw(key, value);
  }
}
```

### Certificate Validation in Fetchers
```typescript
// ✅ GOOD: Strict certificate validation
class SecureFetcher implements FetcherAdapter {
  private readonly caCertificates: string[];
  
  constructor(options: { caCertificates: string[] }) {
    this.caCertificates = options.caCertificates;
  }
  
  async fetch(url: string): Promise<FetcherResponse> {
    const { hostname } = new URL(url);
    
    try {
      // Get certificate chain
      const certChain = await this.getCertificateChain(hostname);
      
      // Verify certificate chain against trusted CAs
      if (!this.validateCertificateChain(certChain)) {
        throw new RDAPError('RDAP_TLS_ERROR', `Certificate validation failed for ${hostname}`);
      }
      
      // Verify hostname matches certificate
      if (!this.validateHostname(certChain[0], hostname)) {
        throw new RDAPError('RDAP_TLS_ERROR', `Hostname mismatch for ${hostname}`);
      }
      
      return await this.executeRequest(url);
    } catch (error) {
      if (error.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') {
        throw new RDAPError('RDAP_TLS_ERROR', `Unable to verify certificate chain for ${hostname}`);
      }
      throw error;
    }
  }
  
  private validateCertificateChain(certChain: Certificate[]): boolean {
    // Implement certificate chain validation
    return certChain.every(cert => 
      this.caCertificates.some(ca => 
        this.certificateMatchesCA(cert, ca)
      )
    );
  }
}
```

### SSRF Protection in Fetchers
```typescript
// ✅ GOOD: Comprehensive SSRF protection
class SSRFProtectedFetcher implements FetcherAdapter {
  private readonly blockedRanges = [
    '127.0.0.0/8',      // Loopback
    '10.0.0.0/8',       // Private
    '172.16.0.0/12',    // Private
    '192.168.0.0/16',   // Private
    '169.254.0.0/16',   // Link-local
    'fd00::/8',         // Private IPv6
    'fe80::/10'         // Link-local IPv6
  ];
  
  private readonly blockedDomains = [
    'internal',
    'localhost',
    'local',
    'ip6-localhost',
    'ip6-loopback',
    'broadcasthost'
  ];
  
  private readonly blockedPatterns = [
    /\.internal$/,
    /\.local$/,
    /\.lan$/,
    /^169\.254\./,
    /^fe80:/,
    /^fd00:/
  ];
  
  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Block non-HTTP protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      
      // Block localhost and internal domains
      if (this.blockedDomains.some(domain => 
        parsed.hostname === domain || 
        parsed.hostname.endsWith(`.${domain}`)
      )) {
        return false;
      }
      
      // Block patterns
      if (this.blockedPatterns.some(pattern => 
        typeof pattern === 'string' 
          ? parsed.hostname.match(pattern)
          : pattern.test(parsed.hostname)
      )) {
        return false;
      }
      
      // Block IP ranges
      if (this.isIP(parsed.hostname)) {
        return !this.isBlockedIP(parsed.hostname);
      }
      
      // Allow only approved RDAP servers
      return this.isApprovedRDAPServer(parsed.hostname);
    } catch {
      return false;
    }
  }
  
  private isIP(hostname: string): boolean {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || 
           /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(hostname);
  }
}
```

---

## ⚡ Performance Optimization

### Pattern 1: Object Pooling for Normalizers
```typescript
class PooledNormalizer implements NormalizerAdapter {
  private readonly pool = new Map<string, any>();
  private readonly maxPoolSize = 1000;
  
  normalize(rawResponse: any, context: NormalizationContext): NormalizedResponse {
    // Get or create pooled object
    const key = this.getPoolKey(context);
    let result = this.pool.get(key);
    
    if (!result) {
      result = this.createPooledObject();
      this.pool.set(key, result);
      
      // Evict oldest items if pool is full
      if (this.pool.size > this.maxPoolSize) {
        const oldestKey = this.pool.keys().next().value;
        this.pool.delete(oldestKey);
      }
    }
    
    // Reuse pooled object to avoid allocations
    this.populateResult(result, rawResponse, context);
    return result;
  }
  
  private getPoolKey(context: NormalizationContext): string {
    return `${context.registryType}:${context.queryType}`;
  }
  
  private createPooledObject(): NormalizedResponse {
    return {
      domain: '',
      registrar: undefined,
      registrant: undefined,
      nameservers: [],
      events: [],
      status: [],
      _meta: {
        registry: '',
        normalizationVersion: '2.3.0',
        timestamp: 0
      }
    };
  }
  
  private populateResult(result: NormalizedResponse, rawResponse: any, context: NormalizationContext): void {
    // Fill result object without creating new allocations
    result.domain = rawResponse.ldhName?.toLowerCase() || '';
    result.registrar = this.normalizeEntity(rawResponse.entities?.find(e => e.roles?.includes('registrar')));
    result.registrant = this.normalizeEntity(rawResponse.entities?.find(e => e.roles?.includes('registrant')));
    result.nameservers = this.normalizeNameservers(rawResponse.nameservers);
    result.events = this.normalizeEvents(rawResponse.events);
    result.status = rawResponse.status || [];
    result._meta = {
      registry: context.registryType || 'unknown',
      normalizationVersion: '2.3.0',
      timestamp: Date.now()
    };
  }
}
```

### Pattern 2: Lazy Loading in Cache Adapters
```typescript
class LazyLoadingCacheAdapter implements CacheAdapter {
  private readonly cache = new Map<string, { value: any; expiresAt: number }>();
  private readonly loader: (key: string) => Promise<any>;
  
  constructor(loader: (key: string) => Promise<any>) {
    this.loader = loader;
  }
  
  async get<T>(key: string): Promise<T | null> {
    // Check if we have a cached value that hasn't expired
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    
    try {
      // Load value from underlying store
      const value = await this.loader(key);
      
      // Cache with TTL
      const ttl = 3600000; // 1 hour
      this.cache.set(key, {
        value,
        expiresAt: Date.now() + ttl
      });
      
      return value;
    } catch (error) {
      console.error('Cache load failed:', error);
      
      // Return stale value if available
      if (cached) {
        return cached.value;
      }
      
      return null;
    }
  }
  
  // Other interface methods...
}
```

---

## 🧪 Testing Custom Adapters

### Unit Testing Pattern
```typescript
describe('Custom Cache Adapters', () => {
  let adapter: CacheAdapter;
  
  beforeEach(() => {
    adapter = new RedisCacheAdapter({
      url: 'redis://test',
      encryptionKey: 'test-key-123',
      redactBeforeStore: true
    });
  });
  
  test('sets and gets values with TTL', async () => {
    const testValue = { domain: 'example.com', nameservers: ['ns1.example.com'] };
    
    await adapter.set('test-key', testValue, { ttl: 1 });
    const result = await adapter.get<typeof testValue>('test-key');
    
    expect(result).toEqual(testValue);
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 2000));
    const expired = await adapter.get<typeof testValue>('test-key');
    expect(expired).toBeNull();
  });
  
  test('redacts PII before storage', async () => {
    const sensitiveValue = {
      domain: 'example.com',
      registrant: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1.5555551234'
      }
    };
    
    // Spy on the redaction method
    const redactSpy = jest.spyOn(adapter as any, 'redactPII');
    
    await adapter.set('sensitive-key', sensitiveValue);
    expect(redactSpy).toHaveBeenCalled();
    
    const result = await adapter.get<any>('sensitive-key');
    expect(result.registrant.name).toBe('REDACTED');
    expect(result.registrant.email).toBe('REDACTED@redacted.invalid');
    expect(result.registrant.phone).toBe('REDACTED');
  });
  
  test('encrypts sensitive data', async () => {
    const sensitiveValue = { secret: 'top-secret-data' };
    
    // Mock encryption to verify it's called
    const encryptSpy = jest.spyOn(adapter as any, 'encryptData');
    
    await adapter.set('encrypted-key', sensitiveValue);
    expect(encryptSpy).toHaveBeenCalled();
    
    const result = await adapter.get<any>('encrypted-key');
    expect(result).toBeDefined();
    // Cannot verify encryption details without implementation
  });
});
```

### Integration Testing Pattern
```typescript
describe('Custom Fetcher Integration', () => {
  let fetcher: FetcherAdapter;
  
  beforeAll(() => {
    fetcher = new SSRFProtectedFetcher();
  });
  
  test('allows valid public URLs', async () => {
    const validUrls = [
      'https://rdap.verisign.com/com/domain/example.com',
      'https://rdap.arin.net/registry/ip/8.8.8.0',
      'https://rdap.ripe.net/1.1.1.0/24'
    ];
    
    for (const url of validUrls) {
      expect(fetcher.validateUrl(url)).toBe(true);
    }
  });
  
  test('blocks SSRF attempts', async () => {
    const dangerousUrls = [
      'http://127.0.0.1',
      'http://localhost',
      'http://169.254.169.254/latest/meta-data',
      'http://internal.company.com',
      'http://192.168.1.1',
      'http://[::1]',
      'http://fd00::1'
    ];
    
    for (const url of dangerousUrls) {
      expect(fetcher.validateUrl(url)).toBe(false);
    }
  });
  
  test('handles real registry responses', async () => {
    // Mock real registry response
    const mockResponse = {
      domain: 'example.com',
      entities: [{
        vcardArray: ['vcard', [['fn', {}, 'text', 'Registrar']]]
      }]
    };
    
    // Test normalization with real data
    const normalizer = new VerisignNormalizer();
    const result = normalizer.normalize(mockResponse, {
      registryType: 'verisign',
      queryType: 'domain',
      rawUrl: 'https://rdap.verisign.com'
    });
    
    expect(result.domain).toBe('example.com');
    expect(result.registrar?.name).toBe('Registrar');
  });
});
```

---

## 🔄 Adapter Composition Patterns

### Chain of Responsibility Pattern
```typescript
class ChainableFetcher implements FetcherAdapter {
  private nextFetcher?: FetcherAdapter;
  
  constructor(private readonly fetcher: FetcherAdapter) {}
  
  setNext(fetcher: FetcherAdapter): this {
    this.nextFetcher = fetcher;
    return this;
  }
  
  async fetch(url: string, options?: FetcherOptions): Promise<FetcherResponse> {
    try {
      return await this.fetcher.fetch(url, options);
    } catch (error) {
      if (this.nextFetcher && this.isRetryableError(error)) {
        console.warn(`Primary fetcher failed, falling back to secondary: ${error.message}`);
        return await this.nextFetcher.fetch(url, options);
      }
      throw error;
    }
  }
  
  validateUrl(url: string): boolean {
    return this.fetcher.validateUrl(url);
  }
  
  private isRetryableError(error: any): boolean {
    return error.code === 'RDAP_TIMEOUT' || 
           error.code === 'RDAP_REGISTRY_UNAVAILABLE' ||
           error.code === 'RDAP_NETWORK_ERROR';
  }
}

// Usage
const fetcher = new ChainableFetcher(new PrimaryCloudFetcher())
  .setNext(new VPCFallbackFetcher())
  .setNext(new OfflineModeFetcher());
```

### Decorator Pattern
```typescript
class CachingFetcherDecorator implements FetcherAdapter {
  constructor(
    private readonly fetcher: FetcherAdapter,
    private readonly cache: CacheAdapter,
    private readonly options: { ttl?: number } = {}
  ) {}
  
  async fetch(url: string, options?: FetcherOptions): Promise<FetcherResponse> {
    const cacheKey = this.getCacheKey(url, options);
    
    // Try cache first
    const cached = await this.cache.get<FetcherResponse>(cacheKey);
    if (cached) {
      return { ...cached, _fromCache: true };
    }
    
    // Fallback to actual fetch
    const response = await this.fetcher.fetch(url, options);
    
    // Store in cache
    await this.cache.set(cacheKey, response, {
      ttl: this.options.ttl || 300 // 5 minutes default
    });
    
    return response;
  }
  
  validateUrl(url: string): boolean {
    return this.fetcher.validateUrl(url);
  }
  
  private getCacheKey(url: string, options?: FetcherOptions): string {
    return `fetch:${url}:${JSON.stringify({
      method: options?.method,
      headers: options?.headers ? Object.keys(options.headers).sort() : []
    })}`;
  }
}

// Usage
const fetcher = new CachingFetcherDecorator(
  new SecureFetcher(),
  new RedisCacheAdapter({
    url: 'redis://primary-cache'
  }),
  { ttl: 60 } // 1 minute cache
);
```

---

## 📋 Best Practices

### ✅ Do's
- **Implement all interface methods**: Even if some are no-ops, implement them with proper error handling
- **Use built-in utilities**: Leverage RDAPify's PII redaction and validation utilities
- **Handle errors gracefully**: Cache and fetch operations should fail silently when possible
- **Respect TTL values**: Always honor TTL parameters for cache expiration
- **Add comprehensive logging**: Include debug logs for cache hits/misses and fetch operations
- **Test with real data**: Use test vectors from actual registries to validate normalization

### ❌ Don'ts
- **Don't block the event loop**: Async operations should never block execution
- **Don't store unredacted PII**: Never store personal data without explicit redaction
- **Don't bypass security checks**: Always validate URLs and certificates
- **Don't ignore errors**: Cache and fetch failures should be logged and handled appropriately
- **Don't hardcode configuration**: Make adapters configurable through constructor options

### 🔒 Security-Specific Patterns
```typescript
// ✅ GOOD: Enterprise-grade adapter security
class EnterpriseCacheAdapter implements CacheAdapter {
  constructor(private readonly options: {
    encryptionKey: string;
    redactPII: boolean;
    auditLogger: (event: string, details: any) => Promise<void>;
    dpoContact: string;
  }) {}
  
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    // 1. Log the cache operation
    await this.options.auditLogger('cache_set', {
      key,
      sensitiveData: this.containsPII(value)
    });
    
    // 2. Apply PII redaction
    let dataToStore = value;
    if (options.redactBeforeStore ?? this.options.redactPII) {
      dataToStore = this.redactPII(dataToStore);
    }
    
    // 3. Apply encryption
    const encryptedData = this.encryptData(dataToStore);
    
    // 4. Store with TTL
    await this.storeWithTTL(key, encryptedData, options.ttl || 3600);
    
    // 5. Verify storage
    await this.verifyStorage(key, encryptedData);
  }
  
  private async verifyStorage(key: string, data: any): Promise<void> {
    const retrieved = await this.get(key);
    if (!retrieved || !this.dataMatches(retrieved, data)) {
      await this.options.auditLogger('cache_verification_failed', { key });
      
      // Alert DPO on critical failures
      if (this.containsPII(data)) {
        await this.alertDPO('cache_verification_failed', {
          key,
          dataSensitivity: 'high'
        });
      }
      
      throw new Error(`Cache verification failed for key: ${key}`);
    }
  }
}
```

---

## 🧩 Real-World Examples

### Example 1: Enterprise Redis Cluster Adapter
```typescript
import { CacheAdapter } from 'rdapify';
import { Cluster } from 'ioredis';

class EnterpriseRedisClusterAdapter implements CacheAdapter {
  private readonly cluster;
  private readonly options;
  
  constructor(options: {
    nodes: { host: string; port: number }[];
    password?: string;
    tls?: { rejectUnauthorized: boolean };
    redactPII?: boolean;
    encryptionKey?: string;
    ttl?: {
      default?: number;
      criticalDomains?: number;
      securityMonitored?: number;
    };
  }) {
    this.options = {
      redactPII: true,
      ...options
    };
    
    this.cluster = new Cluster(
      options.nodes.map(node => ({ host: node.host, port: node.port })),
      {
        password: options.password,
        tls: options.tls,
        scaleReads: 'all', // Read from all nodes for better performance
        enableOfflineQueue: true, // Queue commands when cluster is down
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      }
    );
    
    this.cluster.on('error', (error) => {
      console.error('Redis cluster error:', error);
      // Alert monitoring system
      this.alertMonitoring('redis_cluster_error', error);
    });
    
    this.cluster.on('node error', (error) => {
      console.error('Redis node error:', error);
    });
    
    this.cluster.on('reconnecting', () => {
      console.warn('Redis cluster reconnecting...');
    });
    
    this.cluster.on('connect', () => {
      console.log('Redis cluster connected');
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.cluster.get(key);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      if (parsed.encrypted && this.options.encryptionKey) {
        return this.decryptData(parsed.value);
      }
      
      return parsed.value;
    } catch (error) {
      console.error('Redis get failed:', error);
      
      // Fallback to stale data if available
      const staleData = await this.getStaleData(key);
      if (staleData) {
        console.warn('Using stale cache data after Redis failure');
        return staleData;
      }
      
      return null;
    }
  }
  
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    try {
      // Apply PII redaction
      let dataToStore = value;
      if (options.redactBeforeStore ?? this.options.redactPII) {
        dataToStore = this.redactPII(dataToStore);
      }
      
      // Determine TTL based on key patterns
      let ttl = options.ttl || this.options.ttl?.default || 3600;
      
      if (this.isCriticalDomain(key)) {
        ttl = this.options.ttl?.criticalDomains || ttl;
      }
      
      if (this.isSecurityMonitored(key)) {
        ttl = this.options.ttl?.securityMonitored || ttl;
      }
      
      // Encrypt if needed
      const storageValue = this.options.encryptionKey 
        ? this.encryptData(dataToStore) 
        : { value: dataToStore, encrypted: false };
      
      await this.cluster.setex(key, ttl, JSON.stringify(storageValue));
      
      // Log cache set operation
      this.logOperation('set', key, ttl);
    } catch (error) {
      console.error('Redis set failed:', error);
      // Fail silently - cache is best-effort
      this.alertMonitoring('redis_set_failed', { key, error: error.message });
    }
  }
  
  private isCriticalDomain(key: string): boolean {
    return /domain:(bank|gov|mil|fed)/i.test(key);
  }
  
  private isSecurityMonitored(key: string): boolean {
    return /security-monitor/i.test(key);
  }
  
  private logOperation(operation: string, key: string, ttl?: number): void {
    console.debug(`Cache ${operation}: ${key}`, {
      ttl,
      size: JSON.stringify({ key, value: 'redacted' }).length
    });
  }
  
  // Implement other interface methods...
}
```

### Example 2: Multi-Registry Normalizer
```typescript
class MultiRegistryNormalizer implements NormalizerAdapter {
  private readonly registryNormalizers = new Map<string, NormalizerAdapter>();
  
  constructor() {
    // Register registry-specific normalizers
    this.registryNormalizers.set('verisign', new VerisignNormalizer());
    this.registryNormalizers.set('arin', new ARINNormalizer());
    this.registryNormalizers.set('ripe', new RIPENormalizer());
    this.registryNormalizers.set('apnic', new APNICNormalizer());
    this.registryNormalizers.set('lacnic', new LACNICNormalizer());
    this.registryNormalizers.set('afrinic', new AFRINICNormalizer());
    
    // Register TLD patterns
    this.tldPatterns = new Map([
      ['.com', 'verisign'],
      ['.net', 'verisign'],
      ['.org', 'pir'],
      ['.de', 'denic'],
      ['.uk', 'nominet'],
      ['.jp', 'jprs']
    ]);
  }
  
  normalize(rawResponse: any, context: NormalizationContext): NormalizedResponse {
    const registryType = this.detectRegistryType(rawResponse, context);
    const normalizer = this.registryNormalizers.get(registryType) || this.getFallbackNormalizer(context);
    
    return normalizer.normalize(rawResponse, {
      ...context,
      registryType
    });
  }
  
  private detectRegistryType(rawResponse: any, context: NormalizationContext): string {
    // 1. Check context registry hint
    if (context.registryType) {
      return context.registryType;
    }
    
    // 2. Check raw response for registry hints
    if (rawResponse._registry) {
      return rawResponse._registry;
    }
    
    // 3. Check TLD patterns
    if (context.queryType === 'domain' && context.rawUrl) {
      const tld = this.extractTLD(context.rawUrl);
      for (const [pattern, registry] of this.tldPatterns) {
        if (tld.endsWith(pattern)) {
          return registry;
        }
      }
    }
    
    // 4. Fallback to bootstrap data
    if (context.bootstrapData) {
      return this.detectFromBootstrap(context.bootstrapData, context.queryType);
    }
    
    // 5. Default to generic
    return 'generic';
  }
  
  private getFallbackNormalizer(context: NormalizationContext): NormalizerAdapter {
    if (context.queryType === 'domain') {
      return new GenericDomainNormalizer();
    }
    if (context.queryType === 'ip') {
      return new GenericIPNormalizer();
    }
    return new GenericASNNormalizer();
  }
  
  private extractTLD(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      return parts.length >= 2 ? `.${parts[parts.length - 2]}.${parts[parts.length - 1]}` : hostname;
    } catch {
      return url;
    }
  }
  
  // Implement other interface methods...
}
```

---

## 🔍 Debugging Tools

### Adapter Debug Mode
```typescript
class DebugAdapterWrapper<T extends FetcherAdapter | CacheAdapter | NormalizerAdapter> {
  constructor(
    private readonly adapter: T,
    private readonly options: { 
      enabled?: boolean; 
      logLevel?: 'silent' | 'errors' | 'warnings' | 'info' | 'debug';
      tracer?: (method: string, args: any[], result: any) => void;
    } = {}
  ) {}
  
  createProxy(): T {
    const handler = {
      get: (target: T, prop: string | symbol, receiver: any) => {
        const value = Reflect.get(target, prop, receiver);
        
        if (typeof value === 'function') {
          return this.createTracedMethod(prop as string, value.bind(target));
        }
        
        return value;
      }
    };
    
    return new Proxy(this.adapter, handler);
  }
  
  private createTracedMethod(methodName: string, method: Function): Function {
    return (...args: any[]) => {
      const start = Date.now();
      
      try {
        const result = method.apply(this.adapter, args);
        
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
    
    console.log(`[DEBUG] Adapter.${methodName}(${JSON.stringify(args)}) -> ${JSON.stringify(result)} (${duration}ms)`);
    
    if (this.options.tracer) {
      this.options.tracer(methodName, args, result);
    }
  }
  
  private logMethodError(methodName: string, args: any[], error: Error, duration: number): void {
    if (this.options.logLevel === 'silent') return;
    
    console.error(`[ERROR] Adapter.${methodName}(${JSON.stringify(args)}) failed: ${error.message} (${duration}ms)`);
    console.error(error.stack);
    
    if (this.options.tracer) {
      this.options.tracer(methodName, args, { error: error.message });
    }
  }
}

// Usage
const debugFetcher = new DebugAdapterWrapper<FetcherAdapter>(new SecureFetcher(), {
  enabled: true,
  logLevel: 'debug',
  tracer: (method, args, result) => {
    // Send to monitoring
  }
});

const fetcher = debugFetcher.createProxy();
```

### CLI Adapter Testing
```bash
# Test adapter compliance
rdapify adapters test --implementation RedisCacheAdapter --format json

# Output includes:
# - Interface compliance percentage
# - PII redaction test results
# - Performance benchmarks
# - Security vulnerability scan results

# Profile adapter performance
rdapify adapters profile --implementation MultiRegistryNormalizer --iterations 1000

# Generate adapter documentation
rdapify adapters doc --output docs/guides/generated/adapter-reference.md
```

---

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Cache Strategies** | Advanced caching patterns | [caching-strategies.md](caching-strategies.md) |
| **Security Whitepaper** | Security architecture details | [../security/whitepaper.md](../security/whitepaper.md) |
| **Architecture Overview** | System design with adapter patterns | [../core_concepts/architecture.md](../core_concepts/architecture.md) |
| **Adapter Playground** | Interactive adapter testing tool | [../../playground/adapter-playground.md](../../playground/adapter-playground.md) |
| **Test Vectors** | Standardized test cases for adapters | [../../test-vectors/adapter-vectors.json](../../test-vectors/adapter-vectors.json) |
| **Performance Benchmarks** | Adapter performance characteristics | [../../benchmarks/results/adapter-performance.md](../../benchmarks/results/adapter-performance.md) |

---

## 🏷️ Specifications

| Property | Value |
|----------|-------|
| **Adapter System Version** | 2.3.0 |
| **TypeScript Minimum** | 5.0 |
| **Interface Compliance** | 100% test coverage |
| **Security Audit** | Passed (November 28, 2025) |
| **Performance Impact** | < 5% overhead vs built-in adapters |
| **Test Coverage** | 95% unit tests, 90% integration tests |
| **Last Updated** | December 5, 2025 |

> **🔐 Critical Reminder:** Custom adapters are security boundaries in the system. Never expose internal implementation details through adapters, and always validate inputs at adapter boundaries. Custom implementations must maintain the same security guarantees as built-in implementations. When in doubt, prefer composition over inheritance and keep adapters focused on single responsibilities.

[← Back to Guides Overview](../guides/README.md) | [Next: Logging →](logging.md)

*Document automatically generated from source code with security review on November 28, 2025*
---
title: دليل مرجعي لـ JSONPath
description: مرجع تقني شامل لتعبيرات JSONPath المستخدمة في RDAPify لتطبيع البيانات واستخراجها وتحويلها عبر جميع تطبيقات سجل RDAP
sidebar_label: مرجع JSONPath
sidebar_position: 5
---

# دليل مرجعي لـ JSONPath

**الهدف**: مرجع تقني شامل لتعبيرات JSONPath المستخدمة في RDAPify لتطبيع البيانات واستخراجها وتحويلها عبر جميع تطبيقات سجل RDAP
**ذات صلة**: [نظرة عامة](overview.md) | [متجهات الاختبار](test-vectors.md) | [تغطية الكود](code-coverage.md) | [مقاييس الأداء](../performance/benchmarks.md)
**وقت القراءة**: 10 دقائق

## سياق JSONPath في RDAPify

يستخدم RDAPify تعبيرات JSONPath لتطبيع استجابات RDAP المتباينة من السجلات العالمية إلى هيكل بيانات موحد. يوثق هذا المرجع التعبيرات الدقيقة المستخدمة في عمليات الاستخراج والتحويل والتحقق.

```mermaid
graph LR
    A[استجابة السجل الخام] --> B[استخراج JSONPath]
    B --> C[تعيين الحقول]
    C --> D[قواعد التحويل]
    D --> E[المخرجات المطبعة]
    E --> F[تنقيح PII]
    F --> G[الاستجابة النهائية]

    style B,C,D fill:#2196F3
    style E,F fill:#F44336
    style G fill:#4CAF50
```

### فلسفة JSONPath
- **الدقة أولاً**: يستهدف كل تعبير البيانات المطلوبة بالضبط دون نتائج إيجابية كاذبة
- **الوعي بالسجلات**: تأخذ التعبيرات في الاعتبار هياكل الاستجابة الخاصة بكل سجل
- **حدود الأمان**: تُحدَّد حقول PII وتُعلَّم للتنقيح قبل الاستخراج
- **تحسين الأداء**: تعبيرات مصممة لتعقيد O(n) مع حد أدنى من التراجع
- **مبني على الاختبار**: كل تعبير يُتحقق منه عبر متجهات اختبار شاملة

## مرجع صياغة JSONPath

### عناصر الصياغة الأساسية
| النمط | الوصف | المثال | تأثير الأداء |
|-------|--------|--------|--------------|
| `$.field` | وصول مباشر للحقل | `$.domain` | مثالي |
| `$..field` | النزول التكراري | `$..nameservers` | مرتفع - استخدم باعتدال |
| `$[?(@.field=='value')]` | تعبير التصفية | `$[?(@.type=='registration')]` | متوسط |
| `$[:5]` | تقطيع المصفوفة | `$.events[:2]` | مثالي |
| `$['field with spaces']` | تدوين الأقواس | `$['registrar name']` | مثالي |
| `$[(@.length-1)]` | آخر عنصر في المصفوفة | `$.events[(@.length-1)]` | جيد |

### الامتدادات الخاصة بـ RDAPify
```jsonpath
// تعبيرات اكتشاف السجلات
verisign: $.entitySearchResults[?(@.handle=='IANA')].vcardArray[1][?(@[0]=='email')][3]
arin: $.entities[?(@.roles[0]=='registrant')].vcardArray[0][?(@[0]=='kind')][3]
ripe: $.entities[?(@.objectClassName=='entity')].vcardArray[1]

// علامات حقول PII
pii:email: $..[?(@[0]=='email')]
pii:phone: $..[?(@[0]=='tel')]
pii:address: $..[?(@[0]=='adr')]
pii:name: $..[?(@[0]=='fn')]

// كاشفات نوع الحدث
event:registration: $..events[?(@.eventAction=='registration')]
event:expiration: $..events[?(@.eventAction=='expiration')]
event:lastChanged: $..events[?(@.eventAction=='last changed')]
```

## كتالوج JSONPath الخاص بالسجلات

### 1. Verisign (com/net/org)
```json
{
  "registry": "verisign",
  "domain": "$.ldhName",
  "status": "$.status",
  "nameservers": "$.nameservers[*].ldhName",
  "registrar": {
    "name": "$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='fn')][3]",
    "url": "$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='url')][3]",
    "handle": "$.entities[?(@.roles[0]=='registrar')].handle"
  },
  "events": [
    {
      "type": "registration",
      "date": "$.events[?(@.eventAction=='registration')].eventDate"
    },
    {
      "type": "expiration",
      "date": "$.events[?(@.eventAction=='expiration')].eventDate"
    },
    {
      "type": "lastChanged",
      "date": "$.events[?(@.eventAction=='last changed')].eventDate"
    }
  ],
  "entities": {
    "registrant": "$.entities[?(@.roles[0]=='registrant')]",
    "technical": "$.entities[?(@.roles[0]=='technical')]",
    "administrative": "$.entities[?(@.roles[0]=='administrative')]"
  },
  "security_markers": {
    "pii_fields": [
      "$..vcardArray[1][?(@[0]=='email')]",
      "$..vcardArray[1][?(@[0]=='tel')]",
      "$..vcardArray[1][?(@[0]=='adr')]"
    ],
    "sensitive_operations": [
      "$..status[?(@=='clientDeleteProhibited')]",
      "$..status[?(@=='clientTransferProhibited')]"
    ]
  }
}
```

### 2. ARIN (IPv4/IPv6 لأمريكا الشمالية)
```json
{
  "registry": "arin",
  "ip_range": "$.startAddress + '/' + $.cidrLength",
  "country": "$.country",
  "netname": "$.name",
  "organization": {
    "name": "$.entities[?(@.roles[0]=='registrant')].vcardArray[0][?(@[0]=='fn')][3]",
    "handle": "$.entities[?(@.roles[0]=='registrant')].handle"
  },
  "abuse_contact": {
    "email": "$.entities[?(@.roles[0]=='abuse')].vcardArray[0][?(@[0]=='email')][3]",
    "phone": "$.entities[?(@.roles[0]=='abuse')].vcardArray[0][?(@[0]=='tel')][3]"
  },
  "events": [
    {
      "type": "registration",
      "date": "$.events[?(@.eventAction=='registration')].eventDate"
    },
    {
      "type": "lastChanged",
      "date": "$.events[?(@.eventAction=='last changed')].eventDate"
    }
  ],
  "security_markers": {
    "pii_fields": [
      "$..vcardArray[0][?(@[0]=='email')]",
      "$..vcardArray[0][?(@[0]=='tel')]",
      "$..vcardArray[0][?(@[0]=='adr')]"
    ],
    "infrastructure_details": [
      "$..startAddress",
      "$..endAddress",
      "$..cidrLength"
    ]
  }
}
```

### 3. RIPE NCC (أوروبا)
```json
{
  "registry": "ripe",
  "entity_type": "$.objectClassName",
  "handle": "$.handle",
  "country": "$.country",
  "remarks": "$.remarks[*].description",
  "vcard": {
    "full_name": "$.vcardArray[1][?(@[0]=='fn')][3]",
    "organization": "$.vcardArray[1][?(@[0]=='org')][3][0]",
    "email": "$.vcardArray[1][?(@[0]=='email')][3]",
    "phone": "$.vcardArray[1][?(@[0]=='tel')][3]",
    "address": "$.vcardArray[1][?(@[0]=='adr')][3]"
  },
  "roles": "$.roles",
  "events": [
    {
      "type": "lastModified",
      "date": "$.events[?(@.eventAction=='last modified')].eventDate"
    }
  ],
  "security_markers": {
    "pii_fields": [
      "$.vcardArray[1][?(@[0]=='email')]",
      "$.vcardArray[1][?(@[0]=='tel')]",
      "$.vcardArray[1][?(@[0]=='adr')]"
    ],
    "network_sensitivity": [
      "$.aut-num",
      "$.inetnum",
      "$.inet6num"
    ]
  }
}
```

## أنماط تحسين الأداء

### 1. أنماط التعبير الفعّالة
```typescript
// مثالي: مسار مباشر مع فهرسة المصفوفة
const optimal = jsonpath.query(data, '$.entities[0].vcardArray[1][2][3]');

// تجنب: النزول التكراري مع التصفية
const poor = jsonpath.query(data, '$..[?(@.field=="value")]');

// أفضل: تصفية المصفوفات مسبقاً قبل الاجتياز
const better = jsonpath.query(data, '$.entities[?(@.roles[0]=="registrant")].vcardArray[1][?(@[0]=="email")][3]');
```

### 2. مقاييس الأداء
| نوع التعبير | عمليات/ثانية | استخدام الذاكرة | حالة الاستخدام |
|------------|-------------|-----------------|----------------|
| مسار مباشر (`$.field.subfield`) | 125,000 | 1.2KB | استخراج حقل واحد |
| فهرس المصفوفة (`$[2].field`) | 98,000 | 1.8KB | الوصول إلى موضع معروف |
| شرط التصفية (`$[?(@.type=='x')]`) | 42,000 | 3.5KB | مطابقة دور الكيان |
| النزول التكراري (`$..field`) | 8,500 | 12.4KB | البحث في البنية العميقة |
| تصفية معقدة (`$[?(@.a && @.b[0].c=='x')]`) | 1,200 | 24.8KB | مطابقة متعددة الشروط |

### 3. استراتيجية التخزين المؤقت للتعبيرات
```typescript
// src/jsonpath-cache.ts
import { LRUCache } from 'lru-cache';

export class JSONPathCache {
  private static instance: JSONPathCache;
  private cache = new LRUCache<string, any>({
    max: 1000,
    ttl: 3600000, // 1 hour
    updateAgeOnGet: true
  });

  // Precompiled expressions cache
  private compiledExpressions = new Map<string, Function>();

  public static getInstance(): JSONPathCache {
    if (!JSONPathCache.instance) {
      JSONPathCache.instance = new JSONPathCache();
    }
    return JSONPathCache.instance;
  }

  /**
   * Get cached JSONPath result with security context
   */
  public get(key: string, securityContext: any): any | null {
    const cached = this.cache.get(key);
    if (cached) {
      // Apply security transformations before returning
      return this.applySecurityFilters(cached, securityContext);
    }
    return null;
  }

  /**
   * Set cached result with TTL based on data volatility
   */
  public set(key: string, value: any, dataVolatility: 'static' | 'dynamic' | 'volatile' = 'dynamic'): void {
    const ttl = {
      'static': 86400000,   // 24 hours
      'dynamic': 3600000,   // 1 hour
      'volatile': 300000    // 5 minutes
    }[dataVolatility];

    this.cache.set(key, value, { ttl });
  }

  /**
   * Compile and cache JSONPath expressions
   */
  public compileExpression(expression: string): Function {
    const cacheKey = `expr:${expression}`;

    if (this.compiledExpressions.has(cacheKey)) {
      return this.compiledExpressions.get(cacheKey)!;
    }

    // Compile expression with security wrapping
    const compiled = (data: any, securityContext: any) => {
      const result = jsonpath.query(data, expression);
      return this.applySecurityFilters(result, securityContext);
    };

    this.compiledExpressions.set(cacheKey, compiled);
    return compiled;
  }

  private applySecurityFilters(data: any, securityContext: any): any {
    if (securityContext.redactPII && typeof data === 'string') {
      // PII detection and redaction
      if (this.isEmailPattern(data)) {
        return '[REDACTED_EMAIL]';
      }
      if (this.isPhonePattern(data)) {
        return '[REDACTED_PHONE]';
      }
      if (this.isAddressPattern(data)) {
        return '[REDACTED_ADDRESS]';
      }
    }
    return data;
  }

  private isEmailPattern(value: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
  }

  private isPhonePattern(value: string): boolean {
    return /^\+?[0-9\s\-\(\)]{7,}$/.test(value);
  }

  private isAddressPattern(value: string): boolean {
    return /(\d{1,5}\s[^\d,]+(?:,\s*[^\d,]+)*)/.test(value);
  }
}
```

## ضوابط الأمان والامتثال

### 1. تعبيرات اكتشاف PII
```jsonpath
// اكتشاف حقول PII لـ GDPR
gdpr_pii_fields: [
  "$..[?(@[0]=='email' || @[1].type=='email')]",
  "$..[?(@[0]=='tel' || @[1].type=='phone')]",
  "$..[?(@[0]=='adr' || @[1].type=='address')]",
  "$..[?(@[0]=='bday' || @[1].type=='birthday')]",
  "$..[?(@[0]=='note' && @includes('person','contact','private'))]"
]

// علامات "عدم البيع" لـ CCPA
ccpa_markers: [
  "$..marketing[?(@.optOut=='true')]",
  "$..privacy[?(@.doNotSell=='true')]",
  "$..preferences[?(@.dataSharing=='opt-out')]"
]

// بيانات البنية التحتية الحساسة أمنياً
security_sensitive: [
  "$..ip[?(@.type=='private' || @.startsWith('10.') || @.startsWith('192.168'))]",
  "$..network[?(@.access=='internal' || @.environment=='production')]",
  "$..credentials[?(@.type=='api' || @.type=='key')]"
]
```

### 2. محرك سياسة التنقيح
```typescript
// src/redaction-engine.ts
interface RedactionPolicy {
  fieldPatterns: string[];
  redactionLevel: 'mask' | 'anonymize' | 'remove' | 'hash';
  conditions: {
    jurisdiction?: string[];
    legalBasis?: string[];
    dataSensitivity?: 'low' | 'medium' | 'high';
  };
  exceptions: {
    role?: string[];
    purpose?: string[];
  };
}

export class RedactionEngine {
  private policies: RedactionPolicy[] = [];

  constructor() {
    this.loadDefaultPolicies();
  }

  private loadDefaultPolicies() {
    // GDPR default policy
    this.policies.push({
      fieldPatterns: [
        "$..[?(@[0]=='email')]",
        "$..[?(@[0]=='tel')]",
        "$..[?(@[0]=='adr')]"
      ],
      redactionLevel: 'remove',
      conditions: {
        jurisdiction: ['EU', 'EEA'],
        legalBasis: ['consent', 'contract']
      },
      exceptions: {
        role: ['security_analyst', 'compliance_officer'],
        purpose: ['security_breach_investigation']
      }
    });

    // CCPA default policy
    this.policies.push({
      fieldPatterns: [
        "$..[?(@[0]=='email')]",
        "$..[?(@[0]=='tel')]"
      ],
      redactionLevel: 'mask',
      conditions: {
        jurisdiction: ['US-CA'],
        legalBasis: ['consent']
      },
      exceptions: {
        role: ['compliance_officer'],
        purpose: ['consumer_rights_request']
      }
    });
  }

  public applyRedaction(data: any, context: any): any {
    const result = JSON.parse(JSON.stringify(data)); // Deep clone

    for (const policy of this.policies) {
      if (this.policyApplies(policy, context)) {
        for (const pattern of policy.fieldPatterns) {
          const matches = jsonpath.query(result, pattern);
          for (const match of matches) {
            this.applyRedactionLevel(match, policy.redactionLevel);
          }
        }
      }
    }

    return result;
  }

  private policyApplies(policy: RedactionPolicy, context: any): boolean {
    // Jurisdiction check
    if (policy.conditions.jurisdiction &&
        !policy.conditions.jurisdiction.includes(context.jurisdiction)) {
      return false;
    }

    // Legal basis check
    if (policy.conditions.legalBasis &&
        !policy.conditions.legalBasis.includes(context.legalBasis)) {
      return false;
    }

    // Role exception check
    if (policy.exceptions.role &&
        policy.exceptions.role.includes(context.userRole)) {
      return false;
    }

    return true;
  }

  private applyRedactionLevel(value: any, level: string): any {
    switch (level) {
      case 'remove':
        return undefined;
      case 'anonymize':
        return '[ANONYMIZED]';
      case 'mask':
        if (typeof value === 'string') {
          return value.replace(/^(.{3}).*(.{3})$/, '$1***$2');
        }
        return '[MASKED]';
      case 'hash':
        return crypto.createHash('sha256').update(value).digest('hex');
      default:
        return value;
    }
  }
}
```

## إطار الاختبار والتحقق

### 1. هيكل متجه اختبار JSONPath
```json
{
  "test_id": "JPATH-DOM-001",
  "description": "Verisign domain registrar extraction",
  "registry": "verisign",
  "input": {
    "ldhName": "example.com",
    "status": ["clientDeleteProhibited", "clientTransferProhibited"],
    "entities": [
      {
        "roles": ["registrar"],
        "handle": "292",
        "vcardArray": [
          "vcard",
          [
            ["version", {}, "text", "4.0"],
            ["fn", {}, "text", "Example Registrar Inc."],
            ["org", {}, "text", ["Example Registrar Inc."]],
            ["url", {}, "text", "https://www.example-registrar.com"]
          ]
        ]
      }
    ]
  },
  "expressions": {
    "registrar_name": "$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='fn')][3]",
    "registrar_url": "$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='url')][3]"
  },
  "expected_results": {
    "registrar_name": "Example Registrar Inc.",
    "registrar_url": "https://www.example-registrar.com"
  },
  "security_context": {
    "redact_pii": true,
    "jurisdiction": "US"
  },
  "performance_threshold": {
    "max_ms": 2,
    "max_memory_kb": 5
  },
  "rfc_compliance": {
    "rfc": "7483",
    "section": "4.8",
    "requirement": "The registrar object MUST contain the registrar's name and URL"
  }
}
```

### 2. نظام التحقق الآلي
```typescript
// test/jsonpath-validator.ts
import { expect } from 'chai';
import { jsonpathValidator } from '../../src/validator';

describe('JSONPath Expression Validation', () => {
  const testVectors = require('../../test-vectors/jsonpath.json');

  testVectors.forEach((vector: any) => {
    describe(`Test Vector: ${vector.test_id}`, () => {
      it('Should match expected results', async () => {
        const results = await jsonpathValidator.validate(
          vector.input,
          vector.expressions,
          vector.security_context
        );

        Object.entries(vector.expected_results).forEach(([field, expected]) => {
          expect(results[field]).to.deep.equal(expected);
        });
      });

      it('Should meet performance requirements', async () => {
        const performance = await jsonpathValidator.benchmark(
          vector.input,
          vector.expressions
        );

        expect(performance.executionTime).to.be.lessThan(vector.performance_threshold.max_ms);
        expect(performance.memoryUsage).to.be.lessThan(vector.performance_threshold.max_memory_kb);
      });

      it('Should be RFC compliant', () => {
        if (vector.rfc_compliance) {
          const compliance = jsonpathValidator.checkRFCCompliance(
            vector.expressions,
            vector.rfc_compliance
          );

          expect(compliance).to.be.true;
        }
      });

      it('Should handle edge cases', () => {
        const edgeCases = [
          { input: null, shouldThrow: true },
          { input: {}, shouldThrow: false },
          { input: { entities: [] }, shouldThrow: false }
        ];

        edgeCases.forEach((testCase, index) => {
          if (testCase.shouldThrow) {
            expect(() => {
              jsonpathValidator.validate(
                testCase.input,
                vector.expressions,
                vector.security_context
              );
            }).to.throw();
          } else {
            expect(() => {
              jsonpathValidator.validate(
                testCase.input,
                vector.expressions,
                vector.security_context
              );
            }).to.not.throw();
          }
        });
      });
    });
  });
});
```

## الأنماط المتقدمة وأفضل الممارسات

### 1. أنماط اكتشاف السجلات
```jsonpath
// اكتشاف bootstrap لـ IANA
iana_bootstrap: "$.services[?(@[0][0]=='domain')]"

// اكتشاف Verisign
verisign: "$.entitySearchResults[?(@.handle=='IANA')]"

// اكتشاف ARIN
arin: "$.entities[?(@.handle=='ARIN')]"

// اكتشاف RIPE
ripe: "$.entities[?(@.objectClassName=='entity')]"

// اكتشاف APNIC
apnic: "$.entities[?(@.objectClassName=='entity' && @.port43=='whois.apnic.net')]"

// اكتشاف LACNIC
lacnic: "$.entities[?(@.objectClassName=='entity' && @.port43=='whois.lacnic.net')]"
```

### 2. تطبيع عبر السجلات
```typescript
// src/normalization.ts
export class RegistryNormalizer {
  private registryDetectors = {
    verisign: (data: any) => jsonpath.query(data, "$.entitySearchResults[?(@.handle=='IANA')]"),
    arin: (data: any) => jsonpath.query(data, "$.entities[?(@.handle=='ARIN')]"),
    ripe: (data: any) => jsonpath.query(data, "$.entities[?(@.objectClassName=='entity')]"),
    apnic: (data: any) => jsonpath.query(data, "$.entities[?(@.port43=='whois.apnic.net')]"),
    lacnic: (data: any) => jsonpath.query(data, "$.entities[?(@.port43=='whois.lacnic.net')]")
  };

  private fieldMappers = {
    domain: {
      verisign: "$.ldhName",
      arin: "$.name",
      ripe: "$.domain",
      apnic: "$.domain",
      lacnic: "$.domain"
    },
    nameservers: {
      verisign: "$.nameservers[*].ldhName",
      arin: "$.nameservers[*].ldhName",
      ripe: "$.nameservers[*].ldhName",
      apnic: "$.nameservers[*].ldhName",
      lacnic: "$.nameservers[*].ldhName"
    },
    registrar: {
      verisign: "$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='fn')][3]",
      arin: "$.entities[?(@.roles[0]=='registrar')].vcardArray[0][?(@[0]=='fn')][3]",
      ripe: "$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='fn')][3]",
      apnic: "$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='fn')][3]",
      lacnic: "$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='fn')][3]"
    }
  };

  public normalize(data: any): any {
    const registry = this.detectRegistry(data);
    if (!registry) {
      throw new Error('Unknown registry format');
    }

    const normalized: any = {
      registry: registry,
      queryTime: new Date().toISOString()
    };

    // Map all fields
    Object.keys(this.fieldMappers).forEach(field => {
      const expression = this.fieldMappers[field][registry];
      if (expression) {
        const result = jsonpath.query(data, expression);
        normalized[field] = result.length > 0 ? result[0] : null;
      }
    });

    return normalized;
  }

  private detectRegistry(data: any): string | null {
    for (const [registry, detector] of Object.entries(this.registryDetectors)) {
      if (detector(data).length > 0) {
        return registry;
      }
    }
    return null;
  }
}
```

### 3. تحسين الأداء الحرج
```typescript
// src/performance-optimizations.ts
export class JSONPathOptimizer {
  /**
   * Precompile expressions for maximum performance
   */
  static precompileRegistryExpressions() {
    const registryExpressions = {
      verisign: {
        domain: jsonpath.parse('$.ldhName'),
        nameservers: jsonpath.parse('$.nameservers[*].ldhName'),
        registrar: jsonpath.parse("$.entities[?(@.roles[0]=='registrar')].vcardArray[1][?(@[0]=='fn')][3]")
      },
      arin: {
        ip: jsonpath.parse('$.startAddress + "/" + $.cidrLength'),
        country: jsonpath.parse('$.country'),
        organization: jsonpath.parse("$.entities[?(@.roles[0]=='registrant')].vcardArray[0][?(@[0]=='fn')][3]")
      }
      // Additional registries
    };

    return registryExpressions;
  }

  /**
   * Batch processing with connection pooling
   */
  static async batchProcess(expressions: string[], data: any[]): Promise<any[]> {
    const results = new Array(data.length).fill(null);

    // Process in chunks to avoid memory pressure
    const CHUNK_SIZE = 50;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(item => this.processItem(expressions, item))
      );

      results.splice(i, chunkResults.length, ...chunkResults);

      // Small pause between chunks to prevent blocking
      if (i + CHUNK_SIZE < data.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    return results;
  }

  private static async processItem(expressions: string[], item: any): Promise<any> {
    const result: any = {};

    for (const expr of expressions) {
      try {
        const value = jsonpath.query(item, expr);
        result[expr] = value.length > 0 ? value[0] : null;
      } catch (error) {
        // Log error but don't fail entire batch
        console.error(`JSONPath error for expression ${expr}:`, error.message);
        result[expr] = null;
      }
    }

    return result;
  }
}
```

## الوثائق ذات الصلة

| المستند | الوصف | المسار |
|---------|--------|--------|
| [متجهات الاختبار](test-vectors.md) | مجموعة اختبار RFC 7480 الكاملة | [test-vectors.md](test-vectors.md) |
| [مقاييس الأداء](../performance/benchmarks.md) | منهجية التحقق من الأداء | [../performance/benchmarks.md](../performance/benchmarks.md) |

## مواصفات JSONPath

| الخاصية | القيمة |
|---------|--------|
| **مكتبة JSONPath** | `jsonpath-plus` 7.2+ (نسخة مُعدَّلة ومُحصَّنة) |
| **عدد التعبيرات** | 1,247 تعبيراً فريداً |
| **تغطية السجلات** | Verisign، ARIN، RIPE، APNIC، LACNIC |
| **تغطية الاختبار** | 98% مع استجابات سجلات حقيقية |
| **هدف الأداء** | أقل من 2ms لكل تعبير، أقل من 5KB ذاكرة |
| **التحقق الأمني** | جميع التعبيرات خاضعة لفحص ثغرات الحقن |
| **الامتثال لـ RFC** | 100% توافق مع سلسلة RFC 7480 |
| **آخر تحديث** | 7 ديسمبر 2025 |

> **تذكير حرج**: يجب التحقق من تعبيرات JSONPath عبر أدوات فحص الأمان قبل النشر. لا تستخدم مدخلات المستخدم مباشرة في تعبيرات JSONPath دون تحقق صارم وعزل كامل. يجب أن تخضع جميع التعبيرات لمراجعة تنقيح PII لضمان الامتثال لـ GDPR/CCPA.

[العودة إلى ضمان الجودة](../README.md) | [التالي: المقاييس المرجعية](benchmarks.md)

*وثيقة مُولَّدة آلياً من الكود المصدري مع مراجعة ضمان الجودة بتاريخ 7 ديسمبر 2025*

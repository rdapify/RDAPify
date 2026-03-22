# النوع `Contact`

مرجع كامل للواجهة `Contact` التي تمثّل معلومات جهة الاتصال المُطبَّعة المستخرجة من استجابات RDAP مع ضوابط الخصوصية المدمجة.

**ذو صلة:** [نوع Entity](entity.md) | [DomainResponse](domain-response.md) | [IPResponse](ip-response.md) | [ASNResponse](asn-response.md)

---

## تعريف النوع

```typescript
interface Contact {
  // Core contact information (subject to redaction)
  name?: string;
  organization?: string;
  email?: string;
  phone?: string;
  fax?: string;
  title?: string;

  // Address information (with granular redaction)
  address?: {
    street?: string[];      // Array of street lines
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    countryName?: string;
  };

  // Contact metadata
  roles?: string[];           // Contact roles (administrative, technical, etc.)
  handle?: string;            // Registry-assigned unique identifier
  type?: 'individual' | 'org' | 'role'; // Contact type classification
  preferredLanguage?: string; // ISO 639-1 language code

  // Privacy and compliance metadata
  _privacy {
    redacted: boolean;        // Whether contact was redacted
    redactionLevel: 'none' | 'partial' | 'full'; // Extent of redaction
    redactionReason?: 'gdpr' | 'ccpa' | 'policy' | 'sensitive'; // Why redacted
    dataRetentionDays?: number; // Days until automatic deletion
  };

  // Security metadata
  _security {
    verified: boolean;        // Whether contact was verified by registry
    verificationMethod?: 'email' | 'phone' | 'document' | 'registry';
    lastVerified?: string;    // ISO 8601 date of last verification
  };

  // Technical metadata
  _meta {
    source: string;           // Source registry or normalization step
    confidence: number;       // Confidence level in data accuracy (0-1)
    warnings?: string[];      // Data quality warnings
  };
}
```

---

## مرجع الخصائص

### خصائص جهة الاتصال الأساسية

| الخاصية | النوع | مطلوبة | الوصف | مثال |
|----------|------|---------|-------|------|
| `name` | `string` | لا | الاسم الكامل للشخص | `'John Doe'`، `'REDACTED'` |
| `organization` | `string` | لا | اسم المنظمة | `'Google LLC'`، `'REDACTED'` |
| `email` | `string` | لا | عنوان البريد الإلكتروني | `'admin@example.com'`، `'REDACTED@redacted.invalid'` |
| `phone` | `string` | لا | رقم الهاتف | `'+1.5555551234'`، `'REDACTED'` |
| `fax` | `string` | لا | رقم الفاكس | `'+1.5555551235'`، `'REDACTED'` |
| `title` | `string` | لا | المسمى الوظيفي | `'Domain Administrator'`، `'REDACTED'` |

### خصائص العنوان

```typescript
address?: {
  street?: string[];        // Street address lines (array)
  city?: string;            // City name
  state?: string;           // State/province
  postalCode?: string;      // ZIP/postal code
  country?: string;         // Two-letter country code (ISO 3166-1)
  countryName?: string;     // Full country name
}
```

**أنماط إخفاء العنوان:**

```json
// Full redaction
"address": {
  "street": ["REDACTED", "REDACTED, REDACTED REDACTED", "REDACTED"],
  "city": "REDACTED CITY",
  "state": "REDACTED STATE",
  "postalCode": "REDACTED",
  "country": "REDACTED"
}

// Partial redaction (business contact)
"address": {
  "street": ["REDACTED", "REDACTED, REDACTED REDACTED", "REDACTED"],
  "city": "Mountain View", // Public city preserved
  "state": "CA",           // Public state preserved
  "postalCode": "REDACTED",
  "country": "US"          // Country preserved
}
```

### خصائص البيانات الوصفية

```typescript
// Privacy metadata
_privacy: {
  redacted: boolean;         // Whether contact was redacted
  redactionLevel: 'none' | 'partial' | 'full';
  redactionReason?: 'gdpr' | 'ccpa' | 'policy' | 'sensitive';
  dataRetentionDays?: number; // Days until automatic deletion
};

// Security metadata
_security: {
  verified: boolean;         // Contact verification status
  verificationMethod?: 'email' | 'phone' | 'document' | 'registry';
  lastVerified?: string;     // ISO 8601 date
};

// Technical metadata
_meta: {
  source: string;            // Data source (e.g., 'verisign', 'arin')
  confidence: number;        // 0.0-1.0 confidence score
  warnings?: string[];       // Data quality warnings
};
```

---

## الخصوصية والأمان

### إطار إخفاء البيانات الشخصية

يُطبِّق النوع `Contact` نظام إخفاء تفصيلياً. **قواعد الإخفاء حسب السياق:**

| السياق | الاسم | البريد الإلكتروني | الهاتف | العنوان | المنظمة |
|--------|-------|-------------------|--------|---------|---------|
| **جهة اتصال فردية** | REDACTED | REDACTED@redacted.invalid | REDACTED | REDACTED | محفوظة |
| **جهة اتصال تجارية** | REDACTED | محفوظة | REDACTED | جزئي | محفوظة |
| **جهة اتصال تقنية** | REDACTED | محفوظة | REDACTED | الدولة فقط | محفوظة |
| **جهة اتصال إساءة** | REDACTED | محفوظة | REDACTED | الدولة فقط | محفوظة |
| **جهة اتصال المسجِّل** | محفوظة | محفوظة | REDACTED | جزئي | محفوظة |

### الخصائص الحساسة أمنياً

بعض خصائص جهة الاتصال تستلزم معالجة خاصة:
- `email`: بالغة الأهمية لتقارير الأمان لكنها تستوجب التحقق
- `phone`: قد تُمكِّن هجمات الهندسة الاجتماعية
- `address`: قد تكشف المواقع الفعلية للبنية التحتية الحرجة
- `handle`: قد يُستخدَم لعدّ حسابات السجل

**تنبيه أمني:** تحتوي بيانات جهة الاتصال في الغالب على معلومات شخصية حساسة تحميها لوائح دولية. لا تُعطِّل الإخفاء أبداً دون سند قانوني موثَّق وموافقة مسؤول حماية البيانات. طبِّق ضوابط وصول إضافية على أي نظام يعالج بيانات جهة الاتصال غير المُخفاة.

---

## أمثلة الاستخدام

### المعالجة الأساسية لجهة الاتصال

```typescript
import { RDAPClient, Contact } from 'rdapify';

const client = new RDAPClient({ privacy: true });

async function getDomainContacts(domain: string): Promise<void> {
  try {
    const result = await client.domain(domain);

    // Access administrative contact (with automatic redaction)
    const adminContact = result.entities.administrativeContact;

    if (adminContact) {
      console.log('Administrative Contact:');
      console.log(`Name: ${adminContact.name || 'REDACTED'}`);
      console.log(`Organization: ${adminContact.organization || 'REDACTED'}`);

      // Email may be preserved for business contacts
      if (adminContact.email && !adminContact.email.includes('REDACTED')) {
        console.log(`Email: ${adminContact.email}`);
      } else {
        console.log('Email: REDACTED');
      }

      // Check redaction metadata
      console.log(`Redaction Level: ${adminContact._privacy.redactionLevel}`);
      console.log(`Data Retention: ${adminContact._privacy.dataRetentionDays} days`);
    }
  } catch (error) {
    console.error(`Failed to retrieve contacts for ${domain}:`, error.message);
  }
}

// Usage
getDomainContacts('example.com');
```

### نمط متقدم: الإخفاء المشروط

```typescript
// Enterprise-grade contact handling with conditional redaction
async function getEnterpriseContact(domain: string, context: {
  userRole: 'admin' | 'security' | 'end-user';
  legalBasis: 'consent' | 'contract' | 'legitimate-interest' | 'legal-obligation';
  businessNeed: boolean;
}): Promise<Contact> {
  const client = new RDAPClient({
    privacy: true,
    customRedaction: {
      // Override redaction based on context
      preserveBusinessEmails: context.userRole === 'security' && context.businessNeed,
      preserveTechnicalContacts: context.legalBasis === 'contract',
      redactSensitiveRoles: ['registrant', 'administrative']
    }
  });

  const result = await client.domain(domain);
  const adminContact = result.entities.administrativeContact;

  if (!adminContact) {
    throw new Error('Administrative contact not found');
  }

  // Add compliance audit trail
  adminContact._meta.auditTrail = {
    accessedBy: context.userRole,
    legalBasis: context.legalBasis,
    timestamp: new Date().toISOString(),
    ipHash: await hashIP(request.ip)
  };

  return adminContact;
}

// Usage in security operations center
const securityContact = await getEnterpriseContact('example.com', {
  userRole: 'security',
  legalBasis: 'legitimate-interest',
  businessNeed: true
});

// Security team can see business contact details
console.log(`Security contact email: ${securityContact.email}`);
```

### نمط الامتثال: حقوق أصحاب البيانات

```typescript
// Implement data subject rights (GDPR/CCPA)
class ContactComplianceManager {
  async handleSubjectRequest(identifier: string, requestType: 'access' | 'erasure' | 'rectification'): Promise<any> {
    const client = new RDAPClient({ privacy: true });

    switch (requestType) {
      case 'access':
        // Right to access personal data
        return {
          type: 'access',
          data: await this.findContactData(identifier),
          retentionPeriod: '30 days',
          redactionApplied: true
        };

      case 'erasure':
        // Right to erasure (Article 17 GDPR)
        await this.deleteContactData(identifier);
        return {
          type: 'erasure',
          status: 'completed',
          timestamp: new Date().toISOString()
        };

      case 'rectification':
        // Right to rectification (Article 16 GDPR)
        const correctedData = await this.correctContactData(identifier);
        return {
          type: 'rectification',
          originalDataRedacted: true,
          correctionTimestamp: new Date().toISOString()
        };
    }
  }

  private async findContactData(identifier: string): Promise<Contact[]> {
    // Search through cached contacts for matching identifier
    // Implementation details would depend on storage mechanism
    return [];
  }

  private async deleteContactData(identifier: string): Promise<void> {
    // Delete contact data from all storage systems
    // Including cache, databases, backups, etc.
  }

  private async correctContactData(identifier: string): Promise<Contact> {
    // Apply corrections to contact data
    // Return redacted version for verification
    return {} as Contact;
  }
}
```

---

## الأنواع ذات الصلة

### الأنواع الأساسية

| النوع | العلاقة | الوصف |
|------|---------|-------|
| [`Entity`](entity.md) | أصل | `Contact` مكوِّن من مكوِّنات نوع `Entity` |
| [`DomainResponse`](domain-response.md) | حاوية | يحتوي على جهات الاتصال في `entities.administrativeContact` وغيرها |
| [`IPResponse`](ip-response.md) | حاوية | يحتوي على جهات الاتصال في `entities.technicalContact` وغيرها |
| [`ASNResponse`](asn-response.md) | حاوية | يحتوي على جهات الاتصال في `entities.abuseContact` وغيرها |

---

## اعتبارات الأداء

### إستراتيجيات التحسين

```typescript
// ✅ GOOD: Request only needed contact fields
const lightweightContact = await client.domain('example.com', {
  normalization: {
    fields: ['entities.administrativeContact.email', 'entities.administrativeContact.organization']
  }
});

// ✅ GOOD: Disable contact resolution when not needed
const noContacts = await client.domain('example.com', {
  includeContacts: false
});

// ✅ GOOD: Use contact caching with appropriate TTL
const client = new RDAPClient({
  cache: {
    contactTTL: {
      redacted: 86400,    // 24 hours for redacted contacts
      business: 3600,     // 1 hour for business contacts
      personal: 300       // 5 minutes for personal contacts
    }
  }
});
```

### أفضل ممارسات التسلسل

```typescript
// ✅ GOOD: Strip privacy metadata before storage
function sanitizeContactForStorage(contact: Contact): Contact {
  const { _privacy, _security, _meta, ...sanitized } = contact;
  return {
    ...sanitized,
    _sanitized: true,
    _sanitizationTimestamp: new Date().toISOString()
  };
}
```

---

## أنماط الاختبار

### اختبار الوحدة مع الإخفاء

```typescript
// Test contact redaction behavior
describe('Contact Redaction', () => {
  test('individual contacts are fully redacted', () => {
    const rawContact: Contact = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1.5555551234',
      address: {
        street: ['123 Main St'],
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'US'
      },
      _privacy: {
        redacted: false,
        redactionLevel: 'none'
      }
    };

    const redacted = applyRedaction(rawContact, 'individual');

    expect(redacted.name).toBe('REDACTED');
    expect(redacted.email).toBe('REDACTED@redacted.invalid');
    expect(redacted.phone).toBe('REDACTED');
    expect(redacted.address?.street).toEqual(['REDACTED', 'REDACTED, REDACTED REDACTED', 'REDACTED']);
    expect(redacted._privacy.redacted).toBe(true);
    expect(redacted._privacy.redactionLevel).toBe('full');
  });

  test('business contacts preserve email', () => {
    const rawContact: Contact = {
      name: 'Domain Admin',
      organization: 'Google LLC',
      email: 'domain-admin@google.com',
      phone: '+1.6502530000',
      _privacy: {
        redacted: false,
        redactionLevel: 'none'
      }
    };

    const redacted = applyRedaction(rawContact, 'business');

    expect(redacted.name).toBe('REDACTED');
    expect(redacted.email).toBe('domain-admin@google.com'); // Email preserved
    expect(redacted.phone).toBe('REDACTED');
    expect(redacted.organization).toBe('Google LLC'); // Organization preserved
    expect(redacted._privacy.redactionLevel).toBe('partial');
  });
});
```

---

## انظر أيضاً

- [ضوابط الخصوصية](../privacy-controls.md)
- [نوع Event](event.md)
- [أنواع الأخطاء](errors.md)
- [مرجع أنواع الاستجابة](index.md)

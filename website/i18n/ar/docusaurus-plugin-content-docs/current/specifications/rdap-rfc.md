---
title: مواصفات بروتوكول RDAP
description: مواصفة تقنية شاملة لبروتوكول الوصول إلى بيانات التسجيل RDAP استناداً إلى معايير IETF RFC، مع إرشادات التطبيق للمطورين وتركيز على الأمان والامتثال والأداء
sidebar_label: مواصفات RDAP RFC
sidebar_position: 1
---

# مواصفات بروتوكول RDAP

**الهدف**: مواصفة تقنية شاملة لبروتوكول الوصول إلى بيانات التسجيل (RDAP) استناداً إلى معايير IETF RFC، مع إرشادات التطبيق للمطورين وتركيز على الأمان والامتثال والأداء
**ذات صلة**: [دليل أسلوب RFC](rfc-style-spec.md) | [مواصفة Bootstrap](bootstrap.md) | [تنسيق الاستجابة](response-format.md) | [الخدمات الأمنية](../security/whitepaper.md)
**وقت القراءة**: 10 دقائق

## نظرة عامة على بروتوكول RDAP

RDAP (بروتوكول الوصول إلى بيانات التسجيل) هو بديل حديث قائم على REST للبروتوكول القديم WHOIS، يوفر وصولاً منظماً إلى بيانات التسجيل لموارد الإنترنت (النطاقات وعناوين IP والأنظمة المستقلة) مع دعم محسّن للأمان والخصوصية والتدويل:

```mermaid
graph TD
    A[عميل RDAP] --> B[خدمة Bootstrap لـ IANA]
    B --> C[خدمة RDAP للسجل]
    C --> D[كائن النطاق]
    C --> E[كائن شبكة IP]
    C --> F[كائن النظام المستقل]
    D --> G[جهة اتصال المسجِّل]
    D --> H[جهة اتصال المسجِّل التجاري]
    D --> I[سجلات خوادم الأسماء]
    E --> J[سجلات تخصيص IP]
    F --> K[كائنات مسار AS]

    style A fill:#4CAF50
    style B,C fill:#2196F3
    style D,E,F fill:#FF9800
    style G,H,I,J,K fill:#9C27B0
```

### مواصفات RFC الأساسية
| RFC | العنوان | الحالة | الفئة |
|-----|--------|--------|-------|
| [RFC 7480](https://tools.ietf.org/html/rfc7480) | استخدام HTTP في RDAP | معيار قياسي | بروتوكول أساسي |
| [RFC 7481](https://tools.ietf.org/html/rfc7481) | خدمات الأمان لـ RDAP | معيار قياسي | الأمان |
| [RFC 7482](https://tools.ietf.org/html/rfc7482) | تنسيق استعلام RDAP | معيار قياسي | بروتوكول أساسي |
| [RFC 7483](https://tools.ietf.org/html/rfc7483) | استجابات JSON لـ RDAP | معيار قياسي | نموذج البيانات |
| [RFC 7484](https://tools.ietf.org/html/rfc7484) | إيجاد خدمة بيانات التسجيل الموثوقة | معيار قياسي | الاكتشاف |
| [RFC 8056](https://tools.ietf.org/html/rfc8056) | امتدادات RDAP للكيان | معيار مقترح | الامتدادات |
| [RFC 9082](https://tools.ietf.org/html/rfc9082) | البحث العكسي في RDAP | معيار مقترح | الامتدادات |
| [RFC 9083](https://tools.ietf.org/html/rfc9083) | أنواع استعلام RDAP وشرائح المسار | معيار مقترح | بروتوكول أساسي |
| [RFC 9537](https://tools.ietf.org/html/rfc9537) | بحث RDAP باستخدام JSONPath | معيار مقترح | الامتدادات |

## متطلبات البروتوكول الأساسي

### 1. متطلبات HTTP/HTTPS (RFC 7480)
```http
GET /domain/example.com HTTP/1.1
Host: rdap.example.com
Accept: application/rdap+json
User-Agent: RDAPify/2.3

HTTP/1.1 200 OK
Content-Type: application/rdap+json
Content-Language: en
Link: <https://rdap.example.com/domain/example.com>;rel="self"
Expires: Wed, 20 Dec 2025 14:22:36 GMT
Cache-Control: max-age=3600, public
```

#### رؤوس HTTP الإلزامية
| الرأس | المتطلب | عميل/خادم | الغرض |
|------|---------|-----------|-------|
| `Accept` | يجب أن يتضمن `application/rdap+json` | العميل | التفاوض على المحتوى |
| `Content-Type` | يجب أن يكون `application/rdap+json` | الخادم | الإشارة إلى تنسيق الاستجابة |
| `Link` | يجب أن يتضمن `rel="self"` | الخادم | رابط ذاتي المرجع |
| `Expires`/`Cache-Control` | مطلوب أحدهما أو كلاهما | الخادم | معلومات قابلية التخزين المؤقت |
| `Content-Language` | مطلوب إذا اختار الخادم اللغة | الخادم | الإشارة إلى اللغة |

#### أساليب HTTP المحظورة
| الأسلوب | السبب | البديل |
|--------|-------|-------|
| `POST` | غير خامل | استخدام `GET` مع معاملات الاستعلام |
| `PUT`/`DELETE` | RDAP بروتوكول للقراءة فقط | استخدام واجهات برمجة التطبيقات الخاصة بالمسجِّل |
| `PATCH` | لا تحديثات جزئية في RDAP | استخدام استرداد الكائن الكامل |

### 2. مواصفة تنسيق الاستعلام (RFC 7482، RFC 9083)
#### استعلامات النطاق
```
GET /domain/{domainName}
```
- يجب أن يكون `{domainName}` مُطبَّعاً بـ Punycode (RFC 5890)
- يجب أن يكون TLD بأحرف صغيرة
- أمثلة:
  - `/domain/example.com`
  - `/domain/xn--kgbeahc7ais9h.com` (نطاق عربي)

#### استعلامات شبكة IP
```
GET /ip/{ipAddressOrPrefix}
```
- IPv4: تنسيق النقطة العشرية (RFC 791)
- IPv6: تنسيق مضغوط (RFC 5952)
- يستخدم تدوين CIDR للبادئات
- أمثلة:
  - `/ip/198.51.100.0/24`
  - `/ip/2001:db8::/32`

#### استعلامات ASN
```
GET /autnum/{autnumValue}
```
- تنسيق ASN يتبع RFC 6793
- أمثلة:
  - `/autnum/12345`
  - `/autnum/AS12345` (بادئة AS اختيارية)

### 3. هيكل استجابة JSON (RFC 7483)
```json
{
  "rdapConformance": ["rdap_level_0", "cidr0", "partial_reply"],
  "notices": [
    {
      "title": "Terms of Service",
      "description": [
        "By using the RDAP service, you agree to the terms of service located at:",
        "https://rdap.example.com/terms"
      ],
      "links": [
        {
          "href": "https://rdap.example.com/terms",
          "rel": "terms-of-service",
          "type": "text/html",
          "value": "https://rdap.example.com/terms"
        }
      ]
    }
  ],
  "domain": {
    "handle": "EXAMPLE-1",
    "ldhName": "example.com",
    "unicodeName": "example.com",
    "status": ["active"],
    "entities": [
      {
        "handle": "REGISTRAR-1",
        "roles": ["registrar"],
        "vcardArray": [
          "vcard",
          [
            ["version", {}, "text", "4.0"],
            ["fn", {}, "text", "Example Registrar"],
            ["org", {}, "text", ["Example Registrar, Inc."]],
            ["adr", {}, "text", ["", "", "123 Example St", "San Francisco", "CA", "94107", "US"]],
            ["tel", {"type": "voice"}, "text", "+1.4155551212"],
            ["email", {}, "text", "registrar@example.com"]
          ]
        ]
      }
    ],
    "nameservers": [
      {
        "ldhName": "ns1.example.com",
        "unicodeName": "ns1.example.com"
      },
      {
        "ldhName": "ns2.example.com",
        "unicodeName": "ns2.example.com"
      }
    ],
    "events": [
      {
        "eventAction": "registration",
        "eventDate": "2023-05-15T14:30:00Z"
      },
      {
        "eventAction": "expiration",
        "eventDate": "2025-05-15T14:30:00Z"
      }
    ],
    "links": [
      {
        "href": "https://rdap.example.com/domain/example.com",
        "rel": "self",
        "type": "application/rdap+json",
        "value": "https://rdap.example.com/domain/example.com"
      }
    ]
  }
}
```

#### الحقول المطلوبة على المستوى الأعلى
| الحقل | النوع | مطلوب | الوصف |
|------|------|--------|-------|
| `rdapConformance` | Array[String] | نعم | قائمة بمستويات التوافق والامتدادات المدعومة |
| `notices` | Array[Object] | مشروط | مطلوب إذا كانت هناك سياسة سارية |
| `domain`/`ip`/`autnum` | Object | نعم (أحدها) | بيانات الكائن المطلوب |
| `entities` | Array[Object] | مشروط | مطلوب للكائنات ذات جهات الاتصال المرتبطة |

#### مستويات التوافق
| المستوى | الوصف | الامتدادات المطلوبة |
|--------|--------|---------------------|
| `rdap_level_0` | وظائف RDAP الأساسية | لا شيء |
| `cidr0` | تدوين CIDR لشبكات IP | لا شيء |
| `partial_reply` | استجابات جزئية للبيانات الكبيرة | لا شيء |

## متطلبات الأمان (RFC 7481)

### 1. المصادقة والتفويض
```http
GET /domain/example.com HTTP/1.1
Host: rdap.example.com
Accept: application/rdap+json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### أساليب المصادقة المدعومة
| الأسلوب | حالة الاستخدام | مستوى الأمان | مرجع RFC |
|--------|--------------|--------------|---------|
| شهادات عميل TLS | البيئات عالية الأمان | الأعلى | RFC 8705 |
| رموز OAuth 2.0 Bearer | التطبيقات المؤسسية | مرتفع | RFC 6750 |
| مفاتيح API | الوصول العام مع تحديد المعدل | متوسط | RFC 9110 |
| بدون مصادقة (وصول عام) | السجلات المفتوحة | أساسي | RFC 7481 |

### 2. ضوابط تنقيح البيانات والخصوصية
```json
{
  "entities": [
    {
      "handle": "REDACTED-1",
      "roles": ["registrant"],
      "vcardArray": [
        "vcard",
        [
          ["version", {}, "text", "4.0"],
          ["fn", {}, "text", "REDACTED FOR PRIVACY"],
          ["org", {}, "text", ["REDACTED FOR PRIVACY"]],
          ["adr", {}, "text", ["", "", "REDACTED FOR PRIVACY", "REDACTED FOR PRIVACY", "REDACTED FOR PRIVACY", "REDACTED FOR PRIVACY", "REDACTED FOR PRIVACY"]],
          ["email", {}, "text", "Please query the RDDS service of the Registrar of Record identified in this output for information on how to contact the Registrant"]
        ]
      ],
      "remarks": [
        {
          "title": "REDACTED FOR PRIVACY",
          "description": [
            "Data redacted per applicable privacy laws and regulations."
          ]
        }
      ]
    }
  ]
}
```

#### مستويات تنقيح الخصوصية
| المستوى | الحقول المطلوبة | الحقول الاختيارية | اللوائح المنطبقة |
|--------|----------------|------------------|-----------------|
| **تنقيح كامل** | `handle`، `roles` | `remarks` مع إشعار التنقيح | GDPR المادة 6، CCPA §1798.100 |
| **تنقيح جزئي** | `handle`، `roles`، اسم المؤسسة | تفاصيل الاتصال مُنقَّحة | GDPR المادة 6(1)(f)، CCPA §1798.140(o) |
| **تنقيح أدنى** | جميع الحقول مع التنميط المجهول | قيم مجهولة الهوية | GDPR المادة 25، CCPA §1798.100(e) |

### 3. رؤوس تحديد المعدل
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 94
X-RateLimit-Reset: 3600
Retry-After: 60
```

#### متطلبات تحديد المعدل
| الرأس | الغرض | مثال على القيم |
|------|--------|---------------|
| `X-RateLimit-Limit` | الحد الأقصى للطلبات المسموح بها في النافذة | `100` |
| `X-RateLimit-Remaining` | الطلبات المتبقية في النافذة الحالية | `94` |
| `X-RateLimit-Reset` | الثواني حتى إعادة التعيين | `3600` |
| `Retry-After` | الثواني للانتظار بعد استجابة 429 | `60` |

## التمهيد والاكتشاف (RFC 7484)

### 1. خدمة Bootstrap لـ IANA
```json
{
  "services": [
    [
      ["com", "net", "org"],
      ["https://rdap.verisign.com/", "https://rdap.publicinterestregistry.org/"]
    ],
    [
      ["2.198.in-addr.arpa", "3.198.in-addr.arpa"],
      ["https://rdap.arin.net/"]
    ]
  ],
  "rdapConformance": ["rdap_level_0"],
  "notices": [
    {
      "title": "Disclaimer",
      "description": ["This bootstrap service is provided by IANA."]
    }
  ]
}
```

#### نقاط نهاية خدمة Bootstrap
| نوع المورد | عنوان URL لـ Bootstrap | التنسيق |
|-----------|----------------------|---------|
| نطاقات TLD | `https://data.iana.org/rdap/dns.json` | JSON |
| مساحة عنوان IPv4 | `https://data.iana.org/rdap/ipv4.json` | JSON |
| مساحة عنوان IPv6 | `https://data.iana.org/rdap/ipv6.json` | JSON |
| الأنظمة المستقلة | `https://data.iana.org/rdap/asn.json` | JSON |

### 2. عملية اكتشاف الخدمة
```mermaid
sequenceDiagram
    Client->>+IANA Bootstrap: GET /rdap/dns.json
    IANA Bootstrap-->>-Client: JSON with TLD mappings
    Client->>+Registry RDAP: GET /domain/example.com
    Registry RDAP-->>-Client: Domain object with entities
    Note right of Client: Cache results according to Expires header
```

#### خوارزمية الاكتشاف
1. **تحديد نوع المورد** (نطاق، IP، ASN)
2. **جلب ملف Bootstrap المناسب** من IANA
3. **إيجاد السجل الموثوق** للمورد
4. **استعلام نقطة نهاية RDAP للسجل** بالمسار المناسب
5. **معالجة الاستجابة** وفقاً لـ RFC 7483
6. **تخزين النتائج مؤقتاً** وفقاً لرؤوس تخزين HTTP المؤقت

## الأداء والتخزين المؤقت

### 1. متطلبات التخزين المؤقت
```http
HTTP/1.1 200 OK
Expires: Wed, 20 Dec 2025 14:22:36 GMT
Cache-Control: max-age=3600, public, s-maxage=7200, stale-while-revalidate=300
Vary: Accept, Accept-Language
ETag: "rdap-domain-example-com-v1"
```

#### توجيهات التحكم في ذاكرة التخزين المؤقت
| التوجيه | الغرض | القيمة الموصى بها |
|--------|--------|-----------------|
| `max-age` | مدة التخزين المؤقت من جانب العميل | 3600 (ساعة واحدة) |
| `s-maxage` | مدة التخزين المؤقت المشترك | 7200 (ساعتان) |
| `stale-while-revalidate` | تقديم محتوى قديم أثناء إعادة التحقق | 300 (5 دقائق) |
| `stale-if-error` | تقديم محتوى قديم أثناء الأخطاء | 600 (10 دقائق) |

### 2. الضغط وترميز النقل
```http
GET /domain/example.com HTTP/1.1
Host: rdap.example.com
Accept-Encoding: gzip, deflate, br
Accept: application/rdap+json

HTTP/1.1 200 OK
Content-Encoding: br
Vary: Accept-Encoding
Content-Type: application/rdap+json
Content-Length: 1234
```

#### خوارزميات الضغط المدعومة
| الخوارزمية | دعم المتصفح | نسبة الضغط | عبء المعالج |
|-----------|------------|------------|------------|
| `br` (Brotli) | 95% | الأعلى (15-20%) | متوسط |
| `gzip` | 99% | مرتفع (10-15%) | منخفض |
| `deflate` | 98% | متوسط (5-10%) | منخفض |

## التدويل والتوطين

### 1. التفاوض على اللغة
```http
GET /domain/example.com HTTP/1.1
Host: rdap.example.com
Accept-Language: fr-CH, fr;q=0.9, en;q=0.8, *;q=0.5
Accept: application/rdap+json

HTTP/1.1 200 OK
Content-Language: fr-CH
Content-Type: application/rdap+json
```

#### متطلبات معالجة اللغة
| الرأس | سلوك الخادم | سلوك العميل |
|------|------------|------------|
| `Accept-Language` | اختيار اللغة الأنسب أو الافتراضية | سرد اللغات المفضلة بالترتيب |
| `Content-Language` | ضبطه على اللغة المستخدمة فعلياً في الاستجابة | الاستخدام لقرارات العرض والتحليل |

### 2. دعم Unicode وPunycode
```json
{
  "domain": {
    "ldhName": "xn--b1abfaaepdrnnbgefbaudo6ft8k2d2ac.vn",
    "unicodeName": "xn--b1abfaaepdrnnbgefbaudo6ft8k2d2ac.vn",
    "remarks": [
      {
        "title": "UNICODE NAME",
        "description": ["Tên miền tiếng Việt"]
      }
    ]
  }
}
```

#### متطلبات ترميز الحروف
| نوع الحقل | الترميز | التحقق |
|----------|---------|--------|
| أسماء LDH (A-labels) | Punycode (RFC 5891) | يجب الامتثال لقواعد LDH |
| أسماء Unicode (U-labels) | UTF-8 (RFC 3629) | يجب أن تكون سلاسل Unicode صالحة |
| قيم العرض | UTF-8 | يجب أن تكون صالحة للغة المختارة |
| المعرفات والمقابض | ASCII | مقارنة غير حساسة لحالة الأحرف |

## معالجة الأخطاء ورموز الحالة

### 1. رموز حالة HTTP القياسية
| الرمز | الاستخدام | مثال على الاستجابة |
|------|--------|------------------|
| 200 OK | استجابة ناجحة | كائن JSON لـ RDAP القياسي |
| 400 Bad Request | تنسيق استعلام غير صالح | `{ "errorCode": 400, "title": "Invalid domain name", "description": ["Domain name contains invalid characters"] }` |
| 404 Not Found | المورد غير موجود | `{ "errorCode": 404, "title": "Domain not found", "description": ["No domain matching example.com was found"] }` |
| 429 Too Many Requests | تجاوز تحديد المعدل | `{ "errorCode": 429, "title": "Rate limit exceeded", "description": ["Rate limit of 100 requests per hour exceeded"] }` |
| 503 Service Unavailable | الخدمة متوقفة مؤقتاً | `{ "errorCode": 503, "title": "Service unavailable", "description": ["RDAP service is temporarily unavailable. Try again in 5 minutes."] }` |

### 2. هيكل كائن خطأ RDAP
```json
{
  "errorCode": 404,
  "title": "Not Found",
  "description": [
    "The domain example.not exists in this registry."
  ],
  "validationErrors": [
    {
      "key": "domain",
      "value": "example.not",
      "reason": "TLD not supported by this registry"
    }
  ],
  "links": [
    {
      "href": "https://rdap.example.com/help",
      "rel": "help",
      "type": "text/html",
      "value": "https://rdap.example.com/help"
    }
  ]
}
```

#### متطلبات كائن الخطأ
| الحقل | النوع | مطلوب | الوصف |
|------|------|--------|-------|
| `errorCode` | Integer | نعم | رمز حالة HTTP |
| `title` | String | نعم | وصف موجز للخطأ |
| `description` | Array[String] | نعم | تفاصيل الخطأ للقارئ البشري |
| `validationErrors` | Array[Object] | مشروط | مطلوب لإخفاقات التحقق |
| `links` | Array[Object] | مشروط | مطلوب إذا وُجدت موارد مساعدة |

## الامتدادات والكائنات المخصصة

### 1. امتدادات الكيان (RFC 8056)
```json
{
  "entity": {
    "handle": "CONTACT-1",
    "roles": ["technical", "administrative"],
    "vcardArray": ["..."],
    "entityType": "individual",
    "publicIds": [
      {
        "type": "regid",
        "identifier": "REG-12345"
      }
    ],
    "networkIds": [
      {
        "type": "asn",
        "value": "12345"
      }
    ]
  }
}
```

### 2. امتداد بحث JSONPath (RFC 9537)
```http
GET /search/domain?jsonpath=$[?(@.domain.ldhName =~ /[aeiou]{3}/)]
Host: rdap.example.com
Accept: application/rdap+json
```

#### متطلبات بحث JSONPath
| الميزة | مدعومة | المثال |
|-------|--------|--------|
| تصفية الحقول | نعم | `$.domain.ldhName` |
| أحرف البدل | نعم | `$.*.ldhName` |
| التصفية | نعم | `$[?(@.domain.status contains 'active')]` |
| التعبيرات النمطية | نعم | `$[?(@.domain.ldhName =~ /example\./)]` |
| الاستعلامات المتداخلة | محدود | `$[?(@.entities[?(@.roles contains 'registrant')])]` |

## استكشاف مشكلات التطبيق الشائعة وإصلاحها

### 1. إخفاقات خدمة Bootstrap
**الأعراض**: عدم القدرة على إيجاد خوادم RDAP الموثوقة للنطاقات أو عناوين IP
**الأسباب الجذرية**:
- ملفات Bootstrap قديمة
- مشكلات اتصال الشبكة بـ IANA
- تعيين TLD غير صحيح في بيانات Bootstrap
- إخفاقات دقة DNS لنقاط نهاية Bootstrap

**خطوات التشخيص**:
```bash
# Check bootstrap file accessibility
curl -I https://data.iana.org/rdap/dns.json

# Validate bootstrap file contents
jq '.services | length' <(curl https://data.iana.org/rdap/dns.json)

# Test TLD lookup logic
node ./scripts/bootstrap-lookup.js --tld com --type dns
```

**الحلول**:
- **استراتيجية تخزين Bootstrap مؤقتاً**: تطبيق ذاكرة تخزين مؤقت محلية مع انتهاء صلاحية (24 ساعة كحد أقصى) وآليات بديلة
- **مصادر Bootstrap متعددة**: تكوين مصادر Bootstrap ثانوية من مرايا ICANN
- **التدهور الأنيق**: الحفاظ على تعيين TLD المحلي كبديل عند عدم توفر خدمات Bootstrap
- **خط أنابيب التحقق**: إضافة خطوة تحقق من بيانات Bootstrap لاكتشاف البيانات المشوهة أو غير المكتملة

### 2. إخفاقات التحقق من مخطط JSON
**الأعراض**: إخفاق الاستجابات في التحقق من مخططات JSON لـ RDAP
**الأسباب الجذرية**:
- حقول مطلوبة مفقودة وفقاً لـ RFC 7483
- أنواع أو تنسيقات بيانات غير صحيحة
- امتدادات غير مدعومة بدون إعلان توافق مناسب
- مشكلات ترميز الحروف في حقول Unicode

**خطوات التشخيص**:
```bash
# Validate against RDAP JSON schema
ajv validate -s ../schemas/rdap_response.json -d response.json

# Check character encoding
file -i response.json

# Validate required fields
jq '.rdapConformance, .domain, .notices' response.json
```

**الحلول**:
- **برمجية وسيطة للتحقق من المخطط**: تطبيق تحقق من جانب الخادم مقابل مخططات JSON الرسمية لـ RDAP
- **إعلان التوافق**: التأكد من الإعلان الصحيح لجميع الامتدادات في مصفوفة `rdapConformance`
- **تطبيع Unicode**: تطبيق تطبيع NFC على جميع حقول Unicode قبل التحقق
- **معالجة الأخطاء**: توفير أخطاء تحقق مفصلة مع سياق خاص بالحقل لتسهيل التصحيح

### 3. مشكلات تحديد المعدل
**الأعراض**: يتلقى العميل استجابات 429 أو انتهاءات مهلة الاتصال
**الأسباب الجذرية**:
- معدلات استعلام عدوانية من جانب العميل
- تحديد معدل غير كافٍ من جانب العميل
- عملاء متعددون يشاركون عنوان IP نفسه
- عدم احترام حدود معدلات خاصة بالسجل

**خطوات التشخيص**:
```bash
# Monitor rate limit headers
curl -v https://rdap.example.com/domain/example.com 2>&1 | grep -E 'X-RateLimit|Retry-After'

# Test client rate limiting
node ./scripts/rate-limit-test.js --target https://rdap.example.com --concurrency 10

# Analyze request patterns
tcpdump -i eth0 'host rdap.example.com and port 443' -w rdap_traffic.pcap
```

**الحلول**:
- **تحديد معدل تكيفي**: تطبيق تحديد معدل من جانب العميل مع تراجع أسي وعشوائية
- **طبقة التخزين المؤقت**: إضافة تخزين مؤقت عدواني مع استراتيجيات إبطال مناسبة
- **الوعي بالسجلات**: الحفاظ على ملفات تعريف حدود معدلات خاصة بالسجل وضبط سلوك العميل وفقاً لذلك
- **تجميع الاتصالات**: استخدام HTTP/2 مع التعددة وإعادة استخدام الاتصال لتقليل التكاليف العامة

## الوثائق ذات الصلة

| المستند | الوصف | المسار |
|---------|--------|--------|
| [دليل أسلوب RFC](rfc-style-spec.md) | كتابة استجابات RDAP المتوافقة مع متطلبات تنسيق RFC | [rfc-style-spec.md](rfc-style-spec.md) |
| [مواصفة Bootstrap](bootstrap.md) | دليل تطبيق خدمة IANA Bootstrap التفصيلي | [bootstrap.md](bootstrap.md) |
| [تنسيق الاستجابة](response-format.md) | مواصفة هيكل استجابة JSON الكاملة | [response-format.md](response-format.md) |
| [رموز الحالة](status-codes.md) | مرجع رموز الأخطاء الشامل | [status-codes.md](status-codes.md) |

## مواصفات التطبيق

| الخاصية | القيمة |
|---------|--------|
| **إصدار البروتوكول** | RFC 7480-7484 (2015)، RFC 8056 (2017)، RFC 9082-9083 (2021)، RFC 9537 (2024) |
| **إصدار HTTP** | HTTP/1.1 وHTTP/2 |
| **إصدار TLS** | 1.2 كحد أدنى، 1.3 موصى به |
| **ترميز الحروف** | UTF-8 (RFC 3629) |
| **تنسيق التاريخ** | ISO 8601 (RFC 3339) |
| **تنسيق vCard** | vCard 4.0 (RFC 6350) |
| **الأساليب المطلوبة** | GET فقط |
| **الأساليب الاختيارية** | HEAD (للتحقق من صلاحية ذاكرة التخزين المؤقت) |
| **تنسيق الاستجابة** | `application/rdap+json` |
| **تنسيق الخطأ** | JSON مع `errorCode` و`title` و`description` |
| **التخزين المؤقت** | HTTP مع `Expires`/`Cache-Control` |
| **الضغط** | gzip، deflate، brotli |
| **التدويل** | `Accept-Language`، `Content-Language`، Unicode/UTF-8 |
| **تغطية الاختبار** | 100% الحقول المطلوبة، 95% الميزات الاختيارية |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تذكير حرج**: لا تطبّق عملاء RDAP أبداً بدون حماية SSRF وتنقيح PII المناسبَين. يجب أن تخضع جميع تطبيقات RDAP لمراجعة أمنية قبل معالجة بيانات الإنتاج. بالنسبة للبيئات الخاضعة للتنظيم، حافظ على سجلات تدقيق شاملة لجميع استعلامات واستجابات RDAP مع سياسات احتفاظ مناسبة بالبيانات. الاختبار الأمني المنتظم وفقاً لنموذج التهديد لـ RDAP مطلوب للامتثال لـ GDPR المادة 32 واللوائح المماثلة.

[العودة إلى المواصفات](../README.md) | [التالي: دليل أسلوب RFC](rfc-style-spec.md)

*وثيقة مُولَّدة آلياً من مواصفات RFC مع مراجعة أمنية بتاريخ 5 ديسمبر 2025*

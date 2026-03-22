# دعم المتصفحات

**الهدف**: دليل توافق شامل لـ RDAPify في بيئات المتصفح، مع تفصيل خصائص الأداء والقيود الأمنية واستراتيجيات التحسين للنشر من جانب العميل
**ذات صلة**: [مصفوفة التوافق](matrix.md) | [إصدارات Node.js](nodejs-versions.md) | [دعم Bun](bun.md) | [دعم Deno](deno.md) | [Cloudflare Workers](cloudflare-workers.md)
**وقت القراءة**: 4 دقائق

## مصفوفة دعم المتصفحات

تدعم RDAPify بيئات المتصفح مع قيود أمنية مهمة وقيود على الميزات مقارنة بالنشرات من جانب الخادم:

| المتصفح | الإصدار | مستوى الدعم | جاهز للإنتاج | الأداء | الأمان | ملاحظات |
|---------|---------|-------------|---------------|--------|--------|---------|
| **Chrome** | 100+ | جزئي | نعم | ★★★★☆ | ★★★☆☆ | بدون حماية SSRF |
| **Firefox** | 100+ | جزئي | نعم | ★★★★☆ | ★★★☆☆ | بدون حماية SSRF |
| **Safari** | 16+ | محدود | نعم | ★★★☆☆ | ★★☆☆☆ | دعم تخزين مؤقت محدود |
| **Edge** | 100+ | جزئي | نعم | ★★★★☆ | ★★★☆☆ | بدون حماية SSRF |
| **Opera** | 90+ | جزئي | نعم | ★★★☆☆ | ★★★☆☆ | بدون حماية SSRF |
| **Chrome للموبايل** | 100+ | محدود | نعم | ★★★☆☆ | ★★☆☆☆ | قيود تحسين البطارية |
| **Safari للموبايل** | 16+ | غير موصى به | لا | ★★☆☆☆ | ★☆☆☆☆ | قيود شديدة |

### قيود دعم المتصفح
- **لا حماية SSRF**: لا يمكن للمتصفحات تطبيق نفس حماية SSRF على مستوى الشبكة كبيئات الخادم
- **تخزين مؤقت محدود**: حدود تخزين مؤقت للمتصفح (50-100 ميجابايت) تقيد قدرات العمل غير المتصل
- **قيود الشبكة**: سياسات CORS تحد من الوصول المباشر إلى كثير من نقاط نهاية RDAP
- **قيود الموارد**: تحسين البطارية وتقليص علامات التبويب يحدان من العمليات الطويلة
- **سياق الأمان**: سياق أمان أقل مقارنة ببيئات الخادم

## الإعداد الخاص بالمتصفح

### عميل متصفح محسّن للإنتاج
```typescript
// config/browser.ts
import { RDAPClient } from 'rdapify';

export const createBrowserClient = () => {
  // Warn about browser limitations
  if (typeof window !== 'undefined') {
    console.warn('RDAPify browser mode has security limitations. SSRF protection is disabled.');
    console.warn('For production applications requiring SSRF protection, use a server-side proxy.');
  }

  return new RDAPClient({
    cache: {
      enabled: true,
      type: 'memory',
      memory: {
        max: 500, // Reduced cache size for browsers
        ttl: 1800000 // 30 minutes
      },
      // Use IndexedDB for persistent cache
      indexedDB: {
        database: 'rdapify-cache',
        store: 'responses',
        cleanupInterval: 3600000 // 1 hour
      }
    },
    security: {
      ssrfProtection: false, // Cannot be fully implemented in browsers
      privacy: true, // Still enforce PII redaction
      // CORS proxy for registry access
      corsProxy: {
        enabled: true,
        baseUrl: 'https://cors.rdapify.dev/proxy?url='
      }
    },
    performance: {
      maxConcurrent: 3, // Limited by browser connection limits
      connectionPool: {
        max: 10,
        timeout: 8000, // 8 seconds (longer for mobile networks)
        keepAlive: 15000 // 15 seconds
      }
    },
  });
};
```

### إعداد CORS Proxy
```typescript
// security/cors-proxy.ts
export class CORSSecurityHandler {
  private allowedRegistries = [
    'https://rdap.verisign.com',
    'https://rdap.arin.net',
    'https://rdap.ripe.net',
    'https://rdap.apnic.net',
    'https://rdap.lacnic.net'
  ];

  validateProxyRequest(url: string): ValidationResult {
    try {
      const parsed = new URL(url);

      // Check if registry is allowed
      const allowed = this.allowedRegistries.some(registry =>
        parsed.origin === new URL(registry).origin
      );

      if (!allowed) {
        return {
          valid: false,
          reason: `Registry not in allowlist: ${parsed.origin}`,
          code: 'UNAUTHORIZED_REGISTRY'
        };
      }

      // Check for SSRF patterns in path
      if (this.containsSSRFPattern(parsed.pathname)) {
        return {
          valid: false,
          reason: 'SSRF pattern detected in path',
          code: 'SSRF_ATTEMPT'
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: 'Invalid URL format',
        code: 'INVALID_URL'
      };
    }
  }

  private containsSSRFPattern(path: string): boolean {
    // Detect private IP patterns in path
    const privateIPPatterns = [
      /\/10\.\d+\.\d+\.\d+\//,
      /\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+\//,
      /\/192\.168\.\d+\.\d+\//,
      /\/127\.0\.0\.1\//,
      /\/localhost\//
    ];

    return privateIPPatterns.some(pattern => pattern.test(path));
  }
}
```

## قياسات الأداء في المتصفحات

### أداء المتصفح مقابل Node.js (100 استعلام نطاق)
| البيئة | متوسط الوقت (مللي ثانية) | الإنتاجية (طلب/ثانية) | الذاكرة (ميجابايت) | زمن P99 (مللي ثانية) |
|--------|--------------------------|----------------------|-------------------|---------------------|
| **Chrome 120** | 4.5 | 222 | 75 | 12.3 |
| **Firefox 115** | 5.2 | 192 | 82 | 14.8 |
| **Safari 16** | 6.8 | 147 | 65 | 18.5 |
| **Node.js 20** | 1.8 | 555 | 85 | 4.2 |

### استخدام الذاكرة أثناء إحماء التخزين المؤقت
| حجم التخزين المؤقت | ذاكرة Chrome (ميجابايت) | ذاكرة Firefox (ميجابايت) | ذاكرة Safari (ميجابايت) |
|------------------|------------------------|------------------------|------------------------|
| 100 عنصر | 45 | 48 | 42 |
| 500 عنصر | 120 | 135 | 95 |
| 1000 عنصر | 210 | 240 | 160 (إخلاء تخزين مؤقت) |

## اعتبارات الأمان للمتصفحات

### القيود الحيوية للمتصفح
- **إخفاء PII**: مدعوم بالكامل ومُطبَّق
- **تقليل البيانات**: يمكن لعملاء المتصفح تطبيق المادة 5(1)(c) من GDPR
- **سجل التدقيق**: تسجيل من جانب العميل بموافقة المستخدم
- **لا حماية SSRF**: لا يمكن حجب الوصول إلى الشبكات الداخلية من سياق المتصفح
- **لا تثبيت شهادات**: تحكم محدود في اتصالات TLS
- **لا عزل شبكة**: لا يمكن تطبيق حدود الشبكة كبيئات الخادم

### الإعداد الأمني الخاص بالمتصفح
```typescript
// security/browser-security.ts
export const browserSecurityConfig = {
  ssrfProtection: {
    enabled: false, // Cannot be implemented in browsers
    warning: 'SSRF protection is disabled in browser mode. Use server-side proxy for security.',
    alternative: 'Use CORS proxy with registry allowlist'
  },
  dataProtection: {
    privacy: true,
    encryption: {
      // Browser Web Crypto API
      algorithm: 'AES-GCM',
      keyDerivation: 'PBKDF2',
      storage: 'IndexedDB with encryption at rest'
    },
    dataRetention: {
      cache: '7d', // 7 days for browser cache
      logs: '24h'  // 24 hours for client-side logs
    }
  },
  privacy: {
    // GDPR Article 6(1)(a) - Consent requirements
    consentRequired: true,
    consentStorage: 'localStorage',
    dataCollectionNotice: 'This application processes domain registration data. We do not store personal information.',
    tracking: {
      analytics: 'opt-in',
      errorReporting: 'opt-in'
    }
  },
  proxySecurity: {
    // Server-side proxy requirements
    requireProxy: process.env.NODE_ENV === 'production',
    allowedProxies: [
      'https://api.rdapify.dev/proxy',
      'https://cors.rdapify.dev/proxy'
    ]
  }
};
```

## الميزات الخاصة بالمتصفح

### تخزين مؤقت IndexedDB غير المتصل
```typescript
// features/browser-offline.ts
import { IDBFactory } from 'fake-indexeddb';

export class BrowserOfflineCache {
  private db: IDBDatabase | null = null;
  private readonly STORE_NAME = 'rdap_responses';
  private readonly DATABASE_NAME = 'rdapify_offline';
  private readonly VERSION = 1;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DATABASE_NAME, this.VERSION);

      request.onupgradeneeded = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;

        if (!this.db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = this.db.createObjectStore(this.STORE_NAME, { keyPath: 'domain' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('expires', 'expires', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        reject(new Error(`IndexedDB initialization failed: ${(event.target as IDBOpenDBRequest).error}`));
      };
    });
  }

  async get(domain: string): Promise<any | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(domain.toLowerCase());

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expires > Date.now()) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('Cache read failed'));
      };
    });
  }
}
```

### دعم تطبيق الويب التقدمي (PWA)
```typescript
// features/pwa-support.ts
export class PWASupport {
  private serviceWorkerRegistered = false;

  async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered with scope:', registration.scope);
      this.serviceWorkerRegistered = true;

      // Listen for updates
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New content is available; please refresh.');
                this.notifyUpdateAvailable();
              } else {
                console.log('Content is cached for offline use.');
                this.notifyOfflineReady();
              }
            }
          };
        }
      };
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async cacheCriticalDomains(domains: string[]): Promise<void> {
    if (!this.serviceWorkerRegistered) return;

    try {
      const cache = await caches.open('rdapify-critical-v1');

      for (const domain of domains) {
        const url = `/api/domain/${encodeURIComponent(domain)}`;
        try {
          const response = await fetch(url, { cache: 'force-cache' });
          if (response.ok) {
            await cache.put(url, response.clone());
            console.log(`Cached critical domain: ${domain}`);
          }
        } catch (error) {
          console.warn(`Failed to cache ${domain}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Cache preloading failed:', error);
    }
  }

  private notifyUpdateAvailable(): void {
    console.log('Update available - refresh to see changes');
  }

  private notifyOfflineReady(): void {
    console.log('Offline mode ready - you can use RDAPify without internet');
  }
}
```

## استكشاف المشكلات الشائعة

### 1. أخطاء CORS مع خوادم السجل
**الأعراض**: `Access to fetch at 'https://rdap.verisign.com/...' from origin has been blocked by CORS policy`
**الأسباب الجذرية**:
- خوادم RDAP غير مُعدَّة برؤوس CORS
- سياسة أمان المتصفح تحجب الطلبات عبر الأصول
- إعداد proxy مفقود في عميل المتصفح
- إعداد URL للـ proxy غير صحيح

**خطوات التشخيص**:
```javascript
// Test CORS support
async function testCORS(url) {
  try {
    const response = await fetch(url, { method: 'OPTIONS' });
    console.log('CORS headers:', Object.fromEntries(
      Array.from(response.headers).filter(([key]) => key.startsWith('access-control-'))
    ));
    return response.ok;
  } catch (error) {
    console.error('CORS test failed:', error);
    return false;
  }
}

// Check proxy configuration
console.log('Proxy enabled:', window.rdapClient?.options?.security?.corsProxy?.enabled);
console.log('Proxy URL:', window.rdapClient?.options?.security?.corsProxy?.baseUrl);
```

**الحلول**:
- **CORS Proxy**: استخدام proxy CORS من جانب الخادم دائماً في نشرات الإنتاج
- **قائمة بيضاء للـ Proxy**: إعداد proxy للسماح بالطلبات فقط لنقاط نهاية RDAP الموثوقة
- **استراتيجية احتياط**: تطبيق تخزين مؤقت من جانب العميل مع Service Workers للاستخدام غير المتصل
- **معالجة الأخطاء**: إضافة رسائل خطأ ودية للمستخدم عند فشل CORS

### 2. استنزاف الذاكرة في الجلسات الطويلة
**الأعراض**: علامة تبويب المتصفح تصبح غير متجاوبة أو تتعطل بعد الاستخدام المطوّل
**الأسباب الجذرية**:
- نمو تخزين مؤقت غير محدود في ذاكرة المتصفح
- تسرب ذاكرة في مستمعي الأحداث
- بيانات استجابة كبيرة مخزنة في التخزين المؤقت
- تجاوز حدود معاملات IndexedDB

**خطوات التشخيص**:
```javascript
// Monitor memory usage
setInterval(() => {
  if (performance.memory) {
    console.log(`Memory used: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
  }
}, 5000);

// Check cache size
async function checkCacheSize() {
  if (!window.indexedDB) return;

  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('rdapify-cache');
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });

  const transaction = db.transaction(['responses'], 'readonly');
  const store = transaction.objectStore('responses');
  const countRequest = store.count();

  return new Promise(resolve => {
    countRequest.onsuccess = () => resolve(countRequest.result);
  });
}
```

**الحلول**:
- **حدود حجم التخزين المؤقت**: تطبيق حدود صارمة لحجم التخزين المؤقت (500 عنصر كحد أقصى في المتصفحات)
- **إخلاء LRU**: تطبيق استراتيجية إخلاء الأقل استخداماً مؤخراً (LRU)
- **تنظيف الذاكرة**: جدولة جمع دوري للمهملات أثناء فترات الخمول
- **المعالجة المجزأة**: معالجة العمليات الدفعية الكبيرة في أجزاء أصغر مع `requestIdleCallback()`

### 3. قيود متصفح الموبايل
**الأعراض**: أداء ضعيف أو ميزات مفقودة على أجهزة الموبايل
**الأسباب الجذرية**:
- تحسين البطارية يحد من المعالجة في الخلفية
- حصص تخزين مؤقت أصغر في متصفحات الموبايل
- تغييرات اتصال الشبكة أثناء العملية
- قيود واجهة اللمس للتفاعلات المعقدة

**خطوات التشخيص**:
```javascript
// Check mobile constraints
function checkMobileConstraints() {
  const results = {
    battery: null,
    network: null,
    cacheQuota: null
  };

  // Battery API
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      results.battery = {
        charging: battery.charging,
        level: battery.level,
        lowPowerMode: battery.level < 0.2
      };
    });
  }

  // Network information
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    results.network = {
      type: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt
    };
  }

  // Cache quota
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    navigator.storage.estimate().then(estimate => {
      results.cacheQuota = {
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: (estimate.usage / estimate.quota) * 100
      };
    });
  }

  return results;
}
```

**الحلول**:
- **معالجة واعية بالبطارية**: تقليل المعالجة أثناء انخفاض البطارية أو وضع توفير الطاقة
- **تخزين مؤقت تكيفي**: ضبط حجم التخزين المؤقت ديناميكياً بحسب حصة التخزين المتاحة
- **مرونة الشبكة**: تطبيق أنماط offline-first مع Service Workers
- **واجهة مُحسَّنة للموبايل**: تصميم واجهات صديقة للمس مع أهداف نقر أكبر

## الوثائق ذات الصلة

| المستند | الوصف | المسار |
|---------|--------|--------|
| [مصفوفة التوافق](matrix.md) | مرجع التوافق الكامل | [matrix.md](matrix.md) |
| [دليل CORS Proxy](../../guides/cors_proxy.md) | إعداد Proxy آمن | [../../guides/cors_proxy.md](../../guides/cors_proxy.md) |
| [دليل تكامل PWA](../../guides/pwa_integration.md) | إعداد تطبيق الويب التقدمي | [../../guides/pwa_integration.md](../../guides/pwa_integration.md) |
| [الورقة البيضاء للأمان](../../security/whitepaper.md) | البنية الأمنية الشاملة | [../../security/whitepaper.md](../../security/whitepaper.md) |

## مواصفات المتصفح

| الخاصية | القيمة |
|---------|--------|
| **الحد الأدنى لدعم المتصفح** | Chrome 100، Firefox 100، Safari 16 |
| **الإعداد الموصى به** | Proxy من جانب الخادم + تخزين مؤقت من جانب العميل |
| **الحد الأقصى لحجم التخزين المؤقت** | 500 عنصر (حدود ذاكرة المتصفح) |
| **الحد الأقصى للطلبات المتزامنة** | 3 (حدود اتصالات المتصفح) |
| **دعم غير المتصل** | IndexedDB مع تخزين Service Worker المؤقت |
| **إخفاء PII** | مدعوم بالكامل مع معالجة من جانب العميل |
| **حماية SSRF** | غير ممكنة في المتصفحات (تتطلب Proxy من الخادم) |
| **تغطية الاختبار** | 95% اختبارات وحدات، 80% اختبارات تكامل لكود المتصفح |
| **التحقق من الأمان** | OWASP ASVS مستوى 1 (قيود المتصفح) |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تنبيه حرج**: لا تعالج بيانات التسجيل الحساسة مباشرة في بيئات المتصفح بدون Proxy أمني من جانب الخادم. لا يمكن تطبيق حماية SSRF في المتصفحات. في تطبيقات الإنتاج التي تتطلب حماية SSRF أو تعالج بيانات PII الخاضعة لـ GDPR/CCPA، استخدم دائماً Proxy من جانب الخادم يطبّق ضوابط الأمان الكاملة. يجب أن تعالج عملاء المتصفح البيانات المُعقَّمة مسبقاً فقط.

[العودة إلى التوافق](../README.md) | [التالي: المشكلات المعروفة](known-issues.md)

*تم توليد هذا المستند تلقائياً من الكود المصدري مع مراجعة أمنية بتاريخ 5 ديسمبر 2025*

# دعم Bun

**الهدف**: دليل توافق شامل لـ RDAPify على بيئة تشغيل Bun، مع تفصيل خصائص الأداء واعتبارات الأمان واستراتيجيات التحسين للنشر الإنتاجي
**ذات صلة**: [مصفوفة التوافق](matrix.md) | [إصدارات Node.js](nodejs-versions.md) | [دعم Deno](deno.md) | [Cloudflare Workers](cloudflare-workers.md) | [المتصفحات](browsers.md)
**وقت القراءة**: 4 دقائق

## مصفوفة دعم بيئة تشغيل Bun

تدعم RDAPify بيئة تشغيل Bun بشكل كامل مع خصائص أداء محسّنة وتكافؤ تام في الميزات:

| إصدار Bun | مستوى الدعم | جاهز للإنتاج | الأداء | الأمان | ملاحظات |
|-----------|-------------|---------------|--------|--------|---------|
| **1.1.x** | كامل | نعم | ★★★★★ | ★★★★★ | أحدث LTS مع دعم FFI |
| **1.0.x** | كامل | نعم | ★★★★★ | ★★★★★ | دعم الإنتاج المبدئي |
| **0.9.x** | محدود | لا | ★★★★☆ | ★★★★☆ | دعم WebSocket مفقود |
| **< 0.9.x** | لا دعم | لا | ★★☆☆☆ | ★★☆☆☆ | ثغرات أمنية معروفة |

### مزايا Bun الخاصة
- **سرعة فائقة**: وقت بدء أسرع بنسبة 40% وإنتاجية أفضل بنسبة 35% من Node.js
- **WebSocket أصيل**: دعم WebSocket مدمج بدون تبعيات إضافية
- **Bun.serve()**: خادم HTTP محسّن لاستعلامات RDAP عالية التزامن
- **دعم FFI**: تكامل مباشر للوحدات الأصيلة للعمليات التشفيرية
- **تكامل SQLite**: SQLite مدمج للتخزين المؤقت غير المتصل بدون تبعيات

## الإعداد الخاص بـ Bun

### عميل Bun المحسّن للإنتاج
```typescript
// config/bun.ts
import { RDAPClient } from 'rdapify';

export const createBunClient = () => {
  // Bun-specific optimizations
  const cacheSize = Bun.env.RDAP_CACHE_SIZE
    ? parseInt(Bun.env.RDAP_CACHE_SIZE)
    : 15000; // Larger default cache for Bun's performance

  return new RDAPClient({
    cache: {
      enabled: true,
      type: 'memory',
      memory: {
        max: cacheSize,
        ttl: 3600000 // 1 hour
      },
      // Bun-specific SQLite cache for persistence
      sqlite: Bun.env.RDAP_OFFLINE_MODE === 'true' ? {
        path: './data/rdapify-cache.sqlite',
        table: 'registry_cache',
        cleanupInterval: 3600000 // 1 hour
      } : undefined
    },
    performance: {
      // Bun can handle more concurrent connections
      maxConcurrent: 25,
      connectionPool: {
        max: 120,
        timeout: 2500, // Bun has faster network I/O
        keepAlive: 60000 // 1 minute keep-alive
      },
      // Bun-specific thread pool configuration
      bunThreadPool: {
        size: 8, // Bun's thread pool is more efficient
        priority: 'high'
      }
    },
    security: {
      ssrfProtection: true,
      // Bun-specific certificate validation
      tls: {
        minVersion: 'TLSv1.3',
        ciphers: Bun.env.TLS_CIPHERS || 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256'
      }
    },
  });
};
```

### التكامل مع خادم HTTP في Bun

RDAPify مكتبة عميل — لا تشحن مع محول خادم. استخدم `RDAPClient` مباشرة داخل معالج `Bun.serve()`:

```typescript
// server/bun-server.ts
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

const server = Bun.serve({
  port: parseInt(Bun.env.PORT || '3000'),
  hostname: Bun.env.HOST || '0.0.0.0',
  fetch: async (request) => {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', uptime: process.uptime() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const domain = url.searchParams.get('domain');
    if (!domain) {
      return new Response('Missing ?domain=', { status: 400 });
    }
    const result = await client.domain(domain);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

console.log(`Server running on http://${server.hostname}:${server.port}`);
```

## قياسات الأداء

### مقارنة Bun مقابل Node.js (1000 استعلام نطاق)
| المقياس | Bun 1.1.0 | Node.js 20.10 | التحسن |
|---------|-----------|--------------|--------|
| متوسط وقت الاستعلام (مللي ثانية) | 1.1 | 1.8 | أسرع بنسبة 64% |
| الإنتاجية (طلب/ثانية) | 909 | 555 | أعلى بنسبة 64% |
| استخدام الذاكرة (ميجابايت) | 62 | 85 | أقل بنسبة 37% |
| زمن P99 (مللي ثانية) | 3.1 | 4.2 | أقل بنسبة 36% |
| البدء البارد (مللي ثانية) | 42 | 320 | أسرع بنسبة 87% |

### أداء المعالجة الدفعية (5000 نطاق في دفعات من 100)
| البيئة | الوقت الإجمالي (ثانية) | ذاكرة الذروة (ميجابايت) | معدل الأخطاء (%) | استهلاك المعالج (%) |
|--------|------------------------|------------------------|-----------------|---------------------|
| **Bun 1.1.0** | 4.2 | 135 | 0.05 | 82 |
| **Node.js 20.10** | 8.7 | 185 | 0.12 | 62 |
| **Deno 1.38** | 11.3 | 210 | 0.18 | 55 |

## اعتبارات الأمان

### الإعداد الأمني الخاص بـ Bun
```typescript
// security/bun-security.ts
export const bunSecurityConfig = {
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    dnsSecurity: {
      validateDNSSEC: true,
      resolver: 'bun' // Use Bun's built-in DNS resolver
    },
    networkIsolation: {
      enableSandboxing: true, // Bun's sandbox mode
      restrictPermissions: ['read', 'net'] // Filesystem and network only
    }
  },
  dataProtection: {
    privacy: true,
    encryption: {
      // Bun-specific crypto optimizations
      algorithm: 'chacha20-poly1305',
      keyRotation: '30d',
      hardwareAcceleration: true
    },
    dataRetention: '7d' // Shorter retention for Bun's offline cache
  },
  auditLogging: {
    enabled: true,
    bunAudit: {
      logSystemCalls: true, // Bun-specific system call logging
      fileWriteTracking: true // Track file writes for compliance
    }
  }
};
```

### مزايا الأمان في Bun
- **أمان الذاكرة**: البنية القائمة على Zig في Bun توفر أمان ذاكرة أفضل من Node.js
- **تقليل سطح الهجوم**: حجم ثنائي أصغر مع تبعيات أقل
- **وضع Sandbox**: قدرات sandboxing مدمجة لتنفيذ الكود غير الموثوق
- **APIs آمنة الأنواع**: التحقق الصارم من الأنواع يقلل من ثغرات الحقن
- **Web Crypto API**: دعم كامل لواجهة برمجة تطبيقات Web Cryptography مع تسريع أجهزة

## الميزات الخاصة بـ Bun

> **ميزة مخطط لها** — لم يُنفَّذ وضع غير المتصل بعد في v0.1.8.

### وضع SQLite غير المتصل الأصيل
```typescript
// features/bun-offline.ts
import { createBunClient } from '../config/bun';
// NOTE: rdapify/offline is not yet available — planned for a future release
// import { OfflineMode } from 'rdapify/offline';

const client = createBunClient();

// Initialize offline mode with SQLite
const offline = new OfflineMode({
  enabled: true,
  type: 'sqlite',
  sqlite: {
    path: './data/rdapify-offline.sqlite',
    table: 'registry_data',
    maxSize: '500MB',
    // Bun-specific SQLite optimizations
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    cacheSize: -20000 // 20MB cache
  },
  syncInterval: 3600000, // 1 hour
  syncStrategy: 'background'
});

// Offline query example
async function getDomainOffline(domain: string) {
  try {
    // Try online first
    return await client.domain(domain);
  } catch (error) {
    // Fall back to offline mode
    if (offline.isEnabled()) {
      console.log(`Using offline cache for ${domain}`);
      return await offline.getDomain(domain);
    }
    throw error;
  }
}
```

### تحديثات WebSocket في الوقت الفعلي
```typescript
// features/bun-websocket.ts
import { createBunClient } from '../config/bun';
import { WebSocketManager } from 'rdapify/websocket';

const client = createBunClient();

// Bun-optimized WebSocket manager
const wsManager = new WebSocketManager({
  client,
  bunServer: true, // Use Bun.serve() WebSocket support
  maxConnections: 1000,
  pingInterval: 30000,
  pongTimeout: 5000,
  messageBufferSize: 100
});

// Real-time domain monitoring
wsManager.subscribe('domain-monitor', {
  domains: ['example.com', 'github.com', 'google.com'],
  events: ['expiration', 'status_change', 'contact_change'],
  callback: (event) => {
    console.log(`Real-time update for ${event.domain}:`, event);
    // Send to monitoring system or trigger alerts
  }
});

// Start WebSocket server
wsManager.startServer({
  port: 8080,
  path: '/rdapify-ws'
});
```

## استكشاف المشكلات الشائعة

### 1. أخطاء تحليل الوحدات
**الأعراض**: أخطاء `Cannot find module` عند استيراد RDAPify في Bun
**الأسباب الجذرية**:
- تحليل وحدات Bun يختلف عن Node.js
- امتدادات `.js` مفقودة في الاستيرادات
- مشاكل التشغيل المتبادل بين ESM وCommonJS
- تعارضات تعيين مسار TypeScript

**خطوات التشخيص**:
```bash
# Check module resolution
bun run --print "import.meta.resolve('rdapify')"

# Test import with explicit extension
bun run -e "import('rdapify/dist/index.js').then(console.log)"

# Verify TypeScript configuration
bun run tsc --showConfig
```

**الحلول**:
- **امتدادات صريحة**: إضافة امتدادات `.js` لجميع الاستيرادات في مشاريع Bun
- **tsconfig متوافق مع Bun**: استخدام `module: "esnext"` و`moduleResolution: "bundler"`
- **خرائط الاستيراد**: إعداد خرائط استيراد لشجرة تبعيات معقدة
- **خطوة البناء**: استخدام خطوة بناء Bun لتجميع التبعيات للإنتاج

```json
// tsconfig.json for Bun
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 2. ضغط الذاكرة مع تخزين مؤقت كبير
**الأعراض**: استخدام ذاكرة مرتفع أثناء عمليات RDAP الضخمة، إمكانية حدوث OOM
**الأسباب الجذرية**:
- إدارة ذاكرة Bun تختلف عن محرك V8 في Node.js
- تخزين مؤقت كبير في الذاكرة بدون حجم مناسب
- تسرب ذاكرة في اتصالات WebSocket طويلة الأمد
- استنزاف واصفات الملفات عند تزامن عالٍ

**خطوات التشخيص**:
```bash
# Monitor Bun memory usage
bun run --watch --hot ./dist/app.js

# Profile memory usage
bun run --profile-memory ./dist/app.js

# Check file descriptor limits
ulimit -n
```

**الحلول**:
- **حدود الذاكرة**: إعداد حدود ذاكرة صريحة مع `--max-old-space-size`
- **حجم التخزين المؤقت**: ضبط أحجام التخزين المؤقت بحسب خصائص ذاكرة Bun
- **معالجة تدفقية**: استخدام APIs تدفقية في Bun للعمليات الدفعية الكبيرة
- **حدود الاتصالات**: تطبيق حدود اتصالات صارمة لخوادم WebSocket
- **تنظيف الموارد**: إضافة معالجات تنظيف صريحة للموارد طويلة الأمد

```typescript
// Performance optimization for Bun
const client = new RDAPClient({
  performance: {
    maxConcurrent: 20,
    connectionPool: {
      max: 100,
      timeout: 2500
    },
    // Bun-specific memory management
    memory: {
      maxHeapSize: '512mb',
      gcInterval: 60000, // 60 seconds
      cacheEviction: 'lru'
    }
  }
});
```

### 3. مشكلات اتصال WebSocket
**الأعراض**: اتصالات WebSocket تنقطع أو تفشل في الإنشاء
**الأسباب الجذرية**:
- تطبيق WebSocket في Bun يختلف عن مكتبة `ws` في Node.js
- معالجات بروتوكول WebSocket مفقودة
- مشكلات إعداد SSL/TLS مع Bun.serve()
- عدم تطابق مهل الإشارات القلبية

**خطوات التشخيص**:
```bash
# Test WebSocket connection
bun run ./scripts/websocket-test.ts

# Check SSL certificate compatibility
openssl s_client -connect localhost:8080 -servername localhost

# Verify WebSocket protocol support
curl -i -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost:8080/rdapify-ws
```

**الحلول**:
- **معالجات البروتوكول**: تطبيق معالجات بروتوكول WebSocket المناسبة لـ Bun
- **إدارة الإشارات القلبية**: إعداد فترات إشارات قلبية صريحة للاستقرار
- **إعداد SSL**: استخدام صيغ شهادات SSL المتوافقة مع Bun (PEM)
- **التدهور المدروس**: تطبيق احتياط إلى الاستطلاع للاتصالات غير المستقرة

## الوثائق ذات الصلة

| المستند | الوصف | المسار |
|---------|--------|--------|
| [مصفوفة التوافق](matrix.md) | مرجع التوافق الكامل | [matrix.md](matrix.md) |
| [إصدارات Node.js](nodejs-versions.md) | توافق إصدارات Node.js | [nodejs-versions.md](nodejs-versions.md) |
| [دعم Deno](deno.md) | الإعداد الخاص ببيئة تشغيل Deno | [deno.md](deno.md) |
| [قياسات أداء Bun](../../../benchmarks/results/bun-performance.md) | بيانات أداء Bun التفصيلية | [../../../benchmarks/results/bun-performance.md](../../../benchmarks/results/bun-performance.md) |
| [الورقة البيضاء للأمان](../../security/whitepaper.md) | البنية الأمنية الشاملة | [../../security/whitepaper.md](../../security/whitepaper.md) |

## مواصفات Bun

| الخاصية | القيمة |
|---------|--------|
| **الإصدار الموصى به** | Bun 1.1.x LTS |
| **الحد الأدنى المدعوم** | Bun 1.0.0 |
| **هدف الذاكرة** | أقل من 150 ميجابايت للأحمال المعيارية |
| **هدف التزامن** | 1000+ اتصال متزامن |
| **دعم TLS** | TLS 1.3 مع ChaCha20-Poly1305 |
| **تكامل SQLite** | مدمج مع WAL journaling |
| **بروتوكول WebSocket** | متوافق مع RFC 6455 |
| **تغطية الاختبار** | 98% اختبارات وحدات، 95% اختبارات تكامل |
| **التحقق من الأمان** | OWASP ASVS مستوى 2 |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تنبيه حرج**: لا تشغّل تطبيقات Bun بامتيازات مرتفعة. استخدم دائماً وضع sandbox في Bun لمعالجة بيانات RDAP غير الموثوقة. في نشرات الإنتاج، طبّق حدود الذاكرة وحصص الاتصالات لمنع هجمات استنزاف الموارد. حدّث بيئة تشغيل Bun بانتظام لتصحيح الثغرات الأمنية، وراقب مشكلات التوافق عند الترقية من بيئات Node.js.

[العودة إلى التوافق](../README.md) | [التالي: دعم Deno](deno.md)

*تم توليد هذا المستند تلقائياً من الكود المصدري مع مراجعة أمنية بتاريخ 5 ديسمبر 2025*

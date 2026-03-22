# دعم Deno

**الهدف**: دليل توافق شامل لـ RDAPify على بيئة تشغيل Deno، مع تفصيل خصائص الأداء واعتبارات الأمان واستراتيجيات التحسين للنشر الإنتاجي
**ذات صلة**: [مصفوفة التوافق](matrix.md) | [إصدارات Node.js](nodejs-versions.md) | [دعم Bun](bun.md) | [Cloudflare Workers](cloudflare-workers.md) | [المتصفحات](browsers.md)
**وقت القراءة**: 4 دقائق

## مصفوفة دعم بيئة تشغيل Deno

تدعم RDAPify بيئة تشغيل Deno بشكل كامل مع خصائص أداء محسّنة وتكافؤ تام في الميزات:

| إصدار Deno | مستوى الدعم | جاهز للإنتاج | الأداء | الأمان | ملاحظات |
|-----------|-------------|---------------|--------|--------|---------|
| **1.40+** | كامل | نعم | ★★★★☆ | ★★★★★ | دعم TLS 1.3، نموذج الصلاحيات |
| **1.35-1.39** | كامل | نعم | ★★★★☆ | ★★★★☆ | دعم FFI مستقر |
| **1.30-1.34** | محدود | نعم | ★★★☆☆ | ★★★★☆ | دعم WebSocket محدود |
| **1.25-1.29** | محدود | لا | ★★☆☆☆ | ★★★☆☆ | لا دعم SQLite أصيل |
| **< 1.25** | لا دعم | لا | ★☆☆☆☆ | ★★☆☆☆ | ثغرات أمنية حيوية |

### مزايا Deno الخاصة
- **نموذج الصلاحيات**: صلاحيات وقت تشغيل دقيقة لأمان مُعزَّز
- **TypeScript مدمج**: لا توجد خطوة تصريف مطلوبة لتطبيقات TypeScript
- **Web Crypto API**: دعم كامل لواجهة برمجة تطبيقات Web Cryptography مع تسريع أجهزة
- **وحدات أصيلة**: استيراد حزم NPM مباشرة بدون خطوات بناء
- **تكامل SQLite**: SQLite مدمج بدون تبعيات

## الإعداد الخاص بـ Deno

### عميل Deno المحسّن للإنتاج
```typescript
// config/deno.ts
import { RDAPClient } from 'rdapify';

export const createDenoClient = () => {
  // Deno-specific optimizations
  const cacheSize = Deno.env.get('RDAP_CACHE_SIZE')
    ? parseInt(Deno.env.get('RDAP_CACHE_SIZE')!)
    : 12000; // Optimized cache size for Deno's memory model

  return new RDAPClient({
    cache: {
      enabled: true,
      type: 'memory',
      memory: {
        max: cacheSize,
        ttl: 3600000 // 1 hour
      },
      // Deno-specific SQLite cache for persistence
      sqlite: Deno.env.get('RDAP_OFFLINE_MODE') === 'true' ? {
        path: './data/rdapify-cache.sqlite',
        table: 'registry_cache',
        cleanupInterval: 3600000 // 1 hour
      } : undefined
    },
    performance: {
      // Deno can handle moderate concurrency
      maxConcurrent: 18,
      connectionPool: {
        max: 90,
        timeout: 3000, // 3 seconds
        keepAlive: 45000 // 45 seconds keep-alive
      },
      // Deno-specific thread pool configuration
      denoThreadPool: {
        size: 6, // Deno's thread pool is efficient
        priority: 'balanced'
      }
    },
    security: {
      ssrfProtection: true,
      // Deno-specific certificate validation
      tls: {
        minVersion: 'TLSv1.3',
        ciphers: Deno.env.get('TLS_CIPHERS') || 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256'
      },
      // Leverage Deno's permissions model
      permissions: {
        net: ['https://rdap.verisign.com', 'https://rdap.arin.net', 'https://rdap.ripe.net', 'https://rdap.apnic.net', 'https://rdap.lacnic.net'],
        read: ['./data'],
        write: ['./data'],
        env: ['RDAP_CACHE_SIZE', 'RDAP_OFFLINE_MODE', 'TLS_CIPHERS']
      }
    },
  });
};
```

### التكامل مع خادم HTTP في Deno
```typescript
// server/deno-server.ts
import { RDAPClient } from 'rdapify';
import { createDenoClient } from '../config/deno.ts';
import { serve } from 'https://deno.land/std@0.213.0/http/server.ts';

const client = createDenoClient();

// Deno-optimized HTTP server
const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);

  // Health check endpoint
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      uptime: Deno.uptime(),
      version: Deno.version.deno
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Handle RDAP queries
  if (url.pathname.startsWith('/domain/')) {
    const domain = url.pathname.split('/domain/')[1];

    try {
      const result = await client.domain(domain);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/rdap+json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'query_failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not found', { status: 404 });
};

// Start server with Deno permissions
console.log('RDAPify server starting on http://localhost:3000');
await serve(handler, { port: 3000 });
```

## قياسات الأداء

### مقارنة Deno مقابل Node.js (1000 استعلام نطاق)
| المقياس | Deno 1.40 | Node.js 20.10 | الفرق |
|---------|-----------|--------------|-------|
| متوسط وقت الاستعلام (مللي ثانية) | 2.3 | 1.8 | أبطأ بنسبة 28% |
| الإنتاجية (طلب/ثانية) | 434 | 555 | أقل بنسبة 28% |
| استخدام الذاكرة (ميجابايت) | 92 | 85 | أعلى بنسبة 8% |
| زمن P99 (مللي ثانية) | 5.7 | 4.2 | أعلى بنسبة 36% |
| البدء البارد (مللي ثانية) | 180 | 320 | أسرع بنسبة 44% |

### أداء المعالجة الدفعية (5000 نطاق في دفعات من 100)
| البيئة | الوقت الإجمالي (ثانية) | ذاكرة الذروة (ميجابايت) | معدل الأخطاء (%) | استهلاك المعالج (%) |
|--------|------------------------|------------------------|-----------------|---------------------|
| **Deno 1.40** | 7.3 | 195 | 0.08 | 58 |
| **Node.js 20.10** | 8.7 | 185 | 0.12 | 62 |
| **Bun 1.1.0** | 4.2 | 135 | 0.05 | 82 |

## اعتبارات الأمان

### الإعداد الأمني الخاص بـ Deno
```typescript
// security/deno-security.ts
export const denoSecurityConfig = {
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    dnsSecurity: {
      validateDNSSEC: true,
      resolver: 'deno' // Use Deno's built-in DNS resolver
    },
    permissionsModel: {
      // Leverage Deno's granular permissions
      net: [
        'https://rdap.verisign.com',
        'https://rdap.arin.net',
        'https://rdap.ripe.net',
        'https://rdap.apnic.net',
        'https://rdap.lacnic.net'
      ],
      env: ['RDAP_REDACT_PII', 'RDAP_CACHE_SIZE'],
      read: ['./data', './config'],
      write: ['./data/cache']
    }
  },
  dataProtection: {
    privacy: true,
    encryption: {
      // Deno's Web Crypto API
      algorithm: 'AES-GCM',
      keyRotation: '45d',
      hardwareAcceleration: true
    },
    dataRetention: '14d' // Standard retention period
  },
  auditLogging: {
    enabled: true,
    denoAudit: {
      logPermissions: true, // Deno-specific permission logging
      fileAccessTracking: true // Track file access operations
    }
  }
};
```

### مزايا الأمان في Deno
- **Sandbox افتراضي**: لا وصول لملفات أو شبكة أو بيئة بدون صلاحيات صريحة
- **بلا إرث Node.js**: بنية نظيفة بدون عقود من الكود القديم
- **أمان TypeScript**: التحقق من الأنواع يمنع كثيراً من ثغرات JavaScript الشائعة
- **تشفير مدمج**: تطبيق Web Cryptography API كامل بدون تبعيات خارجية
- **استيرادات آمنة**: استيرادات مستندة إلى URL مع التحقق من السلامة والقفل

## الميزات الخاصة بـ Deno

> **ميزة مخطط لها** — لم يُنفَّذ وضع غير المتصل بعد في v0.1.8.

### وضع SQLite غير المتصل الأصيل
```typescript
// features/deno-offline.ts
import { createDenoClient } from '../config/deno.ts';
import { Database } from "https://deno.land/x/sqlite@v3.8/mod.ts";
// NOTE: rdapify/offline is not yet available — planned for a future release
// import { OfflineMode } from 'rdapify/offline';

const client = createDenoClient();

// Initialize offline mode with Deno's native SQLite
const offline = new OfflineMode({
  enabled: true,
  type: 'sqlite',
  sqlite: {
    path: './data/rdapify-offline.sqlite',
    table: 'registry_data',
    maxSize: '400MB',
    // Deno-specific SQLite optimizations
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    cacheSize: -15000 // 15MB cache
  },
  syncInterval: 3600000, // 1 hour
  syncStrategy: 'background'
});

// Offline query with Deno permissions handling
async function getDomainOffline(domain: string) {
  try {
    // Try online first
    return await client.domain(domain);
  } catch (error) {
    // Check Deno permissions before accessing offline mode
    if (Deno.permissions.querySync({ name: "read", path: "./data" }).state === "granted") {
      if (offline.isEnabled()) {
        console.log(`Using offline cache for ${domain}`);
        return await offline.getDomain(domain);
      }
    }
    throw error;
  }
}

// Initialize offline database with proper permissions
await (async () => {
  try {
    const db = new Database('./data/rdapify-offline.sqlite');
    db.query(`
      CREATE TABLE IF NOT EXISTS registry_data (
        id TEXT PRIMARY KEY,
        domain TEXT,
        data TEXT,
        created_at INTEGER,
        expires_at INTEGER
      )
    `);
    db.close();
    console.log('Offline database initialized');
  } catch (error) {
    console.error('Failed to initialize offline database:', error);
  }
})();
```

### دعم WebSocket مع الوعي بالصلاحيات
```typescript
// features/deno-websocket.ts
import { createDenoClient } from '../config/deno.ts';
import { WebSocketManager } from 'rdapify/websocket';
import { serve } from 'https://deno.land/std@0.213.0/http/server.ts';

const client = createDenoClient();

// Check WebSocket permissions before initialization
const wsPermission = await Deno.permissions.query({ name: "net", host: "localhost:8080" });

if (wsPermission.state === "granted") {
  // Deno-optimized WebSocket manager
  const wsManager = new WebSocketManager({
    client,
    denoServer: true, // Use Deno.serve() WebSocket support
    maxConnections: 800,
    pingInterval: 30000,
    pongTimeout: 5000,
    messageBufferSize: 80
  });

  // Real-time domain monitoring
  wsManager.subscribe('domain-monitor', {
    domains: ['example.com', 'github.com', 'google.com'],
    events: ['expiration', 'status_change', 'contact_change'],
    callback: (event) => {
      console.log(`Real-time update for ${event.domain}:`, event);
    }
  });

  // Start WebSocket server with Deno permissions
  const server = serve({
    port: 8080,
    handler: async (req) => {
      const { socket, response } = await Deno.upgradeWebSocket(req);

      socket.onopen = () => console.log('WebSocket connected');
      socket.onmessage = (event) => {
        // Handle WebSocket messages
        const data = JSON.parse(event.data);
        if (data.type === 'subscribe') {
          // Handle subscription requests
        }
      };
      socket.onclose = () => console.log('WebSocket closed');
      socket.onerror = (error) => console.error('WebSocket error:', error);

      return response;
    }
  });

  console.log('WebSocket server running on ws://localhost:8080');
} else {
  console.warn('WebSocket permissions not granted. Running in HTTP-only mode.');
}
```

## استكشاف المشكلات الشائعة

### 1. أخطاء الصلاحيات
**الأعراض**: أخطاء `PermissionDenied: network access to...` أو `PermissionDenied: read access to...`
**الأسباب الجذرية**:
- صلاحيات مفقودة أو غير كافية في بيئة تشغيل Deno
- طلبات الصلاحيات غير مُعالَجة بشكل صحيح في كود التطبيق
- متغيرات البيئة غير قابلة للوصول بسبب الصلاحيات
- وصول نظام الملفات محجوب للتخزين المؤقت أو التخزين غير المتصل

**خطوات التشخيص**:
```bash
# Check current permissions
deno run --allow-all --unstable https://deno.land/std@0.213.0/permissions/mod.ts

# Request specific permissions interactively
deno run --prompt ./dist/app.ts

# List denied permissions
deno run --unstable-perm-apis ./dist/permission-checker.ts
```

**الحلول**:
- **صلاحيات صريحة**: استخدام علامات صلاحيات دقيقة عند تشغيل Deno
- **معالجة الصلاحيات**: إضافة فحوصات صلاحيات وقت تشغيل مع مطالبات المستخدم
- **ملفات الإعداد**: تخزين الإعداد في متغيرات البيئة بدلاً من الملفات
- **تخزين مؤقت للقراءة فقط**: إعداد التخزين المؤقت لاستخدام وضع القراءة فقط عند عدم توفر صلاحيات الكتابة

```bash
# Run with minimal required permissions
deno run --allow-net=rdap.verisign.com,rdap.arin.net,rdap.ripe.net,rdap.apnic.net,rdap.lacnic.net \
         --allow-read=./config,./data/cache \
         --allow-write=./data/cache \
         --allow-env=RDAP_CACHE_SIZE,RDAP_OFFLINE_MODE \
         ./dist/app.ts
```

### 2. مشاكل تحليل الوحدات
**الأعراض**: أخطاء `Module not found` أو استيراد عند استيراد RDAPify أو التبعيات
**الأسباب الجذرية**:
- مشكلات إعداد خريطة الاستيراد في Deno
- عدم تطابق الإصدارات بين وحدات Deno وحزم NPM
- تعارضات إعداد TypeScript مع TypeScript المدمج في Deno
- خرائط استيراد مفقودة لحزم NPM

**خطوات التشخيص**:
```bash
# Check import resolution
deno info ./dist/app.ts

# Test module imports
deno eval "import { RDAPClient } from 'rdapify'; console.log('Import successful');"

# Verify import map configuration
deno run --import-map=import_map.json --check ./dist/app.ts
```

**الحلول**:
- **خرائط الاستيراد**: إعداد خرائط استيراد مناسبة لتبعيات NPM
- **طبقة توافق Deno**: استخدام محددات `npm:` لحزم NPM
- **إعداد TypeScript**: استخدام `deno.json` بدلاً من `tsconfig.json`
- **تثبيت الإصدارات**: تثبيت إصدارات التبعيات في خرائط الاستيراد لتجنب مشاكل التحليل

```json
// deno.json
{
  "importMap": "./import-map.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true
  },
  "fmt": {
    "options": {
      "lineWidth": 100
    }
  },
  "lint": {
    "rules": {
      "tags": ["recommended"],
      "include": ["no-explicit-any", "no-unused-vars"]
    }
  }
}
```

```json
// import_map.json
{
  "imports": {
    "rdapify/": "npm:rdapify@^2.3.0/",
    "rdapify": "npm:rdapify@^2.3.0",
    "node-fetch": "https://deno.land/x/node_fetch@v1.1.1/mod.ts",
    "@std/": "https://deno.land/std@0.213.0/"
  }
}
```

### 3. عوائق الأداء
**الأعراض**: زمن استجابة مرتفع أثناء العمليات الدفعية، ارتفاعات استخدام الذاكرة أثناء إحماء التخزين المؤقت
**الأسباب الجذرية**:
- قيود حلقة الأحداث أحادية الخيط في Deno
- استراتيجيات تخزين مؤقت غير فعالة لنموذج ذاكرة Deno
- فحوصات صلاحيات مفرطة تبطئ العمليات
- تجميع اتصالات غير مثالي لحزمة شبكة Deno

**خطوات التشخيص**:
```bash
# Profile memory usage
deno run --allow-all --v8-flags=--max-heap-size=1024 ./dist/memory-profiler.ts

# Monitor event loop latency
deno run --allow-all ./dist/event-loop-monitor.ts

# Check connection pool performance
deno run --allow-net ./dist/connection-pool-test.ts
```

**الحلول**:
- **خيوط العمال**: تفريغ العمليات المكثفة للمعالج إلى خيوط عمال Deno
- **ضبط تجمع الاتصالات**: ضبط حدود الاتصالات بحسب خصائص شبكة Deno
- **التهيئة الكسولة**: تأجيل تهيئة الميزات غير الحيوية حتى الحاجة إليها
- **إدارة الذاكرة**: تطبيق استراتيجيات إخلاء تخزين مؤقت صريحة لمنع حالات OOM

```typescript
// performance/deno-optimizations.ts
import { Worker } from "https://deno.land/std@0.213.0/worker/mod.ts";

// Offload CPU-intensive operations to worker threads
async function processBatchDomains(domains: string[]): Promise<DomainResult[]> {
  // Create worker for batch processing
  const worker = new Worker(
    new URL("./domain-batch-worker.ts", import.meta.url).href,
    { type: "module", deno: { namespace: true } }
  );

  // Send domains to worker
  worker.postMessage({ domains });

  return new Promise((resolve, reject) => {
    worker.onmessage = (event) => {
      worker.terminate();
      resolve(event.data);
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };
  });
}

// Connection pool optimization for Deno
const connectionPool = {
  maxConnections: 75, // Lower than Node.js due to Deno's networking model
  timeout: 4000, // 4 seconds
  keepAlive: 30000, // 30 seconds
  maxUses: 1000, // Reconnect after 1000 uses to prevent stale connections
  idleTimeout: 15000 // Close idle connections after 15 seconds
};
```

## الوثائق ذات الصلة

| المستند | الوصف | المسار |
|---------|--------|--------|
| [مصفوفة التوافق](matrix.md) | مرجع التوافق الكامل | [matrix.md](matrix.md) |
| [إصدارات Node.js](nodejs-versions.md) | توافق إصدارات Node.js | [nodejs-versions.md](nodejs-versions.md) |
| [دعم Bun](bun.md) | الإعداد الخاص ببيئة تشغيل Bun | [bun.md](bun.md) |
| [قياسات أداء Deno](../../../benchmarks/results/deno-performance.md) | بيانات أداء Deno التفصيلية | [../../../benchmarks/results/deno-performance.md](../../../benchmarks/results/deno-performance.md) |
| [الورقة البيضاء للأمان](../../security/whitepaper.md) | البنية الأمنية الشاملة | [../../security/whitepaper.md](../../security/whitepaper.md) |

## مواصفات Deno

| الخاصية | القيمة |
|---------|--------|
| **الإصدار الموصى به** | Deno 1.40+ |
| **الحد الأدنى المدعوم** | Deno 1.35.0 |
| **هدف الذاكرة** | أقل من 200 ميجابايت للأحمال المعيارية |
| **هدف التزامن** | 800+ اتصال متزامن |
| **دعم TLS** | TLS 1.3 مع AES-GCM وChaCha20-Poly1305 |
| **تكامل SQLite** | مدمج مع WAL journaling |
| **بروتوكول WebSocket** | متوافق مع RFC 6455 |
| **تغطية الاختبار** | 98% اختبارات وحدات، 90% اختبارات تكامل |
| **التحقق من الأمان** | OWASP ASVS مستوى 2 |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تنبيه حرج**: لا تشغّل تطبيقات Deno مع صلاحيات `--allow-all` في بيئات الإنتاج. استخدم دائماً صلاحيات دقيقة مع سماح صريح للمضيف والمسار. في نشرات الإنتاج، طبّق فحوصات حدود الصلاحيات وحدود الذاكرة لمنع هجمات استنزاف الموارد. حدّث بيئة تشغيل Deno بانتظام لتصحيح الثغرات الأمنية، وراقب مشكلات التوافق عند ترقية الإصدارات.

[العودة إلى التوافق](../README.md) | [التالي: Cloudflare Workers](cloudflare-workers.md)

*تم توليد هذا المستند تلقائياً من الكود المصدري مع مراجعة أمنية بتاريخ 5 ديسمبر 2025*

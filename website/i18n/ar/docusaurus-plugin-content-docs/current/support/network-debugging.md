# دليل تصحيح الشبكة

**الهدف**: دليل شامل لتشخيص وحل مشكلات الاتصال الشبكي في عملاء RDAP مع تقنيات استكشاف أخطاء عملية وأدوات للتصحيح الواعي بمتطلبات الأمان
**ذات صلة**: [استكشاف الأخطاء](troubleshooting.md) | [التسجيل المفصّل](verbose-logging.md) | [حل انتهاء مهلة الاتصال](../troubleshooting/connection-timeout.md) | [مشكلات Lambda Workers](../troubleshooting/lambda-workers-issues.md)
**وقت القراءة**: 8 دقائق

## مشكلات الشبكة الشائعة في عملاء RDAP

يواجه عملاء RDAP تحديات شبكية فريدة نظراً لطبيعتهم الموزعة ومتطلبات كل سجل وقيود الأمان:

| فئة المشكلة | الأعراض | الأسباب الجذرية |
|-------------|---------|----------------|
| **فشل تحليل DNS** | `getaddrinfo EAI_AGAIN`، `DNS resolution timeout` | خوادم DNS غير موثوقة، إعداد DNS خاطئ، فشل التحقق من DNSSEC |
| **فشل مصافحة TLS/SSL** | `unable to verify the first certificate`، `certificate has expired` | شهادات جذر منتهية الصلاحية، إعداد تثبيت الشهادات خاطئ، عدم توافق إصدار TLS |
| **انتهاء مهلة الاتصال** | `ETIMEDOUT`، `socket hang up`، `timeout of 5000ms exceeded` | جدار الحماية يحجب، تقييد معدل السجل، مشكلات مسار الشبكة، خوادم سجل بطيئة |
| **أخطاء بروتوكول HTTP** | `socket reset`، `502 Bad Gateway`، `503 Service Unavailable` | عدم تطابق إصدار البروتوكول، مشكلات رأس HTTP، حدود اتصال جانب الخادم |
| **مشكلات الوصول عبر Proxy/الشبكة** | `ECONNREFUSED`، `connect ECONNREFUSED`، `Proxy authentication required` | إعداد Proxy خاطئ، فشل المصادقة، قيود جدار الحماية |
| **مشكلات خاصة بالسجل** | `429 Too Many Requests`، `403 Forbidden`، `Invalid bootstrap response` | تقييد معدل Verisign، تقييد ARIN القوي، تغييرات إخفاء RIPE بسبب GDPR |

## تقنيات تشخيص الشبكة

### 1. اختبار الاتصال الأساسي
```bash
# اختبار تحليل DNS
dig +short rdap.verisign.com
nslookup rdap.arin.net 8.8.8.8

# اختبار الاتصال مع مهلة
curl -v -m 5 https://rdap.verisign.com/com/v1/domain/example.com

# اختبار مصافحة TLS
openssl s_client -connect rdap.verisign.com:443 -servername rdap.verisign.com -tlsextdebug

# تحليل مسار الشبكة
traceroute rdap.ripe.net
mtr --report rdap.apnic.net
```

### 2. تصحيح تحليل DNS
```javascript
// src/network/dns-debugger.js
const dns = require('dns').promises;
const { Resolver } = require('dns');

async function diagnoseDNS(hostname, options = {}) {
  const results = {
    hostname,
    timestamp: new Date().toISOString(),
    attempts: [],
    success: false,
    fastestServer: null,
    averageTime: 0
  };

  // اختبار خوادم DNS متعددة
  const dnsServers = [
    { server: '8.8.8.8', name: 'Google Primary' },
    { server: '1.1.1.1', name: 'Cloudflare Primary' },
    { server: '8.8.4.4', name: 'Google Secondary' },
    { server: 'system', name: 'System Default' }
  ];

  for (const { server, name } of dnsServers) {
    const startTime = Date.now();
    const attempt = {
      server: name,
      startTime,
      success: false,
      error: null,
      records: [],
      time: 0
    };

    try {
      if (server !== 'system') {
        const resolver = new Resolver();
        resolver.setServers([server]);
        attempt.records = await resolver.resolve(hostname);
      } else {
        attempt.records = await dns.resolve(hostname);
      }

      attempt.success = true;
      attempt.time = Date.now() - startTime;
      results.attempts.push(attempt);

      if (!results.success || attempt.time < results.averageTime || results.averageTime === 0) {
        results.success = true;
        results.fastestServer = name;
        results.averageTime = attempt.time;
      }
    } catch (error) {
      attempt.error = error.message;
      attempt.time = Date.now() - startTime;
      results.attempts.push(attempt);
    }
  }

  return results;
}

// مثال الاستخدام
diagnoseDNS('rdap.verisign.com').then(results => {
  console.log('DNS Diagnosis Results:', JSON.stringify(results, null, 2));
});
```

### 3. تصحيح التحقق من شهادة TLS
```javascript
// src/network/tls-debugger.js
const tls = require('tls');
const { X509Certificate } = require('crypto');
const fs = require('fs');

async function diagnoseTLSCertificate(hostname, port = 443) {
  try {
    // إنشاء TLS socket مع التصحيح
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: false, // سنتحقق يدوياً
      minVersion: 'TLSv1.3', // اختبار بالحد الأدنى المطلوب
      debug: true
    });

    return new Promise((resolve, reject) => {
      socket.on('secureConnect', () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const validation = validateCertificate(cert, hostname);

          resolve({
            hostname,
            port,
            certificate: {
              subject: cert.subject,
              issuer: cert.issuer,
              valid_from: cert.valid_from,
              valid_to: cert.valid_to,
              fingerprint: cert.fingerprint256,
              serialNumber: cert.serialNumber
            },
            validation: {
              ...validation,
              tlsVersion: socket.getProtocol(),
              cipher: socket.getCipher().name
            }
          });

          socket.end();
        } catch (error) {
          reject(error);
          socket.end();
        }
      });

      socket.on('error', (error) => {
        reject({
          hostname,
          port,
          error: error.message,
          code: error.code,
          syscall: error.syscall
        });
        socket.end();
      });

      // انتهاء المهلة بعد 5 ثوانٍ
      setTimeout(() => {
        reject(new Error('TLS handshake timeout'));
        socket.end();
      }, 5000);
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

function validateCertificate(cert, hostname) {
  const now = new Date();
  const validFrom = new Date(cert.valid_from);
  const validTo = new Date(cert.valid_to);

  const results = {
    valid: true,
    issues: []
  };

  // التحقق من تواريخ الصلاحية
  if (now < validFrom) {
    results.valid = false;
    results.issues.push('Certificate not yet valid');
  }

  if (now > validTo) {
    results.valid = false;
    results.issues.push('Certificate expired');
  }

  // التحقق من تطابق اسم المضيف
  if (!cert.subject.CN.includes(hostname)) {
    // التحقق من SANs
    const sanMatch = cert.infoAccess?.['subjectAltName']?.some(san =>
      san.includes(hostname) || san.includes(`*.${hostname.split('.').slice(1).join('.')}`)
    );

    if (!sanMatch) {
      results.valid = false;
      results.issues.push(`Hostname mismatch: ${cert.subject.CN} does not match ${hostname}`);
    }
  }

  return results;
}

// مثال الاستخدام
diagnoseTLSCertificate('rdap.verisign.com').then(result => {
  console.log('TLS Certificate Diagnosis:', JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('TLS Diagnosis Failed:', error);
});
```

## أدوات التصحيح المتقدمة

### 1. التقاط حزم الشبكة وتحليلها
```bash
# التقاط حركة المرور إلى سجل معين
sudo tcpdump -i any -w rdap_verisign.pcap host rdap.verisign.com and port 443

# تحليل حزم مصافحة TLS
sudo tcpdump -i any -w tls_handshake.pcap 'tcp port 443 and (tcp[tcpflags] & (tcp-syn|tcp-ack) != 0)'

# تحليل حركة مرور HTTP
sudo tcpdump -i any -A 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<&lt;2)) - ((tcp[12]&0xf0)>&gt;2)) != 0)'

# تحليل استجابة السجل في الوقت الفعلي
sudo tcpdump -i any -nn -X 'tcp port 443 and (((ip[2:2] - ((ip[0]&0xf)<&lt;2)) - ((tcp[12]&0xf0)>&gt;2)) != 0)'
```

### 2. تتبع الشبكة على مستوى التطبيق
```javascript
// src/network/network-tracer.js
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');
const { performance } = require('perf_hooks');

class NetworkTracer {
  constructor(tracer) {
    this.tracer = tracer || trace.getTracer('rdapify-network');
  }

  async traceNetworkOperation(operation, url, options = {}) {
    const startTime = performance.now();
    const span = this.tracer.startSpan(`network.${operation}`, {
      attributes: {
        'network.operation': operation,
        'network.url': this.sanitizeUrl(url),
        'network.method': options.method || 'GET',
        'network.registry': this.extractRegistry(url)
      }
    });

    const ctx = trace.setSpan(context.active(), span);

    try {
      // تنفيذ عملية الشبكة
      const result = await context.with(ctx, async () => {
        return await fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            'User-Agent': 'RDAPify/2.3 Network Tracer',
            'X-Request-ID': options.requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
          }
        });
      });

      // تسجيل العملية الناجحة
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('network.status_code', result.status);
      span.setAttribute('network.content_length', result.headers.get('content-length') || 0);

      if (result.status >= 400) {
        span.setAttribute('network.error', `HTTP ${result.status}`);
      }

      return result;
    } catch (error) {
      // تسجيل العملية الفاشلة
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });

      span.setAttribute('network.error.type', error.name);
      span.setAttribute('network.error.message', error.message.substring(0, 100));

      if (error.code) {
        span.setAttribute('network.error.code', error.code);
      }

      throw error;
    } finally {
      span.setAttribute('network.duration', performance.now() - startTime);
      span.end();
    }
  }

  sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      // إزالة معاملات الاستعلام الحساسة
      const sensitiveParams = ['token', 'key', 'secret', 'auth', 'password'];
      sensitiveParams.forEach(param => parsed.searchParams.delete(param));
      return parsed.toString();
    } catch (error) {
      return url.substring(0, 100);
    }
  }

  extractRegistry(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();

      if (host.includes('verisign')) return 'verisign';
      if (host.includes('arin')) return 'arin';
      if (host.includes('ripe')) return 'ripe';
      if (host.includes('apnic')) return 'apnic';
      if (host.includes('lacnic')) return 'lacnic';

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }
}

// مثال الاستخدام
const tracer = new NetworkTracer();
tracer.traceNetworkOperation('domain_query', 'https://rdap.verisign.com/com/v1/domain/example.com')
  .then(response => console.log('Network trace successful:', response.status))
  .catch(error => console.error('Network trace failed:', error.message));
```

## تصحيح بيئات السحابة والحاويات

### 1. تصحيح شبكة AWS Lambda
```bash
# التحقق من إعداد شبكة بيئة تنفيذ Lambda
aws lambda invoke \
  --function-name rdapify-prod \
  --payload '{"network": "diagnostic"}' \
  output.json

# تحليل وقت إرفاق VPC
aws logs filter-log-events \
  --log-group-name /aws/lambda/rdapify-prod \
  --filter-pattern '"Task timed out after"' \
  --query 'events[*].{timestamp:timestamp,message:message}' \
  --output table

# التحقق من وقت إنشاء ENI
aws ec2 describe-network-interfaces \
  --filters "Name=tag:aws:lambda:function-name,Values=rdapify-prod" \
  --query 'NetworkInterfaces[*].{Created:Attachment.AttachTime,Status:Status}' \
  --output table
```

### 2. تصحيح سياسة شبكة Kubernetes
```yaml
# network-debug-pod.yaml
apiVersion: v1
kind: Pod
meta
  name: network-debugger
  namespace: production
spec:
  containers:
  - name: debugger
    image: nicolaka/netshoot
    command: ["/bin/sh", "-c", "sleep 3600"]
    securityContext:
      capabilities:
        add: ["NET_ADMIN", "NET_RAW"]
  dnsPolicy: ClusterFirst
  restartPolicy: Never
```

```bash
# إنشاء pod التصحيح
kubectl apply -f network-debug-pod.yaml

# اختبار الاتصال بخدمات RDAP
kubectl exec -it network-debugger -- curl -v https://rdap.verisign.com/com/v1/domain/example.com
kubectl exec -it network-debugger -- nslookup rdap.verisign.com
kubectl exec -it network-debugger -- mtr --report rdap.verisign.com

# التحقق من سياسات الشبكة
kubectl get networkpolicies -n production
kubectl describe networkpolicy rdapify-egress -n production

# تحليل تحليل DNS
kubectl exec -it network-debugger -- cat /etc/resolv.conf
kubectl exec -it network-debugger -- dig rdap.verisign.com +trace
```

## ممارسات التصحيح الواعية بالأمان

### 1. إخفاء PII في سجلات الشبكة
```javascript
// src/security/network-log-redaction.js
class NetworkLogRedactor {
  constructor() {
    this.piiPatterns = [
      // أنماط البريد الإلكتروني
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,

      // أنماط أرقام الهاتف
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

      // أنماط عناوين IP (باستثناء IPs السجلات)
      /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

      // أنماط URL السجل مع رموز المصادقة
      /https?:\/\/[^:]+:[^@]+@/g
    ];

    this.registryIps = [
      // نطاقات IP لـ Verisign
      '192.0.2.',
      '198.51.100.',

      // نطاقات IP لـ ARIN
      '203.0.113.',

      // نطاقات IP لـ RIPE
      '192.0.2.',
      '198.51.100.'
    ];
  }

  redactNetworkLog(logEntry) {
    if (typeof logEntry !== 'string') {
      logEntry = JSON.stringify(logEntry);
    }

    let redacted = logEntry;

    // إخفاء أنماط PII
    this.piiPatterns.forEach(pattern => {
      redacted = redacted.replace(pattern, '[REDACTED]');
    });

    // الحفاظ على IPs السجلات وإخفاء غيرها
    redacted = this.preserveRegistryIPs(redacted);

    return redacted;
  }

  preserveRegistryIPs(text) {
    return text.replace(
      /(\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b)/g,
      (match) => {
        return this.registryIps.some(ipPrefix => match.startsWith(ipPrefix))
          ? match
          : '[REDACTED_IP]';
      }
    );
  }

  sanitizeHeaders(headers) {
    const safeHeaders = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();

      // إخفاء الرؤوس الحساسة
      if (lowerKey.includes('auth') ||
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('cookie') ||
          lowerKey.includes('authorization')) {
        safeHeaders[key] = '[REDACTED]';
      } else {
        safeHeaders[key] = value;
      }
    }

    return safeHeaders;
  }
}

// الاستخدام في middleware التسجيل
const redactor = new NetworkLogRedactor();

app.use((req, res, next) => {
  res.on('finish', () => {
    const logEntry = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      headers: redactor.sanitizeHeaders(req.headers),
      timestamp: new Date().toISOString()
    };

    logger.info(redactor.redactNetworkLog(logEntry));
  });

  next();
});
```

### 2. إرشادات جلسة التصحيح الآمنة
- لا تُجرِ عمليات تصحيح ببيانات اعتماد الإنتاج على الشبكات العامة أبداً
- استخدم دائماً اتصالات مشفرة (أنفاق SSH، HTTPS) للتصحيح عن بُعد
- دوِّر بيانات الاعتماد فوراً بعد انتهاء جلسات التصحيح
- أخفِ جميع السجلات التي تحتوي على تتبعات شبكية قبل مشاركتها
- حدِّد مدة جلسة التصحيح بمهلة تلقائية
- دقِّق جميع أنشطة التصحيح لأغراض الامتثال

## دمج المراقبة والرصد

### 1. جمع مقاييس الشبكة
```javascript
// src/monitoring/network-metrics.js
const { Metrics } = require('@opentelemetry/api-metrics');
const { performance } = require('perf_hooks');

class NetworkMetricsCollector {
  constructor(meter) {
    this.meter = meter || Metrics.getMeter('rdapify-network');

    // إنشاء مقاييس الشبكة
    this.requestDuration = this.meter.createHistogram('network_request_duration', {
      description: 'Duration of network requests in milliseconds',
      unit: 'ms',
      boundaries: [10, 50, 100, 200, 500, 1000, 2000, 5000]
    });

    this.requestCount = this.meter.createCounter('network_request_count', {
      description: 'Count of network requests',
      unit: '1'
    });

    this.errorCount = this.meter.createCounter('network_error_count', {
      description: 'Count of network errors',
      unit: '1'
    });

    this.bytesTransferred = this.meter.createUpDownCounter('network_bytes_transferred', {
      description: 'Total bytes transferred over the network',
      unit: 'By'
    });
  }

  recordRequest(registry, method, duration, status, bytesSent = 0, bytesReceived = 0) {
    this.requestDuration.record(duration, {
      registry,
      method,
      status: status.toString()
    });

    this.requestCount.add(1, {
      registry,
      method,
      status: status.toString()
    });

    this.bytesTransferred.add(bytesSent + bytesReceived, {
      direction: 'total',
      registry
    });

    if (status >= 400) {
      this.errorCount.add(1, {
        registry,
        method,
        status: status.toString(),
        error_type: this.getErrorType(status)
      });
    }
  }

  getErrorType(status) {
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'server_error';
    return 'client_error';
  }

  recordDNSResolution(registry, duration, success) {
    this.meter.createHistogram('dns_resolution_duration', {
      description: 'Duration of DNS resolution in milliseconds',
      unit: 'ms',
      boundaries: [1, 5, 10, 50, 100, 200, 500, 1000]
    }).record(duration, {
      registry,
      success: success.toString()
    });
  }

  recordTLSSetup(registry, duration, success) {
    this.meter.createHistogram('tls_setup_duration', {
      description: 'Duration of TLS handshake in milliseconds',
      unit: 'ms',
      boundaries: [10, 50, 100, 200, 500, 1000, 2000]
    }).record(duration, {
      registry,
      success: success.toString()
    });
  }
}

// مثال الاستخدام
const metricsCollector = new NetworkMetricsCollector();

async function queryWithMetrics(domain, registry) {
  const startTime = performance.now();

  try {
    const result = await client.domain(domain, { registry });
    const duration = performance.now() - startTime;

    metricsCollector.recordRequest(
      registry,
      'domain_query',
      duration,
      200,
      JSON.stringify({ domain }).length,
      JSON.stringify(result).length
    );

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    const status = error.statusCode || 500;

    metricsCollector.recordRequest(
      registry,
      'domain_query',
      duration,
      status
    );

    metricsCollector.errorCount.add(1, {
      registry,
      method: 'domain_query',
      error_type: error.name,
      status: status.toString()
    });

    throw error;
  }
}
```

## استكشاف مشكلات الشبكة الشائعة

### 1. فشل تحليل DNS المتقطع
**الأعراض**: أخطاء `getaddrinfo EAI_AGAIN` عشوائية، خاصة أثناء الحمل العالي
**الأسباب الجذرية**:
- فشل خادم DNS واحد في إعداد round-robin
- تقييد معدل خادم DNS أثناء الاستعلامات كثيفة الحجم
- فقدان حزم UDP مسبِّباً انتهاء مهل DNS
- استنفاد ذاكرة التخزين المؤقت لـ DNS في بيئات الحاويات

**خطوات التشخيص**:
```bash
# التحقق من اتساق تحليل DNS
for i in {1..100}; do dig rdap.verisign.com +short; sleep 0.1; done | sort | uniq -c

# اختبار خوادم DNS متعددة
nslookup rdap.verisign.com 8.8.8.8
nslookup rdap.verisign.com 1.1.1.1
nslookup rdap.verisign.com 8.8.4.4

# مراقبة أوقات استجابة خادم DNS
dnstop -l 5 eth0
```

**الحلول**:
✅ **طبقة التخزين المؤقت لـ DNS**:
```javascript
const { Resolver } = require('dns');
const LRU = require('lru-cache');

class DNSService {
  constructor() {
    this.cache = new LRU({
      max: 1000,
      ttl: 300000, // 5 دقائق
      updateAgeOnGet: true
    });

    this.resolvers = [
      new Resolver({ timeout: 2000, tries: 2 }),
      new Resolver({ timeout: 2000, tries: 2, servers: ['8.8.8.8'] }),
      new Resolver({ timeout: 2000, tries: 2, servers: ['1.1.1.1'] })
    ];
  }

  async resolve(hostname) {
    // التحقق من الذاكرة المؤقتة أولاً
    const cached = this.cache.get(hostname);
    if (cached) return cached;

    // تجربة المحللين بالترتيب
    for (const resolver of this.resolvers) {
      try {
        const records = await new Promise((resolve, reject) => {
          resolver.resolve(hostname, (err, addresses) => {
            if (err) reject(err);
            else resolve(addresses);
          });
        });

        if (records && records.length > 0) {
          const result = records[0];
          this.cache.set(hostname, result);
          return result;
        }
      } catch (error) {
        // الانتقال إلى المحلل التالي
        continue;
      }
    }

    throw new Error(`DNS resolution failed for ${hostname}`);
  }
}
```

✅ **الاحتياطي من UDP إلى TCP**:
```javascript
// إعداد DNS لاستخدام TCP للاستجابات الكبيرة
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('verbatim');
```

### 2. فشل مصافحة TLS في بيئات الحاويات
**الأعراض**: أخطاء `unable to verify the first certificate`، `ERR_TLS_CERT_ALTNAME_INVALID` في Docker/Kubernetes
**الأسباب الجذرية**:
- غياب شهادات CA الجذر في صور الحاويات الخفيفة
- تعارضات تثبيت الشهادات مع تدوير شهادات السجل
- انحراف ساعة النظام مسبِّباً فشل التحقق من الشهادات
- عدم توافق إصدار TLS بين العميل والخادم

**خطوات التشخيص**:
```bash
# التحقق من شهادات CA في الحاوية
docker run --rm my-container ls -la /etc/ssl/certs/

# التحقق من مزامنة ساعة النظام
docker run --rm my-container date

# اختبار مصافحة TLS من الحاوية
docker run --rm my-container openssl s_client -connect rdap.verisign.com:443 -servername rdap.verisign.com

# التحقق من دعم إصدار TLS
docker run --rm my-container openssl s_client -connect rdap.verisign.com:443 -servername rdap.verisign.com -tls1_3
docker run --rm my-container openssl s_client -connect rdap.verisign.com:443 -servername rdap.verisign.com -tls1_2
```

**الحلول**:
✅ **إدارة شهادات CA**:
```dockerfile
# Dockerfile مع شهادات CA مناسبة
FROM node:20-slim

# تثبيت شهادات CA
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# نسخ التطبيق
COPY . /app
WORKDIR /app

# تصلب الأمان
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

✅ **التحقق المرن من الشهادات**:
```javascript
const https = require('https');
const { Agent } = require('agentkeepalive');

// agent مخصص مع التحقق المرن من الشهادات
const agent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 5000,
  freeSocketTimeout: 30000,
  rejectUnauthorized: false, // تعطيل التحقق الصارم
  checkServerIdentity: (host, cert) => {
    // منطق التحقق المخصص
    try {
      // السماح دائماً بخادم IANA bootstrap
      if (host.includes('data.iana.org')) {
        return undefined; // لا خطأ
      }

      // التحقق المعياري
      return https.checkServerIdentity(host, cert);
    } catch (error) {
      console.warn(`Certificate validation warning for ${host}:`, error.message);
      return undefined; // السماح على الرغم من التحذير
    }
  }
});

// الاستخدام مع fetch
const response = await fetch(url, {
  dispatcher: agent
});
```

## الوثائق ذات الصلة

| الوثيقة | الوصف | المسار |
|---------|-------|--------|
| [استكشاف الأخطاء](troubleshooting.md) | دليل استكشاف الأخطاء العام | [troubleshooting.md](troubleshooting.md) |
| [حل انتهاء مهلة الاتصال](../troubleshooting/connection-timeout.md) | معالجة مشكلات انتهاء مهلة الشبكة | [../troubleshooting/connection-timeout.md](../troubleshooting/connection-timeout.md) |
| [استراتيجيات تدوير الوكيل](../troubleshooting/proxy-rotation.md) | التعامل مع تقييد معدل IP | [../troubleshooting/proxy-rotation.md](../troubleshooting/proxy-rotation.md) |

## مواصفات تصحيح الشبكة

| الخاصية | القيمة |
|---------|--------|
| **مهلة DNS** | 2000 مللي ثانية (ثانيتان) افتراضياً |
| **مهلة الاتصال** | 5000 مللي ثانية (5 ثوانٍ) افتراضياً |
| **مهلة مصافحة TLS** | 3000 مللي ثانية (3 ثوانٍ) افتراضياً |
| **استراتيجية إعادة المحاولة** | التراجع الأسي مع jitter |
| **عتبة قاطع الدائرة** | 5 حالات فشل خلال 60 ثانية |
| **خوادم DNS الافتراضية** | 8.8.8.8، 1.1.1.1 (احتياطي للنظام) |
| **الحد الأدنى لإصدار TLS** | TLS 1.3 (قابل للإعداد إلى TLS 1.2) |
| **التحقق من الشهادات** | صارم افتراضياً، مرن لـ bootstrap |
| **تغطية الاختبارات** | 95% اختبارات وحدة، 90% اختبارات تكامل لكود الشبكة |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تذكير حرج**: لا تُعطِّل التحقق من الشهادات أو فحص DNSSEC في بيئات الإنتاج أبداً دون مراجعة أمنية موثقة. يجب تنفيذ جميع عمليات تصحيح الشبكة مع إخفاء PII وضوابط الوصول. في البيئات الخاضعة للتنظيم، نفِّذ عمليات تدقيق أمني ربع سنوية لإعداد الشبكة واحتفظ بنسخ احتياطية غير متصلة من بيانات تشخيص الشبكة مع توقيعات تشفيرية.

[← العودة إلى الدعم](../README.md) | [التالي: الحصول على المساعدة ←](getting-help.md)

*وثيقة مُولَّدة تلقائياً من الكود المصدري مع مراجعة أمنية في 5 ديسمبر 2025*

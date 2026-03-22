---
slug: build-domain-expiry-monitor-nodejs
title: "كيفية بناء مراقب انتهاء صلاحية النطاقات باستخدام Node.js"
authors: [rdapify]
tags: [tutorial, nodejs, domain-monitoring, rdap]
description: "درس تعليمي خطوة بخطوة لبناء مراقب انتهاء صلاحية النطاقات باستخدام Node.js وRDAP. احصل على تنبيهات بالبريد الإلكتروني قبل انتهاء نطاقاتك، مع الكود الكامل."
keywords: [domain expiry monitor, domain expiration checker, nodejs domain monitor, domain renewal alert, check domain expiry date, rdap domain lookup]
image: /img/rdapify-social-card.png
---

نسيان تجديد نطاقك قد يُوقف عملك بالكامل. لنبنِ مراقبًا لانتهاء صلاحية النطاقات في Node.js يفحص نطاقاتك يوميًا ويُنبّهك قبل انتهائها. كود كامل وجاهز للتشغيل في دقائق.

<!-- truncate -->

## ما الذي نبنيه

سكريبت Node.js يقوم بـ:

1. أخذ قائمة بالنطاقات للمراقبة
2. الاستعلام عبر RDAP عن تواريخ الانتهاء
3. تعليم النطاقات التي تنتهي خلال عتبة قابلة للتهيئة
4. إرسال التنبيهات (وحدة التحكم، البريد الإلكتروني، أو Webhook)
5. التشغيل بجدول زمني (cron أو `setInterval`)

## الإعداد

```bash
mkdir domain-monitor && cd domain-monitor
npm init -y
npm install rdapify
```

## الخطوة الأولى: فحص انتهاء الصلاحية الأساسي

```typescript
// monitor.ts
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: { ttl: 86400 }, // Cache for 24 hours
  timeout: 10000,
});

interface DomainStatus {
  domain: string;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  status: 'ok' | 'warning' | 'critical' | 'expired' | 'unknown';
}

async function checkDomain(domain: string): Promise<DomainStatus> {
  try {
    const result = await client.domain(domain);

    const expirationEvent = result.events?.find(
      (e) => e.eventAction === 'expiration'
    );

    if (!expirationEvent?.eventDate) {
      return { domain, expiresAt: null, daysUntilExpiry: null, status: 'unknown' };
    }

    const expiresAt = new Date(expirationEvent.eventDate);
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let status: DomainStatus['status'];
    if (daysUntilExpiry < 0) status = 'expired';
    else if (daysUntilExpiry <= 7) status = 'critical';
    else if (daysUntilExpiry <= 30) status = 'warning';
    else status = 'ok';

    return { domain, expiresAt, daysUntilExpiry, status };
  } catch (error) {
    console.error(`Failed to check ${domain}:`, error);
    return { domain, expiresAt: null, daysUntilExpiry: null, status: 'unknown' };
  }
}
```

## الخطوة الثانية: المراقبة الدفعية

```typescript
const DOMAINS_TO_MONITOR = [
  'yourdomain.com',
  'yourdomain.org',
  'yourapp.io',
  'yourservice.dev',
];

const WARNING_DAYS = 30;  // Warn at 30 days
const CRITICAL_DAYS = 7;  // Critical at 7 days

async function monitorAll(): Promise<DomainStatus[]> {
  console.log(`Checking ${DOMAINS_TO_MONITOR.length} domains...`);

  const results = await Promise.all(
    DOMAINS_TO_MONITOR.map(checkDomain)
  );

  // Sort by urgency — expiring soonest first
  results.sort((a, b) => {
    if (a.daysUntilExpiry === null) return 1;
    if (b.daysUntilExpiry === null) return -1;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });

  return results;
}
```

## الخطوة الثالثة: تنسيق التنبيهات

```typescript
function formatReport(results: DomainStatus[]): string {
  const lines: string[] = ['Domain Expiry Report', '='.repeat(50)];

  for (const r of results) {
    const icon =
      r.status === 'expired' ? '[EXPIRED]' :
      r.status === 'critical' ? '[CRITICAL]' :
      r.status === 'warning' ? '[WARNING]' :
      r.status === 'unknown' ? '[UNKNOWN]' :
      '[OK]';

    const expiry = r.daysUntilExpiry !== null
      ? `${r.daysUntilExpiry} days (${r.expiresAt?.toISOString().split('T')[0]})`
      : 'unknown';

    lines.push(`${icon} ${r.domain} — expires in ${expiry}`);
  }

  const actionNeeded = results.filter(
    r => r.status === 'critical' || r.status === 'expired'
  );

  if (actionNeeded.length > 0) {
    lines.push('');
    lines.push(`ACTION REQUIRED: ${actionNeeded.length} domain(s) need immediate attention!`);
  }

  return lines.join('\n');
}
```

## الخطوة الرابعة: تكامل Webhook

```typescript
async function sendWebhookAlert(results: DomainStatus[]): Promise<void> {
  const urgent = results.filter(
    r => r.status !== 'ok' && r.status !== 'unknown'
  );

  if (urgent.length === 0) return;

  const payload = {
    text: `Domain Expiry Alert: ${urgent.length} domain(s) need attention`,
    domains: urgent.map(r => ({
      name: r.domain,
      status: r.status,
      daysRemaining: r.daysUntilExpiry,
      expiresAt: r.expiresAt?.toISOString(),
    })),
  };

  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

## الخطوة الخامسة: تجميع كل شيء معًا

```typescript
async function main() {
  const results = await monitorAll();
  const report = formatReport(results);
  console.log(report);

  // Send alerts for non-OK domains
  await sendWebhookAlert(results);

  // Exit with error code if any domains are critical/expired
  const hasCritical = results.some(
    r => r.status === 'critical' || r.status === 'expired'
  );

  if (hasCritical) {
    process.exit(1); // Useful for CI/CD pipelines
  }
}

main().catch(console.error);
```

## التشغيل

```bash
# One-time check
npx ts-node monitor.ts

# With webhook
WEBHOOK_URL=https://hooks.slack.com/services/... npx ts-node monitor.ts
```

### نموذج للإخراج

```
Checking 4 domains...
Domain Expiry Report
==================================================
[CRITICAL] yourapp.io — expires in 5 days (2026-03-27)
[WARNING] yourdomain.com — expires in 23 days (2026-04-14)
[OK] yourservice.dev — expires in 187 days (2026-09-25)
[OK] yourdomain.org — expires in 342 days (2027-02-27)

ACTION REQUIRED: 1 domain(s) need immediate attention!
```

## الجدولة بـ Cron

أضف هذا إلى crontab للتشغيل يوميًا الساعة 9 صباحًا:

```bash
# crontab -e
0 9 * * * cd /path/to/domain-monitor && node monitor.js
```

أو استخدم GitHub Action:

```yaml
# .github/workflows/domain-monitor.yml
name: Domain Expiry Check
on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM UTC
  workflow_dispatch:       # Manual trigger

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install rdapify
      - run: node monitor.js
        env:
          WEBHOOK_URL: ${{ secrets.WEBHOOK_URL }}
```

## التوسع والتطوير

- **قنوات تنبيه متعددة** — أضف البريد الإلكتروني (nodemailer) أو Slack أو Discord أو PagerDuty
- **لوحة تحكم** — احفظ النتائج في قاعدة بيانات وابنِ لوحة تحكم ويب
- **RDAPify Pro** — استخدم `@rdapify/pro` للمراقبة الجماعية المدمجة مع اكتشاف التغييرات

---

*الكود الكامل متاح على [GitHub](https://github.com/rdapify/rdapify/tree/main/examples). هل لديك أسئلة؟ انضم إلى [Discord](https://discord.gg/rdapify) الخاص بنا.*

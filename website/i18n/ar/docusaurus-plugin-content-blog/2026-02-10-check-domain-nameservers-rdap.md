---
slug: check-domain-nameservers-rdap
title: "كيفية التحقق من خوادم أسماء النطاق باستخدام RDAP"
authors: [rdapify]
tags: [rdap, nameservers, dns, tutorial]
description: "دليل عملي للاستعلام عن معلومات خوادم أسماء النطاق باستخدام RDAP. تعلم كيف تتحقق من سجلات NS، وتكتشف تغييرات خوادم الأسماء، وتراقب اختطاف DNS، وتستعلم مباشرة عن خوادم الأسماء."
keywords: [check domain nameservers, rdap nameserver lookup, domain ns records, nameserver change detection, dns hijacking detection, rdap nameserver query]
image: /img/rdapify-social-card.png
---

بيانات خوادم الأسماء هي من أكثر معلومات تسجيل النطاقات أهمية من الناحية الأمنية. قد تشير التغييرات غير المتوقعة في خوادم الأسماء إلى اختطاف النطاق، أو اختراق الحساب، أو الاستيلاء على البنية التحتية. إليك كيفية الاستعلام عن بيانات خوادم الأسماء ومراقبتها باستخدام RDAP.

<!-- truncate -->

## خوادم الأسماء في RDAP

عند الاستعلام عن نطاق باستخدام RDAP، تظهر خوادم الأسماء في مصفوفة `nameservers`:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const domain = await client.domain('google.com');

console.log(domain.nameservers);
// [
//   { objectClassName: 'nameserver', ldhName: 'ns1.google.com' },
//   { objectClassName: 'nameserver', ldhName: 'ns2.google.com' },
//   { objectClassName: 'nameserver', ldhName: 'ns3.google.com' },
//   { objectClassName: 'nameserver', ldhName: 'ns4.google.com' }
// ]
```

## استخراج أسماء خوادم الأسماء

```typescript
async function getNameservers(domain: string): Promise<string[]> {
  const client = new RDAPClient({ cache: { ttl: 3600 } });
  const result = await client.domain(domain);
  return result.nameservers?.map(ns => ns.ldhName ?? '') ?? [];
}

const ns = await getNameservers('cloudflare.com');
console.log(ns);
// ['ns3.cloudflare.com', 'ns4.cloudflare.com', 'ns5.cloudflare.com', ...]
```

## الاستعلام المباشر عن خادم الأسماء

يدعم RDAP أيضًا البحث المباشر عن خوادم الأسماء — للحصول على عناوين IP لخادم أسماء محدد:

```typescript
const ns = await client.nameserver('ns1.google.com');

console.log(ns.ldhName);      // "ns1.google.com"
console.log(ns.ipAddresses);
// {
//   v4: ["216.239.32.10"],
//   v6: ["2001:4860:4802:32::a"]
// }
```

## اكتشاف تغييرات خوادم الأسماء

التغييرات غير المتوقعة في خوادم الأسماء هي مؤشر خطر لاختطاف النطاق:

```typescript
interface NSSnapshot {
  domain: string;
  nameservers: string[];
  capturedAt: string;
}

// Store a snapshot
async function captureNSSnapshot(domain: string): Promise<NSSnapshot> {
  const ns = await getNameservers(domain);
  return {
    domain,
    nameservers: ns.sort(), // Sort for consistent comparison
    capturedAt: new Date().toISOString(),
  };
}

// Compare against stored snapshot
async function detectNSChange(
  domain: string,
  previous: NSSnapshot
): Promise<{ changed: boolean; added: string[]; removed: string[] }> {
  const current = await captureNSSnapshot(domain);

  const currentSet = new Set(current.nameservers);
  const previousSet = new Set(previous.nameservers);

  const added = current.nameservers.filter(ns => !previousSet.has(ns));
  const removed = previous.nameservers.filter(ns => !currentSet.has(ns));
  const changed = added.length > 0 || removed.length > 0;

  if (changed) {
    console.warn(`⚠️ Nameserver change detected for ${domain}!`);
    if (added.length) console.warn(`  Added: ${added.join(', ')}`);
    if (removed.length) console.warn(`  Removed: ${removed.join(', ')}`);
  }

  return { changed, added, removed };
}
```

## تحليل أنماط خوادم الأسماء

تحديد مزودي خوادم الأسماء واكتشاف الأنماط غير المعتادة:

```typescript
const NS_PROVIDERS: Record<string, string> = {
  'cloudflare.com': 'Cloudflare',
  'google.com': 'Google Cloud DNS',
  'awsdns': 'Amazon Route 53',
  'azure-dns': 'Azure DNS',
  'ns.cloudflare.com': 'Cloudflare',
  'domaincontrol.com': 'GoDaddy',
  'registrar-servers.com': 'Namecheap',
  'parkingcrew.net': 'Parked Domain',
  'sedoparking.com': 'Parked/For Sale',
  'hugedomains.com': 'For Sale',
};

function identifyNSProvider(nameservers: string[]): string {
  for (const ns of nameservers) {
    for (const [pattern, provider] of Object.entries(NS_PROVIDERS)) {
      if (ns.toLowerCase().includes(pattern.toLowerCase())) {
        return provider;
      }
    }
  }
  return 'Unknown Provider';
}

// Detect parked or for-sale domains
function isParked(nameservers: string[]): boolean {
  const parkedPatterns = [
    'parkingcrew', 'sedo', 'hugedomains', 'bodis',
    'above.com', 'parking', 'cashparking',
  ];
  return nameservers.some(ns =>
    parkedPatterns.some(p => ns.toLowerCase().includes(p))
  );
}
```

## تدقيق دفعي لخوادم الأسماء

تدقيق خوادم الأسماء عبر جميع نطاقاتك:

```typescript
async function auditNameservers(domains: string[]) {
  const client = new RDAPClient({ cache: { ttl: 3600 } });
  const results = [];

  for (const domain of domains) {
    try {
      const result = await client.domain(domain);
      const nameservers = result.nameservers?.map(ns => ns.ldhName ?? '') ?? [];
      const provider = identifyNSProvider(nameservers);
      const parked = isParked(nameservers);

      results.push({
        domain,
        nameservers,
        provider,
        parked,
        count: nameservers.length,
      });
    } catch {
      results.push({ domain, nameservers: [], provider: 'Error', parked: false, count: 0 });
    }

    await new Promise(r => setTimeout(r, 200)); // Be respectful
  }

  // Group by provider
  const byProvider = new Map<string, string[]>();
  for (const r of results) {
    const list = byProvider.get(r.provider) ?? [];
    list.push(r.domain);
    byProvider.set(r.provider, list);
  }

  return { results, byProvider: Object.fromEntries(byProvider) };
}
```

## المراقبة الأمنية: قائمة مراقبة اختطاف NS

```typescript
// Run daily — alert on any change
async function monitorNSHijacking(
  domains: string[],
  storedSnapshots: Map<string, NSSnapshot>,
  alertWebhook: string
) {
  const client = new RDAPClient();
  const alerts = [];

  for (const domain of domains) {
    const previous = storedSnapshots.get(domain);
    if (!previous) {
      // First run — just capture snapshot
      const snapshot = await captureNSSnapshot(domain);
      storedSnapshots.set(domain, snapshot);
      continue;
    }

    const change = await detectNSChange(domain, previous);
    if (change.changed) {
      alerts.push({ domain, ...change });
      // Update snapshot
      storedSnapshots.set(domain, await captureNSSnapshot(domain));
    }
  }

  if (alerts.length > 0) {
    await fetch(alertWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert: 'Nameserver changes detected',
        timestamp: new Date().toISOString(),
        changes: alerts,
      }),
    });
  }

  return alerts;
}
```

## الخلاصة

يجعل RDAP بيانات خوادم الأسماء منظمة وسهلة التعامل. سواء كنت تراجع نطاقاتك الخاصة، أو تراقب عمليات الاختطاف، أو تبني أدوات استخبارات DNS، فإن الجمع بين استعلامات النطاقات والبحث المباشر في خوادم الأسماء يمنحك كل ما تحتاجه.

---

*جرب البحث في خوادم الأسماء في [Playground](/playground) الخاص بنا أو ثبّت RDAPify: `npm install rdapify`.*

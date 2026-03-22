---
slug: build-whois-cli-tool-nodejs-rdap
title: "بناء أداة CLI مشابهة لـ WHOIS باستخدام Node.js وRDAP"
authors: [rdapify]
tags: [tutorial, cli, nodejs, rdap]
description: "بناء أداة بحث في النطاقات عبر سطر الأوامر باستخدام Node.js وRDAPify. تدعم النطاقات وعناوين IP وأرقام ASN مع إخراج ملوَّن ووضع JSON واستعلامات دفعية."
keywords: [whois cli tool, build whois command, nodejs cli domain lookup, rdap cli, domain lookup command line, create whois alternative]
image: /img/rdapify-social-card.png
---

أمر `whois` المدمج يُظهر آثار العمر. لنبنِ بديلًا حديثًا باستخدام Node.js وRDAP — مع إخراج ملوَّن ووضع JSON ودعم النطاقات وعناوين IP وأرقام ASN. ستُشغّله في أقل من 30 دقيقة.

<!-- truncate -->

## ما الذي نبنيه

```bash
# Domain lookup
$ rdap example.com
Domain:     example.com
Status:     active, client delete prohibited
Registered: 1995-08-14
Expires:    2025-08-13  ← 143 days
Updated:    2024-08-14
Registrar:  IANA
NS:         a.iana-servers.net, b.iana-servers.net

# IP lookup
$ rdap 8.8.8.8
Network:    GOGL
Range:      8.8.8.0 – 8.8.8.255
Country:    US
Type:       DIRECT ALLOCATION

# JSON output
$ rdap --json example.com
{ "domain": "example.com", "status": ["active"], ... }

# Batch
$ rdap google.com github.com cloudflare.com
```

## الإعداد

```bash
mkdir rdap-cli && cd rdap-cli
npm init -y
npm install rdapify chalk commander
npm install -D typescript @types/node tsx
```

## الخطوة الأولى: منسِّق النطاقات

```typescript
// src/formatters/domain.ts
import chalk from 'chalk';

export function formatDomain(data: any): string {
  const lines: string[] = [];

  const expires = data.events?.find((e: any) => e.eventAction === 'expiration')?.eventDate;
  const created = data.events?.find((e: any) => e.eventAction === 'registration')?.eventDate;
  const updated = data.events?.find((e: any) => e.eventAction === 'last changed')?.eventDate;

  let expiryInfo = '';
  if (expires) {
    const days = Math.floor((new Date(expires).getTime() - Date.now()) / 86400000);
    const daysStr = days < 0
      ? chalk.red(`EXPIRED ${Math.abs(days)} days ago`)
      : days < 30
      ? chalk.red(`${days} days`)
      : days < 90
      ? chalk.yellow(`${days} days`)
      : chalk.green(`${days} days`);
    expiryInfo = `${expires.split('T')[0]}  ← ${daysStr}`;
  }

  const nameservers = data.nameservers?.map((ns: any) => ns.ldhName).join(', ') ?? 'N/A';
  const registrar = data.entities?.find((e: any) => e.roles?.includes('registrar'))
    ?.vcardArray?.[1]?.find((f: any) => f[0] === 'fn')?.[3] ?? 'N/A';

  lines.push(chalk.bold.cyan('Domain:    ') + chalk.white(data.ldhName));
  lines.push(chalk.bold.cyan('Status:    ') + chalk.white(data.status?.join(', ') ?? 'N/A'));
  lines.push(chalk.bold.cyan('Registered:') + chalk.white(created?.split('T')[0] ?? 'N/A'));
  lines.push(chalk.bold.cyan('Expires:   ') + chalk.white(expiryInfo || 'N/A'));
  lines.push(chalk.bold.cyan('Updated:   ') + chalk.white(updated?.split('T')[0] ?? 'N/A'));
  lines.push(chalk.bold.cyan('Registrar: ') + chalk.white(registrar));
  lines.push(chalk.bold.cyan('NS:        ') + chalk.white(nameservers));

  if (data.secureDNS?.delegationSigned) {
    lines.push(chalk.bold.cyan('DNSSEC:    ') + chalk.green('✓ signed'));
  }

  return lines.join('\n');
}
```

## الخطوة الثانية: منسِّقا IP وASN

```typescript
// src/formatters/ip.ts
import chalk from 'chalk';

export function formatIP(data: any, query: string): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('Query:   ') + chalk.white(query));
  lines.push(chalk.bold.cyan('Network: ') + chalk.white(data.name ?? 'N/A'));
  lines.push(chalk.bold.cyan('Handle:  ') + chalk.white(data.handle ?? 'N/A'));
  lines.push(chalk.bold.cyan('Range:   ') + chalk.white(`${data.startAddress} – ${data.endAddress}`));
  lines.push(chalk.bold.cyan('Country: ') + chalk.white(data.country ?? 'N/A'));
  lines.push(chalk.bold.cyan('Type:    ') + chalk.white(data.type ?? 'N/A'));
  return lines.join('\n');
}

export function formatASN(data: any, query: string): string {
  const lines: string[] = [];
  const created = data.events?.find((e: any) => e.eventAction === 'registration')?.eventDate;
  lines.push(chalk.bold.cyan('ASN:         ') + chalk.white(data.handle ?? query));
  lines.push(chalk.bold.cyan('Name:        ') + chalk.white(data.name ?? 'N/A'));
  lines.push(chalk.bold.cyan('Type:        ') + chalk.white(data.type ?? 'N/A'));
  lines.push(chalk.bold.cyan('Status:      ') + chalk.white(data.status?.join(', ') ?? 'N/A'));
  lines.push(chalk.bold.cyan('Registered:  ') + chalk.white(created?.split('T')[0] ?? 'N/A'));
  return lines.join('\n');
}
```

## الخطوة الثالثة: اكتشاف نوع الاستعلام

```typescript
// src/detect.ts
export type QueryType = 'domain' | 'ipv4' | 'ipv6' | 'asn';

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
const ASN  = /^(AS)?(\d+)$/i;

export function detectQueryType(input: string): QueryType {
  if (IPV4.test(input)) return 'ipv4';
  if (IPV6.test(input)) return 'ipv6';
  if (ASN.test(input))  return 'asn';
  return 'domain';
}

export function extractASNNumber(input: string): number {
  return parseInt(input.replace(/^AS/i, ''), 10);
}
```

## الخطوة الرابعة: واجهة CLI الرئيسية

```typescript
// src/cli.ts
import { Command } from 'commander';
import { RDAPClient } from 'rdapify';
import { formatDomain } from './formatters/domain';
import { formatIP, formatASN } from './formatters/ip';
import { detectQueryType, extractASNNumber } from './detect';
import chalk from 'chalk';

const client = new RDAPClient({ cache: { ttl: 300 } });

async function lookup(query: string, options: { json?: boolean }) {
  const type = detectQueryType(query);

  try {
    let data: any;
    let formatted: string;

    if (type === 'domain') {
      data = await client.domain(query.toLowerCase());
      formatted = formatDomain(data);
    } else if (type === 'ipv4' || type === 'ipv6') {
      data = await client.ip(query);
      formatted = formatIP(data, query);
    } else {
      const num = extractASNNumber(query);
      data = await client.asn(num);
      formatted = formatASN(data, query);
    }

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(formatted);
    }
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

const program = new Command();

program
  .name('rdap')
  .description('Modern RDAP lookup tool — the WHOIS replacement')
  .version('1.0.0')
  .argument('<queries...>', 'domain names, IP addresses, or ASNs to look up')
  .option('--json', 'output raw JSON')
  .action(async (queries: string[], options) => {
    for (let i = 0; i < queries.length; i++) {
      if (i > 0) console.log(chalk.gray('─'.repeat(40)));
      await lookup(queries[i], options);
    }
  });

program.parse();
```

## الخطوة الخامسة: جعلها قابلة للتنفيذ

```json
// package.json
{
  "bin": {
    "rdap": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "tsx src/cli.ts"
  }
}
```

أضف السطر المُشير (shebang) إلى بداية `src/cli.ts`:

```typescript
#!/usr/bin/env node
```

## التشغيل

```bash
# Development
npx tsx src/cli.ts example.com

# Build + install globally
npm run build
npm link

# Now use as system command
rdap google.com
rdap 8.8.8.8
rdap AS15169
rdap --json cloudflare.com
rdap google.com github.com npmjs.com
```

## نموذج للإخراج

```
Domain:     google.com
Status:     client delete prohibited, client transfer prohibited
Registered: 1997-09-15
Expires:    2028-09-14  ← 907 days
Updated:    2024-09-09
Registrar:  MarkMonitor Inc.
NS:         ns1.google.com, ns2.google.com, ns3.google.com, ns4.google.com
DNSSEC:    ✓ signed
```

## النشر على npm

```bash
npm publish --access public
# Users can then: npm install -g rdap-lookup
```

أو الأبسط من ذلك — يأتي RDAPify بواجهة CLI مدمجة:

```bash
npm install -g rdapify
rdapify domain google.com
rdapify ip 8.8.8.8
rdapify asn 15169
```

---

*الكود الكامل للأداة متاح في [أمثلة RDAPify](https://github.com/rdapify/rdapify/tree/main/examples).*

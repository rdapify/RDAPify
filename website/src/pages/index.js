import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './index.module.css';

const HERO_CODE = `import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

const domain = await client.queryDomain('example.com');
console.log(domain.registrar);   // "Example Registrar"
console.log(domain.expiresAt);   // "2027-03-18"

const ip = await client.queryIP('8.8.8.8');
console.log(ip.organization);    // "Google LLC"

const asn = await client.queryASN(15169);
console.log(asn.name);           // "GOOGLE"`;

const BEFORE_AFTER = {
  before: `// The old way: raw WHOIS
const net = require('net');
const socket = net.createConnection(43, 'whois.verisign-grs.com');
socket.write('example.com\\r\\n');
socket.on('data', (data) => {
  // Parse unstructured text yourself...
  // Handle encoding issues...
  // No error codes, no types, no privacy...
  const raw = data.toString();
  // Good luck extracting the registrar name
});`,
  after: `// The new way: RDAPify
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.queryDomain('example.com');

console.log(result.registrar);    // Typed & structured
console.log(result.nameservers);  // Array<string>
console.log(result.expiresAt);    // ISO date string
// SSRF protection, PII redaction, caching — all built in`,
};

const STRINGS = {
  en: {
    heroEyebrow: 'WHOIS is dead. Long live RDAP.',
    heroTitle: <>The modern way to query<br />registration data</>,
    heroSub: 'RDAPify gives you a single, type-safe API to query domains, IPs, and ASNs across every global registry — with security, privacy, and caching out of the box.',
    getStarted: 'Get Started',
    tryPlayground: 'Try the Playground',
    storyEyebrow: 'The story',
    storyTitle: 'From ARPANET to npm install',
    timeline: [
      { year: '1982', title: 'WHOIS is born', desc: 'A plain-text protocol designed for ARPANET. No structure, no security, no privacy.' },
      { year: '2015', title: 'RDAP standardized', desc: 'RFC 7480-7484 define a modern, RESTful replacement with JSON responses and access control.' },
      { year: '2024', title: 'RDAPify ships', desc: 'A unified TypeScript client that makes RDAP as simple as a single function call.' },
    ],
    baEyebrow: 'Before & after',
    baTitle: 'See the difference',
    baLabelBefore: 'Before',
    baLabelAfter: 'After',
    pillarsEyebrow: 'Built for production',
    pillarsTitle: "Everything you need, nothing you don't",
    pillars: [
      { label: 'Security', value: 'SSRF protection, certificate pinning, input sanitization', accent: '#25c2a0' },
      { label: 'Privacy', value: 'Automatic PII redaction, GDPR & CCPA compliance built in', accent: '#3b82f6' },
      { label: 'Performance', value: 'Smart caching, connection pooling, gzip/brotli compression', accent: '#a78bfa' },
      { label: 'TypeScript', value: '100% type coverage with IDE autocompletion and compile-time safety', accent: '#f59e0b' },
    ],
    ctaTitle: 'Ready to replace WHOIS?',
    readDocs: 'Read the Docs',
    viewGitHub: 'View on GitHub',
    viewNpm: 'View on npm',
    layoutTitle: 'RDAPify — The Modern Way to Query Registration Data',
    layoutDesc: 'Unified, type-safe RDAP client. Query domains, IPs, and ASNs across all global registries with one API.',
  },
  ar: {
    heroEyebrow: 'WHOIS انتهى. يحيا RDAP.',
    heroTitle: <>الطريقة الحديثة للاستعلام<br />عن بيانات التسجيل</>,
    heroSub: 'توفّر لك RDAPify واجهة برمجية واحدة وآمنة للاستعلام عن النطاقات وعناوين IP وأرقام AS عبر جميع سجلات الإنترنت العالمية — مع الأمان والخصوصية والتخزين المؤقت جاهزة للاستخدام.',
    getStarted: 'ابدأ الآن',
    tryPlayground: 'جرّب الملعب',
    storyEyebrow: 'القصة',
    storyTitle: 'من ARPANET إلى npm install',
    timeline: [
      { year: '1982', title: 'ولادة WHOIS', desc: 'بروتوكول نص عادي صُمّم لشبكة ARPANET. بلا هيكل، بلا أمان، بلا خصوصية.' },
      { year: '2015', title: 'توحيد RDAP', desc: 'عرّفت معايير RFC 7480-7484 بديلاً حديثاً وموحّداً بردود JSON والتحكم في الوصول.' },
      { year: '2024', title: 'إطلاق RDAPify', desc: 'عميل TypeScript موحّد يجعل RDAP بسيطاً كاستدعاء دالة واحدة.' },
    ],
    baEyebrow: 'قبل وبعد',
    baTitle: 'شاهد الفرق',
    baLabelBefore: 'قبل',
    baLabelAfter: 'بعد',
    pillarsEyebrow: 'مبني للإنتاج',
    pillarsTitle: 'كل ما تحتاجه، لا أكثر ولا أقل',
    pillars: [
      { label: 'الأمان', value: 'حماية SSRF، تثبيت الشهادات، تنقية المدخلات', accent: '#25c2a0' },
      { label: 'الخصوصية', value: 'إخفاء PII تلقائي، امتثال GDPR و CCPA مدمج', accent: '#3b82f6' },
      { label: 'الأداء', value: 'تخزين مؤقت ذكي، تجميع الاتصالات، ضغط gzip/brotli', accent: '#a78bfa' },
      { label: 'TypeScript', value: 'تغطية أنواع 100% مع الإكمال التلقائي وسلامة وقت التجميع', accent: '#f59e0b' },
    ],
    ctaTitle: 'هل أنت مستعد لاستبدال WHOIS؟',
    readDocs: 'اقرأ التوثيق',
    viewGitHub: 'عرض على GitHub',
    viewNpm: 'عرض على npm',
    layoutTitle: 'RDAPify — الطريقة الحديثة للاستعلام عن بيانات التسجيل',
    layoutDesc: 'عميل RDAP موحّد وآمن. استعلم عن النطاقات وعناوين IP وأرقام AS عبر جميع سجلات الإنترنت بواجهة واحدة.',
  },
};

function Hero({ s }) {
  return (
    <header className={styles.hero}>
      <div className={clsx('container', styles.heroInner)}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{s.heroEyebrow}</p>
          <h1 className={styles.heroTitle}>{s.heroTitle}</h1>
          <p className={styles.heroSub}>{s.heroSub}</p>
          <div className={styles.heroCta}>
            <Link className={styles.btnPrimary} to="/docs/getting-started/installation">
              {s.getStarted}
            </Link>
            <Link className={styles.btnGhost} to="/playground">
              {s.tryPlayground}
            </Link>
          </div>
        </div>
        <div className={styles.heroCode}>
          <div className={styles.codeWindow}>
            <div className={styles.codeWindowBar}>
              <span className={styles.dot} data-color="red" />
              <span className={styles.dot} data-color="yellow" />
              <span className={styles.dot} data-color="green" />
              <span className={styles.codeWindowTitle}>example.ts</span>
            </div>
            <CodeBlock language="typescript" className={styles.codeBlock}>
              {HERO_CODE}
            </CodeBlock>
          </div>
        </div>
      </div>
    </header>
  );
}

function Timeline({ s }) {
  return (
    <section className={styles.timeline}>
      <div className="container">
        <h2 className={styles.sectionEyebrow}>{s.storyEyebrow}</h2>
        <h3 className={styles.sectionTitle}>{s.storyTitle}</h3>
        <div className={styles.timelineTrack}>
          {s.timeline.map(({ year, title, desc }) => (
            <div key={year} className={styles.timelineItem}>
              <div className={styles.timelineMarker}>
                <span className={styles.timelineYear}>{year}</span>
                <span className={styles.timelineLine} />
              </div>
              <div className={styles.timelineContent}>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BeforeAfter({ s }) {
  return (
    <section className={styles.beforeAfter}>
      <div className="container">
        <h2 className={styles.sectionEyebrow}>{s.baEyebrow}</h2>
        <h3 className={styles.sectionTitle}>{s.baTitle}</h3>
        <div className={styles.baGrid}>
          <div className={styles.baCard}>
            <span className={styles.baLabel} data-variant="before">{s.baLabelBefore}</span>
            <CodeBlock language="javascript" className={styles.baCode}>
              {BEFORE_AFTER.before}
            </CodeBlock>
          </div>
          <div className={styles.baCard}>
            <span className={styles.baLabel} data-variant="after">{s.baLabelAfter}</span>
            <CodeBlock language="typescript" className={styles.baCode}>
              {BEFORE_AFTER.after}
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pillars({ s }) {
  return (
    <section className={styles.pillars}>
      <div className="container">
        <h2 className={styles.sectionEyebrow}>{s.pillarsEyebrow}</h2>
        <h3 className={styles.sectionTitle}>{s.pillarsTitle}</h3>
        <div className={styles.pillarGrid}>
          {s.pillars.map(({ label, value, accent }) => (
            <div key={label} className={styles.pillarCard}>
              <div className={styles.pillarAccent} style={{ background: accent }} />
              <h4 className={styles.pillarLabel}>{label}</h4>
              <p className={styles.pillarValue}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BottomCta({ s }) {
  return (
    <section className={styles.bottomCta}>
      <div className="container">
        <div className={styles.ctaCard}>
          <h2>{s.ctaTitle}</h2>
          <div className={styles.ctaInstall}>
            <code>npm install rdapify</code>
          </div>
          <div className={styles.ctaLinks}>
            <Link className="button button--primary button--lg" to="/docs/getting-started/installation">
              {s.readDocs}
            </Link>
            <Link className="button button--outline button--primary button--lg" to="https://github.com/rdapify/rdapify">
              {s.viewGitHub}
            </Link>
            <Link className="button button--outline button--primary button--lg" to="https://www.npmjs.com/package/rdapify">
              {s.viewNpm}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { i18n: { currentLocale } } = useDocusaurusContext();
  const s = STRINGS[currentLocale] || STRINGS.en;

  return (
    <Layout title={s.layoutTitle} description={s.layoutDesc}>
      <Hero s={s} />
      <main>
        <Timeline s={s} />
        <BeforeAfter s={s} />
        <Pillars s={s} />
        <BottomCta s={s} />
      </main>
    </Layout>
  );
}

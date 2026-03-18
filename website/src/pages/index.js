import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';

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

const TIMELINE = [
  {
    year: '1982',
    title: 'WHOIS is born',
    desc: 'A plain-text protocol designed for ARPANET. No structure, no security, no privacy.',
  },
  {
    year: '2015',
    title: 'RDAP standardized',
    desc: 'RFC 7480-7484 define a modern, RESTful replacement with JSON responses and access control.',
  },
  {
    year: '2024',
    title: 'RDAPify ships',
    desc: 'A unified TypeScript client that makes RDAP as simple as a single function call.',
  },
];

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

const PILLARS = [
  {
    label: 'Security',
    value: 'SSRF protection, certificate pinning, input sanitization',
    accent: '#25c2a0',
  },
  {
    label: 'Privacy',
    value: 'Automatic PII redaction, GDPR & CCPA compliance built in',
    accent: '#3b82f6',
  },
  {
    label: 'Performance',
    value: 'Smart caching, connection pooling, gzip/brotli compression',
    accent: '#a78bfa',
  },
  {
    label: 'TypeScript',
    value: '100% type coverage with IDE autocompletion and compile-time safety',
    accent: '#f59e0b',
  },
];

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={clsx('container', styles.heroInner)}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>WHOIS is dead. Long live RDAP.</p>
          <h1 className={styles.heroTitle}>
            The modern way to query<br />
            registration data
          </h1>
          <p className={styles.heroSub}>
            RDAPify gives you a single, type-safe API to query domains, IPs, and ASNs
            across every global registry — with security, privacy, and caching out of the box.
          </p>
          <div className={styles.heroCta}>
            <Link className={styles.btnPrimary} to="/docs/getting-started/installation">
              Get Started
            </Link>
            <Link className={styles.btnGhost} to="/playground">
              Try the Playground
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

function Timeline() {
  return (
    <section className={styles.timeline}>
      <div className="container">
        <h2 className={styles.sectionEyebrow}>The story</h2>
        <h3 className={styles.sectionTitle}>
          From ARPANET to npm install
        </h3>
        <div className={styles.timelineTrack}>
          {TIMELINE.map(({ year, title, desc }) => (
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

function BeforeAfter() {
  return (
    <section className={styles.beforeAfter}>
      <div className="container">
        <h2 className={styles.sectionEyebrow}>Before &amp; after</h2>
        <h3 className={styles.sectionTitle}>See the difference</h3>
        <div className={styles.baGrid}>
          <div className={styles.baCard}>
            <span className={styles.baLabel} data-variant="before">Before</span>
            <CodeBlock language="javascript" className={styles.baCode}>
              {BEFORE_AFTER.before}
            </CodeBlock>
          </div>
          <div className={styles.baCard}>
            <span className={styles.baLabel} data-variant="after">After</span>
            <CodeBlock language="typescript" className={styles.baCode}>
              {BEFORE_AFTER.after}
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  return (
    <section className={styles.pillars}>
      <div className="container">
        <h2 className={styles.sectionEyebrow}>Built for production</h2>
        <h3 className={styles.sectionTitle}>Everything you need, nothing you don't</h3>
        <div className={styles.pillarGrid}>
          {PILLARS.map(({ label, value, accent }) => (
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

function BottomCta() {
  return (
    <section className={styles.bottomCta}>
      <div className="container">
        <div className={styles.ctaCard}>
          <h2>Ready to replace WHOIS?</h2>
          <div className={styles.ctaInstall}>
            <code>npm install rdapify</code>
          </div>
          <div className={styles.ctaLinks}>
            <Link className="button button--primary button--lg" to="/docs/getting-started/installation">
              Read the Docs
            </Link>
            <Link className="button button--outline button--primary button--lg" to="https://github.com/rdapify/rdapify">
              View on GitHub
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="RDAPify — The Modern Way to Query Registration Data"
      description="Unified, type-safe RDAP client. Query domains, IPs, and ASNs across all global registries with one API.">
      <Hero />
      <main>
        <Timeline />
        <BeforeAfter />
        <Pillars />
        <BottomCta />
      </main>
    </Layout>
  );
}

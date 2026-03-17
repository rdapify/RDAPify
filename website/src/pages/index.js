import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import CodeBlock from '@theme/CodeBlock';

import styles from './index.module.css';

const STATS = [
  { value: '145+', label: 'Tests Passing' },
  { value: '5', label: 'Global Registries' },
  { value: '65+', label: 'TypeScript Files' },
  { value: '0', label: 'Runtime Deps*' },
];

const QUICK_START_CODE = `import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: { enabled: true, ttl: 3600 },
  privacy: { redactPII: true },
  security: { validateCertificates: true },
});

// Query a domain
const domain = await client.queryDomain('example.com');
console.log(domain.registrar);   // "RegistrarName, Inc."
console.log(domain.expiresAt);   // "2025-12-31T00:00:00Z"

// Query an IP address
const ip = await client.queryIP('8.8.8.8');
console.log(ip.organization);    // "Google LLC"

// Query an ASN
const asn = await client.queryASN(15169);
console.log(asn.name);           // "GOOGLE"`;

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <div className={styles.versionBadge}>v0.1.6 — Production Ready</div>
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/installation">
            Get Started — 5min ⏱️
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="/playground">
            Try Playground
          </Link>
        </div>
        <div className={styles.badges}>
          <img src="https://img.shields.io/npm/v/rdapify.svg?style=flat-square" alt="npm version" />
          <img src="https://img.shields.io/npm/dm/rdapify.svg?style=flat-square" alt="npm downloads" />
          <img src="https://img.shields.io/github/stars/rdapify/rdapify.svg?style=flat-square" alt="GitHub stars" />
          <img src="https://img.shields.io/github/license/rdapify/rdapify.svg?style=flat-square" alt="License" />
          <img src="https://img.shields.io/node/v/rdapify.svg?style=flat-square" alt="Node.js version" />
        </div>
      </div>
    </header>
  );
}

function StatsSection() {
  return (
    <section className={styles.statsSection}>
      <div className="container">
        <div className={styles.statsGrid}>
          {STATS.map(({value, label}) => (
            <div key={label} className={styles.statItem}>
              <span className={styles.statValue}>{value}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>
        <p className={styles.statNote}>* Core library has zero runtime dependencies (except ipaddr.js)</p>
      </div>
    </section>
  );
}

function QuickStartSection() {
  return (
    <section className={styles.quickStartSection}>
      <div className="container">
        <div className={styles.quickStartGrid}>
          <div className={styles.quickStartText}>
            <h2>Up and running in seconds</h2>
            <p>
              Install with your package manager of choice, then query any domain,
              IP, or ASN across all global registries with a single unified API.
            </p>
            <div className={styles.installCommands}>
              <CodeBlock language="bash">{'npm install rdapify'}</CodeBlock>
            </div>
            <div className={styles.quickStartLinks}>
              <Link className="button button--primary" to="/docs/getting-started/quick-start">
                Quick Start Guide
              </Link>
              <Link className="button button--outline button--primary" to="/docs/api-reference/client">
                API Reference
              </Link>
            </div>
          </div>
          <div className={styles.quickStartCode}>
            <CodeBlock language="typescript" title="rdap-example.ts" showLineNumbers>
              {QUICK_START_CODE}
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - RDAP Client`}
      description="Unified, secure, high-performance RDAP client for enterprise applications with built-in privacy controls">
      <HomepageHeader />
      <main>
        <StatsSection />
        <HomepageFeatures />
        <QuickStartSection />
      </main>
    </Layout>
  );
}

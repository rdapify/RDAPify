import React, { useEffect } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './playground.module.css';

export default function Playground() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/playground-app/app.js';
    script.async = false;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <Layout
      title="Playground — Try RDAPify"
      description="Interactive RDAP query tool. Test domain, IP, and ASN lookups in real-time — no installation required.">

      {/* ── Hero ── */}
      <header className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Interactive RDAP Query Tool</p>
          <h1 className={styles.heroTitle}>Try RDAPify before installing</h1>
          <p className={styles.heroSub}>
            Query domains, IPs, and ASNs directly from your browser.
            Queries go straight to public RDAP servers — no backend, no account required.
          </p>
          <div className={styles.heroCta}>
            <Link className={styles.btnPrimary} to="/docs/getting-started/installation">
              Get Started
            </Link>
            <Link className={styles.btnGhost} to="https://www.npmjs.com/package/rdapify" target="_blank">
              npm install rdapify
            </Link>
          </div>
        </div>
      </header>

      {/* ── Playground ── */}
      <main className={styles.main}>
        <div className="container">

          {/* Query Section */}
          <section className={styles.querySection}>

            {/* Left: Query Input */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Query Input</h3>

              <div className={styles.queryType}>
                <label className={styles.typeLabel}>Query Type</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input type="radio" name="queryType" value="domain" defaultChecked />
                    <span>Domain</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input type="radio" name="queryType" value="ip" />
                    <span>IP Address</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input type="radio" name="queryType" value="asn" />
                    <span>ASN</span>
                  </label>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <input
                  type="text"
                  id="queryInput"
                  className={styles.queryInput}
                  placeholder="Enter domain, IP, or ASN…"
                  autoComplete="off"
                />
                <button id="queryButton" className={styles.btnQuery}>
                  <span className="btn-text">Query</span>
                  <span className="btn-loader" style={{ display: 'none' }}>⏳</span>
                </button>
              </div>

              <div id="quotaInfo" className={styles.quotaInfo} style={{ display: 'none' }} />

              <div className={styles.examples}>
                <span className={styles.examplesLabel}>Examples:</span>
                <button className={styles.exampleBtn} data-type="domain" data-query="example.com">example.com</button>
                <button className={styles.exampleBtn} data-type="ip" data-query="8.8.8.8">8.8.8.8</button>
                <button className={styles.exampleBtn} data-type="ip" data-query="2001:4860:4860::8888">2001:4860:4860::8888</button>
                <button className={styles.exampleBtn} data-type="asn" data-query="AS15169">AS15169</button>
              </div>

              <details className={styles.options}>
                <summary className={styles.optionsSummary}>Advanced Options</summary>
                <div className={styles.optionsContent}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" id="optionCache" defaultChecked />
                    <span>Enable caching</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" id="optionRedact" />
                    <span>Redact PII</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" id="optionVerbose" />
                    <span>Verbose output</span>
                  </label>
                </div>
              </details>
            </div>

            {/* Right: Results */}
            <div className={styles.card}>
              <div className={styles.resultsHeader}>
                <h3 className={styles.cardTitle}>Response</h3>
                <div className={styles.resultsActions}>
                  <button id="copyButton" className={styles.btnSmall}>📋 Copy</button>
                  <button id="clearButton" className={styles.btnSmall}>🗑️ Clear</button>
                </div>
              </div>

              <div id="statusBar" className={styles.statusBar} style={{ display: 'none' }}>
                <span id="statusText" />
                <span id="statusTime" />
              </div>

              <div id="resultsContainer" className={styles.resultsContainer}>
                <div className={styles.placeholder}>
                  <div className={styles.placeholderIcon}>🔍</div>
                  <p>Enter a query above to see results</p>
                  <p className={styles.placeholderHint}>Try: example.com, 8.8.8.8, or AS15169</p>
                </div>
              </div>
            </div>
          </section>

          {/* History */}
          <section className={styles.card} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.historyHeader}>
              <h3 className={styles.cardTitle}>Query History</h3>
              <button id="clearHistoryButton" className={styles.btnSmall}>Clear History</button>
            </div>
            <div id="historyContainer" className={styles.historyContainer}>
              <p className={styles.historyEmpty}>No queries yet</p>
            </div>
          </section>

          {/* Install CTA */}
          <section id="installSection" className={styles.installSection}>
            <div className={styles.installCard}>
              <p className={styles.eyebrow}>Ready for more?</p>
              <h2 className={styles.installTitle}>Install RDAPify</h2>
              <p className={styles.installSub}>Unlimited queries, TypeScript types, caching, PII redaction, and more.</p>

              <div className={styles.installCommands}>
                {[
                  'npm install rdapify',
                  'yarn add rdapify',
                  'pnpm add rdapify',
                ].map((cmd) => (
                  <div key={cmd} className={styles.installCode}>
                    <code>{cmd}</code>
                    <button
                      className={styles.copyInstallBtn}
                      onClick={() => navigator.clipboard.writeText(cmd)}
                      title="Copy"
                    >📋</button>
                  </div>
                ))}
              </div>

              <div className={styles.installExample}>
                <p>Quick start:</p>
                <pre><code>{`import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.queryDomain('example.com');
console.log(result.registrar);   // "Example Registrar"
console.log(result.expiresAt);   // "2027-03-18"`}</code></pre>
              </div>

              <div className={styles.installLinks}>
                <Link className={styles.btnPrimary} to="/docs/getting-started/installation">
                  Read the Docs
                </Link>
                <Link
                  className={styles.btnGhost}
                  to="https://github.com/rdapify/RDAPify"
                  target="_blank"
                >
                  View on GitHub
                </Link>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className={styles.features}>
            <p className={styles.eyebrow}>Why RDAPify</p>
            <h2 className={styles.sectionTitle}>Everything you need, nothing you don't</h2>
            <div className={styles.pillarGrid}>
              {[
                { label: 'Security', value: 'SSRF protection, input sanitization, certificate pinning', accent: '#25c2a0' },
                { label: 'Privacy', value: 'Automatic PII redaction, GDPR & CCPA compliance built in', accent: '#3b82f6' },
                { label: 'Performance', value: 'Smart caching, connection pooling, gzip/brotli compression', accent: '#a78bfa' },
                { label: 'TypeScript', value: '100% type coverage with IDE autocompletion and compile-time safety', accent: '#f59e0b' },
              ].map(({ label, value, accent }) => (
                <div key={label} className={styles.pillarCard}>
                  <div className={styles.pillarAccent} style={{ background: accent }} />
                  <h4 className={styles.pillarLabel}>{label}</h4>
                  <p className={styles.pillarValue}>{value}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </Layout>
  );
}

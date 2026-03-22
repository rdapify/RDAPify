import React, { useEffect } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './playground.module.css';

const STRINGS = {
  en: {
    layoutTitle: 'Playground — Try RDAPify',
    layoutDesc: 'Interactive RDAP query tool. Test domain, IP, and ASN lookups in real-time — no installation required.',
    eyebrow: 'Interactive RDAP Query Tool',
    heroTitle: 'Try RDAPify before installing',
    heroSub: 'Query domains, IPs, and ASNs directly from your browser. Queries go straight to public RDAP servers — no backend, no account required.',
    getStarted: 'Get Started',
    npmInstall: 'npm install rdapify',
    queryInputTitle: 'Query Input',
    queryTypeLabel: 'Query Type',
    typeDomain: 'Domain',
    typeIp: 'IP Address',
    typeAsn: 'ASN',
    inputPlaceholder: 'Enter domain, IP, or ASN…',
    queryBtn: 'Query',
    examplesLabel: 'Examples:',
    advancedOptions: 'Advanced Options',
    enableCaching: 'Enable caching',
    redactPii: 'Redact PII',
    verboseOutput: 'Verbose output',
    responseTitle: 'Response',
    copyBtn: '📋 Copy',
    clearBtn: '🗑️ Clear',
    placeholderText: 'Enter a query above to see results',
    placeholderHint: 'Try: example.com, 8.8.8.8, or AS15169',
    historyTitle: 'Query History',
    clearHistory: 'Clear History',
    noHistory: 'No queries yet',
    readyEyebrow: 'Ready for more?',
    installTitle: 'Install RDAPify',
    installSub: 'Unlimited queries, TypeScript types, caching, PII redaction, and more.',
    quickStart: 'Quick start:',
    readDocs: 'Read the Docs',
    viewGitHub: 'View on GitHub',
    featuresEyebrow: 'Why RDAPify',
    featuresTitle: "Everything you need, nothing you don't",
    pillars: [
      { label: 'Security', value: 'SSRF protection, input sanitization, certificate pinning', accent: '#25c2a0' },
      { label: 'Privacy', value: 'Automatic PII redaction, GDPR & CCPA compliance built in', accent: '#3b82f6' },
      { label: 'Performance', value: 'Smart caching, connection pooling, gzip/brotli compression', accent: '#a78bfa' },
      { label: 'TypeScript', value: '100% type coverage with IDE autocompletion and compile-time safety', accent: '#f59e0b' },
    ],
  },
  ar: {
    layoutTitle: 'الملعب التجريبي — جرّب RDAPify',
    layoutDesc: 'أداة استعلام RDAP تفاعلية. اختبر استعلامات النطاقات وعناوين IP وأرقام ASN في الوقت الفعلي — لا يلزم تثبيت.',
    eyebrow: 'أداة استعلام RDAP التفاعلية',
    heroTitle: 'جرّب RDAPify قبل التثبيت',
    heroSub: 'استعلم عن النطاقات وعناوين IP وأرقام ASN مباشرةً من متصفحك. تذهب الاستعلامات مباشرةً إلى خوادم RDAP العامة — لا يلزم backend ولا حساب.',
    getStarted: 'ابدأ الآن',
    npmInstall: 'npm install rdapify',
    queryInputTitle: 'مدخل الاستعلام',
    queryTypeLabel: 'نوع الاستعلام',
    typeDomain: 'نطاق',
    typeIp: 'عنوان IP',
    typeAsn: 'ASN',
    inputPlaceholder: 'أدخل نطاقاً أو عنوان IP أو رقم ASN…',
    queryBtn: 'استعلام',
    examplesLabel: 'أمثلة:',
    advancedOptions: 'خيارات متقدمة',
    enableCaching: 'تفعيل التخزين المؤقت',
    redactPii: 'إخفاء البيانات الشخصية',
    verboseOutput: 'مخرجات مفصّلة',
    responseTitle: 'الاستجابة',
    copyBtn: '📋 نسخ',
    clearBtn: '🗑️ مسح',
    placeholderText: 'أدخل استعلاماً أعلاه لرؤية النتائج',
    placeholderHint: 'جرّب: example.com، أو 8.8.8.8، أو AS15169',
    historyTitle: 'سجل الاستعلامات',
    clearHistory: 'مسح السجل',
    noHistory: 'لا توجد استعلامات بعد',
    readyEyebrow: 'هل أنت مستعد للمزيد؟',
    installTitle: 'ثبّت RDAPify',
    installSub: 'استعلامات غير محدودة، أنواع TypeScript، تخزين مؤقت، إخفاء PII، والمزيد.',
    quickStart: 'بداية سريعة:',
    readDocs: 'اقرأ التوثيق',
    viewGitHub: 'عرض على GitHub',
    featuresEyebrow: 'لماذا RDAPify',
    featuresTitle: 'كل ما تحتاجه، لا أكثر ولا أقل',
    pillars: [
      { label: 'الأمان', value: 'حماية SSRF، تنقية المدخلات، تثبيت الشهادات', accent: '#25c2a0' },
      { label: 'الخصوصية', value: 'إخفاء PII تلقائي، امتثال GDPR و CCPA مدمج', accent: '#3b82f6' },
      { label: 'الأداء', value: 'تخزين مؤقت ذكي، تجميع الاتصالات، ضغط gzip/brotli', accent: '#a78bfa' },
      { label: 'TypeScript', value: 'تغطية أنواع 100% مع الإكمال التلقائي وسلامة وقت التجميع', accent: '#f59e0b' },
    ],
  },
};

export default function Playground() {
  const { i18n: { currentLocale } } = useDocusaurusContext();
  const s = STRINGS[currentLocale] || STRINGS.en;

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
    <Layout title={s.layoutTitle} description={s.layoutDesc}>

      {/* ── Hero ── */}
      <header className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>{s.eyebrow}</p>
          <h1 className={styles.heroTitle}>{s.heroTitle}</h1>
          <p className={styles.heroSub}>{s.heroSub}</p>
          <div className={styles.heroCta}>
            <Link className={styles.btnPrimary} to="/docs/getting-started/installation">
              {s.getStarted}
            </Link>
            <Link className={styles.btnGhost} to="https://www.npmjs.com/package/rdapify" target="_blank">
              {s.npmInstall}
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
              <h3 className={styles.cardTitle}>{s.queryInputTitle}</h3>

              <div className={styles.queryType}>
                <label className={styles.typeLabel}>{s.queryTypeLabel}</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input type="radio" name="queryType" value="domain" defaultChecked />
                    <span>{s.typeDomain}</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input type="radio" name="queryType" value="ip" />
                    <span>{s.typeIp}</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input type="radio" name="queryType" value="asn" />
                    <span>{s.typeAsn}</span>
                  </label>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <input
                  type="text"
                  id="queryInput"
                  className={styles.queryInput}
                  placeholder={s.inputPlaceholder}
                  autoComplete="off"
                />
                <button id="queryButton" className={styles.btnQuery}>
                  <span className="btn-text">{s.queryBtn}</span>
                  <span className="btn-loader" style={{ display: 'none' }}>⏳</span>
                </button>
              </div>

              <div id="quotaInfo" className={styles.quotaInfo} style={{ display: 'none' }} />

              <div className={styles.examples}>
                <span className={styles.examplesLabel}>{s.examplesLabel}</span>
                <button className={styles.exampleBtn} data-type="domain" data-query="example.com">example.com</button>
                <button className={styles.exampleBtn} data-type="ip" data-query="8.8.8.8">8.8.8.8</button>
                <button className={styles.exampleBtn} data-type="ip" data-query="2001:4860:4860::8888">2001:4860:4860::8888</button>
                <button className={styles.exampleBtn} data-type="asn" data-query="AS15169">AS15169</button>
              </div>

              <details className={styles.options}>
                <summary className={styles.optionsSummary}>{s.advancedOptions}</summary>
                <div className={styles.optionsContent}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" id="optionCache" defaultChecked />
                    <span>{s.enableCaching}</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" id="optionRedact" />
                    <span>{s.redactPii}</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" id="optionVerbose" />
                    <span>{s.verboseOutput}</span>
                  </label>
                </div>
              </details>
            </div>

            {/* Right: Results */}
            <div className={styles.card}>
              <div className={styles.resultsHeader}>
                <h3 className={styles.cardTitle}>{s.responseTitle}</h3>
                <div className={styles.resultsActions}>
                  <button id="copyButton" className={styles.btnSmall}>{s.copyBtn}</button>
                  <button id="clearButton" className={styles.btnSmall}>{s.clearBtn}</button>
                </div>
              </div>

              <div id="statusBar" className={styles.statusBar} style={{ display: 'none' }}>
                <span id="statusText" />
                <span id="statusTime" />
              </div>

              <div id="resultsContainer" className={styles.resultsContainer}>
                <div className={styles.placeholder}>
                  <div className={styles.placeholderIcon}>🔍</div>
                  <p>{s.placeholderText}</p>
                  <p className={styles.placeholderHint}>{s.placeholderHint}</p>
                </div>
              </div>
            </div>
          </section>

          {/* History */}
          <section className={styles.card} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.historyHeader}>
              <h3 className={styles.cardTitle}>{s.historyTitle}</h3>
              <button id="clearHistoryButton" className={styles.btnSmall}>{s.clearHistory}</button>
            </div>
            <div id="historyContainer" className={styles.historyContainer}>
              <p className={styles.historyEmpty}>{s.noHistory}</p>
            </div>
          </section>

          {/* Install CTA */}
          <section id="installSection" className={styles.installSection}>
            <div className={styles.installCard}>
              <p className={styles.eyebrow}>{s.readyEyebrow}</p>
              <h2 className={styles.installTitle}>{s.installTitle}</h2>
              <p className={styles.installSub}>{s.installSub}</p>

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
                <p>{s.quickStart}</p>
                <pre><code>{`import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.queryDomain('example.com');
console.log(result.registrar);   // "Example Registrar"
console.log(result.expiresAt);   // "2027-03-18"`}</code></pre>
              </div>

              <div className={styles.installLinks}>
                <Link className={styles.btnPrimary} to="/docs/getting-started/installation">
                  {s.readDocs}
                </Link>
                <Link className={styles.btnGhost} to="https://github.com/rdapify/RDAPify" target="_blank">
                  {s.viewGitHub}
                </Link>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className={styles.features}>
            <p className={styles.eyebrow}>{s.featuresEyebrow}</p>
            <h2 className={styles.sectionTitle}>{s.featuresTitle}</h2>
            <div className={styles.pillarGrid}>
              {s.pillars.map(({ label, value, accent }) => (
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

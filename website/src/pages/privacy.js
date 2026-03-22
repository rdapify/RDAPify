import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';

import styles from './legal.module.css';

const SECTIONS = [
  { id: 'data-we-collect', label: 'Data We Collect' },
  { id: 'how-we-use', label: 'How We Use Your Data' },
  { id: 'legal-basis', label: 'Legal Basis (GDPR)' },
  { id: 'data-sharing', label: 'Data Sharing & Processors' },
  { id: 'data-retention', label: 'Data Retention' },
  { id: 'your-rights', label: 'Your Rights' },
  { id: 'ccpa', label: 'CCPA Disclosures' },
  { id: 'cookies', label: 'Cookies & Tracking' },
  { id: 'international-transfers', label: 'International Transfers' },
  { id: 'children', label: "Children's Privacy" },
  { id: 'security', label: 'Security' },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact' },
];

export default function Privacy() {
  return (
    <Layout
      title="Privacy Policy — RDAPify"
      description="RDAPify Privacy Policy. Learn how we collect, use, and protect your personal data in compliance with GDPR and CCPA."
    >
      <Head>
        <meta property="og:title" content="RDAPify — Privacy Policy" />
        <meta
          property="og:description"
          content="GDPR and CCPA compliant privacy policy for the RDAPify library, API, and Pro services."
        />
        <meta name="twitter:card" content="summary" />
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className="container">
            <p className={styles.eyebrow}>Legal</p>
            <h1 className={styles.title}>Privacy Policy</h1>
            <p className={styles.meta}>
              <strong>Effective date:</strong> March 1, 2026 &nbsp;·&nbsp;
              <strong>Last updated:</strong> March 2026
            </p>
          </div>
        </header>

        <div className="container">
          <div className={styles.content}>
            <nav className={styles.toc}>
              <p className={styles.tocTitle}>On this page</p>
              <ul className={styles.tocList}>
                {SECTIONS.map((s) => (
                  <li key={s.id} className={styles.tocItem}>
                    <a href={`#${s.id}`} className={styles.tocLink}>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={styles.body}>
              <p>
                RDAPify ("<strong>we</strong>," "<strong>us</strong>," or "
                <strong>our</strong>") is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and
                safeguard your personal data when you use the RDAPify website
                (rdapify.com), open-source library, API services, and Pro
                subscription services (collectively, the "
                <strong>Service</strong>").
              </p>
              <p>
                We process personal data in accordance with the{' '}
                <strong>
                  UK General Data Protection Regulation (UK GDPR)
                </strong>
                , the <strong>EU General Data Protection Regulation (GDPR)</strong>,
                the{' '}
                <strong>
                  California Consumer Privacy Act (CCPA)
                </strong>
                , and other applicable data protection laws.
              </p>

              <h2 id="data-we-collect">1. Data We Collect</h2>

              <h3>Information you provide</h3>
              <ul>
                <li>
                  <strong>Account information:</strong> Email address, name, and
                  organization name when you create an account or subscribe to a
                  paid plan.
                </li>
                <li>
                  <strong>Payment information:</strong> Processed and stored
                  exclusively by Paddle (our Merchant of Record). We do not
                  store credit card numbers, bank details, or other payment
                  credentials.
                </li>
                <li>
                  <strong>Communications:</strong> Content of emails or support
                  requests you send us.
                </li>
              </ul>

              <h3>Information collected automatically</h3>
              <ul>
                <li>
                  <strong>Usage data:</strong> API request logs including query
                  type (domain, IP, ASN), timestamp, response status, and
                  latency. We do <strong>not</strong> log the specific query
                  values (e.g., the domain name queried) in standard usage logs.
                </li>
                <li>
                  <strong>IP address:</strong> Collected for rate limiting,
                  abuse prevention, and security purposes. IP addresses in rate
                  limiting logs are automatically hashed and are not stored in
                  plaintext beyond the active rate limiting window.
                </li>
                <li>
                  <strong>Device & browser data:</strong> Browser type, OS,
                  device type, and referrer URL when you visit rdapify.com.
                </li>
                <li>
                  <strong>Cookies:</strong> See the{' '}
                  <a href="#cookies">Cookies & Tracking</a> section below.
                </li>
              </ul>

              <h3>Information we do NOT collect</h3>
              <ul>
                <li>
                  We do <strong>not</strong> collect or store RDAP query results.
                  All query processing happens in your environment (client-side
                  library) or is passed through without persistent storage.
                </li>
                <li>
                  We do <strong>not</strong> sell, rent, or trade your personal
                  data to third parties for marketing or advertising purposes.
                </li>
              </ul>

              <h2 id="how-we-use">2. How We Use Your Data</h2>
              <p>We use the collected data to:</p>
              <ul>
                <li>Provide, maintain, and improve the Service.</li>
                <li>
                  Process payments and manage your subscription (via Paddle).
                </li>
                <li>
                  Enforce rate limits, prevent abuse, and protect the security
                  of the Service.
                </li>
                <li>
                  Respond to support requests and communicate service updates.
                </li>
                <li>
                  Generate aggregated, anonymized analytics to improve the
                  Service (no individual identification possible).
                </li>
                <li>
                  Comply with legal obligations and resolve disputes.
                </li>
              </ul>

              <h2 id="legal-basis">3. Legal Basis for Processing (GDPR)</h2>
              <p>
                Under the GDPR, we process your personal data based on the
                following legal grounds:
              </p>
              <ul>
                <li>
                  <strong>Contract performance:</strong> Processing necessary to
                  provide the Service you requested (Article 6(1)(b)).
                </li>
                <li>
                  <strong>Legitimate interests:</strong> Security, fraud
                  prevention, rate limiting, and service improvement (Article
                  6(1)(f)).
                </li>
                <li>
                  <strong>Legal obligation:</strong> Compliance with applicable
                  laws, tax requirements, and regulatory obligations (Article
                  6(1)(c)).
                </li>
                <li>
                  <strong>Consent:</strong> Where required (e.g., optional
                  analytics cookies), processing is based on your explicit
                  consent (Article 6(1)(a)), which you may withdraw at any time.
                </li>
              </ul>

              <h2 id="data-sharing">4. Data Sharing & Third-Party Processors</h2>
              <p>
                We share personal data only with the following categories of
                third-party processors, each bound by data processing
                agreements:
              </p>
              <ul>
                <li>
                  <strong>Paddle.com Market Limited</strong> (payments) —
                  Processes subscription payments, invoicing, tax collection,
                  and refunds as our Merchant of Record. Paddle's privacy
                  practices are governed by their{' '}
                  <a
                    href="https://www.paddle.com/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>
                  .
                </li>
                <li>
                  <strong>Analytics provider</strong> (website analytics) — We
                  use privacy-respecting analytics to understand website usage
                  patterns. Data is aggregated and anonymized where possible.
                </li>
                <li>
                  <strong>Infrastructure providers</strong> (hosting) — Our
                  servers and CDN infrastructure are hosted by reputable
                  providers with appropriate security certifications.
                </li>
              </ul>
              <p>
                We do <strong>not</strong> sell your personal data. We do{' '}
                <strong>not</strong> share personal data with advertisers or ad
                networks.
              </p>

              <h2 id="data-retention">5. Data Retention</h2>
              <ul>
                <li>
                  <strong>Account data:</strong> Retained for the duration of
                  your account. Deleted within 30 days of account closure upon
                  request.
                </li>
                <li>
                  <strong>API usage logs:</strong> Aggregated and anonymized
                  after 90 days. Raw logs are deleted after 90 days.
                </li>
                <li>
                  <strong>Rate limiting data:</strong> IP hashes retained for
                  the active rate limiting window only (typically 1–5 minutes).
                </li>
                <li>
                  <strong>Payment records:</strong> Retained by Paddle in
                  accordance with applicable tax and financial record-keeping
                  requirements (typically 7 years).
                </li>
                <li>
                  <strong>Support correspondence:</strong> Retained for up to 2
                  years after the last interaction, then deleted.
                </li>
              </ul>

              <h2 id="your-rights">6. Your Rights</h2>
              <p>
                Under the GDPR and applicable data protection laws, you have
                the right to:
              </p>
              <ul>
                <li>
                  <strong>Access:</strong> Request a copy of the personal data
                  we hold about you.
                </li>
                <li>
                  <strong>Rectification:</strong> Request correction of
                  inaccurate or incomplete personal data.
                </li>
                <li>
                  <strong>Erasure ("right to be forgotten"):</strong> Request
                  deletion of your personal data, subject to legal retention
                  requirements.
                </li>
                <li>
                  <strong>Data portability:</strong> Receive your personal data
                  in a structured, commonly used, machine-readable format.
                </li>
                <li>
                  <strong>Restriction:</strong> Request restriction of
                  processing of your personal data in certain circumstances.
                </li>
                <li>
                  <strong>Object:</strong> Object to processing based on
                  legitimate interests.
                </li>
                <li>
                  <strong>Withdraw consent:</strong> Where processing is based
                  on consent, withdraw your consent at any time.
                </li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a>.
                We will respond within 30 days (or the timeframe required by
                applicable law).
              </p>
              <p>
                You also have the right to lodge a complaint with your local
                data protection supervisory authority.
              </p>

              <h2 id="ccpa">7. CCPA Disclosures (California Residents)</h2>
              <p>
                If you are a California resident, you have the following
                additional rights under the California Consumer Privacy Act:
              </p>
              <ul>
                <li>
                  <strong>Right to know:</strong> You may request disclosure of
                  the categories and specific pieces of personal information we
                  have collected about you.
                </li>
                <li>
                  <strong>Right to delete:</strong> You may request deletion of
                  your personal information, subject to certain exceptions.
                </li>
                <li>
                  <strong>Right to opt-out of sale:</strong> We do{' '}
                  <strong>not sell</strong> personal information. No opt-out is
                  necessary.
                </li>
                <li>
                  <strong>Non-discrimination:</strong> We will not discriminate
                  against you for exercising your CCPA rights.
                </li>
              </ul>
              <p>
                To exercise your CCPA rights, contact us at{' '}
                <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a>.
              </p>

              <h2 id="cookies">8. Cookies & Tracking</h2>
              <p>rdapify.com uses the following types of cookies:</p>
              <ul>
                <li>
                  <strong>Essential cookies:</strong> Required for the website
                  to function (theme preference, locale selection). Cannot be
                  disabled.
                </li>
                <li>
                  <strong>Analytics cookies:</strong> Used to understand website
                  usage patterns. These are loaded only with your consent and
                  can be disabled at any time.
                </li>
              </ul>
              <p>
                We do <strong>not</strong> use advertising cookies, tracking
                pixels, or fingerprinting techniques.
              </p>

              <h2 id="international-transfers">9. International Data Transfers</h2>
              <p>
                Your data may be transferred to and processed in countries
                outside your country of residence. Where such transfers occur,
                we ensure appropriate safeguards are in place, including:
              </p>
              <ul>
                <li>
                  Standard Contractual Clauses (SCCs) approved by the European
                  Commission.
                </li>
                <li>
                  Adequacy decisions where the destination country has been
                  deemed to provide an adequate level of data protection.
                </li>
                <li>
                  Paddle's own compliance with international data transfer
                  mechanisms for payment processing.
                </li>
              </ul>

              <h2 id="children">10. Children's Privacy</h2>
              <p>
                The Service is not directed to individuals under the age of 16.
                We do not knowingly collect personal data from children. If we
                become aware that we have collected personal data from a child
                under 16, we will take steps to delete such data promptly.
              </p>

              <h2 id="security">11. Security</h2>
              <p>
                We implement appropriate technical and organizational measures
                to protect your personal data, including:
              </p>
              <ul>
                <li>Encryption of data in transit (TLS 1.2+) and at rest.</li>
                <li>Access controls and principle of least privilege.</li>
                <li>Regular security assessments and dependency auditing.</li>
                <li>
                  SSRF protection, input validation, and security hardening
                  built into the library itself.
                </li>
              </ul>
              <p>
                No method of transmission or storage is 100% secure. While we
                strive to protect your data, we cannot guarantee absolute
                security.
              </p>

              <h2 id="changes">12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. If we make
                material changes, we will notify you by updating the "Last
                updated" date and, where required, providing additional notice.
                Your continued use of the Service after the effective date of
                the revised policy constitutes acceptance of the changes.
              </p>

              <h2 id="contact">13. Contact</h2>
              <p>
                For privacy-related inquiries, data access requests, or
                complaints:
              </p>
              <div className={styles.contactCard}>
                <p>
                  <strong>Privacy contact:</strong>{' '}
                  <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a>
                </p>
                <p>
                  <strong>General support:</strong>{' '}
                  <a href="mailto:support@rdapify.com">support@rdapify.com</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}

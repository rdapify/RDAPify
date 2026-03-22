import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';

import styles from './legal.module.css';

const SECTIONS = [
  { id: 'definitions', label: 'Definitions' },
  { id: 'service-description', label: 'Service Description' },
  { id: 'account-registration', label: 'Account Registration' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'rate-limiting', label: 'Rate Limiting' },
  { id: 'payment-terms', label: 'Payment Terms' },
  { id: 'intellectual-property', label: 'Intellectual Property' },
  { id: 'data-privacy', label: 'Data & Privacy' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'limitation-of-liability', label: 'Limitation of Liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'termination', label: 'Termination' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'changes', label: 'Changes to Terms' },
  { id: 'contact', label: 'Contact' },
];

export default function Terms() {
  return (
    <Layout
      title="Terms of Service — RDAPify"
      description="RDAPify Terms of Service. Read our terms governing the use of the RDAPify library, API, and Pro services."
    >
      <Head>
        <meta property="og:title" content="RDAPify — Terms of Service" />
        <meta
          property="og:description"
          content="Terms of Service governing the use of RDAPify open-source library, API, and Pro subscription services."
        />
        <meta name="twitter:card" content="summary" />
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className="container">
            <p className={styles.eyebrow}>Legal</p>
            <h1 className={styles.title}>Terms of Service</h1>
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
                These Terms of Service ("<strong>Terms</strong>") constitute a
                legally binding agreement between you ("<strong>User</strong>,"
                "<strong>you</strong>," or "<strong>your</strong>") and RDAPify
                ("<strong>we</strong>," "<strong>us</strong>," or "
                <strong>our</strong>") governing your access to and use of the
                RDAPify open-source library, website (rdapify.com), API
                services, and any related Pro or Enterprise subscription
                services (collectively, the "<strong>Service</strong>").
              </p>
              <p>
                By accessing or using the Service, you agree to be bound by
                these Terms. If you do not agree, you must not use the Service.
              </p>

              <h2 id="definitions">1. Definitions</h2>
              <ul>
                <li>
                  <strong>"RDAP"</strong> means the Registration Data Access
                  Protocol as defined by IETF RFCs 7480–7484.
                </li>
                <li>
                  <strong>"Library"</strong> means the open-source{' '}
                  <code>rdapify</code> npm package, distributed under the MIT
                  License.
                </li>
                <li>
                  <strong>"Pro Service"</strong> means the paid subscription
                  offering (<code>@rdapify/pro</code>) providing enhanced
                  monitoring, analytics, and integrations.
                </li>
                <li>
                  <strong>"API"</strong> means any programmatic interface
                  provided by RDAPify for querying registration data.
                </li>
                <li>
                  <strong>"Paddle"</strong> means Paddle.com Market Limited, our
                  Merchant of Record for payment processing.
                </li>
              </ul>

              <h2 id="service-description">2. Service Description</h2>
              <p>
                RDAPify provides a unified TypeScript/JavaScript client library
                and related services for querying domain registration data, IP
                address information, and Autonomous System Number (ASN) records
                via the RDAP protocol. The Service includes:
              </p>
              <ul>
                <li>
                  An open-source library (<code>rdapify</code>) for performing
                  RDAP queries with built-in security protections, caching, and
                  PII redaction.
                </li>
                <li>
                  A Pro subscription service offering bulk monitoring, change
                  detection, analytics, webhook integrations, and export
                  capabilities.
                </li>
                <li>
                  Documentation, playground tools, and developer resources
                  available at rdapify.com.
                </li>
              </ul>

              <h2 id="account-registration">3. Account Registration</h2>
              <p>
                To access certain features of the Service, you may be required
                to create an account. You agree to:
              </p>
              <ul>
                <li>
                  Provide accurate, current, and complete information during
                  registration.
                </li>
                <li>
                  Maintain the security of your account credentials and API
                  keys.
                </li>
                <li>
                  Promptly notify us of any unauthorized access to your account.
                </li>
                <li>
                  Accept responsibility for all activities that occur under your
                  account.
                </li>
              </ul>

              <h2 id="acceptable-use">4. Acceptable Use Policy</h2>
              <p>You agree not to use the Service to:</p>
              <ul>
                <li>
                  Conduct large-scale automated scraping or data harvesting of
                  RDAP servers without prior written authorization from RDAPify
                  and the applicable registry operators.
                </li>
                <li>
                  Violate any applicable laws, regulations, or third-party
                  rights, including data protection and privacy laws.
                </li>
                <li>
                  Attempt to circumvent rate limits, access controls, or
                  security measures implemented by the Service or by upstream
                  RDAP servers.
                </li>
                <li>
                  Use the Service to facilitate phishing, domain hijacking,
                  trademark infringement, or any form of cybercrime.
                </li>
                <li>
                  Redistribute, resell, or sublicense access to the Pro Service
                  without written authorization.
                </li>
                <li>
                  Transmit any malicious code, exploit, or payload through the
                  Service.
                </li>
                <li>
                  Interfere with or disrupt the integrity or performance of the
                  Service or its underlying infrastructure.
                </li>
              </ul>
              <p>
                We reserve the right to suspend or terminate access to the
                Service, without notice, for any violation of this Acceptable
                Use Policy.
              </p>

              <h2 id="rate-limiting">5. Rate Limiting</h2>
              <p>
                The Service enforces rate limits to ensure fair use and protect
                upstream RDAP registry infrastructure. Current rate limits are:
              </p>
              <ul>
                <li>
                  <strong>Free tier:</strong> 60 requests per minute.
                </li>
                <li>
                  <strong>Pro tier:</strong> 600 requests per minute.
                </li>
                <li>
                  <strong>Enterprise tier:</strong> Custom limits as agreed in
                  your Enterprise agreement.
                </li>
              </ul>
              <p>
                Requests exceeding your rate limit will receive a{' '}
                <code>429 Too Many Requests</code> response with a{' '}
                <code>Retry-After</code> header. Persistent or deliberate
                attempts to exceed rate limits may result in temporary or
                permanent suspension of access.
              </p>

              <h2 id="payment-terms">6. Payment Terms</h2>
              <p>
                All paid subscriptions are processed through{' '}
                <strong>Paddle.com Market Limited</strong>, which acts as our
                Merchant of Record. By subscribing to a paid plan, you agree
                to:
              </p>
              <ul>
                <li>
                  Paddle's{' '}
                  <a
                    href="https://www.paddle.com/legal/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
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
                  Subscriptions are billed on a recurring monthly or annual
                  basis, depending on the plan selected.
                </li>
                <li>
                  Prices are listed exclusive of tax. Paddle calculates and
                  collects applicable VAT or sales tax based on your location.
                </li>
                <li>
                  You may cancel your subscription at any time. Cancellation
                  takes effect at the end of the current billing period.
                </li>
                <li>
                  Refunds are subject to our{' '}
                  <a href="/refund">Refund Policy</a>.
                </li>
              </ul>

              <h2 id="intellectual-property">7. Intellectual Property</h2>
              <h3>Open-Source Library</h3>
              <p>
                The <code>rdapify</code> library is released under the{' '}
                <strong>MIT License</strong>. You may use, copy, modify, merge,
                publish, distribute, sublicense, and/or sell copies of the
                Library in accordance with the MIT License terms. The MIT
                License for the open-source library will not change.
              </p>
              <h3>Pro Service & Proprietary Components</h3>
              <p>
                The <code>@rdapify/pro</code> package, its source code, compiled
                binaries, documentation, and related materials are proprietary
                and protected by copyright and intellectual property laws. You
                are granted a limited, non-exclusive, non-transferable,
                revocable license to use the Pro Service solely in accordance
                with your subscription terms.
              </p>
              <h3>Trademarks</h3>
              <p>
                "RDAPify," the RDAPify logo, and associated branding are
                trademarks of RDAPify. You may not use these marks without prior
                written permission, except as reasonably necessary to identify
                the Service in accordance with fair use principles.
              </p>

              <h2 id="data-privacy">8. Data & Privacy</h2>
              <p>
                Your use of the Service is also governed by our{' '}
                <a href="/privacy">Privacy Policy</a>, which describes how we
                collect, use, and protect your personal data. RDAP query results
                may contain personal data subject to applicable data protection
                regulations (including GDPR and CCPA). You are solely
                responsible for ensuring your use of such data complies with all
                applicable laws.
              </p>

              <h2 id="disclaimers">9. Disclaimers</h2>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY.
                WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO
                WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
                NON-INFRINGEMENT, AND ACCURACY.
              </p>
              <p>
                We do not guarantee that:
              </p>
              <ul>
                <li>
                  RDAP query results will be accurate, complete, or current, as
                  data is sourced from third-party registry operators.
                </li>
                <li>
                  The Service will be uninterrupted, error-free, or free of
                  harmful components.
                </li>
                <li>
                  Upstream RDAP servers will be available or responsive at all
                  times.
                </li>
              </ul>

              <h2 id="limitation-of-liability">
                10. Limitation of Liability
              </h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT
                SHALL RDAPIFY, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS,
                SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT
                LIMITATION LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER
                INTANGIBLE LOSSES, RESULTING FROM:
              </p>
              <ul>
                <li>Your access to or use of (or inability to use) the Service.</li>
                <li>Any conduct or content of any third party on the Service.</li>
                <li>
                  Unauthorized access, use, or alteration of your transmissions
                  or data.
                </li>
                <li>
                  Inaccuracies or omissions in RDAP data provided by upstream
                  registries.
                </li>
              </ul>
              <p>
                Our total aggregate liability for all claims arising out of or
                relating to these Terms or the Service shall not exceed the
                greater of (a) the amount you paid us in the twelve (12) months
                preceding the claim, or (b) one hundred US dollars (US$100).
              </p>

              <h2 id="indemnification">11. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless RDAPify and
                its officers, directors, employees, and agents from and against
                any claims, liabilities, damages, losses, and expenses
                (including reasonable legal fees) arising out of or in any way
                connected with your access to or use of the Service, your
                violation of these Terms, or your violation of any third-party
                rights.
              </p>

              <h2 id="termination">12. Termination</h2>
              <p>
                We may terminate or suspend your access to the Service
                immediately, without prior notice, for any reason, including if
                you breach these Terms. Upon termination:
              </p>
              <ul>
                <li>
                  Your right to use the Service (including Pro features) ceases
                  immediately.
                </li>
                <li>
                  You remain responsible for any outstanding payment obligations.
                </li>
                <li>
                  Provisions that by their nature should survive termination
                  shall survive, including intellectual property, limitation of
                  liability, indemnification, and governing law.
                </li>
              </ul>
              <p>
                You may terminate your account at any time by cancelling your
                subscription (if applicable) and ceasing use of the Service.
              </p>

              <h2 id="governing-law">13. Governing Law & Dispute Resolution</h2>
              <p>
                These Terms shall be governed by and construed in accordance
                with the laws of <strong>England and Wales</strong>, without
                regard to conflict of law principles.
              </p>
              <p>
                Any dispute arising out of or in connection with these Terms
                shall first be attempted to be resolved through good-faith
                negotiation. If the dispute cannot be resolved within thirty
                (30) days, either party may submit the dispute to the exclusive
                jurisdiction of the courts of England and Wales.
              </p>
              <p>
                For users outside the United Kingdom, nothing in these Terms
                affects your statutory consumer rights under the laws of your
                country of residence.
              </p>

              <h2 id="changes">14. Changes to These Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. If we
                make material changes, we will notify you by updating the "Last
                updated" date at the top of this page and, where practicable,
                providing additional notice (such as an email or in-app
                notification). Your continued use of the Service after the
                effective date of the revised Terms constitutes acceptance of
                the changes.
              </p>

              <h2 id="contact">15. Contact</h2>
              <p>
                If you have questions about these Terms, please contact us:
              </p>
              <div className={styles.contactCard}>
                <p>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:legal@rdapify.com">legal@rdapify.com</a>
                </p>
                <p>
                  <strong>GitHub:</strong>{' '}
                  <a
                    href="https://github.com/rdapify/rdapify/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    github.com/rdapify/rdapify/issues
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}

import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';

import styles from './legal.module.css';

const SECTIONS = [
  { id: 'money-back-guarantee', label: '14-Day Guarantee' },
  { id: 'after-14-days', label: 'After 14 Days' },
  { id: 'how-to-request', label: 'How to Request a Refund' },
  { id: 'processing', label: 'Processing & Timeline' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'cancellation', label: 'Cancellation vs. Refund' },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact' },
];

export default function Refund() {
  return (
    <Layout
      title="Refund Policy — RDAPify"
      description="RDAPify Refund Policy. 14-day money-back guarantee for new Pro subscribers. Learn how to request a refund."
    >
      <Head>
        <meta property="og:title" content="RDAPify — Refund Policy" />
        <meta
          property="og:description"
          content="14-day money-back guarantee for new RDAPify Pro subscribers. Clear and transparent refund process."
        />
        <meta name="twitter:card" content="summary" />
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className="container">
            <p className={styles.eyebrow}>Legal</p>
            <h1 className={styles.title}>Refund Policy</h1>
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
                This Refund Policy applies to paid subscriptions for the
                RDAPify Pro and Enterprise services. All payments are processed
                by <strong>Paddle.com Market Limited</strong>, our Merchant of
                Record.
              </p>
              <p>
                The open-source <code>rdapify</code> library is free and does
                not involve any payments or refunds.
              </p>

              <h2 id="money-back-guarantee">1. 14-Day Money-Back Guarantee</h2>
              <p>
                We offer a <strong>14-day money-back guarantee</strong> for all
                new Pro and Enterprise subscriptions. If you are not satisfied
                with the Service for any reason, you may request a full refund
                within 14 calendar days of your initial subscription purchase.
              </p>
              <ul>
                <li>
                  The 14-day period begins on the date of your first payment,
                  not the date you activated or started using the Service.
                </li>
                <li>
                  This guarantee applies only to <strong>first-time</strong>{' '}
                  subscribers. If you have previously subscribed, cancelled, and
                  re-subscribed, the guarantee does not apply to the new
                  subscription.
                </li>
                <li>
                  Refunds under this guarantee are issued for the full
                  subscription amount, including any taxes collected.
                </li>
              </ul>

              <h2 id="after-14-days">2. After 14 Days</h2>
              <p>
                After the 14-day guarantee period, refunds are generally{' '}
                <strong>not</strong> provided. However, we may consider refunds
                at our sole discretion in the following circumstances:
              </p>
              <ul>
                <li>
                  <strong>Service outage:</strong> A prolonged, unscheduled
                  outage that materially prevented you from using the Service
                  for a significant portion of a billing period.
                </li>
                <li>
                  <strong>Billing error:</strong> You were incorrectly charged
                  (e.g., duplicate charge, wrong amount, charge after
                  cancellation).
                </li>
                <li>
                  <strong>Extenuating circumstances:</strong> Situations
                  evaluated on a case-by-case basis.
                </li>
              </ul>
              <p>
                Partial refunds or service credits may be offered in lieu of a
                full refund where appropriate.
              </p>

              <h2 id="how-to-request">3. How to Request a Refund</h2>
              <p>To request a refund, follow these steps:</p>
              <ol>
                <li>
                  Send an email to{' '}
                  <a href="mailto:support@rdapify.com">support@rdapify.com</a>{' '}
                  with the subject line "<strong>Refund Request</strong>."
                </li>
                <li>
                  Include the following information:
                  <ul>
                    <li>
                      The email address associated with your RDAPify account.
                    </li>
                    <li>Your Paddle order number or transaction ID.</li>
                    <li>
                      The reason for your refund request (optional but helpful).
                    </li>
                  </ul>
                </li>
                <li>
                  We will acknowledge your request within{' '}
                  <strong>2 business days</strong> and provide a decision within{' '}
                  <strong>5 business days</strong>.
                </li>
              </ol>

              <h2 id="processing">4. Processing & Timeline</h2>
              <ul>
                <li>
                  Approved refunds are processed by{' '}
                  <strong>Paddle</strong> and typically take{' '}
                  <strong>3–5 business days</strong> to appear on your statement,
                  depending on your payment method and financial institution.
                </li>
                <li>
                  Refunds are issued to the original payment method used for
                  the transaction.
                </li>
                <li>
                  If your refund has not appeared after 10 business days,
                  contact Paddle's support or reach out to us and we will
                  investigate.
                </li>
                <li>
                  Tax amounts collected by Paddle will also be refunded.
                </li>
              </ul>

              <h2 id="exceptions">5. Exceptions</h2>
              <p>Refunds will <strong>not</strong> be issued in cases of:</p>
              <ul>
                <li>
                  <strong>Violation of Terms:</strong> Your account was
                  suspended or terminated due to a violation of our{' '}
                  <a href="/terms">Terms of Service</a>, including the
                  Acceptable Use Policy.
                </li>
                <li>
                  <strong>Abuse or fraud:</strong> Evidence of fraudulent
                  subscription activity, including subscribing solely to obtain
                  a refund after excessive use.
                </li>
                <li>
                  <strong>Third-party issues:</strong> Service disruptions
                  caused by factors beyond our control, including upstream RDAP
                  registry outages, internet connectivity issues, or your own
                  infrastructure failures.
                </li>
              </ul>

              <h2 id="cancellation">6. Cancellation vs. Refund</h2>
              <p>
                Cancelling your subscription and requesting a refund are
                separate actions:
              </p>
              <ul>
                <li>
                  <strong>Cancellation</strong> stops future billing. You retain
                  access to Pro features until the end of your current billing
                  period. No refund is issued for the remaining days.
                </li>
                <li>
                  <strong>Refund</strong> returns money for a charge already
                  made. Upon refund, access to Pro features may be revoked
                  immediately.
                </li>
              </ul>
              <p>
                You can cancel your subscription at any time through your
                account dashboard or by contacting{' '}
                <a href="mailto:support@rdapify.com">support@rdapify.com</a>.
              </p>

              <h2 id="changes">7. Changes to This Policy</h2>
              <p>
                We may update this Refund Policy from time to time. Material
                changes will be communicated by updating the "Last updated"
                date. Changes do not apply retroactively to refund requests
                submitted before the change.
              </p>

              <h2 id="contact">8. Contact</h2>
              <p>
                For refund requests or questions about this policy:
              </p>
              <div className={styles.contactCard}>
                <p>
                  <strong>Refund requests:</strong>{' '}
                  <a href="mailto:support@rdapify.com">support@rdapify.com</a>
                </p>
                <p>
                  <strong>General inquiries:</strong>{' '}
                  <a href="mailto:legal@rdapify.com">legal@rdapify.com</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}

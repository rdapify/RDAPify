import React, { useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';

import styles from './pricing.module.css';

const TIERS = [
  {
    name: 'Free',
    description: 'Open-source library for individual developers and small projects.',
    price: '$0',
    period: 'forever',
    accent: '#25c2a0',
    cta: 'Get Started',
    ctaLink: '/docs/getting-started/installation',
    ctaStyle: 'ghost',
    features: [
      'npm install rdapify — MIT licensed',
      'Domain, IP & ASN queries',
      'TypeScript types & autocompletion',
      'SSRF protection & input sanitization',
      'Automatic PII redaction',
      'In-memory caching',
      'Community support (GitHub)',
      'Rate limited (60 req/min)',
    ],
  },
  {
    name: 'Pro',
    description: 'For teams and businesses that need monitoring, analytics, and higher limits.',
    price: '$49',
    period: '/month',
    accent: '#3b82f6',
    cta: 'Start Free Trial',
    ctaLink: '/docs/getting-started/installation',
    ctaStyle: 'primary',
    popular: true,
    features: [
      'Everything in Free, plus:',
      'Bulk domain monitoring',
      'Change detection & alerts',
      'Analytics & trend reports',
      'Webhook integrations (Slack, Discord, Teams)',
      'CSV & JSON export',
      'Redis & custom cache adapters',
      'Priority email support',
      'Higher rate limits (600 req/min)',
    ],
  },
  {
    name: 'Enterprise',
    description: 'Custom solutions for organizations with advanced compliance and scale needs.',
    price: 'Custom',
    period: '',
    accent: '#a78bfa',
    cta: 'Contact Sales',
    ctaLink: 'mailto:sales@rdapify.com',
    ctaStyle: 'ghost',
    features: [
      'Everything in Pro, plus:',
      'Unlimited rate limits',
      'Dedicated support & SLA',
      'On-premise deployment option',
      'Custom integrations',
      'SSO & team management',
      'Audit logging & compliance reports',
      'Invoice billing & PO support',
      'Dedicated account manager',
    ],
  },
];

const FAQ = [
  {
    q: 'Can I use the free tier in production?',
    a: 'Yes. The open-source rdapify library is MIT-licensed and free for any use — personal, commercial, or enterprise. The free tier has rate limits (60 requests/minute) which are sufficient for most individual use cases.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We use Paddle as our Merchant of Record. Paddle accepts all major credit/debit cards, PayPal, Apple Pay, Google Pay, and wire transfers for enterprise plans. Paddle handles VAT/sales tax automatically based on your location.',
  },
  {
    q: 'Can I cancel my subscription at any time?',
    a: 'Yes. You can cancel your Pro subscription at any time. You will retain access to Pro features until the end of your current billing period. We also offer a 14-day money-back guarantee for new subscribers.',
  },
  {
    q: 'What happens if I exceed my rate limits?',
    a: 'Requests exceeding your rate limit will receive a 429 (Too Many Requests) response with a Retry-After header. You can upgrade your plan at any time for higher limits, or contact us for custom rate limit configurations.',
  },
  {
    q: 'Do you offer discounts for startups or open-source projects?',
    a: 'Yes. We offer discounted pricing for verified startups, educational institutions, and open-source maintainers. Contact us at sales@rdapify.com with details about your project.',
  },
  {
    q: 'Is there a self-hosted option?',
    a: 'The open-source library runs entirely in your environment with no external dependencies. For Enterprise customers, we offer on-premise deployment of the full Pro feature set with dedicated support.',
  },
];

function PricingCard({ tier }) {
  return (
    <div className={clsx(styles.card, tier.popular && styles.cardPopular)}>
      {tier.popular && <span className={styles.popularBadge}>Most Popular</span>}
      <div className={styles.cardAccent} style={{ background: tier.accent }} />
      <div className={styles.cardHeader}>
        <h3 className={styles.tierName}>{tier.name}</h3>
        <p className={styles.tierDesc}>{tier.description}</p>
        <div className={styles.priceRow}>
          <span className={styles.price}>{tier.price}</span>
          {tier.period && <span className={styles.period}>{tier.period}</span>}
        </div>
      </div>
      <ul className={styles.featureList}>
        {tier.features.map((f, i) => (
          <li key={i} className={styles.featureItem}>
            <span className={styles.checkIcon}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <div className={styles.cardFooter}>
        <Link
          className={clsx(
            styles.tierCta,
            tier.ctaStyle === 'primary' ? styles.ctaPrimary : styles.ctaGhost
          )}
          to={tier.ctaLink}
        >
          {tier.cta}
        </Link>
      </div>
    </div>
  );
}

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={clsx(styles.faqItem, open && styles.faqOpen)}>
      <button
        className={styles.faqQuestion}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{item.q}</span>
        <span className={styles.faqChevron}>{open ? '−' : '+'}</span>
      </button>
      {open && <p className={styles.faqAnswer}>{item.a}</p>}
    </div>
  );
}

export default function Pricing() {
  return (
    <Layout
      title="Pricing — RDAPify"
      description="RDAPify pricing plans. Free open-source tier, Pro for teams, and Enterprise for organizations."
    >
      <Head>
        <meta property="og:title" content="RDAPify Pricing" />
        <meta
          property="og:description"
          content="Choose the right RDAPify plan for your needs. Free open-source library, Pro monitoring & analytics, or custom Enterprise solutions."
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <main className={styles.main}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className="container">
            <p className={styles.eyebrow}>Pricing</p>
            <h1 className={styles.heroTitle}>
              Simple, transparent pricing
            </h1>
            <p className={styles.heroSub}>
              Start free with the open-source library. Upgrade to Pro when you need
              monitoring, analytics, and higher rate limits.
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className={styles.cards}>
          <div className="container">
            <div className={styles.cardGrid}>
              {TIERS.map((tier) => (
                <PricingCard key={tier.name} tier={tier} />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.faqSection}>
          <div className="container">
            <p className={styles.eyebrow}>FAQ</p>
            <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
            <div className={styles.faqList}>
              {FAQ.map((item, i) => (
                <FAQItem key={i} item={item} />
              ))}
            </div>
          </div>
        </section>

        {/* Paddle Badge */}
        <section className={styles.paddleSection}>
          <div className="container">
            <div className={styles.paddleBadge}>
              <span className={styles.paddleText}>
                Payments securely processed by
              </span>
              <span className={styles.paddleLogo}>Paddle</span>
              <p className={styles.paddleSub}>
                Paddle is the Merchant of Record for all transactions.
                VAT and sales tax handled automatically.
              </p>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

import React, { useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './pricing.module.css';

const STRINGS = {
  en: {
    layoutTitle: 'Pricing — RDAPify',
    layoutDesc: 'RDAPify pricing plans. Free open-source tier, Pro for teams, and Enterprise for organizations.',
    eyebrow: 'Pricing',
    heroTitle: 'Simple, transparent pricing',
    heroSub: 'Start free with the open-source library. Upgrade to Pro when you need monitoring, analytics, and higher rate limits.',
    popularBadge: 'Most Popular',
    billingMonthly: 'Monthly',
    billingYearly: 'Yearly',
    saveBadge: 'Save 35%',
    faqEyebrow: 'FAQ',
    faqTitle: 'Frequently asked questions',
    paddleText: 'Payments securely processed by',
    paddleSub: 'Paddle is the Merchant of Record for all transactions. VAT and sales tax handled automatically.',
    tiers: [
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
        priceMonthly: '$19',
        priceYearly: '$149',
        periodMonthly: '/month',
        periodYearly: '/year',
        accent: '#3b82f6',
        cta: 'Get Started',
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
    ],
    faq: [
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
        a: 'Yes. You can cancel your Pro subscription at any time. You will retain access to Pro features until the end of your current billing period. Refunds are handled by Paddle in accordance with their refund policy.',
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
    ],
  },
  ar: {
    layoutTitle: 'الأسعار — RDAPify',
    layoutDesc: 'خطط أسعار RDAPify. طبقة مجانية مفتوحة المصدر، Pro للفرق، وEnterprise للمؤسسات.',
    eyebrow: 'الأسعار',
    heroTitle: 'أسعار بسيطة وشفافة',
    heroSub: 'ابدأ مجاناً بالمكتبة مفتوحة المصدر. انتقل إلى Pro عندما تحتاج المراقبة والتحليلات وحدود معدل أعلى.',
    popularBadge: 'الأكثر شعبية',
    billingMonthly: 'شهري',
    billingYearly: 'سنوي',
    saveBadge: 'وفّر 35%',
    faqEyebrow: 'الأسئلة الشائعة',
    faqTitle: 'أسئلة مطروحة بكثرة',
    paddleText: 'تتم معالجة المدفوعات بأمان عبر',
    paddleSub: 'Paddle هو التاجر المعتمد لجميع المعاملات. يتم التعامل مع ضريبة القيمة المضافة وضريبة المبيعات تلقائياً.',
    tiers: [
      {
        name: 'مجاني',
        description: 'مكتبة مفتوحة المصدر للمطورين الأفراد والمشاريع الصغيرة.',
        price: '$0',
        period: 'للأبد',
        accent: '#25c2a0',
        cta: 'ابدأ الآن',
        ctaLink: '/docs/getting-started/installation',
        ctaStyle: 'ghost',
        features: [
          'npm install rdapify — رخصة MIT',
          'استعلامات النطاقات وIP وASN',
          'أنواع TypeScript والإكمال التلقائي',
          'حماية SSRF وتنقية المدخلات',
          'إخفاء PII تلقائي',
          'تخزين مؤقت في الذاكرة',
          'دعم المجتمع (GitHub)',
          'معدل محدود (60 طلب/دقيقة)',
        ],
      },
      {
        name: 'Pro',
        description: 'للفرق والشركات التي تحتاج مراقبة وتحليلات وحدود أعلى.',
        priceMonthly: '$19',
        priceYearly: '$149',
        periodMonthly: '/شهر',
        periodYearly: '/سنة',
        accent: '#3b82f6',
        cta: 'ابدأ الآن',
        ctaLink: '/docs/getting-started/installation',
        ctaStyle: 'primary',
        popular: true,
        features: [
          'كل ما في المجاني، بالإضافة إلى:',
          'مراقبة النطاقات بالجملة',
          'كشف التغييرات والتنبيهات',
          'تقارير التحليلات والاتجاهات',
          'تكاملات Webhook (Slack، Discord، Teams)',
          'تصدير CSV وJSON',
          'Redis ومحوّلات تخزين مؤقت مخصصة',
          'دعم بريد إلكتروني ذو أولوية',
          'حدود معدل أعلى (600 طلب/دقيقة)',
        ],
      },
      {
        name: 'مؤسسات',
        description: 'حلول مخصصة للمؤسسات ذات احتياجات الامتثال والحجم المتقدمة.',
        price: 'مخصص',
        period: '',
        accent: '#a78bfa',
        cta: 'تواصل مع المبيعات',
        ctaLink: 'mailto:sales@rdapify.com',
        ctaStyle: 'ghost',
        features: [
          'كل ما في Pro، بالإضافة إلى:',
          'حدود معدل غير محدودة',
          'دعم مخصص واتفاقية مستوى الخدمة SLA',
          'خيار النشر المحلي',
          'تكاملات مخصصة',
          'SSO وإدارة الفريق',
          'سجلات التدقيق وتقارير الامتثال',
          'فوترة بالفاتورة ودعم أوامر الشراء',
          'مدير حساب مخصص',
        ],
      },
    ],
    faq: [
      {
        q: 'هل يمكنني استخدام الطبقة المجانية في الإنتاج؟',
        a: 'نعم. مكتبة rdapify مفتوحة المصدر مرخصة بـ MIT ومجانية لأي استخدام — شخصي أو تجاري أو مؤسسي. تمتلك الطبقة المجانية حدود معدل (60 طلباً/دقيقة) وهي كافية لمعظم حالات الاستخدام الفردية.',
      },
      {
        q: 'ما طرق الدفع التي تقبلونها؟',
        a: 'نستخدم Paddle كتاجر معتمد. يقبل Paddle جميع بطاقات الائتمان/الخصم الرئيسية، وPayPal، وApple Pay، وGoogle Pay، والتحويلات البنكية لخطط المؤسسات. يتعامل Paddle مع ضريبة القيمة المضافة/ضريبة المبيعات تلقائياً بناءً على موقعك.',
      },
      {
        q: 'هل يمكنني إلغاء اشتراكي في أي وقت؟',
        a: 'نعم. يمكنك إلغاء اشتراك Pro في أي وقت. ستحتفظ بالوصول إلى ميزات Pro حتى نهاية فترة الفوترة الحالية. تتم معالجة المبالغ المستردة من قِبل Paddle وفقاً لسياسة الاسترداد الخاصة بهم.',
      },
      {
        q: 'ماذا يحدث إذا تجاوزت حدود المعدل؟',
        a: 'ستتلقى الطلبات التي تتجاوز حد المعدل ردًا 429 (طلبات كثيرة جداً) مع رأس Retry-After. يمكنك ترقية خطتك في أي وقت للحصول على حدود أعلى، أو اتصل بنا لتكوينات حدود معدل مخصصة.',
      },
      {
        q: 'هل تقدمون خصومات للشركات الناشئة أو المشاريع مفتوحة المصدر؟',
        a: 'نعم. نقدم أسعاراً مخفضة للشركات الناشئة الموثقة والمؤسسات التعليمية ومشرفي المصادر المفتوحة. تواصل معنا على sales@rdapify.com مع تفاصيل مشروعك.',
      },
      {
        q: 'هل يوجد خيار للاستضافة الذاتية؟',
        a: 'تعمل المكتبة مفتوحة المصدر بالكامل في بيئتك بدون تبعيات خارجية. لعملاء المؤسسات، نقدم نشراً محلياً لمجموعة ميزات Pro الكاملة مع دعم مخصص.',
      },
    ],
  },
};

function PricingCard({ tier, popularBadge, billing, onCheckout }) {
  const isProTier = !!tier.priceMonthly;
  const displayPrice  = isProTier ? (billing === 'yearly' ? tier.priceYearly  : tier.priceMonthly)  : tier.price;
  const displayPeriod = isProTier ? (billing === 'yearly' ? tier.periodYearly : tier.periodMonthly) : tier.period;
  const priceId = isProTier ? (billing === 'yearly' ? tier.priceIdYearly : tier.priceIdMonthly) : null;

  return (
    <div className={clsx(styles.card, tier.popular && styles.cardPopular)}>
      {tier.popular && <span className={styles.popularBadge}>{popularBadge}</span>}
      <div className={styles.cardAccent} style={{ background: tier.accent }} />
      <div className={styles.cardHeader}>
        <h3 className={styles.tierName}>{tier.name}</h3>
        <p className={styles.tierDesc}>{tier.description}</p>
        <div className={styles.priceRow}>
          <span className={styles.price}>{displayPrice}</span>
          {displayPeriod && <span className={styles.period}>{displayPeriod}</span>}
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
        {priceId ? (
          <button
            className={clsx(styles.tierCta, styles.ctaPrimary)}
            onClick={() => onCheckout(priceId)}
          >
            {tier.cta}
          </button>
        ) : (
          <Link
            className={clsx(styles.tierCta, styles.ctaGhost)}
            to={tier.ctaLink}
          >
            {tier.cta}
          </Link>
        )}
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
  const { i18n: { currentLocale }, siteConfig: { customFields } } = useDocusaurusContext();
  const s = STRINGS[currentLocale] || STRINGS.en;
  const [billing, setBilling] = useState('monthly');

  // Inject config for paddle-init.js (static script can't access React context)
  if (typeof window !== 'undefined') {
    window.__paddleConfig = {
      token: customFields.paddleClientToken,
      environment: customFields.paddleEnvironment,
    };
  }

  function openCheckout(priceId) {
    if (!window.__paddleReady) {
      alert('Paddle is still loading, please try again in a moment.');
      return;
    }
    // No customer object is passed intentionally: this is a public static marketing
    // page with no user sessions. Paddle will collect the customer's email during
    // checkout. The billing app (Next.js) handles customer binding via webhooks.
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
    });
  }

  // أضف priceId للـ Pro tier
  const tiers = s.tiers.map(t =>
    t.priceMonthly
      ? { ...t, priceIdMonthly: customFields.paddlePriceMonthly, priceIdYearly: customFields.paddlePriceYearly }
      : t
  );

  return (
    <Layout title={s.layoutTitle} description={s.layoutDesc}>
      <Head>
        <meta property="og:title" content={s.layoutTitle} />
        <meta property="og:description" content={s.layoutDesc} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <main className={styles.main}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className="container">
            <p className={styles.eyebrow}>{s.eyebrow}</p>
            <h1 className={styles.heroTitle}>{s.heroTitle}</h1>
            <p className={styles.heroSub}>{s.heroSub}</p>
          </div>
        </section>

        {/* Billing Toggle */}
        <section className={styles.toggleSection}>
          <div className="container">
            <div className={styles.billingToggle}>
              <button
                className={clsx(styles.toggleBtn, billing === 'monthly' && styles.toggleBtnActive)}
                onClick={() => setBilling('monthly')}
              >
                {s.billingMonthly}
              </button>
              <button
                className={clsx(styles.toggleBtn, billing === 'yearly' && styles.toggleBtnActive)}
                onClick={() => setBilling('yearly')}
              >
                {s.billingYearly}
                <span className={styles.saveBadge}>{s.saveBadge}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className={styles.cards}>
          <div className="container">
            <div className={styles.cardGrid}>
              {tiers.map((tier) => (
                <PricingCard key={tier.name} tier={tier} popularBadge={s.popularBadge} billing={billing} onCheckout={openCheckout} />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.faqSection}>
          <div className="container">
            <p className={styles.eyebrow}>{s.faqEyebrow}</p>
            <h2 className={styles.sectionTitle}>{s.faqTitle}</h2>
            <div className={styles.faqList}>
              {s.faq.map((item, i) => (
                <FAQItem key={i} item={item} />
              ))}
            </div>
          </div>
        </section>

        {/* Paddle Badge */}
        <section className={styles.paddleSection}>
          <div className="container">
            <div className={styles.paddleBadge}>
              <span className={styles.paddleText}>{s.paddleText}</span>
              <span className={styles.paddleLogo}>Paddle</span>
              <p className={styles.paddleSub}>{s.paddleSub}</p>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

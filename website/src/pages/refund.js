import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './legal.module.css';

const STRINGS = {
  en: {
    layoutTitle: 'Refund Policy — RDAPify',
    layoutDesc: 'RDAPify Refund Policy. All payments processed by Paddle.com Market Limited.',
    ogTitle: 'RDAPify — Refund Policy',
    ogDesc: 'Refund policy for RDAPify Pro subscriptions. All transactions handled by Paddle.com Market Limited.',
    eyebrow: 'Legal',
    title: 'Refund Policy',
    effectiveLabel: 'Effective date:',
    effectiveDate: 'March 1, 2026',
    updatedLabel: 'Last updated:',
    updatedDate: 'March 2026',
    tocTitle: 'On this page',
    sections: [
      { id: 'merchant-of-record', label: 'Merchant of Record' },
      { id: 'paddle-refund-policy', label: 'Refund Policy' },
      { id: 'how-to-request', label: 'How to Request a Refund' },
      { id: 'cancellation', label: 'Cancellation' },
      { id: 'changes', label: 'Changes to This Policy' },
      { id: 'contact', label: 'Contact' },
    ],
  },
  ar: {
    layoutTitle: 'سياسة الاسترداد — RDAPify',
    layoutDesc: 'سياسة استرداد RDAPify. تُعالَج جميع المدفوعات بواسطة Paddle.com Market Limited.',
    ogTitle: 'RDAPify — سياسة الاسترداد',
    ogDesc: 'سياسة الاسترداد لاشتراكات RDAPify Pro. جميع المعاملات تتم عبر Paddle.com Market Limited.',
    eyebrow: 'قانوني',
    title: 'سياسة الاسترداد',
    effectiveLabel: 'تاريخ السريان:',
    effectiveDate: '١ مارس ٢٠٢٦',
    updatedLabel: 'آخر تحديث:',
    updatedDate: 'مارس ٢٠٢٦',
    tocTitle: 'في هذه الصفحة',
    sections: [
      { id: 'merchant-of-record', label: 'التاجر المعتمد' },
      { id: 'paddle-refund-policy', label: 'سياسة الاسترداد' },
      { id: 'how-to-request', label: 'كيفية طلب الاسترداد' },
      { id: 'cancellation', label: 'الإلغاء' },
      { id: 'changes', label: 'التغييرات على هذه السياسة' },
      { id: 'contact', label: 'التواصل' },
    ],
  },
};

function RefundBodyEn() {
  return (
    <div className={styles.body}>
      <p>
        This Refund Policy applies to paid subscriptions for RDAPify Pro and Enterprise services.
        The open-source <code>rdapify</code> library is free and does not involve any payments or refunds.
      </p>

      <h2 id="merchant-of-record">1. Merchant of Record</h2>
      <p>
        All payments for RDAPify Pro and Enterprise are processed by <strong>Paddle.com Market Limited</strong> ("Paddle"),
        our authorised reseller and Merchant of Record. Paddle is the seller of record for all transactions and is
        responsible for managing refunds, returns, and disputes in accordance with their policies and applicable law.
      </p>

      <h2 id="paddle-refund-policy">2. Refund Policy</h2>
      <p>
        Because Paddle is the Merchant of Record, all refunds are governed exclusively by{' '}
        <a href="https://www.paddle.com/legal/paddle-refundpolicy" target="_blank" rel="noopener noreferrer">
          Paddle's Refund Policy
        </a>. Paddle may issue refunds at their discretion within 14 days of the transaction date.
        Statutory refund rights may also apply depending on your country of residence.
      </p>
      <p>
        We do not impose additional qualifiers, exceptions, or conditions beyond Paddle's standard policy.
      </p>

      <h2 id="how-to-request">3. How to Request a Refund</h2>
      <p>To request a refund, contact Paddle directly:</p>
      <ul>
        <li>
          Via Paddle's buyer support:{' '}
          <a href="https://www.paddle.com/help" target="_blank" rel="noopener noreferrer">paddle.com/help</a>
        </li>
        <li>
          Include your Paddle order number or transaction ID and the email address used for the purchase.
        </li>
      </ul>
      <p>
        You may also contact us at <a href="mailto:support@rdapify.com">support@rdapify.com</a> and we will
        assist you in submitting your request to Paddle.
      </p>

      <h2 id="cancellation">4. Cancellation</h2>
      <p>
        You may cancel your subscription at any time. Cancellation stops future billing and you retain access
        to Pro features until the end of your current billing period. Cancellation does not automatically
        trigger a refund for charges already made.
      </p>

      <h2 id="changes">5. Changes to This Policy</h2>
      <p>
        We may update this Refund Policy to reflect changes in Paddle's policies or applicable law.
        The "Last updated" date will be revised accordingly.
      </p>

      <h2 id="contact">6. Contact</h2>
      <div className={styles.contactCard}>
        <p><strong>Refund requests:</strong> <a href="https://www.paddle.com/help" target="_blank" rel="noopener noreferrer">paddle.com/help</a></p>
        <p><strong>Assistance:</strong> <a href="mailto:support@rdapify.com">support@rdapify.com</a></p>
      </div>
    </div>
  );
}

function RefundBodyAr() {
  return (
    <div className={styles.body}>
      <p>
        تنطبق سياسة الاسترداد هذه على الاشتراكات المدفوعة لخدمات RDAPify Pro وEnterprise.
        مكتبة <code>rdapify</code> مفتوحة المصدر مجانية ولا تنطوي على أي مدفوعات أو استردادات.
      </p>

      <h2 id="merchant-of-record">١. التاجر المعتمد</h2>
      <p>
        تُعالَج جميع مدفوعات RDAPify Pro وEnterprise بواسطة <strong>Paddle.com Market Limited</strong> ("Paddle")،
        موزّعنا المعتمد والتاجر المسجَّل لدينا. تُعدّ Paddle البائع المسجَّل لجميع المعاملات وهي المسؤولة
        عن إدارة الاستردادات والمرتجعات والنزاعات وفقاً لسياساتها والقانون المعمول به.
      </p>

      <h2 id="paddle-refund-policy">٢. سياسة الاسترداد</h2>
      <p>
        بما أن Paddle هي التاجر المعتمد، تخضع جميع الاستردادات حصرياً لـ{' '}
        <a href="https://www.paddle.com/legal/paddle-refundpolicy" target="_blank" rel="noopener noreferrer">
          سياسة استرداد Paddle
        </a>. يجوز لـ Paddle إصدار الاستردادات وفق تقديرها خلال 14 يوماً من تاريخ المعاملة.
        قد تنطبق أيضاً حقوق الاسترداد القانونية اعتماداً على بلد إقامتك.
      </p>
      <p>
        لا نفرض شروطاً أو قيوداً أو استثناءات إضافية تتجاوز السياسة القياسية لـ Paddle.
      </p>

      <h2 id="how-to-request">٣. كيفية طلب الاسترداد</h2>
      <p>لطلب الاسترداد، تواصل مع Paddle مباشرةً:</p>
      <ul>
        <li>
          عبر دعم مشتري Paddle:{' '}
          <a href="https://www.paddle.com/help" target="_blank" rel="noopener noreferrer">paddle.com/help</a>
        </li>
        <li>
          أرفق رقم طلبك من Paddle أو معرّف المعاملة وعنوان البريد الإلكتروني المستخدم في الشراء.
        </li>
      </ul>
      <p>
        يمكنك أيضاً التواصل معنا على <a href="mailto:support@rdapify.com">support@rdapify.com</a> وسنساعدك
        في تقديم طلبك إلى Paddle.
      </p>

      <h2 id="cancellation">٤. الإلغاء</h2>
      <p>
        يمكنك إلغاء اشتراكك في أي وقت. يوقف الإلغاء الفوترة المستقبلية وتحتفظ بالوصول إلى ميزات Pro
        حتى نهاية فترة الفوترة الحالية. لا يُؤدّي الإلغاء تلقائياً إلى استرداد الرسوم المحصَّلة مسبقاً.
      </p>

      <h2 id="changes">٥. التغييرات على هذه السياسة</h2>
      <p>
        قد نحدّث سياسة الاسترداد هذه لتعكس التغييرات في سياسات Paddle أو القانون المعمول به.
        سيُراجَع تاريخ "آخر تحديث" وفقاً لذلك.
      </p>

      <h2 id="contact">٦. التواصل</h2>
      <div className={styles.contactCard}>
        <p><strong>طلبات الاسترداد:</strong> <a href="https://www.paddle.com/help" target="_blank" rel="noopener noreferrer">paddle.com/help</a></p>
        <p><strong>المساعدة:</strong> <a href="mailto:support@rdapify.com">support@rdapify.com</a></p>
      </div>
    </div>
  );
}

export default function Refund() {
  const { i18n: { currentLocale } } = useDocusaurusContext();
  const s = STRINGS[currentLocale] || STRINGS.en;
  const isAr = currentLocale === 'ar';

  return (
    <Layout title={s.layoutTitle} description={s.layoutDesc}>
      <Head>
        <meta property="og:title" content={s.ogTitle} />
        <meta property="og:description" content={s.ogDesc} />
        <meta name="twitter:card" content="summary" />
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className="container">
            <p className={styles.eyebrow}>{s.eyebrow}</p>
            <h1 className={styles.title}>{s.title}</h1>
            <p className={styles.meta}>
              <strong>{s.effectiveLabel}</strong> {s.effectiveDate} &nbsp;·&nbsp;
              <strong>{s.updatedLabel}</strong> {s.updatedDate}
            </p>
          </div>
        </header>

        <div className="container">
          <div className={styles.content}>
            <nav className={styles.toc}>
              <p className={styles.tocTitle}>{s.tocTitle}</p>
              <ul className={styles.tocList}>
                {s.sections.map((sec) => (
                  <li key={sec.id} className={styles.tocItem}>
                    <a href={`#${sec.id}`} className={styles.tocLink}>{sec.label}</a>
                  </li>
                ))}
              </ul>
            </nav>

            {isAr ? <RefundBodyAr /> : <RefundBodyEn />}
          </div>
        </div>
      </main>
    </Layout>
  );
}

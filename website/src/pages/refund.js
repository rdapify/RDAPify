import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './legal.module.css';

const STRINGS = {
  en: {
    layoutTitle: 'Refund Policy — RDAPify',
    layoutDesc: 'RDAPify Refund Policy. 14-day money-back guarantee for new Pro subscribers. Learn how to request a refund.',
    ogTitle: 'RDAPify — Refund Policy',
    ogDesc: '14-day money-back guarantee for new RDAPify Pro subscribers. Clear and transparent refund process.',
    eyebrow: 'Legal',
    title: 'Refund Policy',
    effectiveLabel: 'Effective date:',
    effectiveDate: 'March 1, 2026',
    updatedLabel: 'Last updated:',
    updatedDate: 'March 2026',
    tocTitle: 'On this page',
    sections: [
      { id: 'money-back-guarantee', label: '14-Day Guarantee' },
      { id: 'after-14-days', label: 'After 14 Days' },
      { id: 'how-to-request', label: 'How to Request a Refund' },
      { id: 'processing', label: 'Processing & Timeline' },
      { id: 'exceptions', label: 'Exceptions' },
      { id: 'cancellation', label: 'Cancellation vs. Refund' },
      { id: 'changes', label: 'Changes to This Policy' },
      { id: 'contact', label: 'Contact' },
    ],
  },
  ar: {
    layoutTitle: 'سياسة الاسترداد — RDAPify',
    layoutDesc: 'سياسة استرداد RDAPify. ضمان استرداد الأموال خلال 14 يوماً للمشتركين الجدد في Pro. تعرّف على كيفية طلب الاسترداد.',
    ogTitle: 'RDAPify — سياسة الاسترداد',
    ogDesc: 'ضمان استرداد الأموال خلال 14 يوماً للمشتركين الجدد في RDAPify Pro. عملية استرداد واضحة وشفافة.',
    eyebrow: 'قانوني',
    title: 'سياسة الاسترداد',
    effectiveLabel: 'تاريخ السريان:',
    effectiveDate: '١ مارس ٢٠٢٦',
    updatedLabel: 'آخر تحديث:',
    updatedDate: 'مارس ٢٠٢٦',
    tocTitle: 'في هذه الصفحة',
    sections: [
      { id: 'money-back-guarantee', label: 'ضمان ١٤ يوماً' },
      { id: 'after-14-days', label: 'بعد ١٤ يوماً' },
      { id: 'how-to-request', label: 'كيفية طلب الاسترداد' },
      { id: 'processing', label: 'المعالجة والجدول الزمني' },
      { id: 'exceptions', label: 'الاستثناءات' },
      { id: 'cancellation', label: 'الإلغاء مقابل الاسترداد' },
      { id: 'changes', label: 'التغييرات على هذه السياسة' },
      { id: 'contact', label: 'التواصل' },
    ],
  },
};

function RefundBodyEn() {
  return (
    <div className={styles.body}>
      <p>
        This Refund Policy applies to paid subscriptions for the RDAPify Pro and Enterprise services. All payments are processed by <strong>Paddle.com Market Limited</strong>, our Merchant of Record.
      </p>
      <p>
        The open-source <code>rdapify</code> library is free and does not involve any payments or refunds.
      </p>

      <h2 id="money-back-guarantee">1. 14-Day Money-Back Guarantee</h2>
      <p>We offer a <strong>14-day money-back guarantee</strong> for all new Pro and Enterprise subscriptions. If you are not satisfied with the Service for any reason, you may request a full refund within 14 calendar days of your initial subscription purchase.</p>
      <ul>
        <li>The 14-day period begins on the date of your first payment, not the date you activated or started using the Service.</li>
        <li>This guarantee applies only to <strong>first-time</strong> subscribers. If you have previously subscribed, cancelled, and re-subscribed, the guarantee does not apply to the new subscription.</li>
        <li>Refunds under this guarantee are issued for the full subscription amount, including any taxes collected.</li>
      </ul>

      <h2 id="after-14-days">2. After 14 Days</h2>
      <p>After the 14-day guarantee period, refunds are generally <strong>not</strong> provided. However, we may consider refunds at our sole discretion in the following circumstances:</p>
      <ul>
        <li><strong>Service outage:</strong> A prolonged, unscheduled outage that materially prevented you from using the Service for a significant portion of a billing period.</li>
        <li><strong>Billing error:</strong> You were incorrectly charged (e.g., duplicate charge, wrong amount, charge after cancellation).</li>
        <li><strong>Extenuating circumstances:</strong> Situations evaluated on a case-by-case basis.</li>
      </ul>
      <p>Partial refunds or service credits may be offered in lieu of a full refund where appropriate.</p>

      <h2 id="how-to-request">3. How to Request a Refund</h2>
      <p>To request a refund, follow these steps:</p>
      <ol>
        <li>Send an email to <a href="mailto:support@rdapify.com">support@rdapify.com</a> with the subject line "<strong>Refund Request</strong>."</li>
        <li>Include the following information:
          <ul>
            <li>The email address associated with your RDAPify account.</li>
            <li>Your Paddle order number or transaction ID.</li>
            <li>The reason for your refund request (optional but helpful).</li>
          </ul>
        </li>
        <li>We will acknowledge your request within <strong>2 business days</strong> and provide a decision within <strong>5 business days</strong>.</li>
      </ol>

      <h2 id="processing">4. Processing &amp; Timeline</h2>
      <ul>
        <li>Approved refunds are processed by <strong>Paddle</strong> and typically take <strong>3–5 business days</strong> to appear on your statement, depending on your payment method and financial institution.</li>
        <li>Refunds are issued to the original payment method used for the transaction.</li>
        <li>If your refund has not appeared after 10 business days, contact Paddle's support or reach out to us and we will investigate.</li>
        <li>Tax amounts collected by Paddle will also be refunded.</li>
      </ul>

      <h2 id="exceptions">5. Exceptions</h2>
      <p>Refunds will <strong>not</strong> be issued in cases of:</p>
      <ul>
        <li><strong>Violation of Terms:</strong> Your account was suspended or terminated due to a violation of our <a href="/terms">Terms of Service</a>, including the Acceptable Use Policy.</li>
        <li><strong>Abuse or fraud:</strong> Evidence of fraudulent subscription activity, including subscribing solely to obtain a refund after excessive use.</li>
        <li><strong>Third-party issues:</strong> Service disruptions caused by factors beyond our control, including upstream RDAP registry outages, internet connectivity issues, or your own infrastructure failures.</li>
      </ul>

      <h2 id="cancellation">6. Cancellation vs. Refund</h2>
      <p>Cancelling your subscription and requesting a refund are separate actions:</p>
      <ul>
        <li><strong>Cancellation</strong> stops future billing. You retain access to Pro features until the end of your current billing period. No refund is issued for the remaining days.</li>
        <li><strong>Refund</strong> returns money for a charge already made. Upon refund, access to Pro features may be revoked immediately.</li>
      </ul>
      <p>You can cancel your subscription at any time through your account dashboard or by contacting <a href="mailto:support@rdapify.com">support@rdapify.com</a>.</p>

      <h2 id="changes">7. Changes to This Policy</h2>
      <p>We may update this Refund Policy from time to time. Material changes will be communicated by updating the "Last updated" date. Changes do not apply retroactively to refund requests submitted before the change.</p>

      <h2 id="contact">8. Contact</h2>
      <p>For refund requests or questions about this policy:</p>
      <div className={styles.contactCard}>
        <p><strong>Refund requests:</strong> <a href="mailto:support@rdapify.com">support@rdapify.com</a></p>
        <p><strong>General inquiries:</strong> <a href="mailto:legal@rdapify.com">legal@rdapify.com</a></p>
      </div>
    </div>
  );
}

function RefundBodyAr() {
  return (
    <div className={styles.body}>
      <p>
        تنطبق سياسة الاسترداد هذه على الاشتراكات المدفوعة لخدمات RDAPify Pro وEnterprise. تُعالَج جميع المدفوعات بواسطة <strong>Paddle.com Market Limited</strong>، التاجر المعتمد لدينا.
      </p>
      <p>
        مكتبة <code>rdapify</code> مفتوحة المصدر مجانية ولا تنطوي على أي مدفوعات أو استردادات.
      </p>

      <h2 id="money-back-guarantee">١. ضمان استرداد الأموال خلال ١٤ يوماً</h2>
      <p>نقدّم <strong>ضمان استرداد الأموال خلال 14 يوماً</strong> لجميع اشتراكات Pro وEnterprise الجديدة. إذا لم تكن راضياً عن الخدمة لأي سبب، يمكنك طلب استرداد كامل في غضون 14 يوماً تقويمياً من تاريخ شراء اشتراكك الأولي.</p>
      <ul>
        <li>تبدأ فترة الـ 14 يوماً من تاريخ أول دفعة، وليس من تاريخ تفعيل الخدمة أو البدء في استخدامها.</li>
        <li>ينطبق هذا الضمان فقط على المشتركين <strong>للمرة الأولى</strong>. إذا كنت قد اشتركت سابقاً وألغيت واشتركت مجدداً، فإن الضمان لا ينطبق على الاشتراك الجديد.</li>
        <li>تُصدَر المبالغ المستردة بموجب هذا الضمان عن المبلغ الكامل للاشتراك، بما في ذلك أي ضرائب محصَّلة.</li>
      </ul>

      <h2 id="after-14-days">٢. بعد ١٤ يوماً</h2>
      <p>بعد انتهاء فترة ضمان الـ 14 يوماً، لا تُقدَّم المبالغ المستردة عموماً. غير أننا قد ننظر في الاستردادات وفق تقديرنا المطلق في الظروف التالية:</p>
      <ul>
        <li><strong>انقطاع الخدمة:</strong> انقطاع طويل وغير مجدوَل حال بصورة جوهرية من استخدامك للخدمة خلال جزء كبير من فترة الفوترة.</li>
        <li><strong>خطأ في الفوترة:</strong> تم تحصيل رسوم منك بشكل غير صحيح (مثل تحصيل مزدوج أو مبلغ خاطئ أو تحصيل بعد الإلغاء).</li>
        <li><strong>ظروف استثنائية:</strong> حالات تُقيَّم على أساس كل حالة على حدة.</li>
      </ul>
      <p>قد تُعرض استردادات جزئية أو رصيد خدمة بدلاً من الاسترداد الكامل حيثما يكون ذلك مناسباً.</p>

      <h2 id="how-to-request">٣. كيفية طلب الاسترداد</h2>
      <p>لطلب الاسترداد، اتبع الخطوات التالية:</p>
      <ol>
        <li>أرسل بريداً إلكترونياً إلى <a href="mailto:support@rdapify.com">support@rdapify.com</a> بموضوع "<strong>طلب استرداد</strong>".</li>
        <li>أرفق المعلومات التالية:
          <ul>
            <li>عنوان البريد الإلكتروني المرتبط بحساب RDAPify الخاص بك.</li>
            <li>رقم طلبك من Paddle أو معرّف المعاملة.</li>
            <li>سبب طلب الاسترداد (اختياري لكن مفيد).</li>
          </ul>
        </li>
        <li>سنؤكد استلام طلبك في غضون <strong>يومي عمل</strong> ونقدم قراراً في غضون <strong>5 أيام عمل</strong>.</li>
      </ol>

      <h2 id="processing">٤. المعالجة والجدول الزمني</h2>
      <ul>
        <li>تُعالَج الاستردادات المعتمدة بواسطة <strong>Paddle</strong> وتستغرق عادةً <strong>3–5 أيام عمل</strong> لتظهر في كشف حسابك، حسب طريقة الدفع والمؤسسة المالية.</li>
        <li>تُصدَر المبالغ المستردة إلى طريقة الدفع الأصلية المستخدمة في المعاملة.</li>
        <li>إذا لم يظهر استردادك بعد 10 أيام عمل، تواصل مع دعم Paddle أو راسلنا وسنتحقق من الأمر.</li>
        <li>ستُستردّ أيضاً مبالغ الضريبة التي حصّلتها Paddle.</li>
      </ul>

      <h2 id="exceptions">٥. الاستثناءات</h2>
      <p><strong>لن</strong> تُصدَر مبالغ مستردة في الحالات التالية:</p>
      <ul>
        <li><strong>انتهاك الشروط:</strong> تم تعليق حسابك أو إنهاؤه بسبب انتهاك <a href="/terms">شروط الخدمة</a> الخاصة بنا، بما في ذلك سياسة الاستخدام المقبول.</li>
        <li><strong>الإساءة أو الاحتيال:</strong> وجود دليل على نشاط اشتراك احتيالي، بما في ذلك الاشتراك بهدف الحصول على استرداد بعد الاستخدام المفرط.</li>
        <li><strong>مشكلات الطرف الثالث:</strong> انقطاعات الخدمة الناجمة عن عوامل خارجة عن إرادتنا، بما في ذلك انقطاعات سجلات RDAP الأعلى مستوى أو مشكلات الاتصال بالإنترنت أو إخفاقات بنيتك التحتية الخاصة.</li>
      </ul>

      <h2 id="cancellation">٦. الإلغاء مقابل الاسترداد</h2>
      <p>إلغاء اشتراكك وطلب الاسترداد إجراءان منفصلان:</p>
      <ul>
        <li><strong>الإلغاء</strong> يوقف الفوترة المستقبلية. تحتفظ بالوصول إلى ميزات Pro حتى نهاية فترة الفوترة الحالية. لا يُصدَر استرداد عن الأيام المتبقية.</li>
        <li><strong>الاسترداد</strong> يُعيد المبلغ المدفوع مسبقاً. عند الاسترداد، قد يُلغى الوصول إلى ميزات Pro فوراً.</li>
      </ul>
      <p>يمكنك إلغاء اشتراكك في أي وقت عبر لوحة تحكم حسابك أو بالتواصل مع <a href="mailto:support@rdapify.com">support@rdapify.com</a>.</p>

      <h2 id="changes">٧. التغييرات على هذه السياسة</h2>
      <p>قد نحدّث سياسة الاسترداد هذه من وقت لآخر. ستُبلَّغ بالتغييرات الجوهرية عبر تحديث تاريخ "آخر تحديث". لا تنطبق التغييرات بأثر رجعي على طلبات الاسترداد المقدَّمة قبل التغيير.</p>

      <h2 id="contact">٨. التواصل</h2>
      <p>لطلبات الاسترداد أو الاستفسارات حول هذه السياسة:</p>
      <div className={styles.contactCard}>
        <p><strong>طلبات الاسترداد:</strong> <a href="mailto:support@rdapify.com">support@rdapify.com</a></p>
        <p><strong>الاستفسارات العامة:</strong> <a href="mailto:legal@rdapify.com">legal@rdapify.com</a></p>
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

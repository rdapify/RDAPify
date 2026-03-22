import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './legal.module.css';

const STRINGS = {
  en: {
    layoutTitle: 'Privacy Policy — RDAPify',
    layoutDesc: 'RDAPify Privacy Policy. Learn how we collect, use, and protect your personal data in compliance with GDPR and CCPA.',
    ogTitle: 'RDAPify — Privacy Policy',
    ogDesc: 'GDPR and CCPA compliant privacy policy for the RDAPify library, API, and Pro services.',
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    effectiveLabel: 'Effective date:',
    effectiveDate: 'March 1, 2026',
    updatedLabel: 'Last updated:',
    updatedDate: 'March 2026',
    tocTitle: 'On this page',
    sections: [
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
    ],
  },
  ar: {
    layoutTitle: 'سياسة الخصوصية — RDAPify',
    layoutDesc: 'سياسة خصوصية RDAPify. تعرّف على كيفية جمع بياناتك الشخصية واستخدامها وحمايتها وفق GDPR وCCPA.',
    ogTitle: 'RDAPify — سياسة الخصوصية',
    ogDesc: 'سياسة خصوصية متوافقة مع GDPR وCCPA لمكتبة RDAPify وخدمات API وPro.',
    eyebrow: 'قانوني',
    title: 'سياسة الخصوصية',
    effectiveLabel: 'تاريخ السريان:',
    effectiveDate: '١ مارس ٢٠٢٦',
    updatedLabel: 'آخر تحديث:',
    updatedDate: 'مارس ٢٠٢٦',
    tocTitle: 'في هذه الصفحة',
    sections: [
      { id: 'data-we-collect', label: 'البيانات التي نجمعها' },
      { id: 'how-we-use', label: 'كيف نستخدم بياناتك' },
      { id: 'legal-basis', label: 'الأساس القانوني (GDPR)' },
      { id: 'data-sharing', label: 'مشاركة البيانات والمعالجون' },
      { id: 'data-retention', label: 'الاحتفاظ بالبيانات' },
      { id: 'your-rights', label: 'حقوقك' },
      { id: 'ccpa', label: 'إفصاحات CCPA' },
      { id: 'cookies', label: 'ملفات تعريف الارتباط والتتبع' },
      { id: 'international-transfers', label: 'النقل الدولي للبيانات' },
      { id: 'children', label: 'خصوصية الأطفال' },
      { id: 'security', label: 'الأمان' },
      { id: 'changes', label: 'التغييرات على هذه السياسة' },
      { id: 'contact', label: 'التواصل' },
    ],
  },
};

function PrivacyBodyEn() {
  return (
    <div className={styles.body}>
      <p>
        RDAPify ("<strong>we</strong>," "<strong>us</strong>," or "
        <strong>our</strong>") is committed to protecting your privacy.
        This Privacy Policy explains how we collect, use, disclose, and
        safeguard your personal data when you use the RDAPify website
        (rdapify.com), open-source library, API services, and Pro
        subscription services (collectively, the "<strong>Service</strong>").
      </p>
      <p>
        We process personal data in accordance with the{' '}
        <strong>UK General Data Protection Regulation (UK GDPR)</strong>,
        the <strong>EU General Data Protection Regulation (GDPR)</strong>,
        the <strong>California Consumer Privacy Act (CCPA)</strong>, and
        other applicable data protection laws.
      </p>

      <h2 id="data-we-collect">1. Data We Collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li><strong>Account information:</strong> Email address, name, and organization name when you create an account or subscribe to a paid plan.</li>
        <li><strong>Payment information:</strong> Processed and stored exclusively by Paddle (our Merchant of Record). We do not store credit card numbers, bank details, or other payment credentials.</li>
        <li><strong>Communications:</strong> Content of emails or support requests you send us.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li><strong>Usage data:</strong> API request logs including query type (domain, IP, ASN), timestamp, response status, and latency. We do <strong>not</strong> log the specific query values (e.g., the domain name queried) in standard usage logs.</li>
        <li><strong>IP address:</strong> Collected for rate limiting, abuse prevention, and security purposes. IP addresses in rate limiting logs are automatically hashed and are not stored in plaintext beyond the active rate limiting window.</li>
        <li><strong>Device &amp; browser data:</strong> Browser type, OS, device type, and referrer URL when you visit rdapify.com.</li>
        <li><strong>Cookies:</strong> See the <a href="#cookies">Cookies &amp; Tracking</a> section below.</li>
      </ul>
      <h3>Information we do NOT collect</h3>
      <ul>
        <li>We do <strong>not</strong> collect or store RDAP query results. All query processing happens in your environment (client-side library) or is passed through without persistent storage.</li>
        <li>We do <strong>not</strong> sell, rent, or trade your personal data to third parties for marketing or advertising purposes.</li>
      </ul>

      <h2 id="how-we-use">2. How We Use Your Data</h2>
      <p>We use the collected data to:</p>
      <ul>
        <li>Provide, maintain, and improve the Service.</li>
        <li>Process payments and manage your subscription (via Paddle).</li>
        <li>Enforce rate limits, prevent abuse, and protect the security of the Service.</li>
        <li>Respond to support requests and communicate service updates.</li>
        <li>Generate aggregated, anonymized analytics to improve the Service (no individual identification possible).</li>
        <li>Comply with legal obligations and resolve disputes.</li>
      </ul>

      <h2 id="legal-basis">3. Legal Basis for Processing (GDPR)</h2>
      <p>Under the GDPR, we process your personal data based on the following legal grounds:</p>
      <ul>
        <li><strong>Contract performance:</strong> Processing necessary to provide the Service you requested (Article 6(1)(b)).</li>
        <li><strong>Legitimate interests:</strong> Security, fraud prevention, rate limiting, and service improvement (Article 6(1)(f)).</li>
        <li><strong>Legal obligation:</strong> Compliance with applicable laws, tax requirements, and regulatory obligations (Article 6(1)(c)).</li>
        <li><strong>Consent:</strong> Where required (e.g., optional analytics cookies), processing is based on your explicit consent (Article 6(1)(a)), which you may withdraw at any time.</li>
      </ul>

      <h2 id="data-sharing">4. Data Sharing &amp; Third-Party Processors</h2>
      <p>We share personal data only with the following categories of third-party processors, each bound by data processing agreements:</p>
      <ul>
        <li><strong>Paddle.com Market Limited</strong> (payments) — Processes subscription payments, invoicing, tax collection, and refunds as our Merchant of Record. Paddle's privacy practices are governed by their <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</li>
        <li><strong>Analytics provider</strong> (website analytics) — We use privacy-respecting analytics to understand website usage patterns. Data is aggregated and anonymized where possible.</li>
        <li><strong>Infrastructure providers</strong> (hosting) — Our servers and CDN infrastructure are hosted by reputable providers with appropriate security certifications.</li>
      </ul>
      <p>We do <strong>not</strong> sell your personal data. We do <strong>not</strong> share personal data with advertisers or ad networks.</p>

      <h2 id="data-retention">5. Data Retention</h2>
      <ul>
        <li><strong>Account data:</strong> Retained for the duration of your account. Deleted within 30 days of account closure upon request.</li>
        <li><strong>API usage logs:</strong> Aggregated and anonymized after 90 days. Raw logs are deleted after 90 days.</li>
        <li><strong>Rate limiting data:</strong> IP hashes retained for the active rate limiting window only (typically 1–5 minutes).</li>
        <li><strong>Payment records:</strong> Retained by Paddle in accordance with applicable tax and financial record-keeping requirements (typically 7 years).</li>
        <li><strong>Support correspondence:</strong> Retained for up to 2 years after the last interaction, then deleted.</li>
      </ul>

      <h2 id="your-rights">6. Your Rights</h2>
      <p>Under the GDPR and applicable data protection laws, you have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
        <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete personal data.</li>
        <li><strong>Erasure ("right to be forgotten"):</strong> Request deletion of your personal data, subject to legal retention requirements.</li>
        <li><strong>Data portability:</strong> Receive your personal data in a structured, commonly used, machine-readable format.</li>
        <li><strong>Restriction:</strong> Request restriction of processing of your personal data in certain circumstances.</li>
        <li><strong>Object:</strong> Object to processing based on legitimate interests.</li>
        <li><strong>Withdraw consent:</strong> Where processing is based on consent, withdraw your consent at any time.</li>
      </ul>
      <p>To exercise any of these rights, contact us at <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a>. We will respond within 30 days (or the timeframe required by applicable law).</p>
      <p>You also have the right to lodge a complaint with your local data protection supervisory authority.</p>

      <h2 id="ccpa">7. CCPA Disclosures (California Residents)</h2>
      <p>If you are a California resident, you have the following additional rights under the California Consumer Privacy Act:</p>
      <ul>
        <li><strong>Right to know:</strong> You may request disclosure of the categories and specific pieces of personal information we have collected about you.</li>
        <li><strong>Right to delete:</strong> You may request deletion of your personal information, subject to certain exceptions.</li>
        <li><strong>Right to opt-out of sale:</strong> We do <strong>not sell</strong> personal information. No opt-out is necessary.</li>
        <li><strong>Non-discrimination:</strong> We will not discriminate against you for exercising your CCPA rights.</li>
      </ul>
      <p>To exercise your CCPA rights, contact us at <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a>.</p>

      <h2 id="cookies">8. Cookies &amp; Tracking</h2>
      <p>rdapify.com uses the following types of cookies:</p>
      <ul>
        <li><strong>Essential cookies:</strong> Required for the website to function (theme preference, locale selection). Cannot be disabled.</li>
        <li><strong>Analytics cookies:</strong> Used to understand website usage patterns. These are loaded only with your consent and can be disabled at any time.</li>
      </ul>
      <p>We do <strong>not</strong> use advertising cookies, tracking pixels, or fingerprinting techniques.</p>

      <h2 id="international-transfers">9. International Data Transfers</h2>
      <p>Your data may be transferred to and processed in countries outside your country of residence. Where such transfers occur, we ensure appropriate safeguards are in place, including:</p>
      <ul>
        <li>Standard Contractual Clauses (SCCs) approved by the European Commission.</li>
        <li>Adequacy decisions where the destination country has been deemed to provide an adequate level of data protection.</li>
        <li>Paddle's own compliance with international data transfer mechanisms for payment processing.</li>
      </ul>

      <h2 id="children">10. Children's Privacy</h2>
      <p>The Service is not directed to individuals under the age of 16. We do not knowingly collect personal data from children. If we become aware that we have collected personal data from a child under 16, we will take steps to delete such data promptly.</p>

      <h2 id="security">11. Security</h2>
      <p>We implement appropriate technical and organizational measures to protect your personal data, including:</p>
      <ul>
        <li>Encryption of data in transit (TLS 1.2+) and at rest.</li>
        <li>Access controls and principle of least privilege.</li>
        <li>Regular security assessments and dependency auditing.</li>
        <li>SSRF protection, input validation, and security hardening built into the library itself.</li>
      </ul>
      <p>No method of transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.</p>

      <h2 id="changes">12. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. If we make material changes, we will notify you by updating the "Last updated" date and, where required, providing additional notice. Your continued use of the Service after the effective date of the revised policy constitutes acceptance of the changes.</p>

      <h2 id="contact">13. Contact</h2>
      <p>For privacy-related inquiries, data access requests, or complaints:</p>
      <div className={styles.contactCard}>
        <p><strong>Privacy contact:</strong> <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a></p>
        <p><strong>General support:</strong> <a href="mailto:support@rdapify.com">support@rdapify.com</a></p>
      </div>
    </div>
  );
}

function PrivacyBodyAr() {
  return (
    <div className={styles.body}>
      <p>
        تلتزم RDAPify ("<strong>نحن</strong>" أو "<strong>شركتنا</strong>") بحماية خصوصيتك.
        توضّح سياسة الخصوصية هذه كيفية جمع بياناتك الشخصية واستخدامها والإفصاح عنها وحمايتها
        عند استخدامك موقع RDAPify (rdapify.com)، والمكتبة مفتوحة المصدر، وخدمات API، وخدمات
        اشتراك Pro (يُشار إليها مجتمعةً بـ "<strong>الخدمة</strong>").
      </p>
      <p>
        نعالج البيانات الشخصية وفق{' '}
        <strong>اللائحة العامة لحماية البيانات في المملكة المتحدة (UK GDPR)</strong>،
        و<strong>اللائحة العامة لحماية البيانات في الاتحاد الأوروبي (GDPR)</strong>،
        و<strong>قانون خصوصية المستهلك في كاليفورنيا (CCPA)</strong>،
        وسائر قوانين حماية البيانات المعمول بها.
      </p>

      <h2 id="data-we-collect">١. البيانات التي نجمعها</h2>
      <h3>المعلومات التي تقدّمها</h3>
      <ul>
        <li><strong>معلومات الحساب:</strong> عنوان البريد الإلكتروني والاسم واسم المؤسسة عند إنشاء حساب أو الاشتراك في خطة مدفوعة.</li>
        <li><strong>معلومات الدفع:</strong> تُعالَج وتُخزَّن حصراً بواسطة Paddle (التاجر المعتمد لدينا). لا نحتفظ بأرقام بطاقات الائتمان أو البيانات المصرفية أو أي بيانات دفع أخرى.</li>
        <li><strong>المراسلات:</strong> محتوى رسائل البريد الإلكتروني أو طلبات الدعم التي ترسلها إلينا.</li>
      </ul>
      <h3>المعلومات المجمّعة تلقائياً</h3>
      <ul>
        <li><strong>بيانات الاستخدام:</strong> سجلات طلبات API تشمل نوع الاستعلام (نطاق، IP، ASN) والطابع الزمني وحالة الاستجابة والكمون. <strong>لا</strong> نسجّل قيم الاستعلام المحددة (مثل اسم النطاق المستعلَم عنه) في سجلات الاستخدام القياسية.</li>
        <li><strong>عنوان IP:</strong> يُجمَع لأغراض تحديد معدل الطلبات ومنع الإساءة والأمان. تُجزَّأ عناوين IP في سجلات تحديد المعدل تلقائياً ولا تُخزَّن بنص صريح خارج نافذة تحديد المعدل النشطة.</li>
        <li><strong>بيانات الجهاز والمتصفح:</strong> نوع المتصفح ونظام التشغيل ونوع الجهاز وعنوان URL المُحيل عند زيارة rdapify.com.</li>
        <li><strong>ملفات تعريف الارتباط:</strong> راجع قسم <a href="#cookies">ملفات تعريف الارتباط والتتبع</a> أدناه.</li>
      </ul>
      <h3>معلومات لا نجمعها</h3>
      <ul>
        <li><strong>لا</strong> نجمع نتائج استعلامات RDAP أو نخزّنها. تجري معالجة الاستعلامات في بيئتك (مكتبة جانب العميل) أو تمرّ عبرنا دون تخزين دائم.</li>
        <li><strong>لا</strong> نبيع بياناتك الشخصية أو نؤجّرها أو نتاجر بها مع أطراف ثالثة لأغراض التسويق أو الإعلان.</li>
      </ul>

      <h2 id="how-we-use">٢. كيف نستخدم بياناتك</h2>
      <p>نستخدم البيانات المجمّعة من أجل:</p>
      <ul>
        <li>توفير الخدمة وصيانتها وتحسينها.</li>
        <li>معالجة المدفوعات وإدارة اشتراكك (عبر Paddle).</li>
        <li>تطبيق حدود المعدل ومنع الإساءة وحماية أمان الخدمة.</li>
        <li>الرد على طلبات الدعم وإرسال تحديثات الخدمة.</li>
        <li>توليد تحليلات مجمّعة ومجهولة الهوية لتحسين الخدمة (دون إمكانية التعرف على الأفراد).</li>
        <li>الامتثال للالتزامات القانونية وتسوية النزاعات.</li>
      </ul>

      <h2 id="legal-basis">٣. الأساس القانوني للمعالجة (GDPR)</h2>
      <p>بموجب GDPR، نعالج بياناتك الشخصية استناداً إلى الأسس القانونية التالية:</p>
      <ul>
        <li><strong>تنفيذ العقد:</strong> المعالجة اللازمة لتقديم الخدمة التي طلبتها (المادة 6(1)(b)).</li>
        <li><strong>المصالح المشروعة:</strong> الأمان ومنع الاحتيال وتحديد المعدل وتحسين الخدمة (المادة 6(1)(f)).</li>
        <li><strong>الالتزام القانوني:</strong> الامتثال للقوانين المعمول بها والمتطلبات الضريبية والالتزامات التنظيمية (المادة 6(1)(c)).</li>
        <li><strong>الموافقة:</strong> حيثما يُشترط (مثل ملفات تعريف الارتباط الاختيارية للتحليلات)، تستند المعالجة إلى موافقتك الصريحة (المادة 6(1)(a))، ويمكنك سحبها في أي وقت.</li>
      </ul>

      <h2 id="data-sharing">٤. مشاركة البيانات والمعالجون الخارجيون</h2>
      <p>نشارك البيانات الشخصية فقط مع الفئات التالية من المعالجين الخارجيين، ويلتزم كل منهم باتفاقيات معالجة البيانات:</p>
      <ul>
        <li><strong>Paddle.com Market Limited</strong> (المدفوعات) — تعالج مدفوعات الاشتراك والفوترة وتحصيل الضرائب والمبالغ المستردة بوصفها التاجر المعتمد لدينا. تخضع ممارسات الخصوصية لدى Paddle لـ<a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">سياسة الخصوصية</a> الخاصة بها.</li>
        <li><strong>مزود التحليلات</strong> (تحليلات الموقع) — نستخدم تحليلات تحترم الخصوصية لفهم أنماط استخدام الموقع. تُجمَّع البيانات وتُجهَّل الهوية حيثما أمكن.</li>
        <li><strong>مزودو البنية التحتية</strong> (الاستضافة) — يتم استضافة خوادمنا وبنية CDN التحتية لدى مزودين موثوقين يمتلكون شهادات أمنية مناسبة.</li>
      </ul>
      <p><strong>لا</strong> نبيع بياناتك الشخصية. <strong>لا</strong> نشاركها مع المعلنين أو شبكات الإعلانات.</p>

      <h2 id="data-retention">٥. الاحتفاظ بالبيانات</h2>
      <ul>
        <li><strong>بيانات الحساب:</strong> تُحتفظ طوال مدة حسابك. تُحذف خلال 30 يوماً من إغلاق الحساب بناءً على طلب.</li>
        <li><strong>سجلات استخدام API:</strong> تُجمَّع وتُجهَّل الهوية بعد 90 يوماً. تُحذف السجلات الخام بعد 90 يوماً.</li>
        <li><strong>بيانات تحديد المعدل:</strong> تُحتفظ بتجزئات IP فقط خلال نافذة تحديد المعدل النشطة (عادةً 1–5 دقائق).</li>
        <li><strong>سجلات الدفع:</strong> تحتفظ بها Paddle وفق متطلبات الاحتفاظ الضريبية والمالية المعمول بها (عادةً 7 سنوات).</li>
        <li><strong>مراسلات الدعم:</strong> تُحتفظ لمدة تصل إلى سنتين بعد آخر تفاعل، ثم تُحذف.</li>
      </ul>

      <h2 id="your-rights">٦. حقوقك</h2>
      <p>بموجب GDPR وقوانين حماية البيانات المعمول بها، يحق لك:</p>
      <ul>
        <li><strong>الوصول:</strong> طلب نسخة من البيانات الشخصية التي نحتفظ بها عنك.</li>
        <li><strong>التصحيح:</strong> طلب تصحيح البيانات الشخصية غير الدقيقة أو غير المكتملة.</li>
        <li><strong>الحذف ("حق النسيان"):</strong> طلب حذف بياناتك الشخصية، مع مراعاة متطلبات الاحتفاظ القانونية.</li>
        <li><strong>نقل البيانات:</strong> استلام بياناتك الشخصية بتنسيق منظّم وشائع الاستخدام وقابل للقراءة آلياً.</li>
        <li><strong>التقييد:</strong> طلب تقييد معالجة بياناتك الشخصية في ظروف معينة.</li>
        <li><strong>الاعتراض:</strong> الاعتراض على المعالجة المستندة إلى المصالح المشروعة.</li>
        <li><strong>سحب الموافقة:</strong> حيثما تستند المعالجة إلى الموافقة، سحبها في أي وقت.</li>
      </ul>
      <p>لممارسة أيٍّ من هذه الحقوق، تواصل معنا على <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a>. سنرد في غضون 30 يوماً (أو الإطار الزمني المطلوب بموجب القانون المعمول به).</p>
      <p>يحق لك أيضاً تقديم شكوى إلى هيئة حماية البيانات الإشرافية المحلية.</p>

      <h2 id="ccpa">٧. إفصاحات CCPA (المقيمون في كاليفورنيا)</h2>
      <p>إذا كنت مقيماً في كاليفورنيا، تتمتع بالحقوق الإضافية التالية بموجب قانون خصوصية المستهلك في كاليفورنيا:</p>
      <ul>
        <li><strong>حق المعرفة:</strong> يمكنك طلب الإفصاح عن فئات المعلومات الشخصية وعناصرها المحددة التي جمعناها عنك.</li>
        <li><strong>حق الحذف:</strong> يمكنك طلب حذف معلوماتك الشخصية، مع مراعاة استثناءات معينة.</li>
        <li><strong>حق الرفض (عدم البيع):</strong> <strong>لا نبيع</strong> المعلومات الشخصية. لا حاجة لأي رفض.</li>
        <li><strong>عدم التمييز:</strong> لن نميّز ضدك لممارستك حقوق CCPA.</li>
      </ul>
      <p>لممارسة حقوق CCPA الخاصة بك، تواصل معنا على <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a>.</p>

      <h2 id="cookies">٨. ملفات تعريف الارتباط والتتبع</h2>
      <p>يستخدم rdapify.com أنواع ملفات تعريف الارتباط التالية:</p>
      <ul>
        <li><strong>ملفات تعريف الارتباط الأساسية:</strong> ضرورية لعمل الموقع (تفضيلات السمة، اختيار اللغة). لا يمكن تعطيلها.</li>
        <li><strong>ملفات تعريف الارتباط التحليلية:</strong> تُستخدم لفهم أنماط استخدام الموقع. تُحمَّل فقط بموافقتك ويمكن تعطيلها في أي وقت.</li>
      </ul>
      <p><strong>لا</strong> نستخدم ملفات تعريف الارتباط الإعلانية أو بكسلات التتبع أو تقنيات أخذ البصمات الرقمية.</p>

      <h2 id="international-transfers">٩. النقل الدولي للبيانات</h2>
      <p>قد تُنقَل بياناتك إلى دول خارج بلد إقامتك وتُعالَج هناك. عند حدوث مثل هذه النقلات، نضمن توافر الضمانات الملائمة، بما في ذلك:</p>
      <ul>
        <li>البنود التعاقدية القياسية (SCCs) المعتمدة من المفوضية الأوروبية.</li>
        <li>قرارات الكفاية حيثما تم اعتبار الدولة المستقبِلة توفر مستوى كافياً من حماية البيانات.</li>
        <li>امتثال Paddle لآليات النقل الدولي للبيانات الخاصة بمعالجة المدفوعات.</li>
      </ul>

      <h2 id="children">١٠. خصوصية الأطفال</h2>
      <p>الخدمة غير موجّهة للأفراد دون سن 16 عاماً. لا نجمع بيانات شخصية من الأطفال عن علم. إذا أدركنا أننا جمعنا بيانات شخصية من طفل دون 16 عاماً، سنتخذ خطوات فورية لحذف هذه البيانات.</p>

      <h2 id="security">١١. الأمان</h2>
      <p>نُطبّق تدابير تقنية وتنظيمية ملائمة لحماية بياناتك الشخصية، تشمل:</p>
      <ul>
        <li>تشفير البيانات أثناء النقل (TLS 1.2+) وفي حالة السكون.</li>
        <li>ضوابط الوصول ومبدأ الحد الأدنى من الصلاحيات.</li>
        <li>تقييمات الأمان الدورية ومراجعة التبعيات.</li>
        <li>حماية SSRF والتحقق من المدخلات وتصليب الأمان المدمج في المكتبة ذاتها.</li>
      </ul>
      <p>لا توجد طريقة إرسال أو تخزين آمنة بنسبة 100%. بينما نسعى جاهدين لحماية بياناتك، لا يمكننا ضمان الأمان المطلق.</p>

      <h2 id="changes">١٢. التغييرات على هذه السياسة</h2>
      <p>قد نحدّث سياسة الخصوصية هذه من وقت لآخر. إذا أجرينا تغييرات جوهرية، سنُخطرك بتحديث تاريخ "آخر تحديث" وتقديم إشعار إضافي حيثما يُشترط. استمرارك في استخدام الخدمة بعد تاريخ سريان السياسة المُعدَّلة يُعدّ قبولاً للتغييرات.</p>

      <h2 id="contact">١٣. التواصل</h2>
      <p>للاستفسارات المتعلقة بالخصوصية أو طلبات الوصول إلى البيانات أو الشكاوى:</p>
      <div className={styles.contactCard}>
        <p><strong>جهة الاتصال للخصوصية:</strong> <a href="mailto:privacy@rdapify.com">privacy@rdapify.com</a></p>
        <p><strong>الدعم العام:</strong> <a href="mailto:support@rdapify.com">support@rdapify.com</a></p>
      </div>
    </div>
  );
}

export default function Privacy() {
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

            {isAr ? <PrivacyBodyAr /> : <PrivacyBodyEn />}
          </div>
        </div>
      </main>
    </Layout>
  );
}

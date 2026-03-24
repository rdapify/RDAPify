import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './legal.module.css';

const STRINGS = {
  en: {
    layoutTitle: 'Terms of Service — RDAPify',
    layoutDesc: 'RDAPify Terms of Service. Read our terms governing the use of the RDAPify library, API, and Pro services.',
    ogTitle: 'RDAPify — Terms of Service',
    ogDesc: 'Terms of Service governing the use of RDAPify open-source library, API, and Pro subscription services.',
    eyebrow: 'Legal',
    title: 'Terms of Service',
    effectiveLabel: 'Effective date:',
    effectiveDate: 'March 1, 2026',
    updatedLabel: 'Last updated:',
    updatedDate: 'March 2026',
    tocTitle: 'On this page',
    sections: [
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
    ],
  },
  ar: {
    layoutTitle: 'شروط الخدمة — RDAPify',
    layoutDesc: 'شروط خدمة RDAPify. اقرأ الشروط التي تحكم استخدام مكتبة RDAPify وخدمات API وخدمات Pro.',
    ogTitle: 'RDAPify — شروط الخدمة',
    ogDesc: 'شروط الخدمة التي تحكم استخدام مكتبة RDAPify مفتوحة المصدر وخدمات API وخدمات الاشتراك Pro.',
    eyebrow: 'قانوني',
    title: 'شروط الخدمة',
    effectiveLabel: 'تاريخ السريان:',
    effectiveDate: '١ مارس ٢٠٢٦',
    updatedLabel: 'آخر تحديث:',
    updatedDate: 'مارس ٢٠٢٦',
    tocTitle: 'في هذه الصفحة',
    sections: [
      { id: 'definitions', label: 'التعريفات' },
      { id: 'service-description', label: 'وصف الخدمة' },
      { id: 'account-registration', label: 'تسجيل الحساب' },
      { id: 'acceptable-use', label: 'الاستخدام المقبول' },
      { id: 'rate-limiting', label: 'تحديد المعدل' },
      { id: 'payment-terms', label: 'شروط الدفع' },
      { id: 'intellectual-property', label: 'الملكية الفكرية' },
      { id: 'data-privacy', label: 'البيانات والخصوصية' },
      { id: 'disclaimers', label: 'إخلاء المسؤولية' },
      { id: 'limitation-of-liability', label: 'تحديد المسؤولية' },
      { id: 'indemnification', label: 'التعويض' },
      { id: 'termination', label: 'الإنهاء' },
      { id: 'governing-law', label: 'القانون الحاكم' },
      { id: 'changes', label: 'التغييرات على الشروط' },
      { id: 'contact', label: 'التواصل' },
    ],
  },
};

function TermsBodyEn() {
  return (
    <div className={styles.body}>
      <p>
        These Terms of Service ("<strong>Terms</strong>") constitute a legally binding agreement between you ("<strong>User</strong>," "<strong>you</strong>," or "<strong>your</strong>") and RDAPify ("<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") governing your access to and use of the RDAPify open-source library, website (rdapify.com), API services, and any related Pro or Enterprise subscription services (collectively, the "<strong>Service</strong>").
      </p>
      <p>By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you must not use the Service.</p>

      <h2 id="definitions">1. Definitions</h2>
      <ul>
        <li><strong>"RDAP"</strong> means the Registration Data Access Protocol as defined by IETF RFCs 7480–7484.</li>
        <li><strong>"Library"</strong> means the open-source <code>rdapify</code> npm package, distributed under the MIT License.</li>
        <li><strong>"Pro Service"</strong> means the paid subscription offering (<code>@rdapify/pro</code>) providing enhanced monitoring, analytics, and integrations.</li>
        <li><strong>"API"</strong> means any programmatic interface provided by RDAPify for querying registration data.</li>
        <li><strong>"Paddle"</strong> means Paddle.com Market Limited, our Merchant of Record for payment processing.</li>
      </ul>

      <h2 id="service-description">2. Service Description</h2>
      <p>RDAPify provides a unified TypeScript/JavaScript client library and related services for querying domain registration data, IP address information, and Autonomous System Number (ASN) records via the RDAP protocol. The Service includes:</p>
      <ul>
        <li>An open-source library (<code>rdapify</code>) for performing RDAP queries with built-in security protections, caching, and PII redaction.</li>
        <li>A Pro subscription service offering bulk monitoring, change detection, analytics, webhook integrations, and export capabilities.</li>
        <li>Documentation, playground tools, and developer resources available at rdapify.com.</li>
      </ul>

      <h2 id="account-registration">3. Account Registration</h2>
      <p>To access certain features of the Service, you may be required to create an account. You agree to:</p>
      <ul>
        <li>Provide accurate, current, and complete information during registration.</li>
        <li>Maintain the security of your account credentials and API keys.</li>
        <li>Promptly notify us of any unauthorized access to your account.</li>
        <li>Accept responsibility for all activities that occur under your account.</li>
      </ul>

      <h2 id="acceptable-use">4. Acceptable Use Policy</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Conduct large-scale automated scraping or data harvesting of RDAP servers without prior written authorization from RDAPify and the applicable registry operators.</li>
        <li>Violate any applicable laws, regulations, or third-party rights, including data protection and privacy laws.</li>
        <li>Attempt to circumvent rate limits, access controls, or security measures implemented by the Service or by upstream RDAP servers.</li>
        <li>Use the Service to facilitate phishing, domain hijacking, trademark infringement, or any form of cybercrime.</li>
        <li>Redistribute, resell, or sublicense access to the Pro Service without written authorization.</li>
        <li>Transmit any malicious code, exploit, or payload through the Service.</li>
        <li>Interfere with or disrupt the integrity or performance of the Service or its underlying infrastructure.</li>
      </ul>
      <p>We reserve the right to suspend or terminate access to the Service, without notice, for any violation of this Acceptable Use Policy.</p>

      <h2 id="rate-limiting">5. Fair Use</h2>
      <p>The open-source rdapify library (Free tier) has no usage limits. Pro and Team plans include rate limits to protect upstream RDAP registry infrastructure:</p>
      <ul>
        <li><strong>Pro tier:</strong> 600 requests per minute.</li>
        <li><strong>Enterprise tier:</strong> Custom limits as agreed in your Enterprise agreement.</li>
      </ul>
      <p>Requests exceeding your plan's rate limit will receive a <code>429 Too Many Requests</code> response with a <code>Retry-After</code> header.</p>

      <h2 id="payment-terms">6. Payment Terms</h2>
      <p>All paid subscriptions are processed through <strong>Paddle.com Market Limited</strong>, which acts as our Merchant of Record. By subscribing to a paid plan, you agree to:</p>
      <ul>
        <li>Paddle's <a href="https://www.paddle.com/legal/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</li>
        <li>Subscriptions are billed on a recurring monthly or annual basis, depending on the plan selected.</li>
        <li>Prices are listed exclusive of tax. Paddle calculates and collects applicable VAT or sales tax based on your location.</li>
        <li>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
        <li>Refunds are subject to our <a href="/refund">Refund Policy</a>.</li>
      </ul>

      <h2 id="intellectual-property">7. Intellectual Property</h2>
      <h3>Open-Source Library</h3>
      <p>The <code>rdapify</code> library is released under the <strong>MIT License</strong>. You may use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Library in accordance with the MIT License terms. The MIT License for the open-source library will not change.</p>
      <h3>Pro Service &amp; Proprietary Components</h3>
      <p>The <code>@rdapify/pro</code> package, its source code, compiled binaries, documentation, and related materials are proprietary and protected by copyright and intellectual property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to use the Pro Service solely in accordance with your subscription terms.</p>
      <h3>Trademarks</h3>
      <p>"RDAPify," the RDAPify logo, and associated branding are trademarks of RDAPify. You may not use these marks without prior written permission, except as reasonably necessary to identify the Service in accordance with fair use principles.</p>

      <h2 id="data-privacy">8. Data &amp; Privacy</h2>
      <p>Your use of the Service is also governed by our <a href="/privacy">Privacy Policy</a>, which describes how we collect, use, and protect your personal data. RDAP query results may contain personal data subject to applicable data protection regulations (including GDPR and CCPA). You are solely responsible for ensuring your use of such data complies with all applicable laws.</p>

      <h2 id="disclaimers">9. Disclaimers</h2>
      <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY.</p>
      <p>We do not guarantee that:</p>
      <ul>
        <li>RDAP query results will be accurate, complete, or current, as data is sourced from third-party registry operators.</li>
        <li>The Service will be uninterrupted, error-free, or free of harmful components.</li>
        <li>Upstream RDAP servers will be available or responsive at all times.</li>
      </ul>

      <h2 id="limitation-of-liability">10. Limitation of Liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL RDAPIFY, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:</p>
      <ul>
        <li>Your access to or use of (or inability to use) the Service.</li>
        <li>Any conduct or content of any third party on the Service.</li>
        <li>Unauthorized access, use, or alteration of your transmissions or data.</li>
        <li>Inaccuracies or omissions in RDAP data provided by upstream registries.</li>
      </ul>
      <p>Our total aggregate liability for all claims arising out of or relating to these Terms or the Service shall not exceed the greater of (a) the amount you paid us in the twelve (12) months preceding the claim, or (b) one hundred US dollars (US$100).</p>

      <h2 id="indemnification">11. Indemnification</h2>
      <p>You agree to indemnify, defend, and hold harmless RDAPify and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>

      <h2 id="termination">12. Termination</h2>
      <p>We may terminate or suspend your access to the Service immediately, without prior notice, for any reason, including if you breach these Terms. Upon termination:</p>
      <ul>
        <li>Your right to use the Service (including Pro features) ceases immediately.</li>
        <li>You remain responsible for any outstanding payment obligations.</li>
        <li>Provisions that by their nature should survive termination shall survive, including intellectual property, limitation of liability, indemnification, and governing law.</li>
      </ul>
      <p>You may terminate your account at any time by cancelling your subscription (if applicable) and ceasing use of the Service.</p>

      <h2 id="governing-law">13. Governing Law &amp; Dispute Resolution</h2>
      <p>These Terms shall be governed by and construed in accordance with the laws of <strong>England and Wales</strong>, without regard to conflict of law principles.</p>
      <p>Any dispute arising out of or in connection with these Terms shall first be attempted to be resolved through good-faith negotiation. If the dispute cannot be resolved within thirty (30) days, either party may submit the dispute to the exclusive jurisdiction of the courts of England and Wales.</p>
      <p>For users outside the United Kingdom, nothing in these Terms affects your statutory consumer rights under the laws of your country of residence.</p>

      <h2 id="changes">14. Changes to These Terms</h2>
      <p>We reserve the right to modify these Terms at any time. If we make material changes, we will notify you by updating the "Last updated" date at the top of this page and, where practicable, providing additional notice (such as an email or in-app notification). Your continued use of the Service after the effective date of the revised Terms constitutes acceptance of the changes.</p>

      <h2 id="contact">15. Contact</h2>
      <p>If you have questions about these Terms, please contact us:</p>
      <div className={styles.contactCard}>
        <p><strong>Email:</strong> <a href="mailto:legal@rdapify.com">legal@rdapify.com</a></p>
        <p><strong>GitHub:</strong> <a href="https://github.com/rdapify/rdapify/issues" target="_blank" rel="noopener noreferrer">github.com/rdapify/rdapify/issues</a></p>
      </div>
    </div>
  );
}

function TermsBodyAr() {
  return (
    <div className={styles.body}>
      <p>
        تُشكّل شروط الخدمة هذه ("<strong>الشروط</strong>") اتفاقية ملزمة قانونياً بينك ("<strong>المستخدم</strong>" أو "<strong>أنت</strong>") وبين RDAPify ("<strong>نحن</strong>" أو "<strong>شركتنا</strong>") تحكم وصولك إلى مكتبة RDAPify مفتوحة المصدر والموقع الإلكتروني (rdapify.com) وخدمات API وأي خدمات اشتراك Pro أو Enterprise ذات صلة (يُشار إليها مجتمعةً بـ "<strong>الخدمة</strong>").
      </p>
      <p>بالوصول إلى الخدمة أو استخدامها، فإنك توافق على الالتزام بهذه الشروط. إذا كنت لا توافق، يجب عليك عدم استخدام الخدمة.</p>

      <h2 id="definitions">١. التعريفات</h2>
      <ul>
        <li><strong>"RDAP"</strong> يعني بروتوكول الوصول إلى بيانات التسجيل كما هو محدد في معايير IETF RFCs 7480–7484.</li>
        <li><strong>"المكتبة"</strong> تعني حزمة <code>rdapify</code> مفتوحة المصدر على npm، موزَّعة بموجب رخصة MIT.</li>
        <li><strong>"خدمة Pro"</strong> تعني الاشتراك المدفوع (<code>@rdapify/pro</code>) الذي يوفر مراقبة وتحليلات وتكاملات متقدمة.</li>
        <li><strong>"API"</strong> تعني أي واجهة برمجية توفرها RDAPify للاستعلام عن بيانات التسجيل.</li>
        <li><strong>"Paddle"</strong> تعني Paddle.com Market Limited، التاجر المعتمد لدينا لمعالجة المدفوعات.</li>
      </ul>

      <h2 id="service-description">٢. وصف الخدمة</h2>
      <p>توفّر RDAPify مكتبة عميل TypeScript/JavaScript موحّدة وخدمات ذات صلة للاستعلام عن بيانات تسجيل النطاقات ومعلومات عناوين IP وسجلات أرقام النظام المستقل (ASN) عبر بروتوكول RDAP. تشمل الخدمة:</p>
      <ul>
        <li>مكتبة مفتوحة المصدر (<code>rdapify</code>) لتنفيذ استعلامات RDAP مع حمايات أمنية مدمجة وتخزين مؤقت وإخفاء PII.</li>
        <li>خدمة اشتراك Pro تتيح المراقبة الجماعية وكشف التغييرات والتحليلات وتكاملات الـ Webhook وإمكانيات التصدير.</li>
        <li>التوثيق وأدوات الملعب التجريبي والموارد التطويرية المتاحة على rdapify.com.</li>
      </ul>

      <h2 id="account-registration">٣. تسجيل الحساب</h2>
      <p>قد يُشترط إنشاء حساب للوصول إلى بعض ميزات الخدمة. توافق على:</p>
      <ul>
        <li>تقديم معلومات دقيقة وحديثة وكاملة أثناء التسجيل.</li>
        <li>الحفاظ على أمان بيانات اعتماد حسابك ومفاتيح API.</li>
        <li>إخطارنا فوراً بأي وصول غير مصرّح به إلى حسابك.</li>
        <li>تحمّل المسؤولية عن جميع الأنشطة التي تجري تحت حسابك.</li>
      </ul>

      <h2 id="acceptable-use">٤. سياسة الاستخدام المقبول</h2>
      <p>توافق على عدم استخدام الخدمة من أجل:</p>
      <ul>
        <li>إجراء جمع بيانات آلي واسع النطاق من خوادم RDAP دون تفويض خطي مسبق من RDAPify ومشغّلي السجلات المعنيين.</li>
        <li>انتهاك أي قوانين أو لوائح أو حقوق أطراف ثالثة سارية، بما في ذلك قوانين حماية البيانات والخصوصية.</li>
        <li>محاولة التحايل على حدود المعدل أو ضوابط الوصول أو التدابير الأمنية التي تطبّقها الخدمة أو خوادم RDAP الأعلى مستوى.</li>
        <li>استخدام الخدمة لتسهيل التصيّد الاحتيالي أو اختطاف النطاقات أو انتهاك العلامات التجارية أو أي شكل من أشكال الجرائم الإلكترونية.</li>
        <li>إعادة توزيع أو إعادة بيع أو منح ترخيص فرعي للوصول إلى خدمة Pro دون تفويض خطي.</li>
        <li>إرسال أي كود ضار أو استغلال أو حمولة عبر الخدمة.</li>
        <li>التدخل في أو تعطيل سلامة أو أداء الخدمة أو بنيتها التحتية الأساسية.</li>
      </ul>
      <p>نحتفظ بالحق في تعليق أو إنهاء الوصول إلى الخدمة، دون إشعار، لأي انتهاك لسياسة الاستخدام المقبول هذه.</p>

      <h2 id="rate-limiting">٥. الاستخدام العادل</h2>
      <p>مكتبة rdapify مفتوحة المصدر (الطبقة المجانية) ليس لها حدود على الاستخدام. تشمل خطط Pro و Team حدوداً على المعدل لحماية بنية سجلات RDAP:</p>
      <ul>
        <li><strong>طبقة Pro:</strong> 600 طلب في الدقيقة.</li>
        <li><strong>طبقة Enterprise:</strong> حدود مخصصة وفق اتفاقية المؤسسة.</li>
      </ul>
      <p>ستتلقى الطلبات التي تتجاوز حد خطتك استجابة <code>429 Too Many Requests</code> مع رأس <code>Retry-After</code>.</p>

      <h2 id="payment-terms">٦. شروط الدفع</h2>
      <p>تُعالَج جميع الاشتراكات المدفوعة عبر <strong>Paddle.com Market Limited</strong>، التي تعمل بوصفها التاجر المعتمد لدينا. بالاشتراك في خطة مدفوعة، توافق على:</p>
      <ul>
        <li><a href="https://www.paddle.com/legal/terms" target="_blank" rel="noopener noreferrer">شروط خدمة</a> Paddle و<a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">سياسة الخصوصية</a> الخاصة بها.</li>
        <li>تُفوتَر الاشتراكات على أساس متكرر شهري أو سنوي، حسب الخطة المختارة.</li>
        <li>الأسعار المعروضة لا تشمل الضريبة. تحسب Paddle وتجمع ضريبة القيمة المضافة أو ضريبة المبيعات المعمول بها بناءً على موقعك.</li>
        <li>يمكنك إلغاء اشتراكك في أي وقت. يسري الإلغاء في نهاية فترة الفوترة الحالية.</li>
        <li>تخضع المبالغ المستردة لـ<a href="/refund">سياسة الاسترداد</a> الخاصة بنا.</li>
      </ul>

      <h2 id="intellectual-property">٧. الملكية الفكرية</h2>
      <h3>المكتبة مفتوحة المصدر</h3>
      <p>تُصدَر مكتبة <code>rdapify</code> بموجب <strong>رخصة MIT</strong>. يجوز لك استخدام المكتبة ونسخها وتعديلها ودمجها ونشرها وتوزيعها ومنح ترخيص فرعي لها و/أو بيع نسخ منها وفق شروط رخصة MIT. لن تتغير رخصة MIT للمكتبة مفتوحة المصدر.</p>
      <h3>خدمة Pro والمكونات الاحتكارية</h3>
      <p>حزمة <code>@rdapify/pro</code> وكودها المصدري والملفات الثنائية المجمَّعة والتوثيق والمواد ذات الصلة هي ملكية خاصة محمية بحقوق الطبع والنشر وقوانين الملكية الفكرية. تُمنح ترخيصاً محدوداً وغير حصري وغير قابل للنقل وقابل للإلغاء لاستخدام خدمة Pro وفق شروط اشتراكك فقط.</p>
      <h3>العلامات التجارية</h3>
      <p>"RDAPify" وشعار RDAPify والعلامات التجارية المرتبطة هي علامات تجارية لـ RDAPify. لا يجوز لك استخدام هذه العلامات دون إذن خطي مسبق، إلا بالقدر المعقول اللازم لتعريف الخدمة وفق مبادئ الاستخدام العادل.</p>

      <h2 id="data-privacy">٨. البيانات والخصوصية</h2>
      <p>يخضع استخدامك للخدمة أيضاً لـ<a href="/privacy">سياسة الخصوصية</a> الخاصة بنا، التي تصف كيفية جمع بياناتك الشخصية واستخدامها وحمايتها. قد تحتوي نتائج استعلامات RDAP على بيانات شخصية خاضعة للوائح حماية البيانات المعمول بها (بما في ذلك GDPR وCCPA). أنت المسؤول الوحيد عن ضمان امتثال استخدامك لهذه البيانات لجميع القوانين المعمول بها.</p>

      <h2 id="disclaimers">٩. إخلاء المسؤولية</h2>
      <p>تُقدَّم الخدمة "كما هي" و"كما هي متاحة" دون ضمانات من أي نوع، سواء صريحة أو ضمنية أو قانونية. نخلي مسؤوليتنا من جميع الضمانات، بما في ذلك على سبيل المثال لا الحصر ضمانات قابلية التسويق والملاءمة لغرض معين وعدم الانتهاك والدقة.</p>
      <p>لا نضمن:</p>
      <ul>
        <li>دقة أو اكتمال أو حداثة نتائج استعلامات RDAP، إذ تُستقى البيانات من مشغّلي سجلات خارجيين.</li>
        <li>أن تكون الخدمة غير منقطعة أو خالية من الأخطاء أو المكونات الضارة.</li>
        <li>أن تكون خوادم RDAP الأعلى مستوى متاحة أو مستجيبة في جميع الأوقات.</li>
      </ul>

      <h2 id="limitation-of-liability">١٠. تحديد المسؤولية</h2>
      <p>إلى أقصى حد يسمح به القانون المعمول به، لن تكون RDAPify أو مديروها أو موظفوها أو شركاؤها أو وكلاؤها أو مورّدوها أو الشركات التابعة لها مسؤولة عن أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية أو تأديبية، بما في ذلك دون حصر خسارة الأرباح والبيانات والاستخدام والسمعة التجارية وغيرها من الخسائر غير المادية، الناجمة عن:</p>
      <ul>
        <li>وصولك إلى الخدمة أو استخدامها (أو عدم قدرتك على استخدامها).</li>
        <li>أي سلوك أو محتوى لطرف ثالث في الخدمة.</li>
        <li>الوصول غير المصرّح به أو الاستخدام أو التعديل في إرسالاتك أو بياناتك.</li>
        <li>عدم الدقة أو الإغفالات في بيانات RDAP المقدَّمة من السجلات الأعلى مستوى.</li>
      </ul>
      <p>لا تتجاوز مسؤوليتنا الإجمالية الكاملة عن جميع المطالبات الناشئة عن هذه الشروط أو الخدمة أيَّ المبلغين التاليين أيهما أكبر: (أ) المبلغ الذي دفعته لنا في الاثني عشر (12) شهراً السابقة للمطالبة، أو (ب) مائة دولار أمريكي (100 دولار أمريكي).</p>

      <h2 id="indemnification">١١. التعويض</h2>
      <p>توافق على تعويض RDAPify ومسؤوليها ومديريها وموظفيها ووكلائها والدفاع عنهم وإبراء ذمتهم من وضد أي مطالبات أو مسؤوليات أو أضرار أو خسائر ونفقات (بما في ذلك أتعاب محامية معقولة) الناشئة عن أو المرتبطة بأي صورة بوصولك إلى الخدمة أو استخدامها أو انتهاكك لهذه الشروط أو انتهاكك لأي حقوق أطراف ثالثة.</p>

      <h2 id="termination">١٢. الإنهاء</h2>
      <p>يجوز لنا إنهاء أو تعليق وصولك إلى الخدمة فوراً ودون إشعار مسبق لأي سبب، بما في ذلك في حالة إخلالك بهذه الشروط. عند الإنهاء:</p>
      <ul>
        <li>يتوقف حقك في استخدام الخدمة (بما في ذلك ميزات Pro) فوراً.</li>
        <li>تبقى مسؤولاً عن أي التزامات دفع معلّقة.</li>
        <li>تبقى الأحكام التي يجب بطبيعتها أن تظل سارية بعد الإنهاء، بما في ذلك الملكية الفكرية وتحديد المسؤولية والتعويض والقانون الحاكم.</li>
      </ul>
      <p>يمكنك إنهاء حسابك في أي وقت بإلغاء اشتراكك (إن وجد) والتوقف عن استخدام الخدمة.</p>

      <h2 id="governing-law">١٣. القانون الحاكم وتسوية النزاعات</h2>
      <p>تخضع هذه الشروط وتُفسَّر وفق قوانين <strong>إنجلترا وويلز</strong>، دون الاعتداد بمبادئ تعارض القوانين.</p>
      <p>تُحاوَل تسوية أي نزاع ينشأ عن هذه الشروط أو يتعلق بها أولاً عبر التفاوض بحسن نية. إذا تعذّر حل النزاع في غضون ثلاثين (30) يوماً، جاز لأي من الطرفين إحالة النزاع إلى الاختصاص الحصري لمحاكم إنجلترا وويلز.</p>
      <p>للمستخدمين خارج المملكة المتحدة، لا يؤثر أي شيء في هذه الشروط على حقوقك القانونية كمستهلك بموجب قوانين بلد إقامتك.</p>

      <h2 id="changes">١٤. التغييرات على هذه الشروط</h2>
      <p>نحتفظ بالحق في تعديل هذه الشروط في أي وقت. إذا أجرينا تغييرات جوهرية، سنُخطرك بتحديث تاريخ "آخر تحديث" في أعلى هذه الصفحة وتقديم إشعار إضافي حيثما أمكن (مثل بريد إلكتروني أو إشعار داخل التطبيق). استمرارك في استخدام الخدمة بعد تاريخ سريان الشروط المُعدَّلة يُعدّ قبولاً للتغييرات.</p>

      <h2 id="contact">١٥. التواصل</h2>
      <p>إذا كانت لديك أسئلة حول هذه الشروط، يرجى التواصل معنا:</p>
      <div className={styles.contactCard}>
        <p><strong>البريد الإلكتروني:</strong> <a href="mailto:legal@rdapify.com">legal@rdapify.com</a></p>
        <p><strong>GitHub:</strong> <a href="https://github.com/rdapify/rdapify/issues" target="_blank" rel="noopener noreferrer">github.com/rdapify/rdapify/issues</a></p>
      </div>
    </div>
  );
}

export default function Terms() {
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

            {isAr ? <TermsBodyAr /> : <TermsBodyEn />}
          </div>
        </div>
      </main>
    </Layout>
  );
}

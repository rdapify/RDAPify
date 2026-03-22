import React from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './styles.module.css';

const STRINGS = {
  en: {
    sectionTitle: 'Everything you need',
    sectionSubtitle: 'Production-ready features designed for modern infrastructure teams.',
    features: [
      {
        title: 'Unified Interface',
        description: 'Single API for querying all global registries (Verisign, ARIN, RIPE, APNIC, LACNIC). No need to manage multiple clients or endpoints.',
      },
      {
        title: 'Security First',
        description: 'Built-in SSRF protection, certificate validation, and secure data handling. Enterprise-grade security out of the box.',
      },
      {
        title: 'Privacy by Default',
        description: 'Automatic PII redaction for GDPR/CCPA compliance. Protect user privacy without additional configuration.',
      },
      {
        title: 'High Performance',
        description: 'Smart caching with 1-hour TTL, parallel processing, and memory optimization. Built for enterprise scale.',
      },
      {
        title: 'Multi-Environment',
        description: 'Works seamlessly on Node.js, Bun, Deno, and Cloudflare Workers. Deploy anywhere with confidence.',
      },
      {
        title: 'TypeScript Native',
        description: 'Full TypeScript support with comprehensive type definitions. Catch errors at compile time, not runtime.',
      },
    ],
  },
  ar: {
    sectionTitle: 'كل ما تحتاجه',
    sectionSubtitle: 'ميزات جاهزة للإنتاج مصممة لفرق البنية التحتية الحديثة.',
    features: [
      {
        title: 'واجهة موحّدة',
        description: 'واجهة API واحدة للاستعلام عن جميع السجلات العالمية (Verisign وARIN وRIPE وAPNIC وLACNIC). لا حاجة لإدارة عملاء أو نقاط نهاية متعددة.',
      },
      {
        title: 'الأمان أولاً',
        description: 'حماية SSRF مدمجة، والتحقق من الشهادات، ومعالجة البيانات الآمنة. أمان على مستوى المؤسسات جاهز للاستخدام فوراً.',
      },
      {
        title: 'الخصوصية بالافتراض',
        description: 'إخفاء تلقائي للبيانات الشخصية PII لامتثال GDPR/CCPA. حماية خصوصية المستخدم دون أي إعداد إضافي.',
      },
      {
        title: 'أداء عالٍ',
        description: 'تخزين مؤقت ذكي بوقت انتهاء صلاحية ساعة، ومعالجة متوازية، وتحسين الذاكرة. مبني لحجم المؤسسات.',
      },
      {
        title: 'متعدد البيئات',
        description: 'يعمل بسلاسة على Node.js وBun وDeno وCloudflare Workers. انشر في أي مكان بثقة.',
      },
      {
        title: 'TypeScript أصيل',
        description: 'دعم كامل لـ TypeScript مع تعريفات أنواع شاملة. اكتشف الأخطاء في وقت التجميع، لا في وقت التشغيل.',
      },
    ],
  },
};

const SVGS = [
  require('@site/static/img/unified.svg').default,
  require('@site/static/img/security.svg').default,
  require('@site/static/img/privacy.svg').default,
  require('@site/static/img/performance.svg').default,
  require('@site/static/img/multi-env.svg').default,
  require('@site/static/img/typescript.svg').default,
];

function Feature({ Svg, title, description }) {
  return (
    <div className={clsx('col col--4')} style={{ marginBottom: '1.5rem' }}>
      <div className={styles.featureCard}>
        <div className={styles.featureIconWrap}>
          <Svg className={styles.featureSvg} role="img" />
        </div>
        <div className="text--center">
          <h3 className={styles.featureTitle}>{title}</h3>
          <p className={styles.featureDesc}>{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  const { i18n: { currentLocale } } = useDocusaurusContext();
  const s = STRINGS[currentLocale] || STRINGS.en;

  return (
    <section className={styles.features}>
      <div className="container">
        <h2 className={styles.featuresTitle}>{s.sectionTitle}</h2>
        <p className={styles.featuresSubtitle}>{s.sectionSubtitle}</p>
        <div className="row">
          {s.features.map((feature, idx) => (
            <Feature key={idx} Svg={SVGS[idx]} title={feature.title} description={feature.description} />
          ))}
        </div>
      </div>
    </section>
  );
}

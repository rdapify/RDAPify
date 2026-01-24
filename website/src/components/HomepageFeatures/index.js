import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Unified Interface',
    Svg: require('@site/static/img/unified.svg').default,
    description: (
      <>
        Single API for querying all global registries (Verisign, ARIN, RIPE, APNIC, LACNIC).
        No need to manage multiple clients or endpoints.
      </>
    ),
  },
  {
    title: 'Security First',
    Svg: require('@site/static/img/security.svg').default,
    description: (
      <>
        Built-in SSRF protection, certificate validation, and secure data handling.
        Enterprise-grade security out of the box.
      </>
    ),
  },
  {
    title: 'Privacy by Default',
    Svg: require('@site/static/img/privacy.svg').default,
    description: (
      <>
        Automatic PII redaction for GDPR/CCPA compliance. Protect user privacy
        without additional configuration.
      </>
    ),
  },
  {
    title: 'High Performance',
    Svg: require('@site/static/img/performance.svg').default,
    description: (
      <>
        Smart caching with 1-hour TTL, parallel processing, and memory optimization.
        Built for enterprise scale.
      </>
    ),
  },
  {
    title: 'Multi-Environment',
    Svg: require('@site/static/img/multi-env.svg').default,
    description: (
      <>
        Works seamlessly on Node.js, Bun, Deno, and Cloudflare Workers.
        Deploy anywhere with confidence.
      </>
    ),
  },
  {
    title: 'TypeScript Native',
    Svg: require('@site/static/img/typescript.svg').default,
    description: (
      <>
        Full TypeScript support with comprehensive type definitions.
        Catch errors at compile time, not runtime.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

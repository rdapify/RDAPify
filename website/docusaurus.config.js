// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme = require('prism-react-renderer').themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'RDAPify',
  tagline: 'Unified, secure, high-performance RDAP client for enterprise applications',
  favicon: 'img/favicon.png',

  url: 'https://rdapify.com',
  baseUrl: '/',

  organizationName: 'rdapify',
  projectName: 'rdapify',

  customFields: {
    paddleClientToken: 'live_a7bb812fe63dc120029ea183a66',
    paddleEnvironment: 'production',
    paddlePriceMonthly: 'pri_01kmc06bj6pvs2wrrk20g5pr40',
    paddlePriceYearly: 'pri_01kmc08c1ej50661655w5t7mce',
    paddlePriceTeamMonthly: 'pri_01kmc0bdsthkycbx0ewbq5fhcn',
    paddlePriceTeamYearly: 'pri_01kmc0cm8bccxgmmkqf3jya468',
  },

  scripts: [
    { src: 'https://cdn.paddle.com/paddle/v2/paddle.js', async: true },
    { src: '/js/paddle-init.js', defer: true },
  ],

  // JSON-LD structured data injected into every page
  headTags: [
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': 'https://rdapify.com/#organization',
            name: 'RDAPify',
            url: 'https://rdapify.com',
            logo: {
              '@type': 'ImageObject',
              url: 'https://rdapify.com/img/logo.png',
            },
            description:
              'Unified, type-safe RDAP client for querying domains, IPs, and ASNs across all global registries.',
            sameAs: [
              'https://github.com/rdapify/rdapify',
              'https://www.npmjs.com/package/rdapify',
            ],
          },
          {
            '@type': 'WebSite',
            '@id': 'https://rdapify.com/#website',
            url: 'https://rdapify.com',
            name: 'RDAPify',
            description:
              'Modern, type-safe RDAP client. Query domains, IPs, and ASNs across all global registries with one API.',
            publisher: { '@id': 'https://rdapify.com/#organization' },
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://rdapify.com/search?q={search_term_string}',
              },
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@type': 'SoftwareApplication',
            '@id': 'https://rdapify.com/#software',
            name: 'RDAPify',
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Node.js 20+',
            programmingLanguage: 'TypeScript',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            url: 'https://rdapify.com',
            downloadUrl: 'https://www.npmjs.com/package/rdapify',
            codeRepository: 'https://github.com/rdapify/rdapify',
            publisher: { '@id': 'https://rdapify.com/#organization' },
            description:
              'A fast, secure, type-safe RDAP client for Node.js. Query domain, IP, ASN, nameserver, and entity data across all global RDAP registries.',
          },
        ],
      }),
    },
  ],

  onBrokenLinks: 'warn',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
      onBrokenMarkdownImages: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ar', 'es', 'zh', 'ru'],
    localeConfigs: {
      en: {
        label: 'English',
        direction: 'ltr',
      },
      ar: {
        label: 'العربية',
        direction: 'rtl',
      },
      es: {
        label: 'Español',
        direction: 'ltr',
      },
      zh: {
        label: '中文',
        direction: 'ltr',
      },
      ru: {
        label: 'Русский',
        direction: 'ltr',
      },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: '../docs',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/rdapify/rdapify/tree/main/',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/rdapify/rdapify/tree/main/website/',
          blogTitle: 'RDAPify Blog',
          blogDescription: 'Tutorials, guides, and insights on RDAP, domain intelligence, and internet registration data',
          blogSidebarTitle: 'Recent Posts',
          blogSidebarCount: 'ALL',
          postsPerPage: 10,
          feedOptions: {
            type: 'all',
            title: 'RDAPify Blog',
            description: 'Stay up to date with RDAP protocol guides, tutorials, and domain intelligence insights',
            copyright: `Copyright © ${new Date().getFullYear()} RDAPify Contributors`,
          },
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        sitemap: {
          lastmod: 'date',
          changefreq: null,
          priority: null,
          ignorePatterns: ['/tags/**', '/search'],
        },
        gtag: {
          trackingID: 'G-QMD0P4G18Z',
          anonymizeIP: true,
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/rdapify-social-card.png',
      metadata: [
        { name: 'keywords', content: 'rdap, whois, domain lookup, ip lookup, asn lookup, rdap client, typescript, nodejs, rdapify' },
        { name: 'twitter:site', content: '@rdapify' },
        { property: 'og:type', content: 'website' },
      ],
      navbar: {
        title: '',
        logo: {
          alt: 'RDAPify Logo',
          src: 'img/logo-light.svg',
          srcDark: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            to: '/playground',
            position: 'left',
            label: 'Playground',
          },
          {
            to: '/blog',
            position: 'left',
            label: 'Blog',
          },
          {
            to: '/pricing',
            position: 'left',
            label: 'Pricing',
          },
          {
            href: 'https://github.com/rdapify/rdapify',
            label: 'GitHub',
            position: 'right',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/getting-started/installation',
              },
              {
                label: 'API Reference',
                to: '/docs/api-reference/client',
              },
              {
                label: 'Guides',
                to: '/docs/guides/error-handling',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub Discussions',
                href: 'https://github.com/rdapify/rdapify/discussions',
              },
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/rdapify',
              },
              {
                label: 'Discord',
                href: 'https://discord.gg/rdapify',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'Pricing',
                to: '/pricing',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/rdapify',
              },
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/rdapify',
              },
            ],
          },
          {
            title: 'Legal',
            items: [
              {
                label: 'Terms of Service',
                to: '/terms',
              },
              {
                label: 'Privacy Policy',
                to: '/privacy',
              },
              {
                label: 'Refund Policy',
                to: '/refund',
              },
              {
                label: 'Security',
                to: '/security',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} RDAPify Contributors. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['bash', 'json', 'typescript', 'javascript'],
      },
      // NOTE: Algolia search is disabled — replace placeholders with real keys from https://docsearch.algolia.com/apply/
      // algolia: {
      //   appId: 'YOUR_APP_ID',
      //   apiKey: 'YOUR_SEARCH_API_KEY',
      //   indexName: 'rdapify',
      //   contextualSearch: true,
      //   searchParameters: {},
      // },
      announcementBar: {
        id: 'v030_release',
        content:
          '🚀 RDAPify v0.3.0 is out — native Rust backend, batch processing & enterprise features. <a target="_blank" rel="noopener noreferrer" href="https://github.com/rdapify/rdapify/releases">See what\'s new</a> · <a target="_blank" rel="noopener noreferrer" href="https://github.com/rdapify/rdapify">⭐ Star on GitHub</a>',
        backgroundColor: '#1a1a2e',
        textColor: '#25c2a0',
        isCloseable: true,
      },
    }),

  plugins: [
    [
      '@docusaurus/plugin-pwa',
      {
        debug: false,
        offlineModeActivationStrategies: [
          'appInstalled',
          'standalone',
          'queryString',
        ],
        pwaHead: [
          {
            tagName: 'link',
            rel: 'icon',
            href: '/img/logo.png',
          },
          {
            tagName: 'link',
            rel: 'manifest',
            href: '/manifest.json',
          },
          {
            tagName: 'meta',
            name: 'theme-color',
            content: 'rgb(37, 194, 160)',
          },
        ],
      },
    ],
  ],
};

module.exports = config;

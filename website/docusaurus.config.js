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
    paddleClientToken: 'live_d5b5902ea96d58a0206822ec9ca',
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
        gtag: {
          trackingID: 'G-XXXXXXXXXX',
          anonymizeIP: true,
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/rdapify-social-card.png',
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
      algolia: {
        appId: 'YOUR_APP_ID',
        apiKey: 'YOUR_SEARCH_API_KEY',
        indexName: 'rdapify',
        contextualSearch: true,
        searchParameters: {},
      },
      announcementBar: {
        id: 'v016_release',
        content:
          '🚀 RDAPify v0.1.6 is out — CLI tool, Redis cache adapter & enterprise features. <a target="_blank" rel="noopener noreferrer" href="https://github.com/rdapify/rdapify/releases">See what\'s new</a> · <a target="_blank" rel="noopener noreferrer" href="https://github.com/rdapify/rdapify">⭐ Star on GitHub</a>',
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

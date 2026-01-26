// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme = require('prism-react-renderer').themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'RDAPify',
  tagline: 'Unified, secure, high-performance RDAP client for enterprise applications',
  favicon: 'img/favicon.ico',

  url: 'https://rdapify.com',
  baseUrl: '/',

  organizationName: 'rdapify',
  projectName: 'rdapify',

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
        title: 'RDAPify',
        logo: {
          alt: 'RDAPify Logo',
          src: 'img/logo.svg',
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
                label: 'GitHub',
                href: 'https://github.com/rdapify',
              },
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/rdapify',
              },
              {
                label: 'Security',
                to: '/security',
              },
              {
                label: 'Privacy',
                to: '/privacy',
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
        id: 'alpha_release',
        content:
          '⭐️ RDAPify is in alpha! Star us on <a target="_blank" rel="noopener noreferrer" href="https://github.com/rdapify/rdapify">GitHub</a> ⭐️',
        backgroundColor: '#fafbfc',
        textColor: '#091E42',
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

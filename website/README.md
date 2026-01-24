# RDAPify Website

Official documentation website for RDAPify - built with Docusaurus.

## 🌐 Live Site

- **Production**: https://rdapify.com
- **GitHub Pages**: https://rdapify.github.io

## 🚀 Quick Start

### Installation

```bash
cd website
npm install
```

### Local Development

```bash
npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Deployment

#### GitHub Pages

```bash
npm run deploy
```

This command builds the website and pushes to `gh-pages` branch.

#### Custom Domain (rdapify.com)

The site is configured to deploy to https://rdapify.com. Ensure DNS is properly configured:

```
CNAME record: rdapify.com -> rdapify.github.io
```

## 📁 Directory Structure

```
website/
├── docs/                    # Documentation markdown files
├── src/
│   ├── components/         # React components
│   ├── css/               # Custom CSS
│   └── pages/             # Custom pages
├── static/                # Static assets
│   ├── img/              # Images
│   └── diagrams/         # Mermaid diagrams
├── docusaurus.config.js  # Site configuration
├── sidebars.js           # Sidebar navigation
└── package.json          # Dependencies
```

## 🌍 Internationalization

The site supports multiple languages:

- English (en) - Default
- Arabic (ar)
- Spanish (es)
- Chinese (zh)
- Russian (ru)

### Adding Translations

```bash
npm run write-translations -- --locale ar
```

## 🎨 Customization

### Theme

Edit `src/css/custom.css` to customize colors and styles.

### Components

Add custom React components in `src/components/`.

### Pages

Add custom pages in `src/pages/` (supports `.js`, `.jsx`, `.md`, `.mdx`).

## 📝 Documentation

Documentation files are located in `../docs/` (parent directory) and are automatically included in the website build.

### Adding New Docs

1. Create markdown file in appropriate `docs/` subdirectory
2. Add to `sidebars.js` if needed
3. Use frontmatter for metadata:

```markdown
---
id: my-doc
title: My Document
sidebar_label: My Doc
---

Content here...
```

## 🔍 Search

The site uses Algolia DocSearch for search functionality. Configuration is in `docusaurus.config.js`.

To enable search:
1. Apply for DocSearch at https://docsearch.algolia.com/apply/
2. Update `appId` and `apiKey` in config

## 📊 Analytics

Google Analytics is configured in `docusaurus.config.js`. Update the tracking ID:

```js
gtag: {
  trackingID: 'G-XXXXXXXXXX',
}
```

## 🔧 Configuration

Main configuration file: `docusaurus.config.js`

Key settings:
- `url`: Production URL (https://rdapify.com)
- `baseUrl`: Base path (/)
- `organizationName`: GitHub org (rdapify)
- `projectName`: Repo name (rdapify)

## 🚢 Deployment Workflow

### Automatic Deployment

GitHub Actions workflow (`.github/workflows/deploy-website.yml`) automatically deploys on push to `main`:

```yaml
name: Deploy Website
on:
  push:
    branches: [main]
    paths:
      - 'website/**'
      - 'docs/**'
```

### Manual Deployment

```bash
# Build
npm run build

# Test locally
npm run serve

# Deploy
npm run deploy
```

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear cache
npm run clear

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Broken Links

```bash
# Check for broken links
npm run build
```

Docusaurus will warn about broken links during build.

## 📚 Resources

- [Docusaurus Documentation](https://docusaurus.io/)
- [Markdown Features](https://docusaurus.io/docs/markdown-features)
- [Deployment Guide](https://docusaurus.io/docs/deployment)

## 🤝 Contributing

1. Make changes in `website/` or `docs/`
2. Test locally with `npm start`
3. Build to verify: `npm run build`
4. Submit PR

## 📄 License

MIT License - See LICENSE file for details

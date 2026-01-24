# Website Deployment Guide

## 🌐 Production URLs

- **Primary**: https://rdapify.com
- **GitHub Pages**: https://rdapify.github.io

## 📋 Prerequisites

### 1. GitHub Organization Setup

✅ Organization created: `rdapify`
✅ Main repository: `rdapify/rdapify`
✅ Website repository: `rdapify/rdapify.github.io`

### 2. Domain Configuration

Configure DNS records for `rdapify.com`:

```
Type: CNAME
Name: @
Value: rdapify.github.io
TTL: 3600
```

For www subdomain:
```
Type: CNAME
Name: www
Value: rdapify.github.io
TTL: 3600
```

### 3. GitHub Pages Settings

In repository settings:
1. Go to **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **gh-pages** / **root**
4. Custom domain: **rdapify.com**
5. Enforce HTTPS: **✓ Enabled**

## 🚀 Deployment Methods

### Method 1: Automatic (Recommended)

Push to `main` branch triggers automatic deployment:

```bash
git add .
git commit -m "docs: update documentation"
git push origin main
```

GitHub Actions will:
1. Build the website
2. Deploy to `gh-pages` branch
3. Update rdapify.com

### Method 2: Manual Deployment

```bash
cd website

# Install dependencies
npm install

# Build
npm run build

# Deploy
npm run deploy
```

### Method 3: Local Testing

```bash
cd website

# Start dev server
npm start

# Build and serve locally
npm run build
npm run serve
```

## 🔧 Configuration

### Update Site Metadata

Edit `website/docusaurus.config.js`:

```js
const config = {
  title: 'RDAPify',
  tagline: 'Your tagline here',
  url: 'https://rdapify.com',
  baseUrl: '/',
  organizationName: 'rdapify',
  projectName: 'rdapify',
};
```

### Enable Analytics

Update Google Analytics tracking ID:

```js
gtag: {
  trackingID: 'G-XXXXXXXXXX',
  anonymizeIP: true,
}
```

### Enable Search

1. Apply for Algolia DocSearch: https://docsearch.algolia.com/apply/
2. Update config:

```js
algolia: {
  appId: 'YOUR_APP_ID',
  apiKey: 'YOUR_SEARCH_API_KEY',
  indexName: 'rdapify',
}
```

## 📝 Content Updates

### Update Documentation

Documentation is in `../docs/` directory:

```bash
# Edit docs
vim ../docs/getting-started/installation.md

# Commit and push
git add ../docs/
git commit -m "docs: update installation guide"
git push
```

### Add New Page

```bash
# Create new page
touch website/src/pages/pricing.md

# Add content
echo "# Pricing" > website/src/pages/pricing.md
```

### Update Homepage

Edit `website/src/pages/index.js` and `website/src/components/HomepageFeatures/index.js`

## 🌍 Internationalization

### Add New Language

```bash
cd website

# Generate translation files
npm run write-translations -- --locale fr

# Translate files in i18n/fr/
```

### Supported Languages

- English (en) - Default
- Arabic (ar)
- Spanish (es)
- Chinese (zh)
- Russian (ru)

## 🐛 Troubleshooting

### Build Fails

```bash
# Clear cache
cd website
npm run clear
rm -rf node_modules package-lock.json
npm install
npm run build
```

### CNAME Issues

Ensure `website/static/CNAME` contains:
```
rdapify.com
```

### 404 Errors

Check `baseUrl` in `docusaurus.config.js`:
```js
baseUrl: '/',  // For custom domain
```

### Deployment Not Updating

1. Check GitHub Actions: https://github.com/rdapify/rdapify/actions
2. Verify `gh-pages` branch exists
3. Check GitHub Pages settings
4. Clear browser cache

## 📊 Monitoring

### Check Deployment Status

```bash
# View GitHub Actions logs
gh run list --workflow=deploy-website.yml

# View latest run
gh run view
```

### Analytics

- Google Analytics: https://analytics.google.com
- GitHub Insights: https://github.com/rdapify/rdapify/graphs/traffic

## 🔒 Security

### HTTPS

GitHub Pages automatically provides HTTPS for custom domains.

### Content Security Policy

Add to `docusaurus.config.js`:

```js
headTags: [
  {
    tagName: 'meta',
    attributes: {
      'http-equiv': 'Content-Security-Policy',
      content: "default-src 'self'; script-src 'self' 'unsafe-inline'",
    },
  },
],
```

## 📚 Resources

- [Docusaurus Deployment](https://docusaurus.io/docs/deployment)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [Custom Domain Setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

## 🆘 Support

- GitHub Issues: https://github.com/rdapify/rdapify/issues
- Discussions: https://github.com/rdapify/rdapify/discussions
- Email: support@rdapify.com

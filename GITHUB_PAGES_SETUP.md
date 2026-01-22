# GitHub Pages Setup Guide for rdapify.com

## Overview

This guide explains how to set up GitHub Pages for rdapify.com with custom domain and automatic deployment.

---

## 🎯 Architecture

```
Repository Structure:
├── main branch          → Source code
├── gh-pages branch      → Built website (auto-generated)
└── website/             → Docusaurus documentation

Deployment Flow:
1. Push to main branch
2. GitHub Actions builds site
3. Deploys to gh-pages branch
4. Available at rdapify.com
```

---

## 📋 Step-by-Step Setup

### Step 1: Enable GitHub Pages

1. Go to repository **Settings**
2. Navigate to **Pages** section
3. Configure:
   ```
   Source: Deploy from a branch
   Branch: gh-pages
   Folder: / (root)
   ```
4. Click **Save**

### Step 2: Add Custom Domain

1. In the same **Pages** section
2. Under **Custom domain**, enter: `rdapify.com`
3. Click **Save**
4. ✅ Check **Enforce HTTPS** (after DNS propagation)

### Step 3: Configure DNS

Add these records to your DNS provider:

```dns
# For apex domain (rdapify.com)
rdapify.com.    A    185.199.108.153
rdapify.com.    A    185.199.109.153
rdapify.com.    A    185.199.110.153
rdapify.com.    A    185.199.111.153

# For www subdomain
www.rdapify.com.    CNAME    rdapify.github.io.

# For documentation
docs.rdapify.com.   CNAME    rdapify.github.io.
```

**Note**: Replace `rdapify` with your actual GitHub username/organization.

### Step 4: Verify CNAME File

The `CNAME` file in the root directory should contain:
```
rdapify.com
```

This file is already created and will be automatically copied to gh-pages branch.

### Step 5: Wait for DNS Propagation

- DNS propagation can take 24-48 hours
- Check status: https://dnschecker.org/
- Test: `dig rdapify.com`

### Step 6: Enable HTTPS

After DNS propagates:
1. Go back to **Settings > Pages**
2. Check **Enforce HTTPS**
3. Wait a few minutes for certificate provisioning

---

## 🚀 Automatic Deployment

### Current Setup (Already Configured)

The `.github/workflows/docs.yml` workflow automatically:

1. **Triggers on**:
   - Push to `main` branch
   - Changes in `docs/`, `website/`, or `*.md` files

2. **Build Process**:
   ```yaml
   - Validates documentation links
   - Lints markdown files
   - Builds Docusaurus site
   - Deploys to gh-pages branch
   ```

3. **Deployment**:
   - Uses `peaceiris/actions-gh-pages@v3`
   - Deploys to `gh-pages` branch
   - Sets CNAME to `rdapify.com`

### Manual Deployment (if needed)

```bash
# Build locally
cd website
npm install
npm run build

# Deploy manually (not recommended)
npm run deploy
```

---

## 🌐 Multiple Sites Strategy

### Option 1: Single Repository (Recommended)

```
Repository: rdapify/rdapify
├── / (root)              → Main landing page
├── /docs                 → Documentation (Docusaurus)
└── /playground           → Interactive playground

URLs:
- rdapify.com             → Landing page
- rdapify.com/docs        → Documentation
- rdapify.com/playground  → Playground
```

**Pros**: Simple, single deployment, easy maintenance
**Cons**: All in one repository

### Option 2: Multiple Repositories

```
Repository: rdapify/rdapify
└── rdapify.com           → Main site

Repository: rdapify/docs
└── docs.rdapify.com      → Documentation

Repository: rdapify/playground
└── playground.rdapify.com → Playground
```

**Pros**: Separate concerns, independent deployments
**Cons**: More complex, multiple workflows

**Recommendation**: Start with Option 1, migrate to Option 2 if needed.

---

## 📁 Directory Structure

### For Single Repository Approach

```
rdapify/
├── index.html              # Landing page
├── CNAME                   # rdapify.com
├── website/                # Docusaurus
│   ├── docs/              # Documentation source
│   ├── build/             # Built docs (gitignored)
│   └── docusaurus.config.js
├── playground/
│   ├── index.html
│   └── assets/
└── .github/
    └── workflows/
        └── docs.yml        # Deployment workflow
```

### Build Output Structure (gh-pages branch)

```
gh-pages/
├── index.html              # Landing page
├── CNAME                   # rdapify.com
├── docs/                   # Built documentation
│   ├── index.html
│   └── ...
└── playground/             # Playground
    ├── index.html
    └── ...
```

---

## 🎨 Landing Page Setup

Create a simple landing page at the root:

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RDAPify - Unified RDAP Client</title>
    <meta name="description" content="Unified, secure, high-performance RDAP client for enterprise applications">
    <link rel="canonical" href="https://rdapify.com">
    
    <!-- Redirect to docs for now -->
    <meta http-equiv="refresh" content="0; url=/docs/">
</head>
<body>
    <h1>RDAPify</h1>
    <p>Redirecting to documentation...</p>
    <p>If not redirected, <a href="/docs/">click here</a>.</p>
</body>
</html>
```

Or create a proper landing page with:
- Hero section
- Features overview
- Quick start
- Links to docs, playground, GitHub

---

## 🔧 Docusaurus Configuration

Update `website/docusaurus.config.js`:

```javascript
module.exports = {
  title: 'RDAPify',
  tagline: 'Unified, secure, high-performance RDAP client',
  url: 'https://rdapify.com',
  baseUrl: '/docs/',  // If docs are at rdapify.com/docs
  // OR
  baseUrl: '/',       // If docs are at docs.rdapify.com
  
  organizationName: 'rdapify',
  projectName: 'rdapify',
  
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  
  themeConfig: {
    navbar: {
      title: 'RDAPify',
      logo: {
        alt: 'RDAPify Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/playground',
          label: 'Playground',
          position: 'left',
        },
        {
          href: 'https://github.com/rdapify/rdapify',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'API Reference',
              to: '/docs/api-reference',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/rdapify/rdapify',
            },
            {
              label: 'Discussions',
              href: 'https://github.com/rdapify/rdapify/discussions',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} RDAPify. Built with Docusaurus.`,
    },
  },
};
```

---

## 🔍 Testing

### Local Testing

```bash
# Test documentation locally
cd website
npm install
npm start
# Opens http://localhost:3000

# Build for production
npm run build
npm run serve
# Opens http://localhost:3000
```

### DNS Testing

```bash
# Check A records
dig rdapify.com A

# Check CNAME
dig www.rdapify.com CNAME
dig docs.rdapify.com CNAME

# Check from specific DNS server
dig @8.8.8.8 rdapify.com

# Check globally
# Visit: https://dnschecker.org/
```

### HTTPS Testing

```bash
# Check SSL certificate
curl -vI https://rdapify.com

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/
```

---

## 📊 Monitoring

### GitHub Pages Status

- Check: https://www.githubstatus.com/
- Subscribe to updates for Pages service

### Site Monitoring

Set up monitoring with:
- **UptimeRobot** (free tier)
- **Pingdom**
- **StatusCake**

Example UptimeRobot setup:
```
Monitor Type: HTTPS
URL: https://rdapify.com
Interval: 5 minutes
Alert Contacts: your-email@example.com
```

---

## 🚨 Troubleshooting

### Issue: Site not loading

**Check**:
1. DNS records are correct
2. CNAME file exists in gh-pages branch
3. GitHub Pages is enabled
4. DNS has propagated (24-48 hours)

**Solution**:
```bash
# Verify DNS
dig rdapify.com

# Check GitHub Pages status
# Go to Settings > Pages
```

### Issue: HTTPS not working

**Check**:
1. DNS has fully propagated
2. "Enforce HTTPS" is checked
3. Certificate provisioning completed (can take hours)

**Solution**:
- Wait 24 hours after DNS propagation
- Uncheck and recheck "Enforce HTTPS"
- Contact GitHub Support if persists

### Issue: 404 errors

**Check**:
1. Files exist in gh-pages branch
2. Paths are correct (case-sensitive)
3. baseUrl in docusaurus.config.js is correct

**Solution**:
```bash
# Check gh-pages branch
git checkout gh-pages
ls -la

# Verify deployment
# Check GitHub Actions logs
```

### Issue: Build failing

**Check**:
1. GitHub Actions logs
2. Local build works
3. Dependencies are correct

**Solution**:
```bash
# Test locally
cd website
npm install
npm run build

# Check workflow logs
# Go to Actions tab in GitHub
```

---

## 🎯 Performance Optimization

### Enable Caching

GitHub Pages automatically caches static assets.

### Optimize Images

```bash
# Install image optimization tools
npm install -g imagemin-cli

# Optimize images
imagemin website/static/img/* --out-dir=website/static/img/
```

### Minify Assets

Docusaurus automatically minifies in production build.

### Use CDN for External Resources

```html
<!-- Use CDN for libraries -->
<script src="https://cdn.jsdelivr.net/npm/library@version"></script>
```

---

## 📈 Analytics

### Google Analytics

Add to `docusaurus.config.js`:

```javascript
module.exports = {
  // ...
  themeConfig: {
    gtag: {
      trackingID: 'G-XXXXXXXXXX',
      anonymizeIP: true,
    },
  },
};
```

### Plausible Analytics (Privacy-friendly)

```javascript
module.exports = {
  // ...
  scripts: [
    {
      src: 'https://plausible.io/js/script.js',
      'data-domain': 'rdapify.com',
      defer: true,
    },
  ],
};
```

---

## 🔐 Security

### Security Headers

GitHub Pages automatically sets:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`

### Content Security Policy

Add via meta tag in HTML:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline';">
```

---

## 📝 Checklist

### Initial Setup
- [x] CNAME file created
- [x] GitHub Actions workflow configured
- [ ] Enable GitHub Pages in Settings
- [ ] Add custom domain (rdapify.com)
- [ ] Configure DNS records
- [ ] Wait for DNS propagation
- [ ] Enable HTTPS

### Testing
- [ ] Test rdapify.com loads
- [ ] Test www.rdapify.com redirects
- [ ] Test HTTPS works
- [ ] Test all internal links
- [ ] Test on mobile devices
- [ ] Test page load speed

### Monitoring
- [ ] Set up uptime monitoring
- [ ] Set up analytics
- [ ] Subscribe to GitHub Status
- [ ] Create status page

---

## 🎉 Launch Checklist

- [ ] DNS configured and propagated
- [ ] HTTPS enabled and working
- [ ] All pages load correctly
- [ ] No broken links
- [ ] Analytics configured
- [ ] Monitoring set up
- [ ] Announce on social media
- [ ] Update README with live links

---

## 📞 Support

For GitHub Pages issues:
- **GitHub Docs**: https://docs.github.com/pages
- **GitHub Support**: https://support.github.com/
- **Community**: https://github.community/

For rdapify.com issues:
- **Email**: hello@rdapify.com
- **GitHub Issues**: https://github.com/rdapify/rdapify/issues

---

*Last Updated: January 22, 2025*  
*For updates: hello@rdapify.com*

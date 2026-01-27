# RDAPify v0.1.2 Release Notes

**Release Date:** January 27, 2026  
**Version:** 0.1.2  
**Status:** ✅ Production Ready

---

## 🎉 What's New

### Interactive Playground

RDAPify now includes a production-ready "try before install" experience accessible at [rdapify.com/playground](https://rdapify.com/playground).

#### Key Features

1. **Client ID Management**
   - Stable browser identification using `crypto.randomUUID()`
   - Persistent storage in localStorage (`rdapify_client_id`)
   - Fallback for older browsers: `Date.now() + Math.random()`

2. **Real-time Quota Tracking**
   - Display remaining daily queries (`remainingToday`)
   - Show quota reset time (`resetAt`)
   - Automatic button disable when quota exhausted

3. **Rate Limit Handling**
   - Graceful 429 error responses
   - "Daily Limit Reached" user-friendly message
   - Retry-After hint: "Try again in X minutes"

4. **Multi-Package Manager Support**
   - npm install command with copy button
   - yarn add command with copy button
   - pnpm add command with copy button

5. **Website Integration**
   - Playground accessible from main navigation
   - Seamless iframe integration with Docusaurus
   - Responsive design for all screen sizes

### Code Quality Improvements

- **ESLint Fixes**: Resolved 6 issues (4 errors + 2 warnings)
  - Fixed unused variables in `Logger.ts`
  - Fixed type assertions in `enhanced-validators.ts`

---

## 📦 Installation

```bash
# Using npm
npm install rdapify

# Using yarn
yarn add rdapify

# Using pnpm
pnpm add rdapify
```

---

## 🚀 Try It Now

Visit [rdapify.com/playground](https://rdapify.com/playground) to try RDAPify without installing anything!

**Features:**
- Query domains, IPs, and ASNs
- See real RDAP responses
- Track your daily quota
- Copy install commands with one click

---

## 📝 Technical Details

### Playground Architecture

**Frontend (Static):**
- `playground/public/index.html` - Main UI
- `playground/public/app.js` - Client logic with quota tracking
- `playground/public/style.css` - Responsive styling

**Backend (Production):**
- GitHub Pages: Static file hosting
- Cloudflare Worker: API endpoints (`/api/*`)
  - `GET /api/health` - Health check
  - `POST /api/query` - RDAP queries with rate limiting

**Local Development:**
- `playground/api/proxy.js` - Express proxy (dev only)
- Solves CORS issues during local testing

### API Response Format

```json
{
  "success": true,
  "data": { /* RDAP response */ },
  "remainingToday": 3,
  "resetAt": "2026-01-28T00:00:00.000Z"
}
```

### Rate Limiting

- **Daily Quota**: 5 queries per client ID
- **Rate Limit**: 2 queries per minute
- **429 Response**: Includes `Retry-After` header

---

## 📚 Documentation

### New Documentation

- **[playground/README.md](../../playground/README.md)** - Playground overview and production checklist
- **[playground/SETUP.md](../../playground/SETUP.md)** - Local vs production comparison
- **[playground/TESTING_GUIDE.md](../../playground/TESTING_GUIDE.md)** - Testing procedures

### Updated Documentation

- **[README.md](../../README.md)** - Updated to v0.1.2
- **[CHANGELOG.md](../../CHANGELOG.md)** - Added v0.1.2 entry
- **[docs/README.md](../README.md)** - Version reference updated
- **[docs/localization/README_AR.md](../localization/README_AR.md)** - Arabic version updated

---

## 🔧 Breaking Changes

**None.** This release is fully backward compatible with v0.1.3.

---

## 🐛 Bug Fixes

- Fixed ESLint errors in `Logger.ts` (unused variables)
- Fixed ESLint warnings in `enhanced-validators.ts` (type assertions)

---

## 🎯 Migration Guide

No migration needed. Simply update your package:

```bash
npm update rdapify
```

---

## 📊 Statistics

### Code Changes

- **Files Modified**: 8
- **Files Added**: 6
- **Lines Added**: ~800
- **ESLint Issues Fixed**: 6

### Commits

- Total commits in v0.1.2: 6
- Branch: `fix/docs-build-issues`
- Latest commit: `509ddbb`

---

## 🙏 Acknowledgments

Thanks to all contributors who helped make this release possible!

---

## 📞 Support

- **Documentation**: [rdapify.com](https://rdapify.com)
- **GitHub Issues**: [github.com/rdapify/RDAPify/issues](https://github.com/rdapify/RDAPify/issues)
- **Discussions**: [github.com/rdapify/RDAPify/discussions](https://github.com/rdapify/RDAPify/discussions)

---

**🎉 Happy querying with RDAPify v0.1.2! 🎉**

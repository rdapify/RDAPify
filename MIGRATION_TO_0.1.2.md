# 📖 Migration Guide: Upgrading to RDAPify v0.1.2

**Target Audience:** Users on v0.1.0, v0.1.1, or alpha versions  
**Difficulty:** ⭐ Easy (No code changes required!)  
**Time Required:** 2 minutes

---

## 🎯 Why Upgrade?

### ✨ New Features in v0.1.2

1. **Interactive Playground** 🎮
   - Try RDAPify without installing: https://rdapify.com/playground
   - Real-time RDAP queries in your browser
   - Perfect for testing and learning

2. **Client ID Tracking** 🔐
   - Stable browser identification
   - Better quota management
   - localStorage persistence

3. **Real-time Quota Display** 📊
   - See remaining daily queries
   - Know when quota resets
   - Better rate limit visibility

4. **Enhanced Error Handling** 🛡️
   - Graceful 429 (rate limit) responses
   - Retry-After hints
   - Clear error messages

5. **Multi-Package Manager Support** 📦
   - npm, yarn, and pnpm examples
   - Copy-paste install commands
   - Better developer experience

6. **Code Quality** ✅
   - 6 ESLint issues resolved
   - Cleaner codebase
   - Better maintainability

### 🔒 Security & Stability
- All 349 tests passing ✅
- No breaking changes
- Fully backward compatible

---

## ⚠️ Breaking Changes

**None!** 🎉

v0.1.2 is **100% backward compatible** with v0.1.0 and v0.1.1.

Your existing code will work without any modifications.

---

## 🚀 How to Upgrade

### Step 1: Update Your Package

Choose your package manager:

#### Using npm
```bash
npm install rdapify@latest
```

#### Using yarn
```bash
yarn upgrade rdapify@latest
```

#### Using pnpm
```bash
pnpm update rdapify@latest
```

### Step 2: Verify Installation

```bash
npm list rdapify
```

**Expected output:**
```
└── rdapify@0.1.2
```

### Step 3: Test Your Application

Run your existing tests - everything should work as before!

```bash
npm test
```

---

## 💻 Code Examples

### Your Code Doesn't Need Changes!

**Before (v0.1.0 / v0.1.1):**
```javascript
const { RDAPClient } = require('rdapify');

const client = new RDAPClient({
  cache: true,
  redactPII: true
});

const result = await client.domain('example.com');
console.log(result);
```

**After (v0.1.2):**
```javascript
// Exact same code works!
const { RDAPClient } = require('rdapify');

const client = new RDAPClient({
  cache: true,
  redactPII: true
});

const result = await client.domain('example.com');
console.log(result);
```

✅ **No changes required!**

---

## 🔍 What Changed Under the Hood

While your code doesn't need changes, here's what improved:

### Internal Improvements
- Better error handling for rate limits
- Enhanced logging capabilities
- Improved code quality (ESLint fixes)
- Better TypeScript types

### New Optional Features
You can use these if you want, but they're optional:

```javascript
// New: Access to enhanced error information
try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.log(`Retry after: ${error.retryAfter} seconds`);
  }
}
```

---

## 📊 Version Comparison

| Feature | v0.1.0 | v0.1.1 | v0.1.2 |
|---------|--------|--------|--------|
| Core RDAP queries | ✅ | ✅ | ✅ |
| SSRF Protection | ✅ | ✅ | ✅ |
| PII Redaction | ✅ | ✅ | ✅ |
| Caching | ✅ | ✅ | ✅ |
| Correct metadata | ❌ | ✅ | ✅ |
| Interactive Playground | ❌ | ❌ | ✅ |
| Enhanced error handling | ❌ | ❌ | ✅ |
| ESLint clean | ❌ | ❌ | ✅ |

---

## 🧪 Testing After Upgrade

### Quick Smoke Test

```javascript
const { RDAPClient } = require('rdapify');

async function test() {
  const client = new RDAPClient();
  
  // Test domain query
  const domain = await client.domain('example.com');
  console.log('✅ Domain query works:', domain.query);
  
  // Test IP query
  const ip = await client.ip('8.8.8.8');
  console.log('✅ IP query works:', ip.query);
  
  // Test ASN query
  const asn = await client.asn('AS15169');
  console.log('✅ ASN query works:', asn.query);
  
  console.log('\n🎉 All tests passed! Upgrade successful!');
}

test().catch(console.error);
```

---

## 🆘 Troubleshooting

### Issue: "Cannot find module 'rdapify'"

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Version still shows 0.1.x"

**Solution:**
```bash
# Force update
npm install rdapify@0.1.2 --force

# Verify
npm list rdapify
```

### Issue: "Tests failing after upgrade"

**Solution:**
This shouldn't happen (no breaking changes), but if it does:

1. Check your test mocks - ensure they match the API
2. Clear any cached test data
3. Report the issue: https://github.com/rdapify/RDAPify/issues

---

## 📚 Additional Resources

- **Changelog:** [CHANGELOG.md](./CHANGELOG.md)
- **Release Notes:** [VERSION_0.1.2_RELEASE.md](./docs/releases/VERSION_0.1.2_RELEASE.md)
- **Documentation:** https://rdapify.com/docs
- **Playground:** https://rdapify.com/playground
- **GitHub:** https://github.com/rdapify/RDAPify

---

## 💬 Need Help?

- **GitHub Issues:** https://github.com/rdapify/RDAPify/issues
- **GitHub Discussions:** https://github.com/rdapify/RDAPify/discussions
- **Email:** rdapify@gmail.com

---

## ✅ Upgrade Checklist

- [ ] Run `npm install rdapify@latest`
- [ ] Verify version: `npm list rdapify`
- [ ] Run your tests: `npm test`
- [ ] Check your application works
- [ ] Update your documentation (if needed)
- [ ] Celebrate! 🎉

---

**Upgrade Time:** ~2 minutes  
**Breaking Changes:** None  
**Difficulty:** ⭐ Easy

**Ready to upgrade? Run:** `npm install rdapify@latest`

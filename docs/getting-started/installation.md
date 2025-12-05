# ⚙️ Installation Guide

> **🎯 Goal:** Get RDAPify installed and verified in your environment  
> **⏱️ Time Required:** 2-5 minutes  
> **💡 Prerequisite:** Basic familiarity with your preferred package manager  
> **🔍 Pro Tip:** For a hands-on introduction after installation, try our [5-Minute Quick Start](./five-minutes.md)

---

## 📋 System Requirements

### Runtime Environments
RDAPify supports multiple JavaScript runtimes:

| Environment | Minimum Version | Production Ready | Notes |
|-------------|-----------------|------------------|-------|
| Node.js | v18.x or higher | ✅ | Recommended for server applications |
| Bun | v1.0 or higher | ✅ (v2.0+) | Optimized for performance |
| Deno | v1.30 or higher | ✅ (v1.40+) | Built-in TypeScript support |
| Cloudflare Workers | Recent version | ✅ | Limited cache features available |
| Browser | Modern evergreen | ✅ | Via CDN or bundler |

### Development Dependencies
- **Package Manager:** npm (v9+), yarn (v1.22+), or pnpm (v7+)
- **Build Tools (optional):** webpack, esbuild, or Vite for browser bundles
- **For Contributors:** Git 2.30+, TypeScript 5.0+

---

## 📦 Installation Methods

### Option 1: Node.js/npm (Recommended for most users)

```bash
# Create and enter a project directory (if starting new)
mkdir my-rdap-project && cd my-rdap-project

# Initialize a new project (skip if adding to existing project)
npm init -y

# Install RDAPify as a dependency
npm install rdapify
```

> **🔐 Security Note:** Always verify package integrity. RDAPify publishes signed releases. You can verify with:
> ```bash
> npm view rdapify dist.tarball
> # Compare against published checksums at https://rdapify.dev/security/checksums
> ```

### Option 2: CDN (Browser without bundler)
```html
<!DOCTYPE html>
<html>
<head>
  <title>RDAPify Browser Example</title>
  <script type="module">
    // Import from CDN (production ready)
    import { RDAPClient } from 'https://unpkg.com/rdapify@latest/dist/browser/index.js';
    
    // Or use specific version (recommended for production)
    // import { RDAPClient } from 'https://unpkg.com/rdapify@2.3.0/dist/browser/index.js';
    
    // Initialize client with privacy protections
    const client = new RDAPClient({ redactPII: true });
    
    // Your application code here
  </script>
</head>
<body>
  <div id="app"></div>
</body>
</html>
```

### Option 3: Bun (High-performance alternative)
```bash
# Install with Bun
bun add rdapify

# Verify installation
bun run -e "import { RDAPClient } from 'rdapify'; console.log('RDAPify version:', RDAPClient.VERSION);"
```

### Option 4: Deno (Modern runtime with built-in TS)
```typescript
// In your Deno script (app.ts)
import { RDAPClient } from 'https://deno.land/x/rdapify@v2.3.0/mod.ts';

// Initialize client
const client = new RDAPClient({ redactPII: true });

// Your application code here
```

### Option 5: Docker Container
```bash
# Pull the official Docker image
docker pull rdapify/rdapify:latest

# Run with default configuration
docker run -it --rm rdapify/rdapify --help

# Mount custom configuration
docker run -it --rm \
  -v $(pwd)/config:/app/config \
  rdapify/rdapify --config /app/config/client.json
```

---

## ✅ Verification Steps

After installation, verify RDAPify is working correctly:

### Node.js Verification
Create a file `verify.js`:
```javascript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({ redactPII: true });
console.log(`✅ RDAPify client initialized. Version: ${client.version}`);

// Optional: Test with a known domain
try {
  const result = await client.domain('example.com');
  console.log('✅ Basic query successful!');
  console.log('Sample result structure:', {
    domain: result.domain,
    nameservers: result.nameservers,
    // Note: PII fields will be redacted by default
    registrant: result.registrant
  });
} catch (error) {
  console.error('⚠️ Verification query failed:', error.message);
  console.log('ℹ️ This might be due to network restrictions or registry rate limits.');
  console.log('ℹ️ RDAPify is still correctly installed - test queries may fail in restricted environments.');
}
```

Run the verification:
```bash
node verify.js
```

**Expected output:**
```
✅ RDAPify client initialized. Version: 2.3.0
✅ Basic query successful!
Sample result structure: {
  domain: 'example.com',
  nameservers: [ 'a.iana-servers.net', 'b.iana-servers.net' ],
  registrant: { name: 'REDACTED', organization: 'Internet Corporation for Assigned Names and Numbers', ... }
}
```

### Browser Verification
If using the browser/CDN method, open your browser's developer console and check for:
```
RDAPify client initialized. Version: 2.3.0
```

---

## ⚙️ Advanced Configuration

### Environment Variables
RDAPify respects these environment variables for configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `RDAP_CACHE_TTL` | `3600` | Default cache time-to-live in seconds |
| `RDAP_TIMEOUT` | `8000` | Default timeout for RDAP requests in milliseconds |
| `RDAP_RETRIES` | `2` | Number of retries for failed requests |
| `RDAP_REDACT_PII` | `true` | Default PII redaction setting |
| `RDAP_TELEMETRY` | `disabled` | Enable/disable anonymous usage statistics |
| `RDAP_DEBUG` | (unset) | Enable debug logging (values: `basic`, `full`) |

Example setup:
```bash
# .env file
RDAP_CACHE_TTL=7200
RDAP_TIMEOUT=10000
RDAP_RETRIES=3
RDAP_DEBUG=basic
```

### Custom Build Configuration
For browser applications with size constraints, import only what you need:

```javascript
// tree-shaking friendly imports
import { RDAPClient } from 'rdapify/core';
import { RedisAdapter } from 'rdapify/cache-adapters/redis';
import { DataProtection } from 'rdapify/security';

// Minimal browser build
import { RDAPClient } from 'rdapify/browser-minimal';
```

---

## 🛠️ Troubleshooting

### Common Installation Issues

#### 1. Version Conflicts
```bash
# Check for conflicting dependencies
npm ls rdapify

# Resolve version conflicts
npm install rdapify@latest --save-exact
```

#### 2. TypeScript Type Errors
If you encounter TypeScript errors:
```bash
# Ensure TypeScript configuration includes moduleResolution
# tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node16",
    "esModuleInterop": true,
    "strict": true
  }
}
```

#### 3. Network Restrictions
For environments with proxy requirements:
```javascript
import { RDAPClient, ProxyFetcher } from 'rdapify';

const client = new RDAPClient({
  fetcher: new ProxyFetcher({
    proxyUrl: process.env.HTTP_PROXY,
    timeout: 10000
  })
});
```

### Debugging Installation Problems

Enable debug logging to diagnose issues:
```bash
# Environment variable method
RDAP_DEBUG=full node your-app.js

# Programmatic method
import { setLogLevel } from 'rdapify/debug';
setLogLevel('debug');

// Or for a specific client instance
const client = new RDAPClient({
  debug: true,
  logLevel: 'trace'
});
```

Common debug log patterns:
- `rdapify:bootstrap*`: IANA bootstrap server interactions
- `rdapify:discovery*`: Registry discovery process
- `rdapify:query*`: RDAP query lifecycle
- `rdapify:cache*`: Cache interactions
- `rdapify:normalization*`: Data normalization steps

---

## 🔐 Security Verification

After installation, verify security properties:

```bash
# Check for known vulnerabilities
npm audit --production

# Verify package signatures (if applicable)
npm view rdapify | grep sign

# Check dependency tree for security issues
npm ls --depth=10 | grep -i vulnerable
```

> **🔐 Security Best Practice:** In production environments, pin your RDAPify version to avoid unexpected changes:
> ```json
> {
>   "dependencies": {
>     "rdapify": "2.3.0"
>   }
> }
> ```

---

## 🚀 Next Steps

✅ **Installation Complete!** Now choose your path:

- [ ] **Quick Start:** [5 Minutes to RDAPify](./five-minutes.md) - Make your first query
- [ ] **Learning Path:** [Structured Learning Journey](./learning-path.md) - Build expertise systematically
- [ ] **Production Setup:** [Production Checklist](./production-checklist.md) - Prepare for deployment
- [ ] **Interactive Testing:** [Playground Guide](./playground-guide.md) - Experiment safely in browser

### For Enterprise Users
If implementing in an enterprise environment:
```markdown
- [ ] Review [Enterprise Adoption Guide](../enterprise/adoption-guide.md)
- [ ] Configure [Audit Logging](../enterprise/audit-logging.md)
- [ ] Set up [SLA Monitoring](../integrations/monitoring/datadog.md)
- [ ] Implement [Multi-tenant Isolation](../enterprise/multi-tenant.md)
```

---

## 📚 Additional Resources

| Resource | Description | Link |
|----------|-------------|------|
| **API Reference** | Complete method documentation | [../api-reference/client.md](../api-reference/client.md) |
| **Security Whitepaper** | Deep dive on security architecture | [../security/whitepaper.md](../security/whitepaper.md) |
| **Community Support** | Get help from maintainers and users | [../community/getting-help.md](../community/getting-help.md) |
| **Changelog** | Version history and upgrade notes | [../../CHANGELOG.md](../../CHANGELOG.md) |
| **Migration Guide** | Upgrading from previous versions | [../comparisons/migration-guide.md](../comparisons/migration-guide.md) |

> **💡 Expert Tip:** Run your first query against `example.com` or `example.net` as these domains are designed for testing and have predictable responses across all RDAP servers.

[← Back to Getting Started](./README.md) | [Next: 5-Minute Quick Start →](./five-minutes.md)

*Document last updated: December 5, 2025*  
*RDAPify version referenced: 2.3.0*
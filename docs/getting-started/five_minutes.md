# ⚡ 5 Minutes to RDAPify: Interactive Quick Start

> **🎯 Goal:** Query domain registration data with privacy protections in under 5 minutes  
> **💡 Prerequisite:** Basic JavaScript/TypeScript knowledge and Node.js 18+ or modern browser  
> **🚀 Pro Tip:** Follow along in our [Web Playground](https://rdapify.dev/playground) if you don't want to install anything yet!

---

## Minute 1: Installation & Setup

### Option A: Node.js Environment
```bash
# Create a new project directory
mkdir rdap-test && cd rdap-test

# Initialize npm and install RDAPify
npm init -y
npm install rdapify
```

### Option B: Browser Environment (CDN)
```html
<!DOCTYPE html>
<html>
<head>
  <title>RDAPify Quick Start</title>
  <script type="module">
    // Import from CDN
    import { RDAPClient } from 'https://unpkg.com/rdapify@latest/dist/browser/index.js';
  </script>
</head>
<body>
  <div id="result"></div>
</body>
</html>
```

✅ **Check-in:** You now have RDAPify ready to use!

---

## Minute 2: Your First Query (With Privacy Built-In)

Create a file `app.js` with this code:

```javascript
import { RDAPClient } from 'rdapify';

// Create client with privacy-protecting defaults
const client = new RDAPClient({
  // PII redaction is ENABLED by default (GDPR/CCPA compliant)
  redactPII: true,
  
  // Safe caching with automatic expiration
  cacheOptions: {
    ttl: 3600 // 1 hour in seconds
  }
});

// Query a domain - try example.com first (public test domain)
const domain = 'example.com';

try {
  const result = await client.domain(domain);
  console.log(`Registration data for ${domain}:`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Query failed:', error.message);
}
```

✅ **Check-in:** You've made your first privacy-protected RDAP query!

---

## Minute 3: See Privacy in Action

Run your code:
```bash
node app.js
```

**Expected Output:**
```json
{
  "domain": "example.com",
  "registrar": "REDACTED",
  "registrant": {
    "name": "REDACTED",
    "organization": "Internet Corporation for Assigned Names and Numbers",
    "email": "REDACTED@redacted.invalid",
    "phone": "REDACTED"
  },
  "nameservers": ["a.iana-servers.net", "b.iana-servers.net"],
  "events": [
    {
      "action": "registration",
      "date": "1995-08-14T04:00:00Z"
    },
    {
      "action": "last changed",
      "date": "2023-08-14T07:01:44Z"
    }
  ],
  "status": ["client delete prohibited", "client transfer prohibited", "client update prohibited"],
  "raw": false
}
```

🔒 **Privacy Note:** Notice how personal information is automatically redacted while preserving useful technical data. This is RDAPify's privacy-by-default approach in action.

---

## Minute 4: Advanced Features Preview

Update your `app.js` to try these powerful features:

```javascript
// Add this after your first query

// 1. Get raw data (ONLY if you have legal basis!)
const rawResult = await client.domain('example.com', {
  redactPII: false,
  includeRaw: true
});
console.log('Raw RDAP response (use responsibly):');
console.log(JSON.stringify(rawResult.rawResponse, null, 2).substring(0, 200) + '...');

// 2. Try IP lookup
const ipResult = await client.ip('8.8.8.8');
console.log('IP lookup for 8.8.8.8:');
console.log(`Organization: ${ipResult.entity.name}`);
console.log(`Country: ${ipResult.country}`);
console.log(`Network: ${ipResult.cidr}`);
```

✅ **Check-in:** You've now experienced core RDAPify capabilities with built-in privacy controls!

---

## Minute 5: Next Steps & Production Considerations

You've completed the 5-minute quick start! 🎉 Here's where to go next:

### 🔍 **Deepen Your Knowledge**
- [Learning Path](./learning-path.md) - Structured learning journey
- [Core Concepts](../core-concepts/what-is-rdap.md) - Understand RDAP fundamentals
- [Privacy Controls Guide](../api-reference/privacy-controls.md) - Master data protection features

### ⚙️ **Production Readiness Checklist**
```markdown
- [ ] Set up proper error handling with retry logic
- [ ] Configure persistent caching with encryption
- [ ] Implement rate limiting for registry compliance
- [ ] Add audit logging for data access
- [ ] Review legal basis for your specific use case
- [ ] Set up monitoring and alerting
```

### 🌐 **Try These Next**
```javascript
// Production-grade client setup example
const productionClient = new RDAPClient({
  redactPII: true,
  timeout: 10000,
  retries: 3,
  cacheAdapter: new RedisAdapter({ 
    url: process.env.REDIS_URL,
    redactBeforeStore: true,
    encryptionKey: process.env.CACHE_ENCRYPTION_KEY
  }),
  telemetry: {
    enabled: true,
    anonymize: true
  }
});
```

---

## 💡 Interactive Challenge (Optional)

**Modify your code to:**
1. Create a function that checks if a domain is registered to a specific organization
2. Implement a simple cache clear function that respects privacy regulations
3. Add error handling that distinguishes between network errors and data not found

**Solution preview:** Check our [Examples Repository](../../../examples/basic/) for reference implementations.

---

## 🆘 Need Help?

- **Stuck?** Try our [Troubleshooting Guide](../troubleshooting/common-errors.md)
- **Questions?** Join our [Community Discussions](https://github.com/rdapify/rdapify/discussions)
- **Real-time help:** Join our weekly Office Hours (Thursdays 2PM UTC)

---

> **🔐 Privacy Reminder:** RDAPify is designed with privacy-by-default, but you remain responsible for compliance with applicable regulations. Always assess your legal basis for processing registration data. When in doubt, keep `redactPII: true` enabled!

[← Back to Getting Started](./README.md) | [Next: Learning Path →](./learning-path.md)

*Document last updated: December 5, 2025*  
*RDAPify version used in examples: 2.3.0*
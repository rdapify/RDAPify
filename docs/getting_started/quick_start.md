# ⚡ Quick Start: RDAPify in 5 Minutes

> **🎯 Goal:** Query domain registration data with enterprise-grade privacy controls in under 5 minutes  
> **💡 Prerequisite:** Node.js 18+ or modern browser with JavaScript knowledge  
> **🚀 Pro Tip:** Try our [Web Playground](./playground-guide.md) if you prefer not to install anything yet!

---

## Minute 1: Installation

### Node.js Environment (Recommended)
```bash
# Create a new project
mkdir rdap-quickstart && cd rdap-quickstart

# Initialize npm and install RDAPify
npm init -y
npm install rdapify

# Create your first file
touch app.js
```

### Browser Environment (Alternative)
```html
<!DOCTYPE html>
<html>
<head>
  <title>RDAPify Quick Start</title>
  <script type="module">
    // Import from CDN
    import { RDAPClient } from 'https://unpkg.com/rdapify@latest/dist/browser/index.js';
    
    // Your code will go here
  </script>
</head>
<body>
  <div id="result"></div>
</body>
</html>
```

✅ **Check:** RDAPify is now installed and ready to use!

---

## Minute 2: Your First Query (With Privacy Built-In)

Add this code to your `app.js` file:

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

// Query a domain - example.com is safe for testing
const domain = 'example.com';

try {
  const result = await client.domain(domain);
  console.log(`Domain registration data for ${domain}:`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Query failed:', error.message);
}
```

> **🔐 Privacy Note:** The `redactPII: true` setting (enabled by default) ensures personal data like names, emails, and phone numbers are automatically redacted from responses. This is critical for GDPR/CCPA compliance.

✅ **Check:** Your code is ready to execute!

---

## Minute 3: Run and See Results

Execute your code:
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
  "status": ["client delete prohibited", "client transfer prohibited", "client update prohibited"]
}
```

> **🔍 Protocol Insight:** RDAP (RFC 7480) structures registration data in a standardized JSON format unlike legacy WHOIS. This enables programmatic processing while maintaining human-readable metadata.

✅ **Check:** You've successfully queried domain registration data with built-in privacy protection!

---

## Minute 4: Advanced Features Preview

Update your `app.js` to try these powerful features:

```javascript
// Add this after your first query

// 1. IP lookup with geolocation
const ipResult = await client.ip('8.8.8.8');
console.log('\nIP lookup for 8.8.8.8:');
console.log(`Organization: ${ipResult.entity.name}`);
console.log(`Country: ${ipResult.country}`);
console.log(`Network: ${ipResult.cidr}`);

// 2. ASN lookup
const asnResult = await client.asn(15169);
console.log('\nASN lookup for 15169 (Google):');
console.log(`Organization: ${asnResult.entity.name}`);
console.log(`IP Ranges: ${asnResult.ipRanges.join(', ')}`);

// 3. Batch processing (enterprise feature)
const domains = ['example.com', 'iana.org', 'rdap.org'];
const batchResults = await Promise.all(
  domains.map(domain => client.domain(domain))
);
console.log('\nBatch processing complete. Results count:', batchResults.length);
```

✅ **Check:** You've now experienced core RDAPify capabilities with built-in compliance controls!

---

## Minute 5: Next Steps & Production Considerations

You've completed the 5-minute quick start! 🎉 Here's where to go next:

### 🔍 **Deepen Your Knowledge**
```markdown
- [ ] [Learning Path](./learning-path.md) - Structured learning journey
- [ ] [Core Concepts](../core-concepts/what-is-rdap.md) - Understand RDAP fundamentals
- [ ] [Privacy Controls](../api-reference/privacy-controls.md) - Master data protection features
```

### ⚙️ **Production Readiness Checklist**
```javascript
// Example production-grade configuration
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

### 🚨 **Critical Security Reminders**
- Never disable `redactPII` without a documented legal basis
- Always encrypt cached RDAP responses at rest
- Implement rate limiting to comply with registry policies
- Add audit logging for all data access operations

---

## 💡 Interactive Challenge

**Try this exercise:**  
Modify your code to create a function that checks if a domain's registrar has changed in the last 30 days.

```javascript
async function hasRegistrarChangedRecently(domain, days = 30) {
  // Your implementation here
  // Hint: Use the events array in the response
}

// Test it
console.log(await hasRegistrarChangedRecently('example.com'));
```

**Solution:** Check our [examples repository](../../examples/basic/domain-lookup.js) for reference implementations.

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
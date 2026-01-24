/**
 * Rate Limiting Example
 * Demonstrates how to implement rate limiting for RDAP queries
 */

const { RDAPClient } = require('rdapify');

/**
 * Simple token bucket rate limiter
 */
class RateLimiter {
  constructor(tokensPerSecond = 5, maxTokens = 10) {
    this.tokensPerSecond = tokensPerSecond;
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.tokensPerSecond;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire() {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    // Wait until token is available
    const waitTime = ((1 - this.tokens) / this.tokensPerSecond) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    this.tokens = 0;
    return true;
  }

  getStatus() {
    this.refill();
    return {
      available: Math.floor(this.tokens),
      max: this.maxTokens,
      rate: `${this.tokensPerSecond}/sec`,
    };
  }
}

/**
 * Wrapper client with rate limiting
 */
class RateLimitedRDAPClient {
  constructor(options = {}) {
    this.client = new RDAPClient(options);
    this.rateLimiter = new RateLimiter(
      options.rateLimit?.tokensPerSecond || 5,
      options.rateLimit?.maxTokens || 10
    );
  }

  async domain(domain) {
    await this.rateLimiter.acquire();
    console.log(`  [Rate Limiter] Tokens: ${this.rateLimiter.getStatus().available}/${this.rateLimiter.getStatus().max}`);
    return this.client.domain(domain);
  }

  async ip(ip) {
    await this.rateLimiter.acquire();
    console.log(`  [Rate Limiter] Tokens: ${this.rateLimiter.getStatus().available}/${this.rateLimiter.getStatus().max}`);
    return this.client.ip(ip);
  }

  async asn(asn) {
    await this.rateLimiter.acquire();
    console.log(`  [Rate Limiter] Tokens: ${this.rateLimiter.getStatus().available}/${this.rateLimiter.getStatus().max}`);
    return this.client.asn(asn);
  }
}

async function main() {
  // Create rate-limited client (5 requests per second, burst of 10)
  const client = new RateLimitedRDAPClient({
    cache: true,
    privacy: { redactPII: true },
    rateLimit: {
      tokensPerSecond: 5,
      maxTokens: 10,
    },
  });

  const domains = [
    'example.com',
    'google.com',
    'github.com',
    'cloudflare.com',
    'amazon.com',
    'microsoft.com',
    'apple.com',
    'facebook.com',
  ];

  console.log('Rate Limited Queries (5 req/sec, burst 10)\n');

  try {
    const startTime = Date.now();

    // Process domains sequentially with rate limiting
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      console.log(`\n${i + 1}. Querying ${domain}...`);

      const result = await client.domain(domain);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`   ✓ ${result.ldhName} - ${result.status?.[0] || 'N/A'}`);
      console.log(`   Elapsed: ${elapsed}s`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nTotal time: ${totalTime}s`);
    console.log(`Average rate: ${(domains.length / totalTime).toFixed(2)} req/sec`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

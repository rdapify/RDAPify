/**
 * Custom Cache Implementation Example
 * Demonstrates how to implement a custom cache adapter
 */

const { RDAPClient } = require('rdapify');

/**
 * Simple file-based cache implementation
 * In production, use Redis or another distributed cache
 */
class FileCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 3600000; // 1 hour in milliseconds
  }

  async get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    console.log(`  [Cache HIT] ${key}`);
    return entry.value;
  }

  async set(key, value, ttl = this.ttl) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
    console.log(`  [Cache SET] ${key} (TTL: ${ttl}ms)`);
  }

  async delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`  [Cache DEL] ${key}`);
    }
    return deleted;
  }

  async clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`  [Cache CLEAR] Removed ${size} entries`);
  }

  async has(key) {
    return this.cache.has(key);
  }

  get size() {
    return this.cache.size;
  }
}

async function main() {
  // Create custom cache instance
  const customCache = new FileCache();

  // Create client with custom cache
  const client = new RDAPClient({
    cache: customCache,
    privacy: { redactPII: true },
  });

  console.log('Custom Cache Example\n');

  try {
    // First query - cache miss
    console.log('1. First query (cache miss):');
    const result1 = await client.domain('example.com');
    console.log(`   Domain: ${result1.ldhName}, Cached: ${result1.metadata.cached}\n`);

    // Second query - cache hit
    console.log('2. Second query (cache hit):');
    const result2 = await client.domain('example.com');
    console.log(`   Domain: ${result2.ldhName}, Cached: ${result2.metadata.cached}\n`);

    // Query different domain
    console.log('3. Different domain (cache miss):');
    const result3 = await client.domain('google.com');
    console.log(`   Domain: ${result3.ldhName}, Cached: ${result3.metadata.cached}\n`);

    // Cache statistics
    console.log('Cache Statistics:');
    console.log(`  Total entries: ${customCache.size}`);
    console.log(`  Has example.com: ${await customCache.has('domain:example.com')}`);
    console.log(`  Has google.com: ${await customCache.has('domain:google.com')}`);

    // Clear cache
    console.log('\n4. Clearing cache:');
    await customCache.clear();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

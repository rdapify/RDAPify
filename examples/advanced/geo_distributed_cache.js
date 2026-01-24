/**
 * Geo-Distributed Cache Example
 * Demonstrates multi-region cache strategy for global applications
 */

const { RDAPClient } = require('rdapify');

/**
 * Simulated geo-distributed cache with regional fallback
 */
class GeoDistributedCache {
  constructor(region = 'us-east') {
    this.region = region;
    this.localCache = new Map();
    this.remoteCache = new Map(); // Simulates remote region cache
    this.ttl = 3600000; // 1 hour
    this.stats = {
      localHits: 0,
      remoteHits: 0,
      misses: 0,
    };
  }

  async get(key) {
    // Try local cache first (fastest)
    const localEntry = this.localCache.get(key);
    if (localEntry && Date.now() < localEntry.expiresAt) {
      this.stats.localHits++;
      console.log(`  [Cache] LOCAL HIT (${this.region}) - ${key}`);
      return localEntry.value;
    }

    // Try remote cache (slower but still cached)
    const remoteEntry = this.remoteCache.get(key);
    if (remoteEntry && Date.now() < remoteEntry.expiresAt) {
      this.stats.remoteHits++;
      console.log(`  [Cache] REMOTE HIT (other region) - ${key}`);

      // Promote to local cache
      this.localCache.set(key, remoteEntry);
      return remoteEntry.value;
    }

    // Cache miss
    this.stats.misses++;
    console.log(`  [Cache] MISS - ${key}`);
    return null;
  }

  async set(key, value, ttl = this.ttl) {
    const expiresAt = Date.now() + ttl;
    const entry = { value, expiresAt, region: this.region };

    // Write to both local and remote
    this.localCache.set(key, entry);
    this.remoteCache.set(key, entry);

    console.log(`  [Cache] SET (${this.region}) - ${key}`);
  }

  async delete(key) {
    this.localCache.delete(key);
    this.remoteCache.delete(key);
  }

  async clear() {
    this.localCache.clear();
    this.remoteCache.clear();
  }

  getStats() {
    const total = this.stats.localHits + this.stats.remoteHits + this.stats.misses;
    return {
      ...this.stats,
      total,
      localHitRate: total > 0 ? ((this.stats.localHits / total) * 100).toFixed(1) : 0,
      totalHitRate:
        total > 0
          ? (((this.stats.localHits + this.stats.remoteHits) / total) * 100).toFixed(1)
          : 0,
    };
  }
}

async function simulateRegionalQueries(region, domains) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Region: ${region.toUpperCase()}`);
  console.log('='.repeat(50));

  const cache = new GeoDistributedCache(region);
  const client = new RDAPClient({
    cache,
    privacy: { redactPII: true },
  });

  for (const domain of domains) {
    console.log(`\nQuerying: ${domain}`);
    try {
      const result = await client.domain(domain);
      console.log(`  ✓ ${result.ldhName} - ${result.status?.[0] || 'N/A'}`);
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }
  }

  // Display cache statistics
  const stats = cache.getStats();
  console.log(`\nCache Statistics (${region}):`);
  console.log(`  Local Hits: ${stats.localHits}`);
  console.log(`  Remote Hits: ${stats.remoteHits}`);
  console.log(`  Misses: ${stats.misses}`);
  console.log(`  Local Hit Rate: ${stats.localHitRate}%`);
  console.log(`  Total Hit Rate: ${stats.totalHitRate}%`);

  return cache;
}

async function main() {
  console.log('Geo-Distributed Cache Example');
  console.log('Simulating multi-region cache behavior\n');

  // Simulate queries from different regions
  const domains = ['example.com', 'google.com', 'github.com'];

  // US East region queries
  await simulateRegionalQueries('us-east', domains);

  // Simulate same queries from different region
  // In real scenario, this would hit remote cache
  await simulateRegionalQueries('eu-west', domains);

  // Simulate mixed queries
  await simulateRegionalQueries('ap-south', [
    'example.com', // Should hit remote cache
    'cloudflare.com', // New query
    'google.com', // Should hit remote cache
  ]);

  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log('='.repeat(50));
  console.log('This example demonstrates:');
  console.log('  • Local cache for fastest access');
  console.log('  • Remote cache fallback for cross-region hits');
  console.log('  • Cache promotion from remote to local');
  console.log('  • Regional cache statistics');
}

main().catch(console.error);

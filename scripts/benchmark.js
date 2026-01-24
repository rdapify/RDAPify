#!/usr/bin/env node
/**
 * Performance Benchmark Script
 * Measures query performance and cache efficiency
 */

import { performance } from 'perf_hooks';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

console.log('⚡ Running performance benchmarks...\n');

async function benchmark() {
  // Check if dist exists
  try {
    const { RDAPClient } = require('../dist/index.js');

    const client = new RDAPClient({
      cache: true,
      privacy: { redactPII: true },
    });

    const domains = ['example.com', 'google.com', 'github.com'];

    // Benchmark 1: Cold cache (first query)
    console.log('📊 Benchmark 1: Cold Cache');
    console.log('='.repeat(60));

    for (const domain of domains) {
      const start = performance.now();
      try {
        await client.domain(domain);
        const duration = (performance.now() - start).toFixed(2);
        console.log(`  ${domain}: ${duration}ms`);
      } catch (error) {
        console.log(`  ${domain}: Error - ${error.message}`);
      }
    }

    // Benchmark 2: Warm cache (cached queries)
    console.log('\n📊 Benchmark 2: Warm Cache');
    console.log('='.repeat(60));

    for (const domain of domains) {
      const start = performance.now();
      try {
        await client.domain(domain);
        const duration = (performance.now() - start).toFixed(2);
        console.log(`  ${domain}: ${duration}ms (cached)`);
      } catch (error) {
        console.log(`  ${domain}: Error - ${error.message}`);
      }
    }

    // Benchmark 3: Parallel queries
    console.log('\n📊 Benchmark 3: Parallel Queries');
    console.log('='.repeat(60));

    const start = performance.now();
    const results = await Promise.allSettled(
      domains.map((domain) => client.domain(domain))
    );
    const duration = (performance.now() - start).toFixed(2);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`  Total: ${duration}ms`);
    console.log(`  Queries: ${domains.length}`);
    console.log(`  Successful: ${successful}`);
    console.log(`  Average: ${(duration / domains.length).toFixed(2)}ms per query`);

    console.log('\n✅ Benchmarks complete');
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    console.error('\nMake sure to build the project first:');
    console.error('  npm run build');
    process.exit(1);
  }
}

benchmark().catch(console.error);

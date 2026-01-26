/**
 * Rate Limiting Example
 * 
 * This example demonstrates how to use rate limiting to control
 * the number of RDAP queries made within a time window.
 */

const { RDAPClient, RateLimiter, RateLimitError } = require('rdapify');

// Example 1: Basic Rate Limiting
async function basicRateLimiting() {
  console.log('\n=== Example 1: Basic Rate Limiting ===\n');
  
  const client = new RDAPClient({
    rateLimit: {
      enabled: true,
      maxRequests: 5,
      windowMs: 10000  // 5 requests per 10 seconds
    }
  });
  
  const domains = [
    'example.com',
    'google.com',
    'github.com',
    'stackoverflow.com',
    'reddit.com',
    'twitter.com'  // This will exceed the limit
  ];
  
  for (const domain of domains) {
    try {
      console.log(`Querying ${domain}...`);
      const result = await client.domain(domain);
      console.log(`✓ ${domain}: ${result.registrar?.name || 'N/A'}`);
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.log(`✗ Rate limit exceeded! Retry after ${error.retryAfter}ms`);
        console.log(`  Suggestion: ${error.suggestion}`);
        break;
      } else {
        console.error(`✗ Error: ${error.message}`);
      }
    }
  }
}

// Example 2: Standalone Rate Limiter
async function standaloneRateLimiter() {
  console.log('\n=== Example 2: Standalone Rate Limiter ===\n');
  
  const limiter = new RateLimiter({
    enabled: true,
    maxRequests: 3,
    windowMs: 5000  // 3 requests per 5 seconds
  });
  
  const client = new RDAPClient();
  
  for (let i = 1; i <= 5; i++) {
    try {
      // Check rate limit before making request
      await limiter.checkLimit('user-123');
      
      console.log(`Request ${i}: Allowed`);
      const result = await client.domain('example.com');
      console.log(`  Result: ${result.ldhName}`);
      
      // Show usage
      const usage = limiter.getUsage('user-123');
      console.log(`  Usage: ${usage.current}/${usage.limit} (${usage.remaining} remaining)`);
      
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.log(`Request ${i}: Rate limit exceeded!`);
        console.log(`  Retry after: ${error.retryAfter}ms`);
        break;
      }
    }
  }
  
  // Cleanup
  limiter.destroy();
}

// Example 3: Per-User Rate Limiting
async function perUserRateLimiting() {
  console.log('\n=== Example 3: Per-User Rate Limiting ===\n');
  
  const limiter = new RateLimiter({
    enabled: true,
    maxRequests: 2,
    windowMs: 5000
  });
  
  const users = ['user-1', 'user-2', 'user-3'];
  
  for (const user of users) {
    console.log(`\nUser: ${user}`);
    
    for (let i = 1; i <= 3; i++) {
      try {
        await limiter.checkLimit(user);
        console.log(`  Request ${i}: ✓ Allowed`);
      } catch (error) {
        if (error instanceof RateLimitError) {
          console.log(`  Request ${i}: ✗ Rate limit exceeded`);
        }
      }
    }
    
    const usage = limiter.getUsage(user);
    console.log(`  Final usage: ${usage.current}/${usage.limit}`);
  }
  
  limiter.destroy();
}

// Example 4: Rate Limiting with Retry
async function rateLimitingWithRetry() {
  console.log('\n=== Example 4: Rate Limiting with Retry ===\n');
  
  const client = new RDAPClient({
    rateLimit: {
      enabled: true,
      maxRequests: 2,
      windowMs: 5000
    }
  });
  
  async function queryWithRetry(domain, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} for ${domain}...`);
        const result = await client.domain(domain);
        console.log(`✓ Success: ${result.ldhName}`);
        return result;
      } catch (error) {
        if (error instanceof RateLimitError) {
          if (attempt < maxRetries) {
            console.log(`✗ Rate limited. Waiting ${error.retryAfter}ms...`);
            await new Promise(resolve => setTimeout(resolve, error.retryAfter));
          } else {
            console.log(`✗ Failed after ${maxRetries} attempts`);
            throw error;
          }
        } else {
          throw error;
        }
      }
    }
  }
  
  const domains = ['example.com', 'google.com', 'github.com'];
  
  for (const domain of domains) {
    try {
      await queryWithRetry(domain);
    } catch (error) {
      console.error(`Failed to query ${domain}:`, error.message);
    }
  }
}

// Example 5: Rate Limiter Statistics
async function rateLimiterStatistics() {
  console.log('\n=== Example 5: Rate Limiter Statistics ===\n');
  
  const limiter = new RateLimiter({
    enabled: true,
    maxRequests: 10,
    windowMs: 10000
  });
  
  // Simulate some requests
  for (let i = 0; i < 5; i++) {
    await limiter.checkLimit('user-1');
  }
  
  for (let i = 0; i < 3; i++) {
    await limiter.checkLimit('user-2');
  }
  
  // Get statistics
  const stats = limiter.getStats();
  console.log('Rate Limiter Statistics:');
  console.log(`  Enabled: ${stats.enabled}`);
  console.log(`  Max Requests: ${stats.maxRequests}`);
  console.log(`  Window: ${stats.windowMs}ms`);
  console.log(`  Active Keys: ${stats.activeKeys}`);
  console.log(`  Total Requests: ${stats.totalRequests}`);
  
  // Get per-user usage
  console.log('\nPer-User Usage:');
  const usage1 = limiter.getUsage('user-1');
  console.log(`  user-1: ${usage1.current}/${usage1.limit} (${usage1.remaining} remaining)`);
  
  const usage2 = limiter.getUsage('user-2');
  console.log(`  user-2: ${usage2.current}/${usage2.limit} (${usage2.remaining} remaining)`);
  
  limiter.destroy();
}

// Run all examples
async function main() {
  try {
    await basicRateLimiting();
    await standaloneRateLimiter();
    await perUserRateLimiting();
    await rateLimitingWithRetry();
    await rateLimiterStatistics();
    
    console.log('\n✓ All examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  basicRateLimiting,
  standaloneRateLimiter,
  perUserRateLimiting,
  rateLimitingWithRetry,
  rateLimiterStatistics
};

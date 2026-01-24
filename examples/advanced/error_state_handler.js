/**
 * Error State Handling Example
 * Demonstrates comprehensive error handling and retry logic
 */

const { RDAPClient } = require('rdapify');

/**
 * Error handler with detailed logging
 */
class ErrorHandler {
  constructor() {
    this.errors = [];
  }

  handle(error, context = {}) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      context,
    };

    this.errors.push(errorInfo);

    // Log based on error type
    if (error.code === 'VALIDATION_ERROR') {
      console.error(`  ❌ Validation Error: ${error.message}`);
    } else if (error.code === 'NETWORK_ERROR') {
      console.error(`  ❌ Network Error: ${error.message}`);
    } else if (error.code === 'TIMEOUT_ERROR') {
      console.error(`  ❌ Timeout Error: ${error.message}`);
    } else if (error.code === 'SSRF_PROTECTION_ERROR') {
      console.error(`  ❌ Security Error: ${error.message}`);
    } else if (error.code === 'BOOTSTRAP_ERROR') {
      console.error(`  ❌ Bootstrap Error: ${error.message}`);
    } else {
      console.error(`  ❌ Unknown Error: ${error.message}`);
    }

    return errorInfo;
  }

  getSummary() {
    const byType = {};
    this.errors.forEach((err) => {
      const type = err.code || 'UNKNOWN';
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total: this.errors.length,
      byType,
      errors: this.errors,
    };
  }
}

async function queryWithRetry(client, type, value, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  Attempt ${attempt}/${maxRetries}...`);

      let result;
      if (type === 'domain') result = await client.domain(value);
      else if (type === 'ip') result = await client.ip(value);
      else if (type === 'asn') result = await client.asn(value);

      console.log(`  ✓ Success on attempt ${attempt}`);
      return { success: true, result, attempts: attempt };
    } catch (error) {
      lastError = error;
      console.log(`  ✗ Failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        console.log(`  ⏳ Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, error: lastError, attempts: maxRetries };
}

async function main() {
  const client = new RDAPClient({
    cache: false, // Disable cache to test retries
    privacy: { redactPII: true },
    retry: { maxAttempts: 1 }, // Handle retries manually
  });

  const errorHandler = new ErrorHandler();

  console.log('Error State Handling Example\n');

  // Test cases with various scenarios
  const testCases = [
    { type: 'domain', value: 'example.com', description: 'Valid domain' },
    { type: 'domain', value: 'invalid..domain', description: 'Invalid domain format' },
    { type: 'ip', value: '8.8.8.8', description: 'Valid IP' },
    { type: 'ip', value: '999.999.999.999', description: 'Invalid IP' },
    { type: 'asn', value: 15169, description: 'Valid ASN' },
  ];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.description}`);
    console.log(`Query: ${testCase.type}(${testCase.value})`);

    try {
      const result = await queryWithRetry(client, testCase.type, testCase.value, 3);

      if (result.success) {
        console.log(`✓ Query successful after ${result.attempts} attempt(s)`);
      } else {
        errorHandler.handle(result.error, {
          type: testCase.type,
          value: testCase.value,
          attempts: result.attempts,
        });
      }
    } catch (error) {
      errorHandler.handle(error, {
        type: testCase.type,
        value: testCase.value,
      });
    }
  }

  // Display error summary
  console.log('\n' + '='.repeat(50));
  console.log('Error Summary:');
  console.log('='.repeat(50));

  const summary = errorHandler.getSummary();
  console.log(`Total Errors: ${summary.total}`);

  if (summary.total > 0) {
    console.log('\nErrors by Type:');
    Object.entries(summary.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }
}

main().catch(console.error);

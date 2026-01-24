/**
 * Azure Functions Handler for RDAPify
 * 
 * This handler wraps the RDAPify client for use in Azure Functions
 */

const { RDAPClient } = require('rdapify');

// Initialize client once (reused across invocations)
const client = new RDAPClient({
  cache: {
    strategy: process.env.CACHE_STRATEGY || 'memory',
    ttl: parseInt(process.env.CACHE_TTL || '3600'),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
  },
  privacy: {
    redactPII: process.env.REDACT_PII === 'true'
  },
  retry: {
    maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3')
  },
  timeout: {
    request: parseInt(process.env.REQUEST_TIMEOUT || '10000')
  },
  ssrfProtection: {
    enabled: process.env.SSRF_PROTECTION_ENABLED === 'true'
  }
});

/**
 * Azure Functions HTTP trigger
 */
module.exports = async function (context, req) {
  context.log('HTTP trigger function processed a request.');

  try {
    const queryType = context.bindingData.queryType;
    const value = context.bindingData.value;

    // Health check endpoint
    if (queryType === 'health') {
      context.res = {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          status: 'healthy',
          version: '0.1.0-alpha.4',
          timestamp: new Date().toISOString()
        }
      };
      return;
    }

    // Validate parameters
    if (!queryType || !value) {
      context.res = {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          error: 'Query type and value are required',
          usage: {
            domain: '/api/domain/{domain}',
            ip: '/api/ip/{ip}',
            asn: '/api/asn/{asn}'
          }
        }
      };
      return;
    }

    // Route to appropriate query method
    let result;
    
    switch (queryType.toLowerCase()) {
      case 'domain':
        result = await client.domain(value);
        break;
      case 'ip':
        result = await client.ip(value);
        break;
      case 'asn':
        result = await client.asn(value);
        break;
      default:
        context.res = {
          status: 404,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            error: `Unknown query type: ${queryType}`,
            validTypes: ['domain', 'ip', 'asn']
          }
        };
        return;
    }

    // Return successful response
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      },
      body: result
    };

  } catch (error) {
    context.log.error('Error:', error);

    // Handle different error types
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorContext = {};

    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = error.message;
      errorContext = error.context || {};
    } else if (error.name === 'NoServerFoundError') {
      statusCode = 404;
      errorMessage = error.message;
      errorContext = error.context || {};
    } else if (error.name === 'TimeoutError') {
      statusCode = 504;
      errorMessage = 'Request timeout';
      errorContext = { timeout: true };
    } else if (error.name === 'NetworkError') {
      statusCode = 502;
      errorMessage = 'Network error';
      errorContext = { network: true };
    } else {
      errorContext = { error: error.message };
    }

    context.res = {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        error: errorMessage,
        statusCode,
        timestamp: new Date().toISOString(),
        ...errorContext
      }
    };
  }
};

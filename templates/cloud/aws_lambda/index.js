/**
 * AWS Lambda Handler for RDAPify
 * 
 * This handler wraps the RDAPify client for use in AWS Lambda
 */

const { RDAPClient } = require('rdapify');

// Initialize client once (outside handler for reuse across invocations)
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
 * Lambda handler function
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Extract path and query parameters
    const path = event.path || event.rawPath;
    const pathParams = event.pathParameters || {};

    // Health check endpoint
    if (path === '/health') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          status: 'healthy',
          version: '0.1.0-alpha.4',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Route to appropriate query method
    let result;
    
    if (path.startsWith('/domain/')) {
      const domain = pathParams.domain || path.split('/domain/')[1];
      if (!domain) {
        return errorResponse(400, 'Domain parameter is required');
      }
      result = await client.domain(domain);
    } 
    else if (path.startsWith('/ip/')) {
      const ip = pathParams.ip || path.split('/ip/')[1];
      if (!ip) {
        return errorResponse(400, 'IP parameter is required');
      }
      result = await client.ip(ip);
    } 
    else if (path.startsWith('/asn/')) {
      const asn = pathParams.asn || path.split('/asn/')[1];
      if (!asn) {
        return errorResponse(400, 'ASN parameter is required');
      }
      result = await client.asn(asn);
    } 
    else {
      return errorResponse(404, 'Endpoint not found');
    }

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Error:', error);

    // Handle different error types
    if (error.name === 'ValidationError') {
      return errorResponse(400, error.message, error.context);
    } else if (error.name === 'NoServerFoundError') {
      return errorResponse(404, error.message, error.context);
    } else if (error.name === 'TimeoutError') {
      return errorResponse(504, 'Request timeout', { timeout: true });
    } else if (error.name === 'NetworkError') {
      return errorResponse(502, 'Network error', { network: true });
    } else {
      return errorResponse(500, 'Internal server error', {
        error: error.message
      });
    }
  }
};

/**
 * Helper function to create error responses
 */
function errorResponse(statusCode, message, context = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      error: message,
      statusCode,
      timestamp: new Date().toISOString(),
      ...context
    })
  };
}

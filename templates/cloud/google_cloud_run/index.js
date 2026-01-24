/**
 * Google Cloud Run Handler for RDAPify
 * 
 * This handler wraps the RDAPify client for use in Google Cloud Run
 */

const express = require('express');
const { RDAPClient } = require('rdapify');

const app = express();
const port = process.env.PORT || 8080;

// Initialize RDAPify client
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

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '0.1.0-alpha.4',
    timestamp: new Date().toISOString()
  });
});

// Domain query endpoint
app.get('/domain/:domain', async (req, res) => {
  try {
    const result = await client.domain(req.params.domain);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// IP query endpoint
app.get('/ip/:ip', async (req, res) => {
  try {
    const result = await client.ip(req.params.ip);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// ASN query endpoint
app.get('/asn/:asn', async (req, res) => {
  try {
    const result = await client.asn(req.params.asn);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(result);
  } catch (error) {
    handleError(error, res);
  }
});

// Error handler
function handleError(error, res) {
  console.error('Error:', error);

  let statusCode = 500;
  let message = 'Internal server error';
  let context = {};

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
    context = error.context || {};
  } else if (error.name === 'NoServerFoundError') {
    statusCode = 404;
    message = error.message;
    context = error.context || {};
  } else if (error.name === 'TimeoutError') {
    statusCode = 504;
    message = 'Request timeout';
    context = { timeout: true };
  } else if (error.name === 'NetworkError') {
    statusCode = 502;
    message = 'Network error';
    context = { network: true };
  } else {
    context = { error: error.message };
  }

  res.status(statusCode).json({
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    ...context
  });
}

// Start server
app.listen(port, () => {
  console.log(`RDAPify API listening on port ${port}`);
});

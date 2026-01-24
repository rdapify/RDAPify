/**
 * Express.js Integration Example
 * Demonstrates RDAPify integration with Express web server
 */

const express = require('express');
const { RDAPClient } = require('rdapify');

const app = express();
const port = 3000;

// Create RDAP client instance
const rdapClient = new RDAPClient({
  cache: true,
  privacy: { redactPII: true },
  retry: { maxAttempts: 3 },
});

// Middleware for JSON parsing
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rdap-api' });
});

// Domain lookup endpoint
app.get('/api/domain/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const result = await rdapClient.domain(domain);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  }
});

// IP lookup endpoint
app.get('/api/ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const result = await rdapClient.ip(ip);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  }
});

// ASN lookup endpoint
app.get('/api/asn/:asn', async (req, res) => {
  try {
    const { asn } = req.params;
    const result = await rdapClient.asn(asn);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  }
});

// Batch query endpoint
app.post('/api/batch', async (req, res) => {
  try {
    const { queries } = req.body;

    if (!Array.isArray(queries)) {
      return res.status(400).json({
        success: false,
        error: { message: 'queries must be an array' },
      });
    }

    const results = await Promise.allSettled(
      queries.map(({ type, value }) => {
        if (type === 'domain') return rdapClient.domain(value);
        if (type === 'ip') return rdapClient.ip(value);
        if (type === 'asn') return rdapClient.asn(value);
        throw new Error(`Unknown type: ${type}`);
      })
    );

    const response = results.map((result, index) => ({
      query: queries[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? result.reason.message : undefined,
    }));

    res.json({ success: true, results: response });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: { message: 'Internal server error' },
  });
});

// Start server
app.listen(port, () => {
  console.log(`RDAP API server listening at http://localhost:${port}`);
  console.log('\nAvailable endpoints:');
  console.log(`  GET  /health`);
  console.log(`  GET  /api/domain/:domain`);
  console.log(`  GET  /api/ip/:ip`);
  console.log(`  GET  /api/asn/:asn`);
  console.log(`  POST /api/batch`);
});

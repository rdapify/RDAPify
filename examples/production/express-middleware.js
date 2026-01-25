/**
 * Express Middleware Example
 * 
 * Production-ready Express middleware for RDAP queries with:
 * - SSRF protection
 * - Rate limiting
 * - Error handling
 * - Caching
 * - Audit logging
 */

const express = require('express');
const { RDAPClient } = require('rdapify');

const app = express();
app.use(express.json());

// Initialize RDAP client with security settings
const rdapClient = new RDAPClient({
  // SSRF Protection
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    blockLocalhost: true,
    // Allowlist for known RDAP servers
    allowedDomains: [
      'rdap.verisign.com',
      'rdap.arin.net',
      'rdap.ripe.net',
      'rdap.apnic.net',
      'rdap.lacnic.net',
      'rdap.afrinic.net'
    ]
  },
  
  // Privacy Controls
  privacy: {
    redactEmails: true,
    redactPhones: true,
    redactAddresses: true
  },
  
  // Performance
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 1000
  },
  
  // Reliability
  timeout: 5000,
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    maxDelay: 10000
  },
  
  // Rate Limiting
  rateLimit: {
    maxRequests: 10,
    perMilliseconds: 1000
  }
});

// Middleware for rate limiting per IP
const rateLimitMap = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 30;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Max ${maxRequests} requests per minute.`,
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
    });
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  
  // Cleanup old entries
  if (rateLimitMap.size > 10000) {
    const oldestIp = rateLimitMap.keys().next().value;
    rateLimitMap.delete(oldestIp);
  }
  
  next();
}

// Apply rate limiting to all RDAP routes
app.use('/api/rdap', rateLimit);

// Domain lookup endpoint
app.get('/api/rdap/domain/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    
    // Query RDAP
    const result = await rdapClient.queryDomain(domain);
    
    // Return result
    res.json({
      success: true,
      data: result,
      cached: result._cached || false
    });
    
  } catch (error) {
    handleError(error, res);
  }
});

// IP lookup endpoint
app.get('/api/rdap/ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    
    // Query RDAP
    const result = await rdapClient.queryIP(ip);
    
    // Return result
    res.json({
      success: true,
      data: result,
      cached: result._cached || false
    });
    
  } catch (error) {
    handleError(error, res);
  }
});

// ASN lookup endpoint
app.get('/api/rdap/asn/:asn', async (req, res) => {
  try {
    const { asn } = req.params;
    
    // Query RDAP
    const result = await rdapClient.queryASN(asn);
    
    // Return result
    res.json({
      success: true,
      data: result,
      cached: result._cached || false
    });
    
  } catch (error) {
    handleError(error, res);
  }
});

// Batch lookup endpoint
app.post('/api/rdap/batch', async (req, res) => {
  try {
    const { queries } = req.body;
    
    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'queries must be a non-empty array'
      });
    }
    
    if (queries.length > 10) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Maximum 10 queries per batch request'
      });
    }
    
    // Process queries in parallel
    const results = await Promise.allSettled(
      queries.map(async (query) => {
        const { type, value } = query;
        
        switch (type) {
          case 'domain':
            return await rdapClient.queryDomain(value);
          case 'ip':
            return await rdapClient.queryIP(value);
          case 'asn':
            return await rdapClient.queryASN(value);
          default:
            throw new Error(`Unknown query type: ${type}`);
        }
      })
    );
    
    // Format results
    const formattedResults = results.map((result, index) => ({
      query: queries[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
    
    res.json({
      success: true,
      results: formattedResults
    });
    
  } catch (error) {
    handleError(error, res);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache: {
      size: rdapClient.cache?.size() || 0,
      enabled: rdapClient.cache !== null
    }
  });
});

// Error handler
function handleError(error, res) {
  console.error('RDAP Error:', error);
  
  // Map error types to HTTP status codes
  const statusCode = getStatusCode(error);
  
  res.status(statusCode).json({
    error: error.name || 'Error',
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR'
  });
}

function getStatusCode(error) {
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'SSRFProtectionError') return 403;
  if (error.name === 'NoServerFoundError') return 404;
  if (error.name === 'TimeoutError') return 408;
  if (error.name === 'RateLimitError') return 429;
  if (error.name === 'NetworkError') return 502;
  return 500;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RDAP API server listening on port ${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/rdap/domain/example.com`);
});

module.exports = app;

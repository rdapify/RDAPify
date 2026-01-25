/**
 * RDAPify Playground API Proxy Server
 * 
 * Handles CORS and proxies RDAP requests to the actual RDAPify library
 * 
 * @author RDAPify Contributors
 * @license MIT
 */

const express = require('express');
const path = require('path');
const { RDAPClient } = require('../../dist/index.js');

// ============================================
// Configuration
// ============================================
const PORT = process.env.PORT || 3000;
const RDAP_TIMEOUT = parseInt(process.env.RDAP_TIMEOUT || '10000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// Express App Setup
// ============================================
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

// Request logging (development only)
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ============================================
// RDAPify Client Instance
// ============================================
let rdapClient;

try {
    rdapClient = new RDAPClient({
        timeout: RDAP_TIMEOUT,
        cache: {
            enabled: true,
            ttl: 3600000 // 1 hour
        }
    });
    console.log('✅ RDAPify client initialized');
} catch (error) {
    console.error('❌ Failed to initialize RDAPify client:', error.message);
    process.exit(1);
}

// ============================================
// API Routes
// ============================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: require('../../package.json').version
    });
});

/**
 * Query endpoint
 */
app.post('/api/query', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { type, query, options = {} } = req.body;
        
        // Validate request
        if (!type || !query) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type and query'
            });
        }
        
        // Validate query type
        const validTypes = ['domain', 'ip', 'asn'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid query type. Must be one of: ${validTypes.join(', ')}`
            });
        }
        
        // Prepare client options
        const clientOptions = {
            cache: options.cache !== false,
            redactPII: options.redactPII === true,
            verbose: options.verbose === true
        };
        
        // Perform RDAP query
        let result;
        
        switch (type) {
            case 'domain':
                result = await rdapClient.domain(query, clientOptions);
                break;
                
            case 'ip':
                result = await rdapClient.ip(query, clientOptions);
                break;
                
            case 'asn':
                // Remove 'AS' prefix if present
                const asnNumber = query.replace(/^AS/i, '');
                result = await rdapClient.asn(parseInt(asnNumber, 10), clientOptions);
                break;
                
            default:
                throw new Error('Invalid query type');
        }
        
        const queryTime = Date.now() - startTime;
        
        // Send response
        res.json({
            success: true,
            data: result,
            queryTime,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        const queryTime = Date.now() - startTime;
        
        console.error('Query error:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            queryTime,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Batch query endpoint (optional)
 */
app.post('/api/batch', async (req, res) => {
    try {
        const { queries } = req.body;
        
        if (!Array.isArray(queries) || queries.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'queries must be a non-empty array'
            });
        }
        
        if (queries.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 queries per batch request'
            });
        }
        
        // Process queries in parallel
        const results = await Promise.allSettled(
            queries.map(async ({ type, query, options = {} }) => {
                const clientOptions = {
                    cache: options.cache !== false,
                    redactPII: options.redactPII === true
                };
                
                switch (type) {
                    case 'domain':
                        return await rdapClient.domain(query, clientOptions);
                    case 'ip':
                        return await rdapClient.ip(query, clientOptions);
                    case 'asn':
                        const asnNumber = query.replace(/^AS/i, '');
                        return await rdapClient.asn(parseInt(asnNumber, 10), clientOptions);
                    default:
                        throw new Error(`Invalid query type: ${type}`);
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
            results: formattedResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Batch query error:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// Serve Frontend
// ============================================

/**
 * Serve index.html for all other routes
 */
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================
// Error Handling
// ============================================

/**
 * 404 handler
 */
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found'
    });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    res.status(500).json({
        success: false,
        error: NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// ============================================
// Server Startup
// ============================================

const server = app.listen(PORT, () => {
    console.log('');
    console.log('🎮 RDAPify Playground Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 Server running at: http://localhost:${PORT}`);
    console.log(`📦 Environment: ${NODE_ENV}`);
    console.log(`⏱️  Timeout: ${RDAP_TIMEOUT}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
});

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// ============================================
// Exports
// ============================================

module.exports = app;

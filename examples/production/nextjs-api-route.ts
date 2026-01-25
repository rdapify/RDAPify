/**
 * Next.js API Route Example
 * 
 * Production-ready Next.js API route for RDAP queries with:
 * - SSRF protection
 * - TypeScript support
 * - Edge runtime compatible
 * - Error handling
 * - Caching
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { RDAPClient } from 'rdapify';
import type { DomainResponse, IPResponse, ASNResponse } from 'rdapify';

// Initialize RDAP client (singleton)
let rdapClient: RDAPClient | null = null;

function getRDAPClient(): RDAPClient {
  if (!rdapClient) {
    rdapClient = new RDAPClient({
      // SSRF Protection - Critical for public APIs
      ssrfProtection: {
        enabled: true,
        blockPrivateIPs: true,
        blockLocalhost: true,
        blockLinkLocal: true,
        // Only allow known RDAP servers
        allowedDomains: [
          'rdap.verisign.com',
          'rdap.arin.net',
          'rdap.ripe.net',
          'rdap.apnic.net',
          'rdap.lacnic.net',
          'rdap.afrinic.net'
        ]
      },
      
      // Privacy Controls - GDPR/CCPA compliance
      privacy: {
        redactEmails: true,
        redactPhones: true,
        redactAddresses: true
      },
      
      // Performance
      cache: {
        enabled: true,
        ttl: 3600000, // 1 hour
        maxSize: 500
      },
      
      // Reliability
      timeout: 5000,
      retry: {
        maxAttempts: 2,
        backoff: 'exponential'
      }
    });
  }
  
  return rdapClient;
}

// Types
interface SuccessResponse<T> {
  success: true;
  data: T;
  cached?: boolean;
}

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Rate limiting (simple in-memory, use Redis in production)
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 30;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip)!;
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  
  return true;
}

// Main API handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DomainResponse | IPResponse | ASNResponse>>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: 'Only GET requests are allowed'
    });
  }
  
  // Rate limiting
  const ip = (req.headers['x-forwarded-for'] as string) || 
             (req.headers['x-real-ip'] as string) || 
             req.socket.remoteAddress || 
             'unknown';
  
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Max 30 requests per minute.'
    });
  }
  
  try {
    const { type, query } = req.query;
    
    // Validate query parameters
    if (!type || !query) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing required parameters: type and query'
      });
    }
    
    if (typeof type !== 'string' || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Parameters must be strings'
      });
    }
    
    // Get RDAP client
    const client = getRDAPClient();
    
    // Execute query based on type
    let result: DomainResponse | IPResponse | ASNResponse;
    
    switch (type.toLowerCase()) {
      case 'domain':
        result = await client.queryDomain(query);
        break;
        
      case 'ip':
        result = await client.queryIP(query);
        break;
        
      case 'asn':
        result = await client.queryASN(query);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Invalid type: ${type}. Must be 'domain', 'ip', or 'asn'`
        });
    }
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    
    // Return success response
    return res.status(200).json({
      success: true,
      data: result,
      cached: (result as any)._cached || false
    });
    
  } catch (error: any) {
    console.error('RDAP API Error:', error);
    
    // Map error types to HTTP status codes
    const statusCode = getStatusCode(error);
    
    return res.status(statusCode).json({
      success: false,
      error: error.name || 'Error',
      message: error.message,
      code: error.code
    });
  }
}

function getStatusCode(error: any): number {
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'SSRFProtectionError') return 403;
  if (error.name === 'NoServerFoundError') return 404;
  if (error.name === 'TimeoutError') return 408;
  if (error.name === 'RateLimitError') return 429;
  if (error.name === 'NetworkError') return 502;
  return 500;
}

// Export config for Next.js
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

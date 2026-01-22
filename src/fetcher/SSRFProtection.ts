/**
 * SSRF (Server-Side Request Forgery) protection
 * @module fetcher/SSRFProtection
 */

import { SSRFProtectionError } from '../types/errors';
import type { SSRFProtectionOptions } from '../types/options';
import { isPrivateIP, isLocalhost, isLinkLocal, validateIP } from '../utils/validators';

/**
 * SSRF protection validator
 */
export class SSRFProtection {
  private readonly options: Required<SSRFProtectionOptions>;

  constructor(options: SSRFProtectionOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      blockPrivateIPs: options.blockPrivateIPs ?? true,
      blockLocalhost: options.blockLocalhost ?? true,
      blockLinkLocal: options.blockLinkLocal ?? true,
      blockedDomains: options.blockedDomains || [],
      allowedDomains: options.allowedDomains || [],
    };
  }

  /**
   * Validates a URL for SSRF protection
   */
  async validateUrl(url: string): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new SSRFProtectionError(`Invalid URL: ${url}`);
    }

    // Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      throw new SSRFProtectionError(`Only HTTPS protocol is allowed, got: ${parsedUrl.protocol}`, {
        url,
      });
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Check if domain is in allowed list (whitelist takes precedence)
    if (this.options.allowedDomains.length > 0) {
      const isAllowed = this.options.allowedDomains.some(
        (domain) =>
          hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`)
      );

      if (!isAllowed) {
        throw new SSRFProtectionError(`Domain not in allowed list: ${hostname}`, { url, hostname });
      }

      // If in whitelist, skip other checks
      return;
    }

    // Check if domain is in blocked list
    if (this.options.blockedDomains.length > 0) {
      const isBlocked = this.options.blockedDomains.some(
        (domain) =>
          hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`)
      );

      if (isBlocked) {
        throw new SSRFProtectionError(`Domain is blocked: ${hostname}`, { url, hostname });
      }
    }

    // Check if hostname is an IP address
    if (this.isIPAddress(hostname)) {
      await this.validateIPAddress(hostname, url);
    } else {
      // For domain names, we need to resolve and check IPs
      await this.validateDomain(hostname, url);
    }
  }

  /**
   * Validates an IP address for SSRF protection
   */
  private async validateIPAddress(ip: string, url: string): Promise<void> {
    // Validate IP format
    try {
      validateIP(ip);
    } catch (error) {
      throw new SSRFProtectionError(`Invalid IP address: ${ip}`, { url, ip });
    }

    // Check localhost
    if (this.options.blockLocalhost && isLocalhost(ip)) {
      throw new SSRFProtectionError(`Localhost IP addresses are blocked: ${ip}`, {
        url,
        ip,
        reason: 'localhost',
      });
    }

    // Check private IPs
    if (this.options.blockPrivateIPs && isPrivateIP(ip)) {
      throw new SSRFProtectionError(`Private IP addresses are blocked: ${ip}`, {
        url,
        ip,
        reason: 'private',
      });
    }

    // Check link-local
    if (this.options.blockLinkLocal && isLinkLocal(ip)) {
      throw new SSRFProtectionError(`Link-local IP addresses are blocked: ${ip}`, {
        url,
        ip,
        reason: 'link-local',
      });
    }
  }

  /**
   * Validates a domain name for SSRF protection
   */
  private async validateDomain(hostname: string, url: string): Promise<void> {
    // Block localhost domain
    if (this.options.blockLocalhost) {
      const localhostPatterns = ['localhost', 'localhost.localdomain', '*.localhost'];

      for (const pattern of localhostPatterns) {
        if (this.matchesPattern(hostname, pattern)) {
          throw new SSRFProtectionError(`Localhost domains are blocked: ${hostname}`, {
            url,
            hostname,
            reason: 'localhost',
          });
        }
      }
    }

    // Block common internal domains
    const internalDomains = [
      'internal',
      'corp',
      'local',
      'lan',
      'intranet',
      '*.internal',
      '*.corp',
      '*.local',
      '*.lan',
      '*.intranet',
    ];

    for (const pattern of internalDomains) {
      if (this.matchesPattern(hostname, pattern)) {
        throw new SSRFProtectionError(`Internal domains are blocked: ${hostname}`, {
          url,
          hostname,
          reason: 'internal',
        });
      }
    }

    // Note: In a production environment, you would also want to:
    // 1. Resolve the domain to IP addresses
    // 2. Check each resolved IP against the same rules
    // However, this requires DNS resolution which is environment-specific
    // and will be implemented in the Fetcher class
  }

  /**
   * Checks if hostname is an IP address
   */
  private isIPAddress(hostname: string): boolean {
    // Check for IPv4
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    // Check for IPv6
    if (hostname.includes(':')) {
      return true;
    }

    return false;
  }

  /**
   * Matches hostname against a pattern (supports wildcards)
   */
  private matchesPattern(hostname: string, pattern: string): boolean {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.substring(2);
      return hostname === suffix || hostname.endsWith(`.${suffix}`);
    }

    return hostname === pattern;
  }

  /**
   * Gets SSRF protection configuration
   */
  getConfig(): Required<SSRFProtectionOptions> {
    return { ...this.options };
  }

  /**
   * Checks if SSRF protection is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }
}

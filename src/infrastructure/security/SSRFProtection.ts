/**
 * SSRF (Server-Side Request Forgery) protection
 * @module fetcher/SSRFProtection
 */

import * as dns from 'dns';
import { SSRFProtectionError } from '../../shared/types/errors';
import type { SSRFProtectionOptions } from '../../shared/types/options';
import { isPrivateIP, isLocalhost, isLinkLocal, validateIP } from '../../shared/utils/validators';

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
      // Enable DNS rebinding protection by default in server (Node.js) environments;
      // disable in browsers where window is defined and DNS resolution APIs are unavailable.
      dnsRebinding: options.dnsRebinding ?? (typeof (globalThis as any).window === 'undefined'),
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
    } catch {
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
    // Extract zone ID if present (e.g., fe80::1%eth0)
    const zoneIndex = ip.indexOf('%');
    const ipWithoutZone = zoneIndex > 0 ? ip.substring(0, zoneIndex) : ip;

    // Remove brackets if present (e.g., [2001:db8::1])
    const ipClean = ipWithoutZone.replace(/^\[|\]$/g, '');

    // Validate IP format
    try {
      validateIP(ipClean);
    } catch {
      throw new SSRFProtectionError(`Invalid IP address: ${ip}`, { url, ip });
    }

    // Check localhost
    if (this.options.blockLocalhost && isLocalhost(ipClean)) {
      throw new SSRFProtectionError(`Localhost IP addresses are blocked: ${ip}`, {
        url,
        ip,
        reason: 'localhost',
      });
    }

    // Check private IPs
    if (this.options.blockPrivateIPs && isPrivateIP(ipClean)) {
      throw new SSRFProtectionError(`Private IP addresses are blocked: ${ip}`, {
        url,
        ip,
        reason: 'private',
      });
    }

    // Check link-local
    if (this.options.blockLinkLocal && isLinkLocal(ipClean)) {
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

    // DNS rebinding protection: resolve domain and validate each resolved IP
    if (this.options.dnsRebinding) {
      await this.validateDnsRebinding(hostname, url);
    }
  }

  /**
   * Resolves the hostname via DNS and validates each returned IP address.
   * Throws SSRFProtectionError if any resolved IP is private/local.
   * Silently ignores DNS resolution failures (ENOTFOUND, etc.).
   */
  private async validateDnsRebinding(hostname: string, url: string): Promise<void> {
    let ipv4Addresses: string[] = [];
    let ipv6Addresses: string[] = [];

    try {
      ipv4Addresses = await dns.promises.resolve4(hostname);
    } catch {
      // Ignore resolution failures — domain may not have A records or may not exist
    }

    try {
      ipv6Addresses = await dns.promises.resolve6(hostname);
    } catch {
      // Ignore resolution failures — domain may not have AAAA records or may not exist
    }

    for (const ip of [...ipv4Addresses, ...ipv6Addresses]) {
      await this.validateIPAddress(ip, url);
    }
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

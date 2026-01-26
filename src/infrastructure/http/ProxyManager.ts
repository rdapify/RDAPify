/**
 * Proxy manager for RDAP requests
 * @module infrastructure/http/ProxyManager
 */

export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5';

export interface ProxyOptions {
  protocol?: ProxyProtocol;
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  timeout?: number;
  bypassList?: string[];
}

/**
 * Manages proxy configuration for RDAP requests
 */
export class ProxyManager {
  private readonly protocol: ProxyProtocol;
  private readonly host: string;
  private readonly port: number;
  private readonly auth?: {
    username: string;
    password: string;
  };
  private readonly timeout: number;
  private readonly bypassList: Set<string>;

  constructor(options: ProxyOptions) {
    this.protocol = options.protocol || 'http';
    this.host = options.host;
    this.port = options.port;
    this.auth = options.auth;
    this.timeout = options.timeout || 30000;
    this.bypassList = new Set(options.bypassList || []);

    this.validate();
  }

  /**
   * Validates proxy configuration
   */
  private validate(): void {
    if (!this.host) {
      throw new Error('Proxy host is required');
    }

    if (!this.port || this.port < 1 || this.port > 65535) {
      throw new Error('Proxy port must be between 1 and 65535');
    }

    if (this.auth && (!this.auth.username || !this.auth.password)) {
      throw new Error('Proxy auth requires both username and password');
    }
  }

  /**
   * Gets proxy URL
   */
  getProxyUrl(): string {
    let url = `${this.protocol}://`;

    if (this.auth) {
      url += `${encodeURIComponent(this.auth.username)}:${encodeURIComponent(this.auth.password)}@`;
    }

    url += `${this.host}:${this.port}`;

    return url;
  }

  /**
   * Checks if URL should bypass proxy
   */
  shouldBypass(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Check exact match
      if (this.bypassList.has(hostname)) {
        return true;
      }

      // Check wildcard patterns
      for (const pattern of this.bypassList) {
        if (pattern.startsWith('*.')) {
          const domain = pattern.slice(2);
          if (hostname.endsWith(domain)) {
            return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Gets proxy configuration for HTTP agent
   */
  getAgentConfig(): {
    host: string;
    port: number;
    protocol: string;
    auth?: string;
    timeout: number;
  } {
    const config: any = {
      host: this.host,
      port: this.port,
      protocol: this.protocol,
      timeout: this.timeout,
    };

    if (this.auth) {
      config.auth = `${this.auth.username}:${this.auth.password}`;
    }

    return config;
  }

  /**
   * Gets proxy info (without sensitive data)
   */
  getInfo(): {
    protocol: ProxyProtocol;
    host: string;
    port: number;
    hasAuth: boolean;
    timeout: number;
    bypassCount: number;
  } {
    return {
      protocol: this.protocol,
      host: this.host,
      port: this.port,
      hasAuth: !!this.auth,
      timeout: this.timeout,
      bypassCount: this.bypassList.size,
    };
  }

  /**
   * Adds URL to bypass list
   */
  addBypass(pattern: string): void {
    this.bypassList.add(pattern);
  }

  /**
   * Removes URL from bypass list
   */
  removeBypass(pattern: string): void {
    this.bypassList.delete(pattern);
  }

  /**
   * Gets bypass list
   */
  getBypassList(): string[] {
    return Array.from(this.bypassList);
  }
}

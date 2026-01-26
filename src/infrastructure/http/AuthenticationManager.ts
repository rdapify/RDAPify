/**
 * Authentication manager for RDAP requests
 * @module infrastructure/http/AuthenticationManager
 */

export type AuthType = 'basic' | 'bearer' | 'apikey' | 'oauth2';

export interface AuthenticationOptions {
  type: AuthType;
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  oauth2?: OAuth2Options;
}

export interface OAuth2Options {
  accessToken: string;
  tokenType?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Manages authentication for RDAP requests
 */
export class AuthenticationManager {
  private readonly type: AuthType;
  private readonly username?: string;
  private readonly password?: string;
  private readonly token?: string;
  private readonly apiKey?: string;
  private readonly apiKeyHeader: string;
  private oauth2?: OAuth2Options;

  constructor(options: AuthenticationOptions) {
    this.type = options.type;
    this.username = options.username;
    this.password = options.password;
    this.token = options.token;
    this.apiKey = options.apiKey;
    this.apiKeyHeader = options.apiKeyHeader || 'X-API-Key';
    this.oauth2 = options.oauth2;

    this.validate();
  }

  /**
   * Validates authentication configuration
   */
  private validate(): void {
    switch (this.type) {
      case 'basic':
        if (!this.username || !this.password) {
          throw new Error('Basic auth requires username and password');
        }
        break;

      case 'bearer':
        if (!this.token) {
          throw new Error('Bearer auth requires token');
        }
        break;

      case 'apikey':
        if (!this.apiKey) {
          throw new Error('API key auth requires apiKey');
        }
        break;

      case 'oauth2':
        if (!this.oauth2?.accessToken) {
          throw new Error('OAuth2 requires accessToken');
        }
        break;
    }
  }

  /**
   * Gets authentication headers
   */
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (this.type) {
      case 'basic':
        if (this.username && this.password) {
          const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'bearer':
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        break;

      case 'apikey':
        if (this.apiKey) {
          headers[this.apiKeyHeader] = this.apiKey;
        }
        break;

      case 'oauth2':
        if (this.oauth2?.accessToken) {
          const tokenType = this.oauth2.tokenType || 'Bearer';
          headers['Authorization'] = `${tokenType} ${this.oauth2.accessToken}`;
        }
        break;
    }

    return headers;
  }

  /**
   * Checks if OAuth2 token is expired
   */
  isTokenExpired(): boolean {
    if (this.type !== 'oauth2' || !this.oauth2?.expiresAt) {
      return false;
    }

    return Date.now() >= this.oauth2.expiresAt;
  }

  /**
   * Updates OAuth2 token
   */
  updateOAuth2Token(options: OAuth2Options): void {
    if (this.type !== 'oauth2') {
      throw new Error('Cannot update OAuth2 token for non-OAuth2 auth');
    }

    this.oauth2 = options;
  }

  /**
   * Gets authentication type
   */
  getType(): AuthType {
    return this.type;
  }

  /**
   * Gets authentication info (without sensitive data)
   */
  getInfo(): {
    type: AuthType;
    username?: string;
    apiKeyHeader?: string;
    tokenExpired?: boolean;
  } {
    const info: any = {
      type: this.type,
    };

    if (this.type === 'basic' && this.username) {
      info.username = this.username;
    }

    if (this.type === 'apikey') {
      info.apiKeyHeader = this.apiKeyHeader;
    }

    if (this.type === 'oauth2') {
      info.tokenExpired = this.isTokenExpired();
    }

    return info;
  }
}

/**
 * Tests for AuthenticationManager
 */

import { AuthenticationManager } from '../../src/infrastructure/http/AuthenticationManager';

describe('AuthenticationManager', () => {
  describe('Basic Authentication', () => {
    it('should create basic auth manager', () => {
      const auth = new AuthenticationManager({
        type: 'basic',
        username: 'user',
        password: 'pass',
      });

      expect(auth.getType()).toBe('basic');
    });

    it('should generate basic auth header', () => {
      const auth = new AuthenticationManager({
        type: 'basic',
        username: 'user',
        password: 'pass',
      });

      const headers = auth.getHeaders();
      expect(headers['Authorization']).toBeDefined();
      expect(headers['Authorization']).toContain('Basic ');
    });

    it('should throw error without username', () => {
      expect(() => {
        new AuthenticationManager({
          type: 'basic',
          password: 'pass',
        } as any);
      }).toThrow('Basic auth requires username and password');
    });

    it('should throw error without password', () => {
      expect(() => {
        new AuthenticationManager({
          type: 'basic',
          username: 'user',
        } as any);
      }).toThrow('Basic auth requires username and password');
    });
  });

  describe('Bearer Token Authentication', () => {
    it('should create bearer auth manager', () => {
      const auth = new AuthenticationManager({
        type: 'bearer',
        token: 'my-token',
      });

      expect(auth.getType()).toBe('bearer');
    });

    it('should generate bearer auth header', () => {
      const auth = new AuthenticationManager({
        type: 'bearer',
        token: 'my-token',
      });

      const headers = auth.getHeaders();
      expect(headers['Authorization']).toBe('Bearer my-token');
    });

    it('should throw error without token', () => {
      expect(() => {
        new AuthenticationManager({
          type: 'bearer',
        } as any);
      }).toThrow('Bearer auth requires token');
    });
  });

  describe('API Key Authentication', () => {
    it('should create API key auth manager', () => {
      const auth = new AuthenticationManager({
        type: 'apikey',
        apiKey: 'my-api-key',
      });

      expect(auth.getType()).toBe('apikey');
    });

    it('should generate API key header', () => {
      const auth = new AuthenticationManager({
        type: 'apikey',
        apiKey: 'my-api-key',
      });

      const headers = auth.getHeaders();
      expect(headers['X-API-Key']).toBe('my-api-key');
    });

    it('should use custom API key header', () => {
      const auth = new AuthenticationManager({
        type: 'apikey',
        apiKey: 'my-api-key',
        apiKeyHeader: 'X-Custom-Key',
      });

      const headers = auth.getHeaders();
      expect(headers['X-Custom-Key']).toBe('my-api-key');
    });

    it('should throw error without API key', () => {
      expect(() => {
        new AuthenticationManager({
          type: 'apikey',
        } as any);
      }).toThrow('API key auth requires apiKey');
    });
  });

  describe('OAuth2 Authentication', () => {
    it('should create OAuth2 auth manager', () => {
      const auth = new AuthenticationManager({
        type: 'oauth2',
        oauth2: {
          accessToken: 'access-token',
        },
      });

      expect(auth.getType()).toBe('oauth2');
    });

    it('should generate OAuth2 auth header', () => {
      const auth = new AuthenticationManager({
        type: 'oauth2',
        oauth2: {
          accessToken: 'access-token',
        },
      });

      const headers = auth.getHeaders();
      expect(headers['Authorization']).toBe('Bearer access-token');
    });

    it('should use custom token type', () => {
      const auth = new AuthenticationManager({
        type: 'oauth2',
        oauth2: {
          accessToken: 'access-token',
          tokenType: 'Custom',
        },
      });

      const headers = auth.getHeaders();
      expect(headers['Authorization']).toBe('Custom access-token');
    });

    it('should check token expiration', () => {
      const auth = new AuthenticationManager({
        type: 'oauth2',
        oauth2: {
          accessToken: 'access-token',
          expiresAt: Date.now() - 1000, // Expired
        },
      });

      expect(auth.isTokenExpired()).toBe(true);
    });

    it('should update OAuth2 token', () => {
      const auth = new AuthenticationManager({
        type: 'oauth2',
        oauth2: {
          accessToken: 'old-token',
        },
      });

      auth.updateOAuth2Token({
        accessToken: 'new-token',
      });

      const headers = auth.getHeaders();
      expect(headers['Authorization']).toBe('Bearer new-token');
    });

    it('should throw error without access token', () => {
      expect(() => {
        new AuthenticationManager({
          type: 'oauth2',
          oauth2: {} as any,
        });
      }).toThrow('OAuth2 requires accessToken');
    });
  });

  describe('getInfo', () => {
    it('should return auth info without sensitive data', () => {
      const auth = new AuthenticationManager({
        type: 'basic',
        username: 'user',
        password: 'secret',
      });

      const info = auth.getInfo();
      expect(info.type).toBe('basic');
      expect(info.username).toBe('user');
      expect(info).not.toHaveProperty('password');
    });
  });
});

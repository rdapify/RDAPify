/**
 * Tests for ConnectionPool
 */

import { ConnectionPool } from '../../src/infrastructure/http/ConnectionPool';

describe('ConnectionPool', () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxConnections: 5,
      keepAlive: true,
      maxIdleTime: 1000,
    });
  });

  afterEach(() => {
    pool.destroy();
  });

  describe('acquire', () => {
    it('should acquire a new connection', async () => {
      const connectionId = await pool.acquire('example.com');
      expect(connectionId).toBeDefined();
      expect(typeof connectionId).toBe('string');
    });

    it('should reuse released connections', async () => {
      const conn1 = await pool.acquire('example.com');
      pool.release(conn1);

      const conn2 = await pool.acquire('example.com');
      expect(conn2).toBe(conn1);
    });

    it('should create multiple connections up to max', async () => {
      const connections = await Promise.all([
        pool.acquire('example.com'),
        pool.acquire('example.com'),
        pool.acquire('example.com'),
      ]);

      expect(new Set(connections).size).toBe(3);
    });

    it('should handle different hosts separately', async () => {
      const conn1 = await pool.acquire('example.com');
      const conn2 = await pool.acquire('test.com');

      expect(conn1).not.toBe(conn2);
    });
  });

  describe('release', () => {
    it('should release a connection', async () => {
      const connectionId = await pool.acquire('example.com');
      pool.release(connectionId);

      const stats = pool.getStats();
      expect(stats.idleConnections).toBe(1);
      expect(stats.activeConnections).toBe(0);
    });

    it('should handle releasing non-existent connection', () => {
      expect(() => pool.release('non-existent')).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await pool.acquire('example.com');
      await pool.acquire('example.com');
      await pool.acquire('test.com');

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(3);
      expect(stats.activeConnections).toBe(3);
      expect(stats.idleConnections).toBe(0);
      expect(stats.hosts).toBe(2);
    });

    it('should return empty stats for new pool', () => {
      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
      expect(stats.hosts).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      pool.destroy();
      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(0);
    });
  });
});

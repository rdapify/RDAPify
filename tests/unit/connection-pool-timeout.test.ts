/**
 * Tests for ConnectionPool timeout handling
 */

import { ConnectionPool } from '../../src/infrastructure/http/ConnectionPool';

describe('ConnectionPool', () => {
  describe('acquire with timeout', () => {
    let pool: ConnectionPool;

    beforeEach(() => {
      pool = new ConnectionPool({ maxConnections: 2 });
    });

    afterEach(() => {
      pool.destroy();
    });

    it('should acquire available connection', async () => {
      const conn1 = await pool.acquire('example.com');
      expect(conn1).toBeDefined();
      pool.release(conn1);
    });

    it('should timeout waiting for connection', async () => {
      // Acquire all connections
      const conn1 = await pool.acquire('example.com');
      const conn2 = await pool.acquire('example.com');

      // Third acquire should timeout
      await expect(pool.acquire('example.com', 100)).rejects.toThrow('Timeout');

      // Cleanup
      pool.release(conn1);
      pool.release(conn2);
    });

    it('should use default timeout when not specified', async () => {
      const conn1 = await pool.acquire('example.com');
      const conn2 = await pool.acquire('example.com');

      // Should use default 5000ms timeout
      await expect(pool.acquire('example.com')).rejects.toThrow('Timeout');

      pool.release(conn1);
      pool.release(conn2);
    });
  });
});

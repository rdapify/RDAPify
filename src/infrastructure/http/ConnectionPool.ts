/**
 * HTTP Connection Pool for efficient connection reuse
 * @module infrastructure/http/ConnectionPool
 */

interface PooledConnection {
  id: string;
  inUse: boolean;
  lastUsed: number;
  keepAlive: boolean;
}

export interface ConnectionPoolOptions {
  maxConnections?: number;
  keepAlive?: boolean;
  maxIdleTime?: number;
}

/**
 * Connection pool for HTTP requests
 */
export class ConnectionPool {
  private readonly maxConnections: number;
  private readonly keepAlive: boolean;
  private readonly maxIdleTime: number;
  private connections: Map<string, PooledConnection[]>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: ConnectionPoolOptions = {}) {
    this.maxConnections = options.maxConnections || 10;
    this.keepAlive = options.keepAlive ?? true;
    this.maxIdleTime = options.maxIdleTime || 300000; // 5 minutes
    this.connections = new Map();

    // Start cleanup interval
    if (this.keepAlive) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    }
  }

  /**
   * Gets a connection from the pool or creates a new one
   */
  async acquire(host: string): Promise<string> {
    const hostConnections = this.connections.get(host) || [];

    // Find available connection
    const available = hostConnections.find((conn) => !conn.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      return available.id;
    }

    // Create new connection if under limit
    if (hostConnections.length < this.maxConnections) {
      const connection: PooledConnection = {
        id: `${host}-${Date.now()}-${Math.random()}`,
        inUse: true,
        lastUsed: Date.now(),
        keepAlive: this.keepAlive,
      };

      hostConnections.push(connection);
      this.connections.set(host, hostConnections);
      return connection.id;
    }

    // Wait for available connection
    return this.waitForConnection(host);
  }

  /**
   * Releases a connection back to the pool
   */
  release(connectionId: string): void {
    for (const [, connections] of this.connections.entries()) {
      const connection = connections.find((c) => c.id === connectionId);
      if (connection) {
        connection.inUse = false;
        connection.lastUsed = Date.now();
        return;
      }
    }
  }

  /**
   * Waits for an available connection
   */
  private async waitForConnection(host: string): Promise<string> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const hostConnections = this.connections.get(host) || [];
        const available = hostConnections.find((conn) => !conn.inUse);

        if (available) {
          clearInterval(checkInterval);
          available.inUse = true;
          available.lastUsed = Date.now();
          resolve(available.id);
        }
      }, 100);
    });
  }

  /**
   * Cleans up idle connections
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [host, connections] of this.connections.entries()) {
      const activeConnections = connections.filter((conn) => {
        // Keep connections that are in use
        if (conn.inUse) return true;

        // Remove idle connections
        const idleTime = now - conn.lastUsed;
        return idleTime < this.maxIdleTime;
      });

      if (activeConnections.length === 0) {
        this.connections.delete(host);
      } else {
        this.connections.set(host, activeConnections);
      }
    }
  }

  /**
   * Gets pool statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    hosts: number;
  } {
    let total = 0;
    let active = 0;
    let idle = 0;

    for (const connections of this.connections.values()) {
      total += connections.length;
      active += connections.filter((c) => c.inUse).length;
      idle += connections.filter((c) => !c.inUse).length;
    }

    return {
      totalConnections: total,
      activeConnections: active,
      idleConnections: idle,
      hosts: this.connections.size,
    };
  }

  /**
   * Destroys the connection pool
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.connections.clear();
  }
}

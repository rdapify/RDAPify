/**
 * Logger for RDAP operations
 * @module infrastructure/logging/Logger
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface LoggerOptions {
  level?: LogLevel;
  enabled?: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
  format?: 'text' | 'json';
  output?: (entry: LogEntry) => void;
}

/**
 * Logger for RDAP client operations
 */
export class Logger {
  private readonly level: LogLevel;
  private readonly enabled: boolean;
  private readonly logRequests: boolean;
  private readonly logResponses: boolean;
  private readonly format: 'text' | 'json';
  private readonly output: (entry: LogEntry) => void;
  private logs: LogEntry[] = [];
  private readonly maxLogs: number = 1000;

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.enabled = options.enabled ?? true;
    this.logRequests = options.logRequests ?? true;
    this.logResponses = options.logResponses ?? true;
    this.format = options.format || 'text';
    this.output = options.output || this.defaultOutput.bind(this);
  }

  /**
   * Logs a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Logs an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Logs a warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Logs an error message
   */
  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  /**
   * Logs a request
   */
  logRequest(type: string, query: string, context?: Record<string, any>): void {
    if (!this.logRequests) return;
    this.info(`REQUEST → ${type}: ${query}`, context);
  }

  /**
   * Logs a response
   */
  logResponse(
    type: string,
    query: string,
    success: boolean,
    duration: number,
    context?: Record<string, any>
  ): void {
    if (!this.logResponses) return;

    const status = success ? '✓' : '✗';
    const message = `RESPONSE ${status} ${type}: ${query} (${duration}ms)`;

    if (success) {
      this.info(message, context);
    } else {
      this.warn(message, context);
    }
  }

  /**
   * Logs performance metrics
   */
  logPerformance(operation: string, duration: number, context?: Record<string, any>): void {
    this.debug(`PERFORMANCE: ${operation} took ${duration}ms`, context);
  }

  /**
   * Logs cache operations
   */
  logCache(operation: 'hit' | 'miss' | 'set', key: string, context?: Record<string, any>): void {
    const emoji = operation === 'hit' ? '✓' : operation === 'miss' ? '✗' : '→';
    this.debug(`CACHE ${emoji} ${operation}: ${key}`, context);
  }

  /**
   * Main log method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.enabled) return;
    if (this.levelPriority[level] < this.levelPriority[this.level]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
    };

    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.output(entry);
  }

  /**
   * Default output handler
   */
  private defaultOutput(entry: LogEntry): void {
    if (this.format === 'json') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
      return;
    }

    // Text format
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';

    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level];

    // eslint-disable-next-line no-console
    console.log(`${color}[${timestamp}] ${level}${reset} ${entry.message}${contextStr}`);
  }

  /**
   * Gets recent logs
   */
  getLogs(count?: number): LogEntry[] {
    return count ? this.logs.slice(-count) : [...this.logs];
  }

  /**
   * Gets logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Gets logs in time range
   */
  getLogsInRange(startTime: number, endTime: number): LogEntry[] {
    return this.logs.filter((log) => log.timestamp >= startTime && log.timestamp <= endTime);
  }

  /**
   * Clears all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Exports logs
   */
  export(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Gets logger statistics
   */
  getStats(): {
    enabled: boolean;
    level: LogLevel;
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
  } {
    const logsByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };

    this.logs.forEach((log) => {
      logsByLevel[log.level]++;
    });

    return {
      enabled: this.enabled,
      level: this.level,
      totalLogs: this.logs.length,
      logsByLevel,
    };
  }
}

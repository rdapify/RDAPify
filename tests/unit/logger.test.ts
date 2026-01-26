/**
 * Tests for Logger
 */

import { Logger } from '../../src/infrastructure/logging/Logger';
import type { LogEntry } from '../../src/infrastructure/logging/Logger';

describe('Logger', () => {
  let logger: Logger;
  let capturedLogs: LogEntry[];

  beforeEach(() => {
    capturedLogs = [];
    logger = new Logger({
      level: 'debug',
      enabled: true,
      output: (entry) => capturedLogs.push(entry),
    });
  });

  afterEach(() => {
    logger.clear();
  });

  describe('logging levels', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('debug');
      expect(capturedLogs[0].message).toBe('Debug message');
    });

    it('should log info messages', () => {
      logger.info('Info message');
      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('info');
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('warn');
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('error');
    });

    it('should respect log level threshold', () => {
      const infoLogger = new Logger({
        level: 'info',
        enabled: true,
        output: (entry) => capturedLogs.push(entry),
      });

      infoLogger.debug('Should not appear');
      infoLogger.info('Should appear');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe('info');
    });
  });

  describe('context', () => {
    it('should include context in log entries', () => {
      logger.info('Message with context', { userId: 123, action: 'query' });

      expect(capturedLogs[0].context).toEqual({ userId: 123, action: 'query' });
    });
  });

  describe('specialized logging', () => {
    it('should log requests', () => {
      logger.logRequest('domain', 'example.com', { server: 'rdap.verisign.com' });

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toContain('REQUEST');
      expect(capturedLogs[0].message).toContain('domain');
      expect(capturedLogs[0].message).toContain('example.com');
    });

    it('should log successful responses', () => {
      logger.logResponse('domain', 'example.com', true, 150);

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toContain('RESPONSE');
      expect(capturedLogs[0].message).toContain('✓');
      expect(capturedLogs[0].message).toContain('150ms');
    });

    it('should log failed responses', () => {
      logger.logResponse('domain', 'example.com', false, 100);

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toContain('RESPONSE');
      expect(capturedLogs[0].message).toContain('✗');
      expect(capturedLogs[0].level).toBe('warn');
    });

    it('should log performance metrics', () => {
      logger.logPerformance('bootstrap-discovery', 50);

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toContain('PERFORMANCE');
      expect(capturedLogs[0].message).toContain('50ms');
    });

    it('should log cache operations', () => {
      logger.logCache('hit', 'domain:example.com');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].message).toContain('CACHE');
      expect(capturedLogs[0].message).toContain('hit');
    });
  });

  describe('getLogs', () => {
    it('should return all logs', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
    });

    it('should return limited number of logs', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');

      const logs = logger.getLogs(2);
      expect(logs).toHaveLength(2);
    });
  });

  describe('getLogsByLevel', () => {
    it('should filter logs by level', () => {
      logger.info('Info message');
      logger.error('Error message');
      logger.warn('Warning message');

      const errorLogs = logger.getLogsByLevel('error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe('error');
    });
  });

  describe('getLogsInRange', () => {
    it('should filter logs by time range', () => {
      const start = Date.now();
      logger.info('Message 1');

      setTimeout(() => {
        logger.info('Message 2');
      }, 10);

      setTimeout(() => {
        const end = Date.now();
        const logs = logger.getLogsInRange(start, end);
        expect(logs.length).toBeGreaterThan(0);
      }, 20);
    });
  });

  describe('clear', () => {
    it('should clear all logs', () => {
      logger.info('Message 1');
      logger.info('Message 2');

      logger.clear();

      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return logger statistics', () => {
      logger.info('Info message');
      logger.error('Error message');
      logger.error('Another error');

      const stats = logger.getStats();
      expect(stats.enabled).toBe(true);
      expect(stats.level).toBe('debug');
      expect(stats.totalLogs).toBe(3);
      expect(stats.logsByLevel.info).toBe(1);
      expect(stats.logsByLevel.error).toBe(2);
    });
  });

  describe('disabled logger', () => {
    it('should not log when disabled', () => {
      const disabledLogger = new Logger({
        enabled: false,
        output: (entry) => capturedLogs.push(entry),
      });

      disabledLogger.info('Should not appear');

      expect(capturedLogs).toHaveLength(0);
    });
  });
});

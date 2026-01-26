/**
 * Tests for CompressionManager
 */

import { CompressionManager } from '../../src/infrastructure/http/CompressionManager';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

describe('CompressionManager', () => {
  describe('constructor', () => {
    it('should create compression manager with defaults', () => {
      const compression = new CompressionManager();

      const info = compression.getInfo();
      expect(info.enabled).toBe(true);
      expect(info.types).toContain('gzip');
      expect(info.types).toContain('br');
    });

    it('should accept custom options', () => {
      const compression = new CompressionManager({
        enabled: true,
        types: ['gzip'],
        threshold: 2048,
      });

      const info = compression.getInfo();
      expect(info.enabled).toBe(true);
      expect(info.types).toEqual(['gzip']);
      expect(info.threshold).toBe(2048);
    });

    it('should allow disabling compression', () => {
      const compression = new CompressionManager({
        enabled: false,
      });

      expect(compression.getInfo().enabled).toBe(false);
    });
  });

  describe('getAcceptEncodingHeader', () => {
    it('should return Accept-Encoding header', () => {
      const compression = new CompressionManager({
        types: ['gzip', 'br'],
      });

      const header = compression.getAcceptEncodingHeader();
      expect(header).toBeDefined();
      expect(header).toContain('gzip');
      expect(header).toContain('br');
    });

    it('should return undefined when disabled', () => {
      const compression = new CompressionManager({
        enabled: false,
      });

      expect(compression.getAcceptEncodingHeader()).toBeUndefined();
    });

    it('should prioritize brotli over gzip', () => {
      const compression = new CompressionManager({
        types: ['gzip', 'br'],
      });

      const header = compression.getAcceptEncodingHeader();
      expect(header).toBeDefined();
      expect(header!.indexOf('br')).toBeLessThan(header!.indexOf('gzip'));
    });
  });

  describe('decompress', () => {
    it('should decompress gzip data', async () => {
      const compression = new CompressionManager();
      const original = Buffer.from('Hello, World!');
      const compressed = await gzip(original);

      const decompressed = await compression.decompress(compressed, 'gzip');
      expect(decompressed.toString()).toBe('Hello, World!');
    });

    it('should decompress brotli data', async () => {
      const compression = new CompressionManager();
      const original = Buffer.from('Hello, World!');
      const compressed = await brotliCompress(original);

      const decompressed = await compression.decompress(compressed, 'br');
      expect(decompressed.toString()).toBe('Hello, World!');
    });

    it('should return original data for unknown encoding', async () => {
      const compression = new CompressionManager();
      const original = Buffer.from('Hello, World!');

      const result = await compression.decompress(original, 'unknown');
      expect(result).toBe(original);
    });

    it('should return original data when disabled', async () => {
      const compression = new CompressionManager({
        enabled: false,
      });
      const original = Buffer.from('Hello, World!');

      const result = await compression.decompress(original, 'gzip');
      expect(result).toBe(original);
    });

    it('should handle decompression errors gracefully', async () => {
      const compression = new CompressionManager();
      const invalidData = Buffer.from('not compressed data');

      // Should not throw, return original data
      const result = await compression.decompress(invalidData, 'gzip');
      expect(result).toBe(invalidData);
    });
  });

  describe('shouldCompress', () => {
    it('should compress data above threshold', () => {
      const compression = new CompressionManager({
        threshold: 1024,
      });

      expect(compression.shouldCompress(2048)).toBe(true);
    });

    it('should not compress data below threshold', () => {
      const compression = new CompressionManager({
        threshold: 1024,
      });

      expect(compression.shouldCompress(512)).toBe(false);
    });

    it('should not compress when disabled', () => {
      const compression = new CompressionManager({
        enabled: false,
        threshold: 1024,
      });

      expect(compression.shouldCompress(2048)).toBe(false);
    });
  });

  describe('isSupported', () => {
    it('should check if compression type is supported', () => {
      const compression = new CompressionManager({
        types: ['gzip', 'br'],
      });

      expect(compression.isSupported('gzip')).toBe(true);
      expect(compression.isSupported('br')).toBe(true);
      expect(compression.isSupported('deflate')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should calculate compression statistics', () => {
      const compression = new CompressionManager();

      const stats = compression.getStats(1000, 300);
      expect(stats.originalSize).toBe(1000);
      expect(stats.compressedSize).toBe(300);
      expect(stats.savedBytes).toBe(700);
      expect(stats.savedPercentage).toBe(70);
    });

    it('should handle zero original size', () => {
      const compression = new CompressionManager();

      const stats = compression.getStats(0, 0);
      expect(stats.savedPercentage).toBe(0);
    });
  });

  describe('estimateRatio', () => {
    it('should estimate compression ratio', () => {
      const compression = new CompressionManager();

      const ratio = compression.estimateRatio(1000, 300);
      expect(ratio).toBe(70);
    });

    it('should return 0 for zero original size', () => {
      const compression = new CompressionManager();

      const ratio = compression.estimateRatio(0, 0);
      expect(ratio).toBe(0);
    });
  });
});

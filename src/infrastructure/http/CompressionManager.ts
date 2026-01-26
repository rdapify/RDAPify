/**
 * Compression manager for RDAP requests
 * @module infrastructure/http/CompressionManager
 */

import * as zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);
const brotliDecompress = promisify(zlib.brotliDecompress);

export type CompressionType = 'gzip' | 'br' | 'deflate';

export interface CompressionOptions {
  enabled?: boolean;
  types?: CompressionType[];
  threshold?: number;
}

/**
 * Manages compression for RDAP requests and responses
 */
export class CompressionManager {
  private readonly enabled: boolean;
  private readonly types: Set<CompressionType>;
  private readonly threshold: number;

  constructor(options: CompressionOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.types = new Set(options.types || ['gzip', 'br']);
    this.threshold = options.threshold || 1024; // 1KB minimum
  }

  /**
   * Gets Accept-Encoding header value
   */
  getAcceptEncodingHeader(): string | undefined {
    if (!this.enabled || this.types.size === 0) {
      return undefined;
    }

    const encodings: string[] = [];

    // Add supported encodings with quality values
    if (this.types.has('br')) {
      encodings.push('br;q=1.0');
    }
    if (this.types.has('gzip')) {
      encodings.push('gzip;q=0.9');
    }
    if (this.types.has('deflate')) {
      encodings.push('deflate;q=0.8');
    }

    return encodings.length > 0 ? encodings.join(', ') : undefined;
  }

  /**
   * Decompresses response data
   */
  async decompress(data: Buffer, encoding?: string): Promise<Buffer> {
    if (!encoding || !this.enabled) {
      return data;
    }

    const normalizedEncoding = encoding.toLowerCase().trim();

    try {
      switch (normalizedEncoding) {
        case 'gzip':
          return await gunzip(data);

        case 'br':
          return await brotliDecompress(data);

        case 'deflate':
          return await promisify(zlib.inflate)(data);

        default:
          // Unknown encoding, return as-is
          return data;
      }
    } catch (error) {
      // Decompression failed, return original data
      console.warn(`Failed to decompress ${encoding}:`, error);
      return data;
    }
  }

  /**
   * Checks if compression should be used for request
   */
  shouldCompress(size: number): boolean {
    return this.enabled && size >= this.threshold;
  }

  /**
   * Gets supported compression types
   */
  getSupportedTypes(): CompressionType[] {
    return Array.from(this.types);
  }

  /**
   * Checks if compression type is supported
   */
  isSupported(type: CompressionType): boolean {
    return this.types.has(type);
  }

  /**
   * Gets compression info
   */
  getInfo(): {
    enabled: boolean;
    types: CompressionType[];
    threshold: number;
  } {
    return {
      enabled: this.enabled,
      types: this.getSupportedTypes(),
      threshold: this.threshold,
    };
  }

  /**
   * Estimates compression ratio
   */
  estimateRatio(originalSize: number, compressedSize: number): number {
    if (originalSize === 0) return 0;
    return ((originalSize - compressedSize) / originalSize) * 100;
  }

  /**
   * Gets compression statistics
   */
  getStats(originalSize: number, compressedSize: number): {
    originalSize: number;
    compressedSize: number;
    savedBytes: number;
    savedPercentage: number;
  } {
    const savedBytes = originalSize - compressedSize;
    const savedPercentage = this.estimateRatio(originalSize, compressedSize);

    return {
      originalSize,
      compressedSize,
      savedBytes,
      savedPercentage,
    };
  }
}

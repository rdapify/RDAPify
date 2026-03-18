/**
 * Entity handle validator and normalizer
 * @module utils/validators/entity
 */

import { ValidationError } from '../../types/errors';

/**
 * Validates an RDAP entity handle.
 * Entity handles are registry-specific identifiers (e.g., "VRSN-96", "ARIN-HN-1").
 *
 * @param handle - Entity handle to validate
 * @throws {ValidationError} If the handle is invalid
 */
export function validateEntityHandle(handle: string): void {
  if (!handle || typeof handle !== 'string') {
    throw new ValidationError('Entity handle must be a non-empty string', { handle });
  }

  const trimmed = handle.trim();

  if (trimmed.length === 0) {
    throw new ValidationError('Entity handle cannot be empty', { handle });
  }

  if (trimmed.length > 255) {
    throw new ValidationError('Entity handle exceeds maximum length of 255 characters', {
      handle,
      length: trimmed.length,
    });
  }

  // Entity handles can contain alphanumeric, hyphens, underscores, and dots
  if (!/^[a-zA-Z0-9][\w\-.]*$/.test(trimmed)) {
    throw new ValidationError(
      'Entity handle contains invalid characters. Must start with alphanumeric and contain only letters, digits, hyphens, underscores, or dots.',
      { handle }
    );
  }
}

/**
 * Normalizes an entity handle (trims whitespace, uppercases for consistency with RIR conventions).
 *
 * @param handle - Entity handle to normalize
 * @returns Normalized handle
 */
export function normalizeEntityHandle(handle: string): string {
  return handle.trim();
}

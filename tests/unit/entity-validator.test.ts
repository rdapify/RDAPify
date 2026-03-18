/**
 * Unit tests for entity handle validator
 */

import { validateEntityHandle, normalizeEntityHandle } from '../../src/shared/utils/validators/entity';
import { ValidationError } from '../../src/shared/types/errors';

describe('validateEntityHandle', () => {
  it('should accept valid entity handles', () => {
    expect(() => validateEntityHandle('ARIN-HN-1')).not.toThrow();
    expect(() => validateEntityHandle('VRSN-96')).not.toThrow();
    expect(() => validateEntityHandle('RIPE-NCC-HM-MNT')).not.toThrow();
    expect(() => validateEntityHandle('handle123')).not.toThrow();
    expect(() => validateEntityHandle('A1')).not.toThrow();
  });

  it('should reject empty or non-string input', () => {
    expect(() => validateEntityHandle('')).toThrow(ValidationError);
    expect(() => validateEntityHandle('   ')).toThrow(ValidationError);
  });

  it('should reject handles exceeding 255 characters', () => {
    const longHandle = 'A' + 'B'.repeat(255);
    expect(() => validateEntityHandle(longHandle)).toThrow(ValidationError);
  });

  it('should reject handles starting with special characters', () => {
    expect(() => validateEntityHandle('-INVALID')).toThrow(ValidationError);
    expect(() => validateEntityHandle('.INVALID')).toThrow(ValidationError);
  });
});

describe('normalizeEntityHandle', () => {
  it('should trim whitespace', () => {
    expect(normalizeEntityHandle('  ARIN-HN-1  ')).toBe('ARIN-HN-1');
  });

  it('should preserve casing (RIR handles are case-sensitive)', () => {
    expect(normalizeEntityHandle('VRSN-96')).toBe('VRSN-96');
    expect(normalizeEntityHandle('handle123')).toBe('handle123');
  });
});

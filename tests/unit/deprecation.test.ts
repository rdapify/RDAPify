/**
 * Unit tests for the deprecation warning utility
 */

import { deprecated, _resetDeprecationState } from '../../src/shared/utils/deprecation';

beforeEach(() => {
  _resetDeprecationState();
});

describe('deprecated()', () => {
  it('emits a deprecation warning via process.emitWarning', () => {
    const spy = jest.spyOn(process, 'emitWarning').mockImplementation(() => {});
    deprecated('myOldMethod', 'Use myNewMethod() instead');
    expect(spy).toHaveBeenCalledTimes(1);
    const [msg, opts] = spy.mock.calls[0]!;
    expect(String(msg)).toContain('myOldMethod');
    expect(String(msg)).toContain('myNewMethod');
    expect((opts as Record<string, unknown>)['type']).toBe('DeprecationWarning');
    spy.mockRestore();
  });

  it('emits at most once per code (deduplication)', () => {
    const spy = jest.spyOn(process, 'emitWarning').mockImplementation(() => {});
    deprecated('myOldMethod', undefined, 'DEP001');
    deprecated('myOldMethod', undefined, 'DEP001');
    deprecated('myOldMethod', undefined, 'DEP001');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('emits for different codes independently', () => {
    const spy = jest.spyOn(process, 'emitWarning').mockImplementation(() => {});
    deprecated('methodA', undefined, 'DEP001');
    deprecated('methodB', undefined, 'DEP002');
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('includes "deprecated" and "major release" in message', () => {
    const spy = jest.spyOn(process, 'emitWarning').mockImplementation(() => {});
    deprecated('foo');
    const [msg] = spy.mock.calls[0]!;
    expect(String(msg)).toContain('deprecated');
    expect(String(msg)).toContain('future major release');
    spy.mockRestore();
  });

  it('works without alternative argument', () => {
    const spy = jest.spyOn(process, 'emitWarning').mockImplementation(() => {});
    expect(() => deprecated('foo')).not.toThrow();
    spy.mockRestore();
  });

  it('auto-generates a stable code from name when none provided', () => {
    const spy = jest.spyOn(process, 'emitWarning').mockImplementation(() => {});
    deprecated('client.getBatchProcessor');
    const [, opts] = spy.mock.calls[0]!;
    expect((opts as Record<string, unknown>)['code']).toContain('DEP_RDAPIFY');
    spy.mockRestore();
  });

  it('_resetDeprecationState() allows re-emission after reset', () => {
    const spy = jest.spyOn(process, 'emitWarning').mockImplementation(() => {});
    deprecated('foo', undefined, 'DEP001');
    _resetDeprecationState();
    deprecated('foo', undefined, 'DEP001');
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

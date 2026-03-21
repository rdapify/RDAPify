/**
 * Tests for NativeBackend when rdapify-nd is NOT installed.
 *
 * This file does NOT mock rdapify-nd — because rdapify-nd is listed only as
 * an optional peerDependency and is absent from the project's node_modules,
 * require('rdapify-nd') naturally throws MODULE_NOT_FOUND. Jest module
 * isolation ensures the _module cache in NativeBackend.ts starts fresh for
 * this test file.
 */

import { NativeBackend, isNativeAvailable } from '../../src/infrastructure/native/NativeBackend';

describe('NativeBackend — rdapify-nd absent', () => {
  it('isNativeAvailable() returns false', () => {
    expect(isNativeAvailable()).toBe(false);
  });

  it('NativeBackend.create("auto") returns null', () => {
    expect(NativeBackend.create('auto')).toBeNull();
  });

  it('NativeBackend.create("native") throws with install hint', () => {
    expect(() => NativeBackend.create('native')).toThrow(
      'rdapify-nd is not installed'
    );
  });

  it('NativeBackend.create("native") error includes npm install command', () => {
    expect(() => NativeBackend.create('native')).toThrow(
      'npm install rdapify-nd'
    );
  });
});

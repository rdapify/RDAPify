/**
 * Unit tests for CircuitBreaker
 */

import { CircuitBreaker, CircuitOpenError } from '../../src/infrastructure/http/CircuitBreaker';

async function ok<T>(value: T): Promise<T> {
  return value;
}

async function fail(message = 'error'): Promise<never> {
  throw new Error(message);
}

describe('CircuitBreaker', () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts in closed state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('closed');
  });

  it('executes normally when closed', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(() => ok('hello'));
    expect(result).toBe('hello');
    expect(cb.getState()).toBe('closed');
  });

  // ── closed → open ──────────────────────────────────────────────────────────

  it('trips to open after failureThreshold consecutive failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, halfOpenTimeout: 30_000 });

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => fail())).rejects.toThrow('error');
    }

    expect(cb.getState()).toBe('open');
  });

  it('does not trip if failures are below threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });

    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(() => fail())).rejects.toThrow();
    }

    expect(cb.getState()).toBe('closed');
  });

  it('rejects immediately with CircuitOpenError when open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, halfOpenTimeout: 30_000 });
    await expect(cb.execute(() => fail())).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    await expect(cb.execute(() => ok('should not reach'))).rejects.toBeInstanceOf(CircuitOpenError);
  });

  // ── open → half-open ───────────────────────────────────────────────────────

  it('transitions to half-open after halfOpenTimeout elapses', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker({ failureThreshold: 1, halfOpenTimeout: 5000 });

    await expect(cb.execute(() => fail())).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    // Advance time past the half-open timeout
    jest.advanceTimersByTime(5001);
    expect(cb.getState()).toBe('half-open');

    jest.useRealTimers();
  });

  it('remains open before halfOpenTimeout elapses', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker({ failureThreshold: 1, halfOpenTimeout: 5000 });

    await expect(cb.execute(() => fail())).rejects.toThrow();
    jest.advanceTimersByTime(4999);
    expect(cb.getState()).toBe('open');

    jest.useRealTimers();
  });

  // ── half-open → closed (happy path) ───────────────────────────────────────

  it('closed → open → half-open → closed on successful test request', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 1,
      halfOpenTimeout: 1000,
    });

    // Trip to open
    await expect(cb.execute(() => fail())).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    // Advance to half-open
    jest.advanceTimersByTime(1001);
    expect(cb.getState()).toBe('half-open');

    // Successful test request → closed
    const result = await cb.execute(() => ok('recovered'));
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('closed');

    jest.useRealTimers();
  });

  // ── half-open → open (failure during test) ────────────────────────────────

  it('closed → open → half-open → open on failed test request', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 1,
      halfOpenTimeout: 1000,
    });

    // Trip to open
    await expect(cb.execute(() => fail())).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    // Advance to half-open
    jest.advanceTimersByTime(1001);
    expect(cb.getState()).toBe('half-open');

    // Test request fails → back to open
    await expect(cb.execute(() => fail('test failed'))).rejects.toThrow('test failed');
    expect(cb.getState()).toBe('open');

    jest.useRealTimers();
  });

  // ── successThreshold > 1 ──────────────────────────────────────────────────

  it('stays half-open until successThreshold successes in half-open state', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      halfOpenTimeout: 1000,
    });

    await expect(cb.execute(() => fail())).rejects.toThrow();
    jest.advanceTimersByTime(1001);
    expect(cb.getState()).toBe('half-open');

    // First success — still half-open
    await cb.execute(() => ok('1'));
    expect(cb.getState()).toBe('half-open');

    // Second success — closed
    await cb.execute(() => ok('2'));
    expect(cb.getState()).toBe('closed');

    jest.useRealTimers();
  });

  // ── reset() ───────────────────────────────────────────────────────────────

  it('reset() returns circuit to closed state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await expect(cb.execute(() => fail())).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    cb.reset();
    expect(cb.getState()).toBe('closed');
    const result = await cb.execute(() => ok('ok'));
    expect(result).toBe('ok');
  });

  // ── recordSuccess / recordFailure ─────────────────────────────────────────

  it('recordFailure() counts toward threshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    cb.recordFailure();
    expect(cb.getState()).toBe('closed');
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
  });

  it('recordSuccess() resets failure count when closed', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    cb.recordFailure();
    cb.recordSuccess(); // resets count
    cb.recordFailure(); // only 1 after reset — still closed
    expect(cb.getState()).toBe('closed');
  });

  // ── CircuitOpenError ──────────────────────────────────────────────────────

  it('CircuitOpenError has the correct name', () => {
    const err = new CircuitOpenError();
    expect(err.name).toBe('CircuitOpenError');
    expect(err.state).toBe('open');
  });
});

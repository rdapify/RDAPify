/**
 * Unit tests for AbortController support in Fetcher (Feature 2)
 */

import { Fetcher } from '../../../src/infrastructure/http/Fetcher';
import { QueryAbortedError } from '../../../src/shared/errors';

describe('AbortController support', () => {
  it('throws QueryAbortedError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const fetcher = new Fetcher({ signal: controller.signal });

    // Mock global fetch to simulate AbortError — use Error with name='AbortError'
    // because DOMException may not be available in the Jest Node environment
    const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    global.fetch = jest.fn().mockRejectedValue(abortError);

    await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
      QueryAbortedError
    );
  });

  it('proceeds normally without a signal', async () => {
    const fetcher = new Fetcher();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => ({ objectClassName: 'domain', handle: 'TEST' }),
    } as unknown as Response);

    const result = await fetcher.fetch('https://rdap.example.com/domain/test.com');
    expect(result).toEqual({ objectClassName: 'domain', handle: 'TEST' });
  });

  it('passes signal to fetch call', async () => {
    const controller = new AbortController();
    const fetcher = new Fetcher({ signal: controller.signal });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
      json: async () => ({ objectClassName: 'domain' }),
    } as unknown as Response);

    global.fetch = mockFetch;

    await fetcher.fetch('https://rdap.example.com/domain/test.com');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://rdap.example.com/domain/test.com',
      expect.objectContaining({ signal: controller.signal })
    );
  });
});

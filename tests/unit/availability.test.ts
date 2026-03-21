/**
 * Unit tests for checkAvailability / checkAvailabilityBatch
 */

import { RDAPClient } from '../../src/application/client/RDAPClient';
import { RDAPServerError } from '../../src/shared/errors';
import type { DomainResponse } from '../../src/shared/types';

// Minimal DomainResponse factory
function makeDomainResponse(overrides: Partial<DomainResponse> = {}): DomainResponse {
  return {
    query: 'example.com',
    objectClass: 'domain',
    status: ['active'],
    metadata: { source: 'https://rdap.example.com', timestamp: new Date().toISOString(), cached: false },
    ...overrides,
  };
}

describe('RDAPClient.checkAvailability', () => {
  let client: RDAPClient;

  beforeEach(() => {
    client = new RDAPClient({ cache: false });
  });

  it('returns available: false for a registered domain', async () => {
    jest.spyOn(client, 'domain').mockResolvedValue(makeDomainResponse());

    const result = await client.checkAvailability('example.com');

    expect(result.domain).toBe('example.com');
    expect(result.available).toBe(false);
    expect(result.expiresAt).toBeUndefined();
  });

  it('extracts expiresAt from expiration event', async () => {
    const expDate = '2027-08-13T04:00:00Z';
    jest.spyOn(client, 'domain').mockResolvedValue(
      makeDomainResponse({
        events: [
          { type: 'registration', date: '1995-08-14T04:00:00Z' },
          { type: 'expiration', date: expDate },
        ],
      })
    );

    const result = await client.checkAvailability('example.com');

    expect(result.available).toBe(false);
    expect(result.expiresAt).toEqual(new Date(expDate));
  });

  it('returns available: true when RDAP server responds with 404', async () => {
    jest.spyOn(client, 'domain').mockRejectedValue(
      new RDAPServerError('Not found', 404)
    );

    const result = await client.checkAvailability('available-domain.com');

    expect(result.domain).toBe('available-domain.com');
    expect(result.available).toBe(true);
    expect(result.expiresAt).toBeUndefined();
  });

  it('propagates non-404 errors', async () => {
    jest.spyOn(client, 'domain').mockRejectedValue(
      new RDAPServerError('Server error', 500)
    );

    await expect(client.checkAvailability('example.com')).rejects.toBeInstanceOf(RDAPServerError);
  });

  it('propagates network errors', async () => {
    jest.spyOn(client, 'domain').mockRejectedValue(new Error('Network failure'));

    await expect(client.checkAvailability('example.com')).rejects.toThrow('Network failure');
  });
});

describe('RDAPClient.checkAvailabilityBatch', () => {
  let client: RDAPClient;

  beforeEach(() => {
    client = new RDAPClient({ cache: false });
  });

  it('returns a Map with results for each domain', async () => {
    const expDate = '2027-01-01T00:00:00Z';
    jest.spyOn(client, 'domain')
      .mockResolvedValueOnce(
        makeDomainResponse({ query: 'taken.com', events: [{ type: 'expiration', date: expDate }] })
      )
      .mockRejectedValueOnce(new RDAPServerError('Not found', 404));

    const results = await client.checkAvailabilityBatch(['taken.com', 'free.com']);

    expect(results.size).toBe(2);
    expect(results.get('taken.com')?.available).toBe(false);
    expect(results.get('taken.com')?.expiresAt).toEqual(new Date(expDate));
    expect(results.get('free.com')?.available).toBe(true);
  });

  it('returns an empty Map for an empty array', async () => {
    const results = await client.checkAvailabilityBatch([]);
    expect(results.size).toBe(0);
  });

  it('propagates errors from individual domain checks', async () => {
    jest.spyOn(client, 'domain').mockRejectedValue(
      new RDAPServerError('Server error', 500)
    );

    await expect(client.checkAvailabilityBatch(['error.com'])).rejects.toBeInstanceOf(RDAPServerError);
  });
});

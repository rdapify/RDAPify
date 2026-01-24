/**
 * Next.js Integration Example
 * Server-side RDAP queries with Next.js App Router
 */

import { RDAPClient } from 'rdapify';

// Server component - queries run on server
export default async function RDAPPage({
  searchParams,
}: {
  searchParams: { domain?: string };
}) {
  const domain = searchParams.domain || 'example.com';

  // Create client on server
  const client = new RDAPClient({
    cache: true,
    privacy: { redactPII: true },
  });

  let result = null;
  let error = null;

  try {
    result = await client.domain(domain);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>RDAP Lookup</h1>

      <form method="get" style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          name="domain"
          defaultValue={domain}
          placeholder="Enter domain..."
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            width: '300px',
            marginRight: '0.5rem',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Lookup
        </button>
      </form>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div>
          <h2>Domain Information</h2>

          <div
            style={{
              backgroundColor: '#f5f5f5',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            <p>
              <strong>Domain:</strong> {result.ldhName}
            </p>
            <p>
              <strong>Handle:</strong> {result.handle || 'N/A'}
            </p>
            <p>
              <strong>Status:</strong> {result.status?.join(', ') || 'N/A'}
            </p>
          </div>

          {result.nameservers && result.nameservers.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3>Nameservers</h3>
              <ul>
                {result.nameservers.map((ns, i) => (
                  <li key={i}>{ns}</li>
                ))}
              </ul>
            </div>
          )}

          {result.events && result.events.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3>Events</h3>
              <ul>
                {result.events.slice(0, 5).map((event, i) => (
                  <li key={i}>
                    <strong>{event.type}:</strong>{' '}
                    {new Date(event.date).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            style={{
              fontSize: '0.875rem',
              color: '#666',
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
            }}
          >
            <p>
              <strong>Source:</strong> {result.metadata.source}
            </p>
            <p>
              <strong>Cached:</strong> {result.metadata.cached ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>Timestamp:</strong>{' '}
              {new Date(result.metadata.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

# Error Handling

RDAPify throws typed errors that map to specific failure conditions. All five query methods (`domain`, `ip`, `asn`, `nameserver`, `entity`) use the same error hierarchy.

---

## Error classes

```typescript
import {
  ValidationError,
  SSRFError,
  BootstrapError,
  FetchError,
  NativeBackendError,
} from 'rdapify';
```

| Class | Cause |
|-------|-------|
| `ValidationError` | Invalid input — malformed domain, IP address, or ASN |
| `SSRFError` | Query target blocked by SSRF protection (private IP, loopback, link-local) |
| `BootstrapError` | Failed to discover the authoritative RDAP server from the IANA bootstrap registry |
| `FetchError` | Network error, non-2xx HTTP response, or timeout — after all configured retries have been exhausted |
| `NativeBackendError` | `rdapify-nd` unavailable and `backend: 'native'` was set at construction time |

All error classes extend the built-in `Error` and carry a `message` string.

---

## Basic try / catch

```typescript
import { RDAPClient, ValidationError, FetchError, SSRFError } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.domain('example.com');
  console.log(result.query, result.registrar?.name);
} catch (error) {
  if (error instanceof ValidationError) {
    // Bad input — do not retry
    console.error('Invalid domain:', error.message);
  } else if (error instanceof SSRFError) {
    // Security: target is a private / reserved address
    console.error('SSRF blocked:', error.message);
  } else if (error instanceof FetchError) {
    // Network or registry error — retries already exhausted
    console.error('Fetch failed:', error.message);
  } else if (error instanceof BootstrapError) {
    // Could not reach IANA bootstrap endpoint
    console.error('Bootstrap failed:', error.message);
  } else {
    throw error; // unexpected — re-throw
  }
}
```

---

## Retry behaviour

RDAPify retries automatically on transient failures. The default policy is:

```typescript
{
  maxAttempts: 3,
  initialDelay: 1000,    // 1 second
  maxDelay: 10000,       // 10 seconds
  backoff: 'exponential',
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}
```

When the client throws `FetchError`, all configured retry attempts have already been exhausted.

`ValidationError` and `SSRFError` are **never** retried — they represent conditions that will not change on retry.

### Customising retries

```typescript
const client = new RDAPClient({
  retry: {
    maxAttempts: 5,
    initialDelay: 500,
    backoff: 'exponential',
  },
});

// Disable retries entirely
const client = new RDAPClient({ retry: false });
```

---

## Retry visibility with hooks

Use the `onRetry` hook to observe retry events without modifying retry behaviour:

```typescript
client.use({
  onRetry(ctx) {
    console.warn(`Retry #${ctx.attempt} for ${ctx.query} in ${ctx.delay} ms`);
  },
  onError(ctx) {
    console.error(`${ctx.query} failed: ${ctx.error?.message}`);
  },
});
```

---

## Timeouts

Set request timeouts at construction time:

```typescript
const client = new RDAPClient({
  timeout: 5000,  // 5 s applied to connect, request, and DNS
});

// Or fine-grained:
const client = new RDAPClient({
  timeout: {
    connect: 3000,
    request: 8000,
    dns: 2000,
  },
});
```

A timed-out request follows the retry policy — if all attempts time out, a `FetchError` is thrown.

---

## SSRF protection

SSRF protection is enabled by default and blocks queries to:

- Private IPv4 ranges (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Loopback: `127.0.0.0/8`, `::1`
- Link-local: `169.254.0.0/16`

These throw `SSRFError` immediately without any retry:

```typescript
try {
  await client.ip('192.168.1.1');
} catch (error) {
  // error instanceof SSRFError === true
}
```

To allow specific internal RDAP endpoints (e.g. for testing against a private mirror):

```typescript
const client = new RDAPClient({
  ssrfProtection: {
    enabled: true,
    allowedDomains: ['rdap-mirror.internal.corp.example.com'],
  },
});
```

---

## Bootstrap failures

`BootstrapError` is thrown when the client cannot determine which RDAP server to query — either the IANA bootstrap data is unavailable or the TLD/RIR is not found.

If IANA is unreachable in your environment, mirror the bootstrap files locally and point the client at your mirror:

```typescript
const client = new RDAPClient({
  bootstrapUrl: 'https://rdap-bootstrap.internal.corp.example.com',
});
```

---

## Native backend errors

When `backend: 'native'` is set, the client throws `NativeBackendError` at construction time if `rdapify-nd` is not installed:

```typescript
try {
  const client = new RDAPClient({ backend: 'native' });
} catch (error) {
  // NativeBackendError: rdapify-nd is not installed
}
```

Use `backend: 'auto'` (the default) to fall back to the TypeScript backend silently when `rdapify-nd` is absent.

---

## Graceful degradation pattern

```typescript
import { RDAPClient, FetchError, BootstrapError } from 'rdapify';

const client = new RDAPClient();

async function safeDomainLookup(domain: string) {
  try {
    return await client.domain(domain);
  } catch (error) {
    if (error instanceof FetchError || error instanceof BootstrapError) {
      // Return null and let the caller decide how to handle unavailability
      return null;
    }
    throw error;
  }
}

const result = await safeDomainLookup('example.com');
if (result === null) {
  console.warn('RDAP lookup unavailable — skipping');
}
```

---

## See also

- [Retry options](../api-reference/types/options.md#retryoptions)
- [Timeout options](../api-reference/types/options.md#timeoutoptions)
- [SSRF protection options](../api-reference/types/options.md#ssrfprotectionoptions)
- [Middleware hooks — `onError`, `onRetry`](../advanced/middleware.md)

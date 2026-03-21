# Privacy Controls

RDAPify applies PII redaction to RDAP responses before returning them to the caller. Redaction is enabled by default and targets vCard fields that typically carry personal data.

---

## Configuration

### Enable / disable (shorthand)

```typescript
// Enabled with defaults (this is the default behaviour)
const client = new RDAPClient({ privacy: true });

// Disabled — all vCard fields returned as-is from the registry
const client = new RDAPClient({ privacy: false });
```

### Fine-grained control

```typescript
const client = new RDAPClient({
  privacy: {
    redactPII: true,
    redactFields: ['email', 'phone', 'fax'],  // fields to redact (default)
    redactionText: '[REDACTED]',               // replacement value (default)
  },
});
```

To redact additional fields:

```typescript
const client = new RDAPClient({
  privacy: {
    redactPII: true,
    redactFields: ['email', 'phone', 'fax', 'adr', 'url'],
  },
});
```

---

## What gets redacted

Redaction applies to vCard properties inside `RDAPEntity.vcardArray` objects. The default fields are:

| vCard property | Redacted value |
|----------------|----------------|
| `email` | `[REDACTED]` |
| `tel` (phone) | `[REDACTED]` |
| `fax` | `[REDACTED]` |

Fields that are **never** modified by the redaction engine:

- `nameservers` — technical infrastructure data
- `status` — domain/network status flags
- `registrar.name`, `registrar.url` — business-level registry data
- `country`, `startAddress`, `endAddress`, `ipVersion` — network allocation data
- All `metadata` fields

> Note: Many modern RDAP registries already redact personal data server-side before returning the response. RDAPify's client-side redaction provides an additional safety layer, but it does not synthesise redaction that the registry did not perform.

---

## Raw response access

Setting `includeRaw: true` attaches the unprocessed registry response to `result.raw`. The raw response is **not** subject to client-side redaction:

```typescript
const client = new RDAPClient({ includeRaw: true });
const result = await client.domain('example.com');

// result is redacted (based on privacy setting)
// result.raw is the unprocessed server response
```

Only enable `includeRaw` when you have a specific need for it (e.g. debugging or compliance auditing with documented legal basis).

---

## Checking redaction status

Each response carries a `metadata` object:

```typescript
result.metadata.cached    // whether the result came from cache
result.metadata.source    // RDAP server that answered the query
result.metadata.timestamp // ISO 8601 query time
```

Redaction is applied uniformly to all live and cached responses. There is no `metadata.redacted` flag — if `privacy: true` is set, redaction always applies.

---

## Cache interaction

Responses are cached **after** redaction. This means:

- Cached entries never contain PII fields that would have been redacted.
- Changing `privacy` options does not retroactively affect cached entries; call `client.clearCache()` when changing redaction settings.

```typescript
const client = new RDAPClient({ privacy: true });
await client.domain('example.com');  // cached with redaction applied

// Disable privacy and clear cache to get unredacted data
const unredacted = new RDAPClient({ privacy: false });
await unredacted.clearCache();
const result = await unredacted.domain('example.com');
```

---

## Per-query raw include

`includeRaw` is a client-level option — it cannot be set per-call. Construct a separate client instance if you need both redacted and raw responses:

```typescript
const standard = new RDAPClient();
const raw      = new RDAPClient({ privacy: false, includeRaw: true });

const redacted = await standard.domain('example.com');
const full     = await raw.domain('example.com');
```

---

## See also

- [RDAPClientOptions — `privacy`](client.md#privacy)
- [Options types — `PrivacyOptions`](types/options.md#privacyoptions)
- [SSRF protection](../security/ssrf-prevention.md)

# License Activation — @rdapify/pro

@rdapify/pro uses **Ed25519-signed activation tokens** issued by `activation.rdap.io`. Tokens are validated offline after the initial activation handshake — no network call is needed on every startup.

---

## How activation works

```
┌─────────────┐   1. POST /activate   ┌──────────────────────┐
│  Your app   │ ────────────────────► │ activation.rdap.io   │
│             │ ◄──────────────────── │ (rdapify License API) │
│             │   2. signed token     └──────────────────────┘
│             │
│             │   3. validate locally (Ed25519 pubkey embedded in binary)
│             │   4. cache token in ~/.rdapify/license.token
└─────────────┘
```

1. **Activate** — call `activateLicense(key)` once (or set `RDAPIFY_LICENSE_KEY` env var).
2. **Receive token** — `activation.rdap.io` returns an Ed25519-signed JWT containing your plan tier, expiry, and allowed domains.
3. **Validate offline** — the public key is embedded in `@rdapify/pro`; no outbound call is needed at runtime.
4. **Cache token** — the token is written to `~/.rdapify/license.token` and reused across restarts.

---

## Quickstart

```typescript
import { activateLicense } from '@rdapify/pro';

// One-time activation (call once per machine / container image build)
await activateLicense(process.env.RDAPIFY_LICENSE_KEY!);

// Then use the client normally — Pro features are unlocked automatically
import { RDAPClient } from 'rdapify';
const client = new RDAPClient();
```

Alternatively, set the environment variable and skip the `activateLicense()` call entirely:

```bash
export RDAPIFY_LICENSE_KEY=rdpfy_live_xxxxxxxxxxxxxxxxxxxx
```

@rdapify/pro reads `RDAPIFY_LICENSE_KEY` on first use and activates automatically.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `RDAPIFY_LICENSE_KEY` | Yes (or call `activateLicense()`) | Your Pro license key |
| `RDAPIFY_TOKEN_PATH` | No | Override token cache path (default `~/.rdapify/license.token`) |
| `RDAPIFY_ACTIVATION_URL` | No | Override activation server URL (enterprise air-gap use only) |
| `RDAPIFY_OFFLINE_MODE` | No | Set to `1` to skip activation server ping entirely (token must already be cached) |

---

## Offline / air-gapped activation

For environments without outbound internet access:

1. **Pre-activate** on a machine with internet access:
   ```bash
   npx rdapify-activate --key $RDAPIFY_LICENSE_KEY --output license.token
   ```
2. **Copy** `license.token` into your container image or deployment:
   ```dockerfile
   COPY license.token /app/.rdapify/license.token
   ENV RDAPIFY_TOKEN_PATH=/app/.rdapify/license.token
   ENV RDAPIFY_OFFLINE_MODE=1
   ```
3. **Verify** on startup:
   ```typescript
   import { getLicenseInfo } from '@rdapify/pro';
   const info = await getLicenseInfo();
   console.log(info.plan);     // 'starter' | 'growth' | 'enterprise'
   console.log(info.expiresAt); // ISO 8601 date
   console.log(info.offline);   // true
   ```

The embedded Ed25519 public key validates the token signature without any network call.

---

## Grace period

If `activation.rdap.io` is unreachable on startup (network outage, DNS failure), @rdapify/pro enters a **72-hour grace period**:

- All Pro features continue to work normally.
- A warning is logged once per hour: `[rdapify/pro] License server unreachable — grace period active (Xh remaining)`.
- If the grace period expires without a successful re-validation, Pro features are disabled until the license is re-validated.

The grace period does **not** apply if:

- The token signature is invalid (tampered or wrong key).
- The token is expired (past its `exp` claim).
- The license key has been revoked.

---

## Token refresh

Tokens have a **30-day validity window** and are automatically refreshed in the background 7 days before expiry. No action is required.

To force a manual refresh:

```typescript
import { refreshLicense } from '@rdapify/pro';
await refreshLicense();
```

---

## Revocation

Revoked licenses are rejected immediately at the activation server. Cached tokens are also invalidated — `activation.rdap.io` maintains a **Certificate Revocation List (CRL)** checked on every token refresh.

If your license is revoked unexpectedly, contact support at support@rdapify.com with your license key and order ID.

---

## `getLicenseInfo()` reference

```typescript
import { getLicenseInfo } from '@rdapify/pro';

const info = await getLicenseInfo();
```

| Field | Type | Description |
|---|---|---|
| `valid` | `boolean` | `true` if the cached token is valid and unexpired |
| `plan` | `'starter' \| 'growth' \| 'enterprise'` | Your current plan tier |
| `expiresAt` | `string` | ISO 8601 token expiry date |
| `gracePeriodActive` | `boolean` | `true` if the activation server could not be reached |
| `gracePeriodEndsAt` | `string \| null` | ISO 8601 end of grace period, or `null` |
| `offline` | `boolean` | `true` if activated in offline mode |
| `domains` | `string[]` | Allowed domains (empty = all allowed) |
| `features` | `string[]` | List of enabled feature flags for your plan |

---

## Troubleshooting

**`Error: License key not found`**
→ Set `RDAPIFY_LICENSE_KEY` or call `activateLicense()` before using any Pro feature.

**`Error: Token signature invalid`**
→ Your `license.token` file may be corrupted. Delete it and re-activate.

**`Error: License expired`**
→ Renew your subscription at https://rdapify.com/billing. The token will refresh automatically after renewal.

**`Error: License revoked`**
→ Contact support@rdapify.com.

**`Error: Activation server unreachable`**
→ Check your outbound HTTPS connectivity to `activation.rdap.io`. If you need air-gapped deployment, see [Offline activation](#offline--air-gapped-activation) above.

---

## Security notes

- License keys are **not** embedded in tokens — the server maps key → token at activation time.
- Tokens use **Ed25519** signatures (not RSA or HMAC) — the public key is embedded in the binary and cannot be extracted to forge tokens.
- The token cache file (`~/.rdapify/license.token`) should be treated as a secret — it grants access to Pro features without network calls.
- In multi-tenant environments, use separate license keys per tenant. Do not share a single key across tenants.

---

Next: [Pro Features Overview](./features.md) · [Pricing](https://rdapify.com/pricing)

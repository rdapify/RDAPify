# LICENSE_SYSTEM.md

How the RDAPify licensing system works — from license key generation through validation,
activation, offline usage, and revocation.

> **Internal details** (key rotation, revocation procedures, signing key management):
> `RDAPify-Internal/business/LICENSE_KEY_SPEC.md` and `GOVERNANCE.md §5`.

---

## 1. License Model

### Open-core

RDAPify uses an open-core model. The division is clean:

| | `rdapify` | `@rdapify/pro` |
|---|---|---|
| License | MIT | Commercial |
| Source | Public | Private (compiled native addon) |
| Usage | Unlimited — no license key required | Requires a valid license key |
| All 5 query types | ✅ | ✅ (via rdapify as peer dep) |
| Caching, SSRF, PII redaction | ✅ | ✅ |
| Middleware hooks, metrics | ✅ | ✅ |
| Bulk monitoring and change detection | — | ✅ |
| Analytics and reporting | — | ✅ |
| Webhooks and export | — | ✅ |
| History tracking | — | ✅ |
| Portfolio management | — | ✅ |
| Domain expiry alerts | — | ✅ |

### License is required only for Pro features

The core `rdapify` library never checks for a license. You can use all five query types,
all cache strategies, SSRF protection, PII redaction, circuit breaker, rate limiter,
and middleware hooks without any license key. No API key, no registration, no rate limit.

`@rdapify/pro` validates its license key at load time, before any Pro feature is accessible.
If the license is invalid or expired, the `proPlugin()` call throws an error and no Pro
functionality is loaded.

### Plans

| Plan | `maxDev` default | Intended for |
|---|---|---|
| `PRO` | 1 | Individual developers |
| `TEAM` | 10 | Small engineering teams |
| `ENTERPRISE` | 100 | Organizations with large teams |
| `TRIAL` | 1 | Evaluation (time-limited) |

`maxDev` is the maximum number of concurrent developer seats. This is informational —
the library does not enforce seat counts locally. Enforcement is server-side at the
License API.

---

## 2. License Key Format

### Current format (2026-03-24 onwards)

```
RDAP-{PLAN}-{base64url(AES-256-GCM(payload))}.{64-hex-HMAC-SHA256}
```

Example structure (values are illustrative):

```
RDAP-PRO-YWJjZGVmZ2hpamtsbW5vcA.a1b2c3d4e5f6...64hexchars
```

- **`RDAP-`** — fixed prefix, identifies this as an RDAPify license key
- **`{PLAN}`** — one of `PRO`, `TEAM`, `ENTERPRISE`, `TRIAL`
- **`{base64url(AES-256-GCM(payload))}`** — the payload, encrypted with AES-256-GCM
  using the server-side `LICENSE_SECRET`. The client cannot read this without the key.
- **`.{64-hex-HMAC-SHA256}`** — HMAC-SHA256 of the base64url ciphertext, also using
  `LICENSE_SECRET`. The dot separator distinguishes the current format from legacy keys.

**The encryption is opaque by design.** A client holding only the license key cannot
extract plan details, expiry date, or organization from the key itself. All metadata
comes from the online validation API response.

### Legacy format (still accepted)

```
RDAP-{PLAN}-{base64url(JSON)}-{hmac}
```

The original format used plaintext JSON in the payload (base64url-encoded but not
encrypted). The JSON contains `{ org?, exp (Unix ms)?, maxDev? }`. This format
is still validated by both the client library and the License API.

**The hyphen before the HMAC** (vs the dot in the current format) is the distinguishing
marker. The validator checks for a dot separator to identify current-format keys.

### What the key encodes

Both formats ultimately represent the same logical data:

| Field | Description |
|---|---|
| `plan` | License tier: PRO, TEAM, ENTERPRISE, or TRIAL |
| `org` | Organization or individual name (optional) |
| `exp` | Expiry timestamp in Unix milliseconds (optional — null means no fixed expiry) |
| `maxDev` | Maximum developer seats |

### How the key is verified

Verification happens at two levels:

**Client-side (in `@rdapify/pro`):**
- Format validation: correct prefix, recognizable plan, valid base64url encoding
- For legacy format: expiry check against `exp` field
- For current format: format is opaque — expiry is checked against the online API response or the activation cache

**Server-side (License API):**
- Reconstruct and verify the HMAC-SHA256 over the key's payload using `LICENSE_SECRET`
- For current format: decrypt the AES-256-GCM ciphertext and extract metadata
- Check revocation status in the D1 database
- Check seat count compliance
- Return `{ valid, plan, org, maxDev, expiresAt }` or `{ valid: false, reason }`

---

## 3. License Validation Flow

There are three validation methods. They are distinct by design: each is appropriate
for a different situation.

### Three validation methods

```
validate(key)
─────────────
Decode only. No I/O. No cache.

Checks: format, plan presence, expiry (legacy format only).
Does NOT verify the HMAC or check revocation.
Use for: pre-flight format checks before calling the API.
Not sufficient alone to authorize Pro access.

validateOnline(key)
───────────────────
Direct API call. No cache.

Checks: everything the API checks (HMAC, decryption, revocation, seats, expiry).
Falls back to decode-only if the API is unreachable.
Does NOT write or read the activation cache.
Use for: explicit one-off verification (admin tools, CI environments with forceOnline).

validateWithActivation(key, forceOnline, gracePeriodDays)
─────────────────────────────────────────────────────────
Primary method. Used by proPlugin().

Combines online validation, local activation cache, and grace period logic.
See the flows below.
```

### Flow 1 — First activation

The very first time a license key is used on a machine.

```
proPlugin({ licenseKey: 'RDAP-PRO-...' })
    │
    ▼
validateWithActivation(key, forceOnline=false, gracePeriodDays=30)
    │
    ├─ Step 1: Decode key → format valid? plan extractable?
    │    └─ NO → throw immediately (no network call made)
    │
    ├─ Step 2: Load ~/.rdapify/activation/{key_id}.json
    │    └─ FILE NOT FOUND → first activation → must go online
    │
    ├─ Step 3: POST /license/validate-online
    │    │
    │    ├─ Response: valid=true
    │    │    ├─ Write activation cache with:
    │    │    │    - plan, org, max_developers, expires_at (from API response)
    │    │    │    - activated_at = now
    │    │    │    - grace_expires_at = now + 30 days
    │    │    │    - signature = HMAC-SHA256(canonical_fields)
    │    │    └─ Return LicenseInfo ✅
    │    │
    │    ├─ Response: valid=false (revoked, expired, seat limit)
    │    │    └─ Throw with reason from API ✗
    │    │
    │    └─ API unreachable
    │         └─ Throw "Online activation required. API unreachable." ✗
    │              (No offline shortcut for a brand-new key)
    │
    ▼
ProPluginDescriptor returned to client.use()
```

**Why first activation must be online:** A new key has never been verified. There
is no local record to trust. Allowing offline activation for new keys would let
forged keys work indefinitely — the entire security model depends on first-use
being online.

---

### Flow 2 — Subsequent runs (within grace period)

The key has been activated on this machine. The grace period has not expired.

```
validateWithActivation(key, forceOnline=false, gracePeriodDays=30)
    │
    ├─ Step 1: Decode key → OK
    │
    ├─ Step 2: Load ~/.rdapify/activation/{key_id}.json → EXISTS
    │
    ├─ Step 3: Verify HMAC signature on cache file
    │    └─ INVALID → delete tampered file → throw ✗
    │
    ├─ Step 4: Check grace_expires_at > now
    │    └─ YES, within grace period
    │
    └─ Return LicenseInfo from cache (no network call) ✅
```

This is the common path in production. Zero network calls, sub-millisecond validation,
works without internet connectivity.

---

### Flow 3 — Offline usage (grace period active)

Identical to Flow 2. As long as the activation cache exists, the signature is valid,
and `grace_expires_at` is in the future, `@rdapify/pro` works completely offline.

The default grace period is **30 days**. This means a machine can be fully offline
for 30 days after its last successful online validation and Pro features continue
to work normally.

To reduce or extend the grace period, pass `gracePeriodDays` to `proPlugin()`:

```typescript
// CI environment: re-validate online every run
const plugin = await proPlugin({ licenseKey, gracePeriodDays: 0 });

// Air-gapped environment: longer grace (max 365 days)
const plugin = await proPlugin({ licenseKey, gracePeriodDays: 90 });
```

---

### Flow 4 — Grace period expired (renewal)

The grace period has elapsed. The library tries to renew online.

```
validateWithActivation(key, forceOnline=false, gracePeriodDays=30)
    │
    ├─ Cache exists, signature valid, BUT grace_expires_at < now
    │
    ├─ Step 3 (renewal): POST /license/validate-online
    │    │
    │    ├─ API reachable, valid=true
    │    │    └─ Update cache: new grace_expires_at = now + 30 days ✅
    │    │
    │    ├─ API reachable, valid=false (revoked or expired)
    │    │    └─ Delete activation cache → throw ✗
    │    │
    │    └─ API unreachable
    │         └─ Emergency extension: extend grace_expires_at by +7 days
    │            Log warning: "License API unreachable. 7-day extension granted."
    │            Return LicenseInfo from cache (with warning) ✅
    │
    └─ Emergency extension is non-configurable and non-renewable.
       After 7 days: throw "License validation required. API unreachable." ✗
```

**Total maximum offline window: 37 days** (30-day grace + 7-day emergency).
After that, the License API must be reachable at least once.

---

### Flow 5 — Revoked license

```
validateWithActivation(key, forceOnline=false, gracePeriodDays=30)
    │
    ├─ If within grace period → returns valid from cache
    │    (Revocation is not checked offline)
    │
    └─ On next online check (grace renewal or forceOnline=true):
         POST /license/validate-online
         Response: { valid: false, reason: "revoked" }
         └─ Delete activation cache → throw "License has been revoked." ✗
```

**Implication:** A revoked license continues to work offline until its grace period
expires. This is intentional — it prevents service disruption from API downtime being
misidentified as revocation.

For immediate revocation enforcement (e.g., fraud response):

```typescript
// Force online check every call — no cache used
const plugin = await proPlugin({ licenseKey, onlineValidation: true });
```

---

### Flow 6 — Expired license

A license with an explicit expiry date (`exp` field) has passed its expiry.

```
└─ Online check: License API returns { valid: false, reason: "expired" }
   └─ Delete activation cache → throw "License has expired." ✗
```

Expiry is checked server-side on every online validation. In the legacy format,
it is also checked client-side by `validate()`. Current-format keys require the
API to determine expiry since the payload is opaque to the client.

---

## 4. Activation System

### Activation cache

The activation cache is a JSON file written to the user's home directory after
every successful online validation.

**Location:** `~/.rdapify/activation/{key_id}.json`

**Key ID:** The first 16 hexadecimal characters of `SHA-256(license_key)`. This
identifies the key without storing the key itself — the file is anonymous.

**Cache structure:**

```json
{
  "plan": "pro",
  "org": "Acme Corp",
  "max_developers": 1,
  "expires_at": "2027-01-01T00:00:00Z",
  "activated_at": "2026-03-25T10:00:00Z",
  "grace_expires_at": "2026-04-24T10:00:00Z",
  "signature": "a1b2c3...64 hex chars..."
}
```

The cache does not store the license key itself. It stores only the derived
metadata returned by the API, plus timestamps for the activation and grace period.

### Activation signing

The `signature` field is computed as:

```
HMAC-SHA256(
  "{plan}|{org}|{max_developers}|{expires_at}|{activated_at}|{grace_expires_at}",
  ACTIVATION_SIGNING_KEY
)
```

`ACTIVATION_SIGNING_KEY` is embedded in the compiled `@rdapify/pro` binary.

**What this prevents:** A user manually editing the JSON file to change their plan,
extend `grace_expires_at`, or alter `max_developers`. Any field modification
invalidates the HMAC, causing the cache to be discarded and the system to fall back
to online validation.

**What this does not prevent:** A sophisticated attacker who extracts
`ACTIVATION_SIGNING_KEY` from the binary could forge a cache file. The signing key
is a tamper-detection mechanism, not a cryptographic secret. The security model does
not rely on this key being secret — it only needs to make casual cache editing
impractical.

### Grace period

The grace period controls how long a machine can operate without contacting the
License API. It starts from the most recent successful online validation.

| Parameter | Default | Range | Where set |
|---|---|---|---|
| `gracePeriodDays` | 30 | 1–365 | `proPlugin({ gracePeriodDays: N })` |

The grace period resets on every successful online validation. A machine that checks
in online daily effectively has unlimited offline capability.

### Emergency extension

When the License API is unreachable at grace period expiry, the system automatically
extends the grace period by 7 days. This prevents service disruption from temporary
API outages.

The extension is:
- **Automatic** — no user action required
- **Non-configurable** — always exactly 7 days
- **Non-renewable** — granted once per grace period cycle
- **Logged** — a warning is emitted: `"License API unreachable. 7-day emergency extension granted."`

---

## 5. Revocation

### How a license is revoked

Revocation is a server-side operation performed by the License API. A license can be
revoked:

- **Automatically** — when a Paddle `subscription.canceled` event is received
- **Manually** — via the admin endpoint `POST /admin/revoke` (requires `ADMIN_SECRET`)

When revoked, the D1 database sets `revoked = 1` and records `revoked_at`. The
physical license key string is not changed or deleted.

### When revocation is checked

Revocation is only checked during an online validation call (`validateOnline()` or
`validateWithActivation()` when an online check is triggered). It is **not** checked
when serving a response from the local activation cache.

This means:

| Scenario | Revocation detected? |
|---|---|
| Within grace period, no network call | No |
| Grace period expired, online renewal triggered | Yes |
| `forceOnline: true` on every call | Yes, every call |
| API unreachable during renewal | No (emergency extension granted) |
| After emergency extension expires | Yes (forced online check) |

### What happens after revocation is detected

1. The License API response contains `{ valid: false, reason: "revoked" }`
2. The local activation cache file is deleted
3. `validateWithActivation()` throws with the reason string
4. `proPlugin()` throws, preventing Pro plugin initialization
5. No Pro features are accessible

The next `proPlugin()` call will also fail, because the activation cache is gone
and the online check will again return revoked.

---

## 6. Security Model

### Why keys are encrypted

The current key format uses AES-256-GCM encryption for the payload. This is a
deliberate design decision — not just added complexity.

**Without encryption (legacy format):** Anyone with a license key can decode the
payload and read their plan, org name, expiry date, and seat count. This is mildly
sensitive data, but more importantly, it reveals the exact payload structure —
which could inform attempts to forge keys.

**With encryption:** The payload is opaque to anyone without `LICENSE_SECRET`.
Clients cannot extract metadata without an online API call. An attacker who
intercepts or observes a license key gains no information about its contents.
The AES-256-GCM mode also provides authenticated encryption — the HMAC-SHA256
outer layer is a second independent authentication, providing defense in depth.

### Why activation is signed

The activation cache is user-writable (it lives in the user's home directory). Without
the HMAC signature, a user could:
- Change `grace_expires_at` to a date far in the future
- Change `plan` from `pro` to `enterprise`
- Change `max_developers` to a larger number

The HMAC over the canonical fields catches all of these modifications. The signing
key embedded in the binary makes this impractical for most users.

### What attacks are prevented

| Attack | Prevention mechanism |
|---|---|
| **Key forgery** (creating a valid key without paying) | HMAC-SHA256 on key is server-side; AES-256-GCM payload requires `LICENSE_SECRET` |
| **Key tampering** (changing plan or expiry in the key) | AES-256-GCM authentication tag detects ciphertext modification; HMAC detects outer tampering |
| **Activation cache tampering** (editing JSON to extend grace period, upgrade plan) | HMAC-SHA256 over all business-critical fields; mismatched signature discards the cache |
| **Replay attacks on webhooks** | Paddle webhook signature + 5-minute timestamp window + D1 idempotency key |
| **Webhook forgery** (faking a payment event) | HMAC-SHA256 verification against `PADDLE_WEBHOOK_SECRET` |
| **Revocation bypass** (continuing use after cancellation) | Online validation at grace period expiry detects revocation; `forceOnline: true` detects it every call |

### What attacks are not prevented

Understanding the limits of the security model is as important as understanding its
protections.

**License key sharing.** There is no hardware binding, machine fingerprinting, or
device limit enforcement in the client library. A single `PRO` key (1 seat) shared
across 50 machines will work. Seat limits are enforced only when the License API is
called, and only the API can detect concurrent usage across machines. This is a
deliberate usability trade-off for developer-friendly licensing.

**Binary extraction of `ACTIVATION_SIGNING_KEY`.** A motivated attacker who disassembles
the `@rdapify/pro` native binary can extract the signing key embedded in it. This
allows them to forge local activation cache files. This attack requires access to the
binary, knowledge of the cache format, and technical skill — it is not casual.
The system's online validation requirement on first use and at grace period renewal
limits the window of abuse.

**Offline abuse during grace period.** A revoked license continues to work from the
activation cache for up to 37 days without any network call. If an attacker obtains
a license key, activates it, and then disconnects from the network, they can use
Pro features for up to 37 days after revocation.

**`LICENSE_SECRET` compromise.** If the server-side `LICENSE_SECRET` is leaked, an
attacker can generate valid license keys of any plan. Key rotation invalidates all
existing keys and requires customer migration. See `GOVERNANCE.md §5.5` for the
rotation procedure.

---

## 7. Environment Variables

These variables are required by the License API (Cloudflare Worker). They are
**server-side secrets** — not configured by library users.

| Variable | Where used | Purpose |
|---|---|---|
| `LICENSE_SECRET` | Cloudflare Worker | AES-256-GCM encryption key for license key payloads; HMAC-SHA256 signing key for key authentication. **Critical** — rotation invalidates all existing keys. |
| `PADDLE_WEBHOOK_SECRET` | Cloudflare Worker | Verifies HMAC-SHA256 signatures on incoming Paddle webhook payloads. |
| `PADDLE_API_KEY` | Cloudflare Worker | Authenticates requests to the Paddle API for subscription lookups. |
| `PADDLE_PRICE_PRO` | Cloudflare Worker | Maps a Paddle price ID to the `PRO` plan during webhook processing. |
| `PADDLE_PRICE_TEAM` | Cloudflare Worker | Maps a Paddle price ID to the `TEAM` plan during webhook processing. |
| `PADDLE_PRICE_ENTERPRISE` | Cloudflare Worker | Maps a Paddle price ID to the `ENTERPRISE` plan during webhook processing. |
| `RESEND_API_KEY` | Cloudflare Worker | Authenticates requests to Resend for sending license key delivery emails. |
| `ADMIN_SECRET` | Cloudflare Worker | Authenticates requests to admin-only endpoints (`/admin/revoke`, key generation). |
| `DB` | Cloudflare Worker (D1 binding) | Cloudflare D1 database binding — not a secret. Bound in `wrangler.toml`. |

**Client-side variable:** None. `@rdapify/pro` does not read any environment variables
for license validation. The license key is passed explicitly to `proPlugin()`.

**`ACTIVATION_SIGNING_KEY`:** Embedded directly in the compiled `@rdapify/pro` binary.
It is not an environment variable. It is rotated by releasing a new binary version.
Rotating it invalidates all existing activation caches — users must re-activate online
once after installing the new version.

---

## Related Documents

| Document | What it covers |
|---|---|
| `rdapify/docs/license/` | This directory — license system public documentation |
| `RDAPify-Internal/business/LICENSE_KEY_SPEC.md` | Internal spec: exact format, code locations, key migration policy |
| `RDAPify-Internal/ARCHITECTURE.md §3` | Architecture-level view of the activation model |
| `RDAPify-Internal/GOVERNANCE.md §5` | Key rotation authority and `LICENSE_SECRET` rotation procedure |
| `RDAPify-Internal/operations/RUNBOOK_PADDLE_LICENSE_FLOW.md` | Full operational guide: Paddle events, manual recovery |
| `RDAPify-Internal/operations/EMERGENCY_RUNBOOK.md` | Emergency procedures for license key compromise |

# BILLING_ARCHITECTURE.md

How the RDAPify billing and payment system works — end-to-end.

**Audience:** Operators, Infrastructure Owner, anyone responding to billing incidents.
**Last updated:** 2026-03-26

---

## 1. Billing Provider

RDAPify uses **Paddle** as its payment processor and merchant of record.

**Why Paddle:**

- **Merchant of record** — Paddle handles VAT, sales tax, and compliance obligations by jurisdiction. RDAPify does not collect tax or file returns.
- **Subscription management** — Paddle manages billing cycles, retries on failed payments, cancellations, and grace periods at the payment layer.
- **Webhook-driven** — Paddle notifies the Worker of payment events in real time. The Worker only needs to respond to events; it never polls Paddle.
- **Paddle.js overlay** — The checkout experience is a Paddle-hosted overlay on rdapify.com/pricing. No card data ever touches RDAPify infrastructure.

Paddle operates in two modes, controlled by the `ENVIRONMENT` Worker secret:

| `ENVIRONMENT` value | Paddle API base URL | Use |
|---|---|---|
| `production` | `api.paddle.com` | Live payments |
| `sandbox` | `sandbox-api.paddle.com` | Testing |

All price IDs (e.g. `pri_xxxxx`) are set as Worker secrets and must match the corresponding mode.

---

## 2. Payment Flow

A new subscription follows this path from checkout to working license key:

```
1. Customer visits rdapify.com/pricing
2. Customer clicks a plan → Paddle.js checkout overlay opens
3. Customer enters payment details (card, PayPal, etc.) — handled entirely by Paddle
4. Paddle processes the payment and creates a subscription
5. Paddle sends POST /paddle/webhook (subscription.created) to the Worker
6. Worker verifies the webhook signature (HMAC-SHA256, Paddle-Signature header)
7. Worker checks idempotency: does a license with this paddle_order_id already exist?
8. Worker resolves the customer email from the webhook payload or Paddle API
9. Worker detects the plan from the price ID (comparing against PADDLE_PRICE_* env vars)
10. Worker generates a license key (AES-256-GCM encrypted, HMAC-signed)
11. Worker writes the license record to D1 (licenses table)
12. Worker sends the license key to the customer via Resend email
13. Worker sends an admin notification (new sale alert)
14. Worker returns HTTP 200 to Paddle
15. Customer activates the key in their application via @rdapify/pro
```

Steps 6–14 happen inside a single Worker invocation. The Worker returns 200 to Paddle as early as possible after signature verification, even if downstream steps (email) fail, to prevent Paddle from retrying.

---

## 3. Webhook Handling

### Signature Verification

Every incoming request to `POST /paddle/webhook` is verified before any processing occurs:

```
Paddle-Signature: ts=1700000000;h1=<64-hex-hmac>
```

The Worker recomputes `HMAC-SHA256(ts + ":" + rawBody, PADDLE_WEBHOOK_SECRET)` and compares it to `h1`. Requests that fail verification are rejected with HTTP 403. No further processing occurs.

### Events Handled

| Event | Handler | Action |
|---|---|---|
| `subscription.created` | `onSubscriptionCreated` | Generate license key → write to D1 → send email |
| `subscription.canceled` | `onSubscriptionCanceled` | Set `revoked = 1` in D1 (`revoke_reason = "Subscription canceled"`) |
| `subscription.past_due` | `onSubscriptionPastDue` | Log warning only — no immediate action taken |

### Events Not Yet Handled

The following events have no registered handler. Until they are implemented, these scenarios require manual admin action:

| Event | Missing behavior | Risk |
|---|---|---|
| `transaction.refunded` | Refunded customers keep their license key | Customer can use refunded license indefinitely |
| `subscription.updated` | Plan changes (upgrade/downgrade) not reflected | Wrong plan in license key after plan change |
| `subscription.resumed` | Paused subscription re-activation not supported | Customer has to contact support |

See `RUNBOOK_PADDLE_LICENSE_FLOW.md` — Known Gaps for tracking status.

### Idempotency

Paddle retries webhook delivery for up to 3 days on non-200 responses. A single `subscription.created` event could arrive multiple times. The Worker prevents duplicate license generation at two levels:

**Level 1 — Application check (before INSERT):**
```javascript
const existing = await env.DB.prepare(
  'SELECT id FROM licenses WHERE paddle_order_id = ? LIMIT 1'
).bind(subscriptionId).first();
if (existing) { return; } // already processed — skip silently
```

**Level 2 — Schema constraint (safety net):**
```sql
paddle_order_id TEXT UNIQUE
```
If the application check is bypassed (race condition, concurrent Workers), the UNIQUE constraint prevents duplicate rows at the database level.

### Retry Behavior

The Worker **always returns HTTP 200 after signature verification**, even if D1 write or email delivery fails. This prevents Paddle from triggering unwanted retries for transient downstream failures.

If processing fails silently (Resend down, D1 timeout), the license may or may not exist in D1. Check D1 directly and follow the manual recovery procedure in §7.

---

## 4. Database

The Worker uses **Cloudflare D1** (SQLite at the edge):

- **Worker binding:** `DB` (configured in `wrangler.toml`)
- **Database name:** `rdapify-licenses`
- **Schema file:** `RDAPify-Internal/cloudflare/license-api/schema.sql`

### Core Tables

**`licenses`** — One row per issued license key

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `key` | TEXT UNIQUE | Full license key string |
| `org` | TEXT | Organization or customer name |
| `email` | TEXT | Customer email (where key was sent) |
| `plan` | TEXT | `pro`, `team`, `enterprise`, or `trial` |
| `expires_at` | INTEGER | Unix timestamp (milliseconds) |
| `max_dev` | INTEGER | Max concurrent developer installs (default 5) |
| `max_devices` | INTEGER | Max device activations (default 1) |
| `max_users` | INTEGER | Max users for team plans (default 1) |
| `registered_domain` | TEXT | Set on first activation; domain binding |
| `violation_count` | INTEGER | Count of domain mismatch violations |
| `revoked` | INTEGER | 0 = active, 1 = revoked |
| `revoke_reason` | TEXT | Human-readable revocation cause |
| `created_at` | INTEGER | Unix timestamp (milliseconds) |
| `paddle_order_id` | TEXT UNIQUE | Paddle subscription ID; idempotency key |

**`activations`** — One row per activated device per license

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `license_id` | TEXT FK | References `licenses.id` |
| `fingerprint` | TEXT | Device fingerprint (hash of hardware identifiers) |
| `activated_at` | INTEGER | First activation timestamp |
| `last_seen` | INTEGER | Last validation timestamp |

The `(license_id, fingerprint)` pair is UNIQUE — the same device activating the same license updates `last_seen` rather than creating a new row. This is the server-side device tracking used to enforce `max_devices`.

**`anomaly_logs`** — Suspicious activity log

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `license_id` | TEXT FK | License involved |
| `type` | TEXT | `validation`, `domain_mismatch`, `multi_ip_warning` |
| `details` | TEXT | JSON payload with event context |
| `ip` | TEXT | Source IP of the suspicious request |
| `created_at` | INTEGER | Unix timestamp |

Populated when the Worker detects anomalies during license validation: domain mismatches increment `violation_count` on the license row and write here. Review via `/adify/anomalies`.

**`rate_limits`** — Per-key request rate enforcement

| Column | Type | Notes |
|---|---|---|
| `key_hash` | TEXT | SHA-256(license key + window type) |
| `window` | TEXT | Window identifier (minute or day number) |
| `count` | INTEGER | Requests in this window |
| `updated_at` | INTEGER | Last increment timestamp |

Enforced in the Worker before license validation queries reach D1. Prevents brute-force key enumeration and validation abuse.

### Supporting Tables

**`admin_team`** — Admin users with dashboard access

| Column | Notes |
|---|---|
| `email` TEXT PK | Admin email address |
| `role` TEXT | `super_admin` or `viewer` |
| `invited_by` TEXT | Email of admin who invited them |
| `last_login` INTEGER | Last dashboard login timestamp |

**`api_keys`** — Programmatic API access tokens

| Column | Notes |
|---|---|
| `key_hash` TEXT UNIQUE | SHA-256 of the raw API key |
| `scope` TEXT | `read_only` or `read_write` |
| `expires_at` INTEGER | NULL = never expires |
| `last_used` INTEGER | Last API request timestamp |

**`automations`** — Trigger-based automation rules

Stores rules that the daily cron job evaluates. Examples: send expiry warning email 7 days before `expires_at`, auto-revoke if `violation_count` exceeds threshold.

| `trigger` values | `action` values |
|---|---|
| `expiring_soon`, `expired`, `anomaly`, `inactive` | `send_email`, `revoke`, `extend` |

**Note:** The daily cron job (`0 3 * * *` at 03:00 UTC) that executes automations is defined in `wrangler.toml` but is currently disabled (commented out TODO). Automations do not run until this is enabled.

**`notification_settings`** — Key-value notification configuration

Controls system notification behavior (e.g. `email_on_license_expired`, `email_on_anomaly`). Updated by admins via the dashboard.

---

## 5. Email Delivery

RDAPify uses **Resend** for transactional email.

### Emails Sent

| Trigger | Recipient | Content |
|---|---|---|
| License generated (`subscription.created`) | Customer email from Paddle payload | License key, activation instructions, plan details |
| Manual generation (admin) | Email specified in generate request | Same license key email |
| Admin notification (new sale) | Internal admin address | Org name, plan, subscription ID |

### Failure Behavior

If Resend returns a non-200 response, the Worker logs the failure but does not propagate the error or return non-200 to Paddle. The license record already exists in D1 at this point. The customer paid but did not receive the key.

**Detection:** Monitor Resend dashboard → Logs for failed deliveries. See §7 for recovery.

### Environment

Resend is configured via the `RESEND_API_KEY` Worker secret. There is no sandbox mode for Resend — use test email addresses during staging.

---

## 6. Subscription Lifecycle

### New Subscription

```
subscription.created received
  → signature verified
  → idempotency check (paddle_order_id not seen before)
  → plan detected from price ID
  → license key generated (AES-256-GCM encrypted)
  → D1 INSERT into licenses (expires_at = now + 366 days for annual, now + 31 days for monthly)
  → Resend: license delivery email
  → Resend: admin notification
  → HTTP 200 → Paddle
```

### Renewal

Paddle handles billing cycle renewals automatically. **The Worker does not currently process renewal events.** License expiry is based on the `expires_at` timestamp set at initial creation. For annual licenses this means the key expires after ~366 days regardless of whether Paddle renews the subscription.

**Gap:** There is no `subscription.renewed` handler. Long-term subscribers will see their license expire unless the key is manually extended or the renewal handler is implemented.

### Cancellation

```
subscription.canceled received
  → signature verified
  → D1 UPDATE: revoked = 1, revoke_reason = "Subscription canceled"
  → HTTP 200 → Paddle
```

No email is sent to the customer on cancellation. The customer's next license validation will return `{ valid: false, reason: "Subscription canceled" }`. The 30-day local activation cache means the customer may continue to use the library for up to 30 days after cancellation before the validation fails.

### Refund

`transaction.refunded` is not handled. Refunded customers keep their license key active in D1. Manual revocation is required. See §8 — Admin Operations.

### Past Due

`subscription.past_due` triggers a warning log only. No action is taken against the license. Paddle handles payment retry on its own schedule. If Paddle eventually cancels the subscription, `subscription.canceled` will arrive and the license will be revoked.

### Expiration

License keys have an `expires_at` timestamp. When `expires_at` is in the past:
- Online validation (`/license/validate-online`) returns `{ valid: false }`
- The Rust client's local activation cache has a 30-day grace period and a 7-day emergency extension
- After grace + emergency extension, the license is fully expired client-side

Expired licenses are not automatically purged from D1. The daily cron job at 03:00 UTC is intended to handle cleanup and expiry notifications but is currently disabled.

---

## 7. Failure Scenarios

### Webhook signature verification fails

**Symptom:** Worker returns 403. Paddle logs non-200. Paddle retries.

**Cause:** `PADDLE_WEBHOOK_SECRET` is wrong, rotated, or mismatched between Paddle dashboard and Worker secret.

**Resolution:** Verify the secret in Paddle dashboard → Notifications → webhook endpoint settings. Update Worker secret via `wrangler secret put PADDLE_WEBHOOK_SECRET`.

---

### D1 write fails (license not created)

**Symptom:** Paddle dashboard shows webhook returned 200. Customer receives no email. No D1 record exists.

**Cause:** D1 transient failure, Worker CPU timeout before INSERT, or UNIQUE constraint violation.

**Resolution:**
1. Query D1 for the subscription ID: `SELECT * FROM licenses WHERE paddle_order_id = '{subscriptionId}'`
2. If no record: generate manually via admin dashboard. See §8.
3. If record exists with `revoked = 1`: restore via admin API.

---

### Email delivery fails (license in D1, email not sent)

**Symptom:** D1 record exists. Customer contacts support saying no key received.

**Cause:** Resend API down, `RESEND_API_KEY` expired, customer email address in Paddle payload invalid.

**Resolution:**
1. Retrieve the key from D1: `SELECT key FROM licenses WHERE email = 'customer@example.com' ORDER BY created_at DESC LIMIT 1`
2. Send the key manually via `support@rdapify.com`
3. Or use the admin dashboard resend flow: `/adify/licenses/{id}/resend`

---

### Customer receives key but activation fails

**Cause:** Plan detected incorrectly (unrecognized price ID → silently defaults to `pro`), `ENVIRONMENT` set to `sandbox` in production, or `@rdapify/pro` version older than v0.2.2.

**Check:**
```sql
SELECT plan, revoked, revoke_reason, expires_at FROM licenses WHERE key = 'RDAP-PRO-...';
```

**Resolution:** Revoke the incorrect key and generate a replacement with the correct plan.

---

### Duplicate license key issued

**Symptom:** Customer has two active keys for the same subscription.

**Cause:** Idempotency check bypassed (race condition between concurrent Worker invocations on the same event). The UNIQUE constraint on `paddle_order_id` prevents this at the DB level — if this occurred, the UNIQUE constraint was not yet applied (schema migration not run).

**Resolution:** Revoke the duplicate. Verify schema has `paddle_order_id TEXT UNIQUE` applied.

---

### Worker returns 500 / crashes mid-processing

The Worker returns 200 to Paddle after signature verification. If the Worker crashes after that point, Paddle will not retry. The license may or may not be in D1. Check D1 and Worker logs in Cloudflare dashboard → Workers → `rdapify-license-api` → Logs.

---

## 8. Admin Operations

The admin dashboard is available at `GET /adify` (requires OTP authentication via `ADMIN_SECRET`). It provides a web UI for all operations described below.

All operations are also available as authenticated API endpoints using `Authorization: Bearer {ADMIN_SESSION_TOKEN}`.

### Generate a License Manually

Use when a customer paid but no key was generated (webhook processing failed).

**Via admin dashboard:** `/adify` → Licenses → Generate New

**Via API:**
```bash
curl -X POST https://rdapify-license-api.rdapify.workers.dev/license/generate \
  -H "Authorization: Bearer {ADMIN_SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "org": "Acme Corp",
    "email": "customer@example.com",
    "plan": "pro",
    "days": 366
  }'
```

The endpoint generates the key, writes it to D1, and sends the license email automatically. Do not generate keys with `days` values that exceed the customer's subscription term.

### Revoke a License

Use when a subscription is canceled manually, a refund is issued, or a key is reported compromised.

**Via API:**
```bash
curl -X POST https://rdapify-license-api.rdapify.workers.dev/license/revoke \
  -H "Authorization: Bearer {ADMIN_SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "RDAP-PRO-...",
    "reason": "Refund issued — customer requested"
  }'
```

Revocation takes effect immediately on the next online validation. Customers using the local activation cache will not see the revocation until their cache expires (up to 30 days + 7-day emergency extension).

### Restore a Revoked License

Use when a license was revoked in error or a refund-with-continued-access is granted.

```bash
curl -X POST https://rdapify-license-api.rdapify.workers.dev/adify/licenses/{id}/restore \
  -H "Authorization: Bearer {ADMIN_SESSION_TOKEN}"
```

### Resend a License Email

Use when a customer did not receive the key email.

**Via admin dashboard:** `/adify` → Licenses → find license → Resend Email

Retrieves the key from D1 and sends a new license delivery email to the address on record.

### Handle a Refund

`transaction.refunded` is not automatically handled. When Paddle issues a refund:

1. Locate the customer's license in D1 by email or `paddle_order_id`
2. Decide whether to revoke the license (standard) or grant continued access (exception)
3. If revoking: use the revoke API with `reason: "Refund issued"`
4. Inform the customer via `support@rdapify.com`

No automated refund handling exists. All refund processing is manual.

### Extend a License

Use to grant extended access without issuing a new key (e.g., goodwill extension, delayed renewal).

```bash
curl -X POST https://rdapify-license-api.rdapify.workers.dev/adify/licenses/{id}/extend \
  -H "Authorization: Bearer {ADMIN_SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"days": 30}'
```

This updates `expires_at` in D1. The customer's local activation cache will reflect the new expiry on next online validation.

### Export License Data

A full D1 export is available at `GET /adify/export`. Use before `LICENSE_SECRET` rotation to capture all active keys before they are invalidated.

### Monitor Anomalies

Suspicious activity (domain mismatches, multi-IP usage, high validation rates) is logged in `anomaly_logs`. Review at:

- Admin dashboard: `/adify/anomalies`
- Direct D1 query:
  ```sql
  SELECT license_id, type, details, ip, created_at
  FROM anomaly_logs
  ORDER BY created_at DESC
  LIMIT 50;
  ```

---

## Related Documents

| Document | Location |
|---|---|
| Step-by-step Paddle event runbook | `RDAPify-Internal/operations/RUNBOOK_PADDLE_LICENSE_FLOW.md` |
| License key format and validation | `rdapify/docs/license/LICENSE_SYSTEM.md` |
| Internal architecture (billing section) | `RDAPify-Internal/ARCHITECTURE.md §4` |
| Emergency procedures (key compromise, Worker outage) | `RDAPify-Internal/operations/EMERGENCY_RUNBOOK.md` |
| Incident runbooks | `RDAPify-Internal/operations/INCIDENT_RUNBOOK.md` |
| D1 schema (source of truth) | `RDAPify-Internal/cloudflare/license-api/schema.sql` |

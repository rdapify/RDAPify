# Migration Guide — 0.x to 1.0.0

This guide helps you upgrade from any `rdapify` 0.x release to v1.0.0.
Read it fully before upgrading a production deployment.

> **Target release:** `rdapify@1.0.0` · `rdapify-rust@1.0.0` · `@rdapify/pro@1.0.0`
> **Target date:** February 2027
> **Status:** This document is updated as the 1.0.0 API stabilizes. Some details
> remain marked as *planned* where final decisions are still pending.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Supported Upgrade Paths](#2-supported-upgrade-paths)
3. [Breaking Changes](#3-breaking-changes)
4. [New Defaults and Behavior Changes](#4-new-defaults-and-behavior-changes)
5. [License & Activation Changes](#5-license--activation-changes)
6. [Deployment & Infrastructure Changes](#6-deployment--infrastructure-changes)
7. [Step-by-Step Upgrade Guide](#7-step-by-step-upgrade-guide)
8. [Compatibility Matrix](#8-compatibility-matrix)
9. [Troubleshooting](#9-troubleshooting)
10. [Getting Help](#10-getting-help)

---

## 1. Overview

### Why 1.0.0?

Version 1.0.0 marks the public stability commitment for RDAPify. It means:

- **The public API is frozen.** No breaking changes will be introduced without a new major version.
- **Security posture is validated.** An external security audit has been completed and all findings addressed.
- **The license system is production-grade.** Online-first activation, offline grace periods, and emergency extensions are fully implemented and tested.
- **Cross-repo compatibility is enforced.** `rdapify`, `rdapify-rust`, `rdapify-nd`, `rdapify-py`, and `@rdapify/pro` are versioned together and tested as a system.

### What changed conceptually

| Area | 0.x state | 1.0.0 state |
|------|-----------|-------------|
| API stability | Evolving; breaking changes between minor versions | Frozen until v2.0.0 |
| Circuit breaker | Exported class; wiring optional | Enabled per-registry by default |
| Batch API | `getBatchProcessor()` + `processBatch()` | `streamBatch()` + `client.processBatch()` directly |
| Native binding name | `@rdapify/core` (npm) | `rdapify-nd` (npm) |
| Python binding name | `rdapify` (PyPI) | `rdapify-py` (PyPI) |
| Pro license validation | Offline-first (exploitable) | Online-first activation with signed local cache |
| `onlineValidation` default | Inconsistent (true in JS, false in Rust) | Consistently `false` |
| Node.js minimum | `>=18.0.0` (inconsistent across templates) | `>=20.0.0` enforced |
| User-Agent | Hardcoded version string | Dynamic: `RDAPify/{version}` |

### Who needs to read this guide

- **Everyone using `rdapify` 0.x directly.** At minimum read §3 (Breaking Changes) and §7 (Step-by-Step).
- **Everyone using `@rdapify/pro` 0.x.** Also read §5 (License & Activation Changes) and §6 (Deployment).
- **DevOps/platform teams.** Read §6 (Deployment) for environment variable and CI changes.
- **Users of `rdapify-nd` or `rdapify-py`.** Read §3.3 and §3.4 for package rename details.

---

## 2. Supported Upgrade Paths

| From | To | Path | Notes |
|------|----|------|-------|
| **0.3.x** | 1.0.0 | Direct | Recommended path. Resolve all deprecation warnings before upgrading. |
| **0.2.x** | 1.0.0 | Upgrade to 0.3.x first | Required — 0.3.x emits deprecation warnings for all removed APIs. |
| **0.1.x** | 1.0.0 | Not directly supported | Upgrade to 0.2.x → 0.3.x → 1.0.0. Multiple breaking changes accumulate. |

> **Why the staged path?**
> 0.3.x was specifically designed as the migration bridge. It adds `streamBatch()`,
> emits `DeprecationWarning` for every removed API, and documents each migration path.
> Attempting a direct 0.1.x → 1.0.0 upgrade means encountering all breaking changes
> at once without warning context. Upgrade to 0.3.x first.

---

## 3. Breaking Changes

### 3.1 — `client.getBatchProcessor()` removed

**Deprecation code:** `DEP_RDAPIFY_0001` (emitted since v0.3.1)

**What changed:** The `getBatchProcessor()` method on `RDAPClient` is removed.
`processBatch()` is now a direct method on `RDAPClient`.

**Why:** The indirect accessor pattern forced users to manage a `BatchProcessor` instance
explicitly. In 1.0.0, `processBatch()` and `streamBatch()` are first-class client methods.

**Before (0.x):**
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const processor = client.getBatchProcessor();

const results = await processor.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'ip', query: '8.8.8.8' },
]);
```

**After (1.0.0):**
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Option A — streaming (recommended for large sets)
for await (const result of client.streamBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'ip', query: '8.8.8.8' },
])) {
  if (result.success) {
    console.log(result.data);
  }
}

// Option B — collect all results (small sets only)
const results = await client.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'ip', query: '8.8.8.8' },
]);
```

**How to detect before upgrading:** Run your 0.3.x code and check the Node.js process
warnings for `DEP_RDAPIFY_0001`. Any call to `client.getBatchProcessor()` will emit
the warning exactly once.

---

### 3.2 — `BatchProcessor` direct import removed from public API

**What changed:** `BatchProcessor` is no longer exported from the package root.
It is an internal class.

**Why:** With `processBatch()` and `streamBatch()` available directly on `RDAPClient`,
importing `BatchProcessor` directly was an advanced escape hatch that is now unnecessary
and was not part of the stable API surface.

**Before (0.x):**
```typescript
import { BatchProcessor } from 'rdapify';

const processor = new BatchProcessor(client, { concurrency: 10 });
const results = await processor.processBatch(requests);
```

**After (1.0.0):**
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({ concurrency: 10 });
const results = await client.processBatch(requests);
```

---

### 3.3 — Node.js native binding renamed: `@rdapify/core` → `rdapify-nd`

**What changed:** The npm package for the Node.js native Rust binding was renamed
from `@rdapify/core` to `rdapify-nd`. The old package is deprecated on npm with
an install warning.

**Why:** The scoped name `@rdapify/core` was misleading — the "core" is the TypeScript
library (`rdapify`), not the native binding. `rdapify-nd` (Node Dispatch) accurately
describes the role.

**Before (0.x):**
```bash
npm install @rdapify/core
```
```typescript
import { RDAPClient } from 'rdapify';
// @rdapify/core auto-detected if installed
```

**After (1.0.0):**
```bash
npm install rdapify-nd
```
```typescript
import { RDAPClient } from 'rdapify';
// rdapify-nd auto-detected if installed (same auto-selection, new package name)
```

If you pinned the `backend` option explicitly:
```typescript
// Before
const client = new RDAPClient({ backend: 'native' }); // required @rdapify/core

// After — same option, new underlying package
const client = new RDAPClient({ backend: 'native' }); // requires rdapify-nd
```

**Action required:** Update `package.json`:
```diff
 "dependencies": {
-  "@rdapify/core": "^0.1.2",
+  "rdapify-nd": "^1.0.0"
 }
```

---

### 3.4 — Python binding renamed: `rdapify` → `rdapify-py`; import `rdapify_py`

**What changed:** The Python package on PyPI was renamed from `rdapify` to `rdapify-py`.
The Python module import name changed from `rdapify` to `rdapify_py`.

**Why:** The PyPI name `rdapify` conflicted with the library's own identity. `rdapify-py`
follows the same naming pattern as `rdapify-nd` and makes the ecosystem explicit.

**Before (0.x):**
```bash
pip install rdapify
```
```python
import rdapify

result = rdapify.domain("example.com")
```

**After (1.0.0):**
```bash
pip install rdapify-py
```
```python
import rdapify_py as rdap

result = rdap.domain("example.com")
print(result["registrar"]["name"])
```

**Action required:** Update `requirements.txt` and any `pip install` commands.
The old PyPI `rdapify` package is deprecated and will not receive further updates.

---

### 3.5 — `@rdapify/pro` peer dependency minimum raised to `rdapify >= 1.0.0`

**What changed:** `@rdapify/pro@1.0.0` requires `rdapify@>=1.0.0` as a peer dependency.
The 0.x range (`>=0.2.0`) is no longer supported.

**Why:** The 1.0.0 API freeze changes the `client.use()` plugin interface contract.
`@rdapify/pro` depends on this interface being stable.

**Action required:**
```bash
npm install rdapify@^1.0.0 @rdapify/pro@^1.0.0
```

---

### 3.6 — Node.js minimum version raised to 20

**What changed:** `rdapify@1.0.0` requires Node.js 20+. The `engines` field in
`package.json` enforces this.

**Before (0.x):** `"engines": { "node": ">=18.0.0" }` (some templates had `>=16.0.0`)

**After (1.0.0):** `"engines": { "node": ">=20.0.0" }`

**Action required:** If your runtime is Node.js 18, upgrade to Node.js 20 (LTS) before
upgrading rdapify. Node.js 20 has been available since April 2023 and reaches LTS end of
life in April 2026 — Node.js 22 is recommended for new deployments.

---

## 4. New Defaults and Behavior Changes

These are not removed APIs but behavior changes that may affect existing code silently.

### 4.1 — Circuit breaker enabled by default (per-registry)

In 0.2.0, `CircuitBreaker` was exported as a standalone class that users could wire
manually. In 1.0.0, the circuit breaker is automatically wired per RDAP registry
inside the `Fetcher`.

**Default configuration:**
```typescript
// These are the 1.0.0 circuit breaker defaults — applied automatically
{
  failureThreshold: 5,   // open after 5 consecutive failures within the window
  successThreshold: 1,   // close after 1 success in half-open state
  halfOpenTimeout: 30_000, // 30s before attempting recovery
  window: 60_000,         // failures older than 60s are forgotten
}
```

**What this means in practice:** If an RDAP registry (e.g. Verisign's `.com` server)
returns 5 consecutive failures, rdapify will stop sending requests to that registry
for 30 seconds and return `CircuitOpenError` immediately. Requests to other registries
are not affected.

**If you want to disable or tune it:**
```typescript
import { RDAPClient } from 'rdapify';

// Disable entirely
const client = new RDAPClient({
  circuitBreaker: false,
});

// Custom thresholds
const client = new RDAPClient({
  circuitBreaker: {
    failureThreshold: 10,
    halfOpenTimeout: 60_000,
  },
});
```

**Monitoring circuit breaker state:**
```typescript
const stats = client.getCircuitBreakerStats();
// Returns: Map<registryHost, { state, failureCount, lastOpenedAt }>

for (const [host, stat] of stats) {
  console.log(`${host}: ${stat.state}`);
}
```

---

### 4.2 — `onlineValidation` default unified to `false` in `@rdapify/pro`

In Pro 0.2.1 and earlier, `onlineValidation` defaulted to `true` in the JavaScript
wrapper but `false` in the Rust core — causing inconsistent behavior depending on
how the option was set. As of Pro 0.2.2, it is `false` everywhere.

In 1.0.0 this is enforced: `onlineValidation: false` means "use the 30-day offline
grace period cache; validate online only when the cache is absent or expired."

**If you need online validation on every call** (e.g. in CI/CD for immediate revocation
detection):
```typescript
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  onlineValidation: true, // explicitly opt-in to force-online
});
```

---

### 4.3 — User-Agent header format changed

**Before (0.x):** `User-Agent: RDAPify/0.1.7` (hardcoded version string)

**After (1.0.0):** `User-Agent: RDAPify/{current-version}` (dynamic from `VERSION` constant)

This affects any RDAP registry logs or monitoring tools that parse the User-Agent field.
The format change is intentional and remains stable in 1.0.0.

---

### 4.4 — Telemetry remains opt-in, no change

`UsageTelemetry` is disabled by default and requires explicit `UsageTelemetry.enable()`
to activate. No PII is ever included in telemetry payloads (no domain names, no IP
addresses — only anonymous counters and environment metadata).

This behavior does not change in 1.0.0. If you have `UsageTelemetry.enable()` in your
code, telemetry will continue to fire. To disable explicitly:

```typescript
import { UsageTelemetry } from 'rdapify';

UsageTelemetry.disable(); // idempotent, safe to call regardless of current state
```

---

### 4.5 — `SSRF protection` cannot be disabled in 1.0.0

**Planned change.** In 0.x, SSRF protection can be disabled via
`{ ssrfProtection: false }`. In 1.0.0, SSRF protection is always on. The `ssrfProtection`
option accepts only a configuration object — passing `false` will throw at construction time.

If you pass private IPs for legitimate internal RDAP registries (e.g. in a test environment),
use the `customServers` bootstrap option to bypass discovery (queries still validate SSL)
or set up a proxy via `ProxyManager`.

---

## 5. License & Activation Changes

This section applies to users of `@rdapify/pro`.

### 5.1 — Online activation is mandatory on first use

**What changed:** The first time `ProPlugin()` is called with a new license key on a
given machine, it **must** reach `api.rdapify.dev` to complete activation. There is no
offline shortcut for first activation.

**Why:** Previous versions (0.1.x and some 0.2.x) decoded the license key payload
locally and relied only on the key's self-reported expiry. Because the HMAC signature
was not verified offline, any developer who had seen one real key could forge any plan.
Online-first activation closes this gap permanently.

**What you need to do:**
- Ensure `api.rdapify.dev` is reachable from your deployment environment during the first
  activation. This is a one-time requirement per machine per license key.
- In containerized environments, the activation cache directory
  (`~/.rdapify/activation/`) must be mounted as a persistent volume if you want to
  avoid re-activating on every container restart.

---

### 5.2 — Offline grace period: 30 days

After the first successful online activation, rdapify stores a HMAC-SHA256 signed
activation record locally:

```
~/.rdapify/activation/{key-id}.json
```

The default grace period is **30 days**. Within the grace period, all validation is
done locally — no network call, no latency.

At the end of the grace period, rdapify attempts online renewal. If the API is
unreachable during renewal, a **7-day emergency extension** is granted automatically
and a warning is logged.

To configure the grace period:
```typescript
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  gracePeriodDays: 14, // shorter window for stricter environments
});
```

---

### 5.3 — Activation cache tamper detection

The local activation record is HMAC-signed. If the file is modified (manually or by
a system tool), the next validation call detects the tamper, deletes the corrupted
record, and requires online re-activation.

```
[@rdapify/pro] Activation token tampered. Online re-activation required.
```

This is expected and safe — it means one additional network call.

---

### 5.4 — What happens if online validation fails

| Scenario | Result |
|----------|--------|
| First activation, API unreachable | Error: `"License API unreachable"`. Plugin not initialized. |
| Grace period active, API unreachable | Offline validation succeeds. No error. |
| Grace period expired, API unreachable | 7-day emergency extension granted. Warning logged. |
| Grace period expired + emergency expired | Error: `"License key has expired"`. |
| License key revoked (D1 database) | Error: `"License revoked"` at next online validation. |
| License key expired | Error: `"License key has expired"`. Cache deleted. |

---

### 5.5 — License key in environment variables

Always pass the license key via an environment variable, never hardcode it:

```typescript
// Correct
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
});

// Wrong — commits key to source control
const plugin = await ProPlugin({
  licenseKey: 'RDAP-PRO-xxxxx-xxxxx',
});
```

In CI/CD environments where you want revocation to take effect immediately:
```typescript
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  onlineValidation: true, // bypasses local cache on every build
});
```

---

## 6. Deployment & Infrastructure Changes

### 6.1 — Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `RDAPIFY_LICENSE_KEY` | `@rdapify/pro` | License key (required for Pro) |
| `HOME` / `USERPROFILE` | `@rdapify/pro` | Activation cache directory base path |

No additional environment variables are required for the open-source `rdapify` package.

**Kubernetes / Docker:** Mount `~/.rdapify/` as a `PersistentVolumeClaim` to preserve
the activation cache across pod restarts:

```yaml
# deployment.yaml
volumeMounts:
  - name: rdapify-activation
    mountPath: /root/.rdapify
volumes:
  - name: rdapify-activation
    persistentVolumeClaim:
      claimName: rdapify-activation-pvc
```

---

### 6.2 — License API endpoint

The Pro license validation API is hosted on Cloudflare Workers:

```
https://api.rdapify.dev/v1/validate
```

Ensure this endpoint is reachable from your deployment network. It uses HTTPS (port 443).
No authentication is required from the client — the license key itself is the credential.

**Firewall rules:** Allow outbound HTTPS to `api.rdapify.dev`.

---

### 6.3 — Billing and webhooks

Billing is handled by Paddle. You do not interact with Paddle directly from your application.
The license key is delivered automatically after a successful Paddle checkout.

If your organization requires invoice-based billing or a custom contract, contact
`support@rdapify.com`.

---

### 6.4 — CI/CD environments

In CI/CD pipelines where `HOME` may be unset or ephemeral:

```typescript
// Recommended CI/CD configuration
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  onlineValidation: true, // always validate online; no cache needed
});
```

This avoids requiring a mounted volume and ensures revocation is immediately reflected
in CI builds. Each build makes one validation call to `api.rdapify.dev` (typically < 50ms).

---

### 6.5 — No changes to open-source infrastructure

The `rdapify` npm package (MIT) has no changes to its infrastructure requirements.
It continues to work with no network calls at startup. The IANA Bootstrap endpoint
(`data.iana.org/rdap/dns.json`) is only contacted on the first query per TLD
(then cached for 24 hours by default).

---

## 7. Step-by-Step Upgrade Guide

Follow this sequence for a safe, validated upgrade.

### Step 1 — Upgrade to latest 0.3.x

```bash
npm install rdapify@^0.3.2
```

For Pro:
```bash
npm install rdapify@^0.3.2 @rdapify/pro@^0.2.2
```

Run your test suite. It must pass before proceeding.

---

### Step 2 — Fix all deprecation warnings

Start your application and watch for `DeprecationWarning` messages. Each deprecated API
emits a warning exactly once per process.

```bash
node --trace-deprecation your-app.js 2>&1 | grep DEP_RDAPIFY
```

| Warning | Code | Action |
|---------|------|--------|
| `client.getBatchProcessor() is deprecated` | `DEP_RDAPIFY_0001` | Migrate to `client.streamBatch()` or `client.processBatch()` |

Fix all warnings before upgrading to 1.0.0. Warnings that are not fixed will become
runtime errors in 1.0.0.

---

### Step 3 — Update package names (if applicable)

**If you use the Node.js native binding:**
```bash
npm uninstall @rdapify/core
npm install rdapify-nd@^1.0.0
```

**If you use the Python binding:**
```bash
pip uninstall rdapify
pip install rdapify-py
```

Update all `import` / `require` statements and requirements files.

---

### Step 4 — Audit your `RDAPClient` configuration

Check your `RDAPClient` instantiation for any options that change in 1.0.0:

```typescript
// Review these option values before upgrading:
const client = new RDAPClient({
  // 1. circuitBreaker — now enabled by default; pass false to disable
  circuitBreaker: { failureThreshold: 5 }, // or false

  // 2. ssrfProtection — cannot be disabled in 1.0.0
  // ssrfProtection: false, // ← REMOVE THIS; will throw in 1.0.0

  // 3. No other option defaults changed
});
```

---

### Step 5 — Upgrade to 1.0.0

```bash
npm install rdapify@^1.0.0
```

For Pro:
```bash
npm install rdapify@^1.0.0 @rdapify/pro@^1.0.0
```

For Rust:
```toml
# Cargo.toml
rdapify = "1.0"
```

Run your test suite. Address any `ReferenceError` or `TypeError` from removed APIs
(these should all be resolved in Step 2 if you fixed all deprecation warnings).

---

### Step 6 — Verify Pro activation (if using @rdapify/pro)

On the first run of your upgraded application, Pro performs online activation.
Confirm this succeeds:

```typescript
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
});

console.log('License valid:', plugin.license.valid);
console.log('Plan:', plugin.license.plan);
console.log('Cached:', plugin.license.activationCached); // false on first activation
console.log('Grace expires:', new Date(plugin.license.graceExpiresAt));
```

Expected output on first activation:
```
License valid: true
Plan: pro
Cached: false
Grace expires: [date 30 days from now]
```

Expected output on subsequent runs (within grace period):
```
License valid: true
Plan: pro
Cached: true
Grace expires: [same date]
```

---

### Step 7 — Monitor logs after deployment

After deploying 1.0.0 to production, watch for:

1. **`CircuitOpenError`** — a registry is experiencing failures. Check the affected registry
   status page. The circuit will recover automatically after `halfOpenTimeout`.

2. **`License API temporarily unavailable — 7-day emergency grace active`** — your network
   cannot reach `api.rdapify.dev`. Check firewall rules. Investigate within 7 days.

3. **`Activation token tampered`** — the activation cache file was modified. This triggers
   automatic online re-activation on the next call. If this appears in a container
   environment, check that your volume mount is not overwriting the activation directory.

---

## 8. Compatibility Matrix

All components must be at the same major version. Mixing major versions across packages
is not supported and will throw a compatibility error at startup.

| Component | Required Version for 1.0.0 | Install |
|-----------|--------------------------|---------|
| `rdapify` (npm) | `^1.0.0` | `npm install rdapify@^1.0.0` |
| `rdapify` (crates.io) | `^1.0.0` | `cargo add rdapify@^1.0` |
| `rdapify-nd` (npm) | `^1.0.0` | `npm install rdapify-nd@^1.0.0` |
| `rdapify-py` (PyPI) | `^1.0.0` | `pip install rdapify-py==1.*` |
| `@rdapify/pro` (npm) | `^1.0.0` | `npm install @rdapify/pro@^1.0.0` |
| Node.js | `>=20.0.0` | — |
| Python | `>=3.9` | — |
| Rust MSRV | `1.75` | — |

**Peer dependency enforcement:** `@rdapify/pro@1.0.0` declares `"rdapify": ">=1.0.0"` as a
peer dependency. npm will warn (or error with `--legacy-peer-deps` disabled) if you install
Pro with a 0.x core. This is intentional.

---

## 9. Troubleshooting

### License activation fails on first use

**Symptom:**
```
[@rdapify/pro] License API unreachable — cannot activate on first use.
```

**Causes and fixes:**
1. **Network/firewall:** Ensure outbound HTTPS to `api.rdapify.dev` is allowed.
   ```bash
   curl -I https://api.rdapify.dev/v1/validate
   # Expected: HTTP/2 200 or HTTP/2 400 (endpoint exists)
   ```
2. **Invalid key format:** The key must follow `RDAP-{PLAN}-{payload}-{signature}`.
   ```bash
   echo $RDAPIFY_LICENSE_KEY
   # Should start with RDAP-PRO-, RDAP-TEAM-, or RDAP-ENTERPRISE-
   ```
3. **Expired key:** The license key itself has passed its expiry date. Contact
   `support@rdapify.com` to renew.

---

### Circuit breaker trips immediately after upgrade

**Symptom:**
```
CircuitOpenError: Circuit is open — request rejected
```

**Cause:** Your deployment has pre-existing RDAP server failures that the circuit breaker
now surfaces more visibly.

**Fix:** Check which registry is tripping:
```typescript
const stats = client.getCircuitBreakerStats();
for (const [host, stat] of stats) {
  if (stat.state !== 'closed') {
    console.log(`Failing registry: ${host} — state: ${stat.state}`);
  }
}
```

The circuit recovers automatically after `halfOpenTimeout` (30s by default). If a registry
is persistently failing, it is a real downstream issue. To increase the failure tolerance:
```typescript
const client = new RDAPClient({
  circuitBreaker: { failureThreshold: 10, halfOpenTimeout: 60_000 },
});
```

---

### Telemetry ping errors in logs

**Symptom:**
```
[rdapify] Telemetry ping failed (silently ignored)
```

**Cause:** Telemetry is enabled (`UsageTelemetry.enable()` was called) but
`telemetry.rdapify.com` is unreachable. Telemetry failures are always silently
swallowed — they never affect RDAP query results.

**Fix:** Either whitelist `telemetry.rdapify.com` or disable telemetry:
```typescript
import { UsageTelemetry } from 'rdapify';
UsageTelemetry.disable();
```

---

### Native binding mismatch (`rdapify-nd` or `rdapify-py`)

**Symptom:**
```
Error: Cannot find module 'rdapify-nd'
# or
Error: Native module rdapify-nd version 0.1.3 is incompatible with rdapify 1.0.0
```

**Fix:** Install the matching version of `rdapify-nd`:
```bash
npm install rdapify-nd@^1.0.0
```

If you are using the optional native backend and cannot install `rdapify-nd`, fall back
to the TypeScript pipeline:
```typescript
const client = new RDAPClient({
  backend: 'typescript', // explicit fallback; ignores rdapify-nd even if present
});
```

---

### Python import error after pip upgrade

**Symptom:**
```python
ImportError: No module named 'rdapify'
```

**Fix:** The module name changed:
```python
# Before
import rdapify

# After
import rdapify_py as rdap
```

Also ensure you uninstalled the old package:
```bash
pip uninstall rdapify
pip install rdapify-py
```

---

### `ssrfProtection: false` throws at startup

**Symptom:**
```
Error: ssrfProtection cannot be disabled. SSRF protection is required in rdapify 1.0.0.
```

**Fix:** Remove the `ssrfProtection: false` option. If you are querying internal registries,
use the `customServers` bootstrap option instead:
```typescript
const client = new RDAPClient({
  bootstrap: {
    customServers: [
      { tld: 'internal', url: 'https://rdap.internal.corp/rdap/' },
    ],
    fallback: false, // disable IANA lookup entirely for internal-only deployments
  },
});
```

---

## 10. Getting Help

### Documentation

- **Full API reference:** [rdapify/docs/api/](docs/api/)
- **Security:** [SECURITY.md](SECURITY.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)

### Community support

- **GitHub Issues** (bugs, unexpected behavior):
  [github.com/rdapify/RDAPify/issues](https://github.com/rdapify/RDAPify/issues)
- **GitHub Discussions** (questions, upgrade help):
  [github.com/rdapify/RDAPify/discussions](https://github.com/rdapify/RDAPify/discussions)

### Commercial support

- **License and billing issues:** [support@rdapify.com](mailto:support@rdapify.com)
- **Security vulnerabilities:** [security@rdapify.com](mailto:security@rdapify.com)
  or [GitHub Security Advisories](https://github.com/rdapify/RDAPify/security/advisories/new)
- **Emergency (active exploit):** [emergency@rdapify.com](mailto:emergency@rdapify.com)
  — 4-hour response target

---

> Last updated: 2026-03-25
> This guide will be updated as breaking changes are finalized during the 1.0.0 release
> candidate phase (Q4 2026 — Q1 2027). Watch
> [github.com/rdapify/RDAPify/releases](https://github.com/rdapify/RDAPify/releases)
> for release candidate announcements.

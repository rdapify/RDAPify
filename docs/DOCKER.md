# RDAPify — Docker

Run RDAPify as a standalone, hardened RDAP REST API microservice. The image
ships the `rdap-service` binary (Axum HTTP server) and nothing else.

The canonical build assets live at the repo root:
[`Dockerfile`](../Dockerfile), [`docker-compose.yml`](../docker-compose.yml),
[`.dockerignore`](../.dockerignore).

---

## Quick Start

```bash
# Build the image (fully static musl binary on a distroless base)
docker build -t rdapify-core:local .

# Run the service (binds 0.0.0.0:8080 inside the container)
docker run -d --name rdapify-core -p 8080:8080 rdapify-core:local

# Query it
curl http://localhost:8080/health
# {"status":"ok"}

curl -X POST http://localhost:8080/rdap \
  -H 'content-type: application/json' \
  -d '{"kind":"domain","query":"example.com"}'
```

Or with Compose:

```bash
docker compose up -d --build
docker compose logs -f rdapify-core
```

---

## Image Details

| Property | Value |
|---|---|
| Runtime base | `gcr.io/distroless/static-debian12:nonroot` |
| Binary | `rdap-service`, statically linked (`x86_64-unknown-linux-musl`) |
| Size | **~13 MB** (CI gate: ≤ 15 MB — see [PERFORMANCE_SPEC.md](PERFORMANCE_SPEC.md#2-binary-size-targets)) |
| User | `nonroot` (UID 65532) — no shell, no package manager, no libc |
| TLS | rustls + `ring`; CA roots bundled via `webpki-roots` (no system cert store needed) |
| Platform | `linux/amd64` (arm64 requires adding the `aarch64-unknown-linux-musl` target) |

Because TLS roots are compiled into the binary and there is no dynamic linkage,
the image needs no `ca-certificates` package and runs on the minimal
`distroless/static` base.

---

## REST API

All endpoints are served on the **single** listener (port `8080`). There is no
separate metrics port.

| Method | Path | Description |
|---|---|---|
| `POST` | `/rdap` | RDAP lookup — body `{"kind":"domain","query":"example.com"}` (`kind`: `domain` \| `ip` \| `asn` \| `nameserver`) |
| `POST` | `/batch` | Batch lookup |
| `GET` | `/health` | Liveness → `{"status":"ok"}` |
| `GET` | `/ready` | Readiness → `200` (or `503` if not ready); no body |
| `GET` | `/version` | Service name, version, and active config |
| `GET` | `/metrics` | Prometheus text exposition (no authentication) |

```bash
curl http://localhost:8080/version
# {"name":"rdap-service","version":"0.7.0","config":{"cache_enabled":true,"server_port":8080,"timeout_seconds":5}}
```

---

## Running as a Service

### Single container (hardened)

```bash
docker run -d \
  --name rdapify-core \
  -p 8080:8080 \
  --read-only \
  --cap-drop=ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:size=16m \
  -e RDAPIFY_LOG_LEVEL=info \
  -e RDAPIFY_LOG_FORMAT=json \
  -e RDAPIFY_RDAP_TIMEOUT=5 \
  --restart unless-stopped \
  rdapify-core:local
```

### Docker Compose

See [`docker-compose.yml`](../docker-compose.yml) at the repo root, which already
wires the `rdapify-core` service with the `--read-only` / `--cap-drop=ALL` /
`no-new-privileges` hardening and `restart: unless-stopped`.

```bash
docker compose up -d --build
```

---

## Environment Variables

These are the variables the `rdap-service` binary actually honors
(`rdap-config/src/env.rs`). There is **no** `RUST_LOG` and **no** `RDAPIFY_HOST`.

| Variable | Default | Description |
|---|---|---|
| `RDAPIFY_LOG_LEVEL` | `info` | Log level (`error`/`warn`/`info`/`debug`/`trace`) |
| `RDAPIFY_LOG_FORMAT` | `json` | Log format (`json` or `pretty`) |
| `RDAPIFY_SERVER_PORT` | `8080` | TCP port to listen on |
| `RDAPIFY_RDAP_TIMEOUT` | `5` | Upstream RDAP fetch timeout (seconds) |
| `RDAPIFY_CACHE_TYPE` | `memory` | Cache backend: `memory` \| `sqlite` \| `postgres` |
| `RDAPIFY_SQLITE_PATH` | _(none)_ | SQLite cache path (when `RDAPIFY_CACHE_TYPE=sqlite`) |
| `RDAPIFY_LICENSE_PATH` | _(none)_ | License file path (Pro) |

Notes:

- **Bind address** defaults to `0.0.0.0` and is *not* env-overridable — change it
  only via a mounted `rdapify.toml` (`[server] host = ...`).
- **Cache TTL / size** (`3600 s` / `100000` entries) are *not* env-tunable —
  set `[cache] ttl_seconds` / `[cache] max_entries` in a mounted `rdapify.toml`.
- `RDAPIFY_METRICS_PORT` is parsed by the config layer but **not used** by
  `rdap-service` (it serves `/metrics` on the main listener).

To tune cache or bind address, mount a config file:

```bash
docker run ... -v ./rdapify.toml:/etc/rdapify/rdapify.toml:ro rdapify-core:local
```

---

## Health Checks

The image is **distroless** — it has no shell and no `curl`/`wget`, so an
in-container Docker `HEALTHCHECK` cannot run. Use **orchestrator-level HTTP
probes** against `/health` and `/ready` instead.

Kubernetes example:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
```

For a Compose healthcheck you would need a sidecar or a debug image variant that
includes a probe tool; the production distroless image intentionally does not.

---

## Prometheus Metrics

```bash
curl http://localhost:8080/metrics
```

Returns Prometheus text exposition (e.g. `http_requests_total`,
`http_request_duration_seconds`). The endpoint is **unauthenticated** — restrict
it with a network policy / ingress rule in production rather than exposing it
publicly. See [MONITORING.md](MONITORING.md) for the Grafana dashboard.

---

## Building Locally

The repo-root [`Dockerfile`](../Dockerfile) is a two-stage build:

1. **Builder** — `rust:1.88-slim-bookworm` + `musl-tools`, compiles
   `rdap-service` for `x86_64-unknown-linux-musl` (fully static). The release
   profile already strips symbols and enables LTO + `opt-level="z"`.
2. **Runtime** — `gcr.io/distroless/static-debian12:nonroot`, just the binary.

```bash
docker build -t rdapify-core:local .
docker run --rm -p 8080:8080 rdapify-core:local
```

> The build toolchain is pinned to `1.88`, which matches the workspace MSRV.
> The floor is dictated by dependencies in the resolved tree: `time` 0.3.47
> (security fix RUSTSEC-2026-0009), `napi-build` 1.88 (Node binding member), and
> edition-2024 manifests.

---

## Resource Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 0.1 vCPU | 0.5 vCPU |
| Memory | 32 MB | 128 MB |
| Disk | none | none |
| Network | Outbound HTTPS (443) | Outbound HTTPS (443) |

Memory scales with cache size (~2 KB per entry; 100k entries ≈ 200 MB worst case
— tune `[cache] max_entries`).

---

## Security Notes

- Runs as `nonroot` (UID 65532) — no `sudo`, no `setuid` binaries.
- Distroless base: no shell, no package manager, no `curl` — minimal pivot
  surface even under RCE.
- SSRF protection is enabled by default via `rdap-security::secure_fetch`
  (7-layer guard) — the service cannot be used to probe internal networks.
- Recommended runtime flags (already in `docker-compose.yml`):
  `--read-only --cap-drop=ALL --security-opt no-new-privileges:true`.
- `/metrics` is unauthenticated — protect it at the network layer.

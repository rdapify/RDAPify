# Multi-stage build for `rdap-service` with the `metrics` cargo feature on.
#
# Build context (set in docker-compose.yml): the rdapify-rust workspace root.
# Args:
#   FEATURES — cargo features for rdap-service (default: "metrics")
#
# This image is the rehearsal/reference deployment. It is not the production
# distroless image referenced in docs/PRODUCTION.md; that build is a separate
# pipeline.

ARG FEATURES=metrics

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM rust:1.77-slim-bookworm AS builder

ARG FEATURES
WORKDIR /workspace

# System packages required to link rustls + brotli + zstd transitively.
RUN apt-get update \
 && apt-get install -y --no-install-recommends pkg-config ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy the workspace. We avoid pre-vendoring so the build is reproducible
# from the source tree; cargo's incremental cache layer below speeds up
# successive rebuilds.
COPY . .

RUN cargo build --release \
        --bin rdap-service \
        -p rdap-service \
        --features "${FEATURES}"

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# `curl` is here for the healthcheck only. `ca-certificates` is required
# because rustls uses the system trust store for upstream RDAP TLS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --no-create-home --shell /sbin/nologin rdapify

COPY --from=builder /workspace/target/release/rdap-service /usr/local/bin/rdap-service

USER rdapify
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/rdap-service"]

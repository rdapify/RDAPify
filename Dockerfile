# syntax=docker/dockerfile:1.7
#
# RDAPify — standalone RDAP REST API microservice (rdap-service)
# -----------------------------------------------------------------------------
# Multi-stage build:
#   Stage 1 (builder) — compile rdap-service as a fully static musl binary.
#   Stage 2 (runtime) — distroless/static: no shell, no libc, nonroot.
#
# Why static musl: TLS is rustls + `ring` with bundled `webpki-roots`, so the
# binary carries its own CA trust store and has zero dynamic dependencies. This
# is the only base that satisfies BOTH the "distroless + nonroot" security
# invariant AND the CI-gated <= 15 MB image-size target (PERFORMANCE_SPEC.md).
# Release profile already sets strip=true, lto=true, opt-level="z", panic=abort.

###############################################################################
# Stage 1 — Builder
###############################################################################
# NOTE: workspace MSRV is 1.88. The floor is set by deps in the resolved tree:
# time 0.3.47 (security fix RUSTSEC-2026-0009), napi-build 1.88 (bindings/nodejs
# member), and edition-2024 manifests. See docs/DOCKER.md "Building Locally".
FROM rust:1.88-slim-bookworm AS builder

# musl cross toolchain — `ring` compiles its C/asm with musl-gcc.
# Relax apt signature/validity checks for THIS builder stage only: some build
# environments proxy deb.debian.org over plain HTTP and corrupt the InRelease
# signature. The runtime image pulls no packages, so this does not affect it.
RUN printf 'Acquire::Check-Valid-Until "false";\nAcquire::AllowInsecureRepositories "true";\n' \
      > /etc/apt/apt.conf.d/99-relax \
 && apt-get -o Acquire::AllowInsecureRepositories=true update \
 && apt-get install -y --no-install-recommends --allow-unauthenticated musl-tools \
 && rm -rf /var/lib/apt/lists/*

ARG TARGET=x86_64-unknown-linux-musl
RUN rustup target add ${TARGET}
ENV CC_x86_64_unknown_linux_musl=musl-gcc \
    CARGO_TERM_COLOR=never

WORKDIR /build

# Only the workspace manifests + crate sources are copied (see .dockerignore).
# `cargo build -p rdap-service` compiles just the service and its dep graph.
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
# bindings/nodejs is a workspace member — cargo needs its manifest+source to
# resolve the workspace, even though rdap-service does not depend on it.
COPY bindings/nodejs/ bindings/nodejs/

# BuildKit cache mounts keep the cargo registry and target dir warm across
# rebuilds. The binary is copied out so the cache mount can stay anonymous.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/build/target \
    cargo build --release --locked --target ${TARGET} -p rdap-service \
 && cp /build/target/${TARGET}/release/rdap-service /rdap-service

###############################################################################
# Stage 2 — Runtime
###############################################################################
FROM gcr.io/distroless/static-debian12:nonroot

LABEL org.opencontainers.image.title="rdapify-core" \
      org.opencontainers.image.description="RDAPify RDAP REST API microservice (rdap-service)" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.source="https://github.com/rdapify/RDAPify"

COPY --from=builder /rdap-service /usr/local/bin/rdap-service

# rdap-service binds 0.0.0.0:8080 by default (rdap-config ServerConfig).
# /metrics is served on this same listener (not a separate port).
EXPOSE 8080

# distroless :nonroot already runs as UID 65532; set it explicitly for clarity.
USER 65532:65532

ENTRYPOINT ["/usr/local/bin/rdap-service"]

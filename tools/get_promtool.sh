#!/usr/bin/env bash
#
# RDAPify — fetch promtool for alert-rule unit tests.
#
# Idempotent: if a matching promtool is already in tools/, this
# script exits 0 immediately without re-downloading.
#
# USAGE
#   tools/get_promtool.sh
#
# ENVIRONMENT
#   PROMTOOL_VERSION  (default: 3.11.3)
#                     Pinned for reproducibility. CI runs should use
#                     the default; bump it deliberately when promtool
#                     adds a feature the test suite depends on.
#
# OUTPUT
#   tools/promtool — the binary, verified by `--version`.
#
# DEPENDENCIES
#   bash, curl, tar. No jq, no GitHub API token required.
#
# EXIT CODES
#   0  promtool ready (already present or freshly downloaded)
#   1  download or extraction failed

set -euo pipefail

# Resolve the repo root from this script's location so the script
# works regardless of the caller's cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR"

# Default version. Override with: PROMTOOL_VERSION=3.x.y tools/get_promtool.sh
PROMTOOL_VERSION="${PROMTOOL_VERSION:-3.11.3}"

# Detect platform — the test suite is exercised on Linux x86_64.
# (Mac/Windows operators can adapt PLATFORM if needed.)
PLATFORM="${PLATFORM:-linux-amd64}"

# Idempotence: if the binary is already present and matches the
# pinned version, exit immediately.
if [[ -x "$TOOLS_DIR/promtool" ]]; then
    HAVE_VERSION=$("$TOOLS_DIR/promtool" --version 2>&1 | head -1 \
                   | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
    if [[ "$HAVE_VERSION" == "$PROMTOOL_VERSION" ]]; then
        echo "✓ promtool $PROMTOOL_VERSION already present at $TOOLS_DIR/promtool"
        exit 0
    fi
    echo "i  promtool present at version $HAVE_VERSION; pinned is $PROMTOOL_VERSION — replacing"
fi

# Build the asset URL. Pattern (verified against Prometheus releases):
#   https://github.com/prometheus/prometheus/releases/download/vX.Y.Z/prometheus-X.Y.Z.<platform>.tar.gz
ASSET="prometheus-${PROMTOOL_VERSION}.${PLATFORM}.tar.gz"
URL="https://github.com/prometheus/prometheus/releases/download/v${PROMTOOL_VERSION}/${ASSET}"

echo "→ Downloading promtool $PROMTOOL_VERSION ($PLATFORM)"
echo "  $URL"

cd "$TOOLS_DIR"

# Use a temp working dir so a partial extract can't pollute tools/.
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

if ! curl -fL --max-time 180 -o "$WORKDIR/$ASSET" "$URL"; then
    echo "✗ download failed: $URL" >&2
    exit 1
fi

# Extract just the promtool binary into the temp dir.
if ! tar -xzf "$WORKDIR/$ASSET" -C "$WORKDIR" --strip-components=1 \
        --wildcards "*/promtool"; then
    echo "✗ extract failed" >&2
    exit 1
fi

# Atomic install — write to a side path, then rename.
mv "$WORKDIR/promtool" "$TOOLS_DIR/promtool.new"
chmod +x "$TOOLS_DIR/promtool.new"
mv "$TOOLS_DIR/promtool.new" "$TOOLS_DIR/promtool"

# Verify.
HAVE_VERSION=$("$TOOLS_DIR/promtool" --version 2>&1 | head -1 \
               | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [[ "$HAVE_VERSION" != "$PROMTOOL_VERSION" ]]; then
    echo "✗ version mismatch after install: have $HAVE_VERSION, expected $PROMTOOL_VERSION" >&2
    exit 1
fi

echo "✓ promtool $PROMTOOL_VERSION installed at $TOOLS_DIR/promtool"
echo
echo "Next: run the alert-rule unit tests:"
echo "  ./tools/promtool test rules docs/observability/alert-tests/t8_rules_test.yaml"

#!/bin/bash

# RDAPify Enterprise Restructure Script
# This script reorganizes the project to Clean Architecture

set -e

echo "🚀 Starting RDAPify Enterprise Restructure..."

# Backup current src
echo "📦 Creating backup..."
cp -r src src_backup

# Create new structure
echo "📁 Creating new directory structure..."
mkdir -p src_new/{core/{domain/{entities,value-objects,errors},use-cases,ports},infrastructure/{cache,http,security},application/{client,services,dto},shared/{types,utils/{validators,formatters,helpers},constants,errors}}

# Copy shared utilities (already done)
echo "📋 Copying shared utilities..."
cp -r src/types/* src_new/shared/types/ 2>/dev/null || true
cp -r src/utils/validators/* src_new/shared/utils/validators/ 2>/dev/null || true
cp -r src/utils/helpers/* src_new/shared/utils/helpers/ 2>/dev/null || true

# Copy infrastructure implementations
echo "🔧 Copying infrastructure implementations..."
cp src/cache/InMemoryCache.ts src_new/infrastructure/cache/
cp src/cache/CacheManager.ts src_new/infrastructure/cache/
cp src/fetcher/Fetcher.ts src_new/infrastructure/http/
cp src/fetcher/BootstrapDiscovery.ts src_new/infrastructure/http/
cp src/fetcher/SSRFProtection.ts src_new/infrastructure/security/
cp src/normalizer/Normalizer.ts src_new/infrastructure/http/
cp src/normalizer/PIIRedactor.ts src_new/infrastructure/security/

# Copy application layer
echo "🎯 Copying application layer..."
cp src/client/RDAPClient.ts src_new/application/client/
cp src/client/QueryOrchestrator.ts src_new/application/services/

echo "✅ File structure created successfully!"
echo ""
echo "📊 Summary:"
echo "  - Shared layer: ✓"
echo "  - Core layer: ✓"
echo "  - Infrastructure layer: ✓"
echo "  - Application layer: ✓"
echo ""
echo "⚠️  Next steps:"
echo "  1. Update import paths in all files"
echo "  2. Run tests to verify functionality"
echo "  3. Update tsconfig.json if needed"
echo "  4. Replace src/ with src_new/ when ready"

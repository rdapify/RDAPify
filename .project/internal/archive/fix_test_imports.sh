#!/bin/bash

# Fix test import paths to match new structure

echo "🔧 Fixing test import paths..."

# Update all test files to use new paths
find tests -name "*.test.ts" -type f -exec sed -i \
  -e "s|from '../../src/cache/|from '../../src/infrastructure/cache/|g" \
  -e "s|from '../../src/fetcher/|from '../../src/infrastructure/http/|g" \
  -e "s|from '../../src/normalizer/|from '../../src/infrastructure/http/|g" \
  -e "s|from '../../src/client/|from '../../src/application/client/|g" \
  -e "s|from '../../src/types|from '../../src/shared/types|g" \
  -e "s|from '../../src/utils/helpers'|from '../../src/shared/utils/helpers'|g" \
  -e "s|from '../../src/utils/validators'|from '../../src/shared/utils/validators'|g" \
  {} \;

echo "✅ Test import paths fixed!"

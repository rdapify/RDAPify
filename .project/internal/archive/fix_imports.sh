#!/bin/bash

# Fix all import path issues in the new structure

echo "🔧 Fixing import paths..."

# Fix shared/utils/helpers/async.ts
sed -i "s|from '../../shared/types/options'|from '../../types/options'|g" src/shared/utils/helpers/async.ts

# Fix shared/utils/validators/*.ts
sed -i "s|from '../../shared/errors'|from '../../errors'|g" src/shared/utils/validators/asn.ts
sed -i "s|from '../../shared/errors'|from '../../errors'|g" src/shared/utils/validators/domain.ts
sed -i "s|from '../../shared/errors'|from '../../errors'|g" src/shared/utils/validators/ip.ts
sed -i "s|from '../../shared/errors'|from '../../errors'|g" src/shared/utils/validators/network.ts

# Fix infrastructure/http/Fetcher.ts
sed -i "s|from './SSRFProtection'|from '../security/SSRFProtection'|g" src/infrastructure/http/Fetcher.ts

# Fix application/services/index.ts (circular reference)
sed -i "s|from '../services'|from './QueryOrchestrator'|g" src/application/services/index.ts

echo "✅ Import paths fixed!"

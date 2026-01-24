#!/usr/bin/env python3
"""
Update import paths for the new Clean Architecture structure
"""

import os
import re
from pathlib import Path

# Import path mappings (old -> new)
IMPORT_MAPPINGS = {
    # Types
    r"from ['\"]\.\.\/types['\"]": "from '../../shared/types'",
    r"from ['\"]\.\.\/\.\.\/types['\"]": "from '../../shared/types'",
    r"from ['\"]\.\/types['\"]": "from '../shared/types'",
    
    # Errors
    r"from ['\"]\.\.\/types\/errors['\"]": "from '../../shared/errors'",
    r"from ['\"]\.\.\/\.\.\/types\/errors['\"]": "from '../../shared/errors'",
    
    # Options
    r"from ['\"]\.\.\/types\/options['\"]": "from '../../shared/types/options'",
    r"from ['\"]\.\.\/\.\.\/types\/options['\"]": "from '../../shared/types/options'",
    
    # Utils
    r"from ['\"]\.\.\/utils\/helpers['\"]": "from '../../shared/utils/helpers'",
    r"from ['\"]\.\.\/\.\.\/utils\/helpers['\"]": "from '../../shared/utils/helpers'",
    r"from ['\"]\.\.\/utils\/validators['\"]": "from '../../shared/utils/validators'",
    r"from ['\"]\.\.\/\.\.\/utils\/validators['\"]": "from '../../shared/utils/validators'",
    
    # Cache
    r"from ['\"]\.\.\/cache\/CacheManager['\"]": "from '../../infrastructure/cache'",
    r"from ['\"]\.\.\/cache\/InMemoryCache['\"]": "from '../../infrastructure/cache'",
    r"from ['\"]\.\/CacheManager['\"]": "from './CacheManager'",
    
    # Fetcher
    r"from ['\"]\.\.\/fetcher\/Fetcher['\"]": "from '../../infrastructure/http'",
    r"from ['\"]\.\.\/fetcher\/BootstrapDiscovery['\"]": "from '../../infrastructure/http'",
    r"from ['\"]\.\.\/fetcher\/SSRFProtection['\"]": "from '../../infrastructure/security'",
    r"from ['\"]\.\/Fetcher['\"]": "from './Fetcher'",
    
    # Normalizer
    r"from ['\"]\.\.\/normalizer\/Normalizer['\"]": "from '../../infrastructure/http'",
    r"from ['\"]\.\.\/normalizer\/PIIRedactor['\"]": "from '../../infrastructure/security'",
    
    # Client
    r"from ['\"]\.\/QueryOrchestrator['\"]": "from '../services'",
}

def update_file_imports(file_path):
    """Update imports in a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply all mappings
        for old_pattern, new_import in IMPORT_MAPPINGS.items():
            content = re.sub(old_pattern, new_import, content)
        
        # Only write if changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function"""
    src_new = Path('src_new')
    
    if not src_new.exists():
        print("❌ src_new directory not found!")
        return
    
    print("🔄 Updating import paths...")
    
    updated_count = 0
    total_count = 0
    
    # Process all TypeScript files
    for ts_file in src_new.rglob('*.ts'):
        total_count += 1
        if update_file_imports(ts_file):
            updated_count += 1
            print(f"  ✓ {ts_file.relative_to(src_new)}")
    
    print(f"\n✅ Updated {updated_count}/{total_count} files")

if __name__ == '__main__':
    main()

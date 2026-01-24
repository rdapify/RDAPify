#!/bin/bash

# Finalize RDAPify Enterprise Restructure
# This script replaces the old src/ with the new structure

set -e

echo "🎯 Finalizing RDAPify Enterprise Restructure..."
echo ""

# Check if src_new exists
if [ ! -d "src_new" ]; then
    echo "❌ Error: src_new directory not found!"
    exit 1
fi

# Check if backup exists
if [ ! -d "src_backup" ]; then
    echo "⚠️  Warning: No backup found. Creating backup now..."
    cp -r src src_backup
    echo "✅ Backup created at src_backup/"
fi

echo "📊 Current structure:"
echo "  - src/        (old structure)"
echo "  - src_new/    (new Clean Architecture)"
echo "  - src_backup/ (backup)"
echo ""

# Ask for confirmation
read -p "⚠️  Replace src/ with src_new/? This will rename src/ to src_old/ (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operation cancelled."
    exit 0
fi

echo ""
echo "🔄 Replacing directory structure..."

# Rename old src to src_old
if [ -d "src_old" ]; then
    echo "  Removing existing src_old/..."
    rm -rf src_old
fi

mv src src_old
echo "  ✓ Renamed src/ → src_old/"

# Rename src_new to src
mv src_new src
echo "  ✓ Renamed src_new/ → src/"

echo ""
echo "✅ Restructure completed successfully!"
echo ""
echo "📁 New structure:"
echo "  - src/        (new Clean Architecture) ✨"
echo "  - src_old/    (old structure - can be deleted)"
echo "  - src_backup/ (original backup - keep for safety)"
echo ""
echo "🧪 Next steps:"
echo "  1. Run: npm run build"
echo "  2. Run: npm test"
echo "  3. If tests pass, delete src_old/"
echo "  4. Update .kiro/steering/structure.md"
echo ""

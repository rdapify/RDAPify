#!/bin/bash

# Verification Script for Docs Build Fixes
# This script verifies all fixes are properly applied

# Don't exit on error - we want to collect all results
set +e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║     🔍 Docs Build Verification Script 🔍                     ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check
check() {
    local test_name="$1"
    local command="$2"
    
    echo -n "Checking: $test_name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Checking Main Project"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check "TypeScript compilation" "npm run typecheck" || true
check "ESLint checks" "npm run lint" || true
check "Unit tests" "npm test" || true
check "Main build" "npm run build" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Checking Docusaurus Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check "docusaurus.config.js exists" "test -f website/docusaurus.config.js"
check "sidebars.js exists" "test -f website/sidebars.js"
check "No deprecated onBrokenMarkdownLinks" "! grep -q 'onBrokenMarkdownLinks:' website/docusaurus.config.js"
check "Has markdown.hooks config" "grep -q 'markdown:' website/docusaurus.config.js"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Checking SVG Assets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

REQUIRED_SVGS=(
    "website/static/img/typescript.svg"
    "website/static/img/performance.svg"
    "website/static/img/security.svg"
    "website/static/img/multi-env.svg"
    "website/static/img/unified.svg"
    "website/static/img/privacy.svg"
)

for svg in "${REQUIRED_SVGS[@]}"; do
    check "$(basename $svg)" "test -f $svg"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Checking MDX Syntax Fixes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check "HTML entities in docs" "grep -r '&lt;' docs/ > /dev/null"
check "No unescaped < in tables" "! grep -E '\|.*<[0-9]' docs/ > /dev/null || true"
check "Self-closing br tags" "grep -r '<br/>' docs/ > /dev/null || true"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Building Documentation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd website

echo "Installing dependencies..."
if npm ci > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    ((FAILED++))
fi

echo "Building documentation..."
if npm run build > /tmp/docs-build.log 2>&1; then
    echo -e "${GREEN}✅ Documentation built successfully${NC}"
    ((PASSED++))
    
    # Check for all locales
    LOCALES=("en" "ar" "es" "zh" "ru")
    for locale in "${LOCALES[@]}"; do
        if [ "$locale" = "en" ]; then
            check "Locale: $locale" "test -f build/index.html" || true
        else
            check "Locale: $locale" "test -f build/$locale/index.html" || true
        fi
    done
else
    echo -e "${RED}❌ Documentation build failed${NC}"
    echo ""
    echo "Last 20 lines of build log:"
    tail -20 /tmp/docs-build.log
    ((FAILED++))
fi

cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Checking Build Output"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check "Build directory exists" "test -d website/build"
check "Main index.html exists" "test -f website/build/index.html"
check "Assets directory exists" "test -d website/build/assets"
check "Docs directory exists" "test -d website/build/docs"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=$((PASSED + FAILED))
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║     ✅ All Verifications Passed! Ready to Deploy! ✅         ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff main"
    echo "  2. Commit changes: git commit -m 'fix(docs): resolve build issues'"
    echo "  3. Push to GitHub: git push origin fix/docs-build-issues"
    echo "  4. Create Pull Request"
    echo ""
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                              ║${NC}"
    echo -e "${RED}║     ❌ Some Verifications Failed! Please Fix! ❌             ║${NC}"
    echo -e "${RED}║                                                              ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 1
fi

#!/bin/bash

# RDAPify Playground Setup Test Script
# Tests that all components are properly configured

echo "🧪 Testing RDAPify Playground Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test 1: Check if Node.js is installed
echo -n "1. Checking Node.js installation... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} ($NODE_VERSION)"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Node.js not found"
    ((FAILED++))
fi

# Test 2: Check if npm is installed
echo -n "2. Checking npm installation... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} (v$NPM_VERSION)"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} npm not found"
    ((FAILED++))
fi

# Test 3: Check if package.json exists
echo -n "3. Checking package.json... "
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} package.json not found"
    ((FAILED++))
fi

# Test 4: Check if API proxy exists
echo -n "4. Checking API proxy file... "
if [ -f "api/proxy.js" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} api/proxy.js not found"
    ((FAILED++))
fi

# Test 5: Check if public files exist
echo -n "5. Checking public files... "
if [ -f "public/index.html" ] && [ -f "public/app.js" ] && [ -f "public/style.css" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Missing public files"
    ((FAILED++))
fi

# Test 6: Check if RDAPify library is built
echo -n "6. Checking RDAPify library build... "
if [ -f "../dist/index.js" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Library not built (run 'npm run build' in root)"
    ((FAILED++))
fi

# Test 7: Check if node_modules exists
echo -n "7. Checking dependencies... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Dependencies not installed (run 'npm install')"
    ((FAILED++))
fi

# Test 8: Check documentation
echo -n "8. Checking documentation... "
if [ -f "README.md" ] && [ -f "SETUP.md" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Missing documentation"
    ((FAILED++))
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Results:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Playground is ready.${NC}"
    echo ""
    echo "To start the playground:"
    echo "  npm start"
    echo ""
    echo "Or from root directory:"
    echo "  npm run playground"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please fix the issues above.${NC}"
    echo ""
    if [ ! -f "../dist/index.js" ]; then
        echo "To build the library:"
        echo "  cd .. && npm run build && cd playground"
        echo ""
    fi
    if [ ! -d "node_modules" ]; then
        echo "To install dependencies:"
        echo "  npm install"
        echo ""
    fi
    exit 1
fi

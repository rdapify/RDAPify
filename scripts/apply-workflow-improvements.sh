#!/bin/bash

# =============================================================================
# GitHub Actions Workflows Improvement Script
# =============================================================================
# هذا السكريبت يطبق جميع التحسينات المقترحة على workflows
# الاستخدام: bash scripts/apply-workflow-improvements.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
MODIFIED_FILES=0
ERRORS=0

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                              ║${NC}"
echo -e "${BLUE}║     GitHub Actions Workflows Improvement Script             ║${NC}"
echo -e "${BLUE}║                                                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [ ! -d ".github/workflows" ]; then
    echo -e "${RED}❌ Error: .github/workflows directory not found${NC}"
    echo -e "${YELLOW}Please run this script from the project root${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found .github/workflows directory"
echo ""

# Backup workflows
BACKUP_DIR=".github/workflows.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${YELLOW}📦 Creating backup...${NC}"
cp -r .github/workflows "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} Backup created: $BACKUP_DIR"
echo ""

# Function to add content after a pattern
add_after_pattern() {
    local file=$1
    local pattern=$2
    local content=$3
    
    if grep -q "$pattern" "$file"; then
        # Create temp file with new content
        awk -v pattern="$pattern" -v content="$content" '
            {print}
            $0 ~ pattern && !found {
                print content
                found=1
            }
        ' "$file" > "$file.tmp"
        mv "$file.tmp" "$file"
        return 0
    fi
    return 1
}

# =============================================================================
# 1. Update ci.yml
# =============================================================================

echo -e "${BLUE}[1/7]${NC} Updating ci.yml..."
TOTAL_FILES=$((TOTAL_FILES + 1))

FILE=".github/workflows/ci.yml"

if [ -f "$FILE" ]; then
    # Add concurrency after pull_request
    if ! grep -q "concurrency:" "$FILE"; then
        sed -i '/pull_request:/a\
\
# Cancel in-progress runs for the same PR/branch\
concurrency:\
  group: ${{ github.workflow }}-${{ github.ref }}\
  cancel-in-progress: true\
\
permissions:\
  contents: read' "$FILE"
        
        # Add timeout to job
        sed -i '/runs-on: ubuntu-latest/a\    timeout-minutes: 15' "$FILE"
        
        echo -e "${GREEN}  ✓ Added concurrency, permissions, and timeout${NC}"
        MODIFIED_FILES=$((MODIFIED_FILES + 1))
    else
        echo -e "${YELLOW}  ⊙ Already has concurrency${NC}"
    fi
else
    echo -e "${RED}  ✗ File not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =============================================================================
# 2. Update deploy-website.yml
# =============================================================================

echo -e "${BLUE}[2/7]${NC} Updating deploy-website.yml..."
TOTAL_FILES=$((TOTAL_FILES + 1))

FILE=".github/workflows/deploy-website.yml"

if [ -f "$FILE" ]; then
    if ! grep -q "concurrency:" "$FILE"; then
        sed -i '/workflow_dispatch:/a\
\
# Prevent multiple deployments at once\
concurrency:\
  group: deploy-website\
  cancel-in-progress: false' "$FILE"
        
        sed -i '/runs-on: ubuntu-latest/a\    timeout-minutes: 20' "$FILE"
        
        echo -e "${GREEN}  ✓ Added concurrency and timeout${NC}"
        MODIFIED_FILES=$((MODIFIED_FILES + 1))
    else
        echo -e "${YELLOW}  ⊙ Already has concurrency${NC}"
    fi
else
    echo -e "${RED}  ✗ File not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =============================================================================
# 3. Update docs.yml
# =============================================================================

echo -e "${BLUE}[3/7]${NC} Updating docs.yml..."
TOTAL_FILES=$((TOTAL_FILES + 1))

FILE=".github/workflows/docs.yml"

if [ -f "$FILE" ]; then
    if ! grep -q "concurrency:" "$FILE"; then
        # Add concurrency and permissions at top
        sed -i '/^on:/i\
concurrency:\
  group: ${{ github.workflow }}-${{ github.ref }}\
  cancel-in-progress: true\
\
permissions:\
  contents: read\
' "$FILE"
        
        # Add timeouts to all jobs (simplified - adds after each runs-on)
        sed -i '/validate-links:/,/steps:/ s/runs-on: ubuntu-latest/runs-on: ubuntu-latest\n    timeout-minutes: 10\n    permissions:\n      contents: read/' "$FILE"
        
        echo -e "${GREEN}  ✓ Added concurrency, permissions, and timeouts${NC}"
        MODIFIED_FILES=$((MODIFIED_FILES + 1))
    else
        echo -e "${YELLOW}  ⊙ Already has concurrency${NC}"
    fi
else
    echo -e "${RED}  ✗ File not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =============================================================================
# 4. Update examples.yml
# =============================================================================

echo -e "${BLUE}[4/7]${NC} Updating examples.yml..."
TOTAL_FILES=$((TOTAL_FILES + 1))

FILE=".github/workflows/examples.yml"

if [ -f "$FILE" ]; then
    if ! grep -q "concurrency:" "$FILE"; then
        sed -i '/^on:/i\
concurrency:\
  group: ${{ github.workflow }}-${{ github.ref }}\
  cancel-in-progress: true\
\
permissions:\
  contents: read\
' "$FILE"
        
        sed -i '/runs-on: ubuntu-latest/a\    timeout-minutes: 10' "$FILE"
        
        echo -e "${GREEN}  ✓ Added concurrency, permissions, and timeout${NC}"
        MODIFIED_FILES=$((MODIFIED_FILES + 1))
    else
        echo -e "${YELLOW}  ⊙ Already has concurrency${NC}"
    fi
else
    echo -e "${RED}  ✗ File not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =============================================================================
# 5. Update release.yml
# =============================================================================

echo -e "${BLUE}[5/7]${NC} Updating release.yml..."
TOTAL_FILES=$((TOTAL_FILES + 1))

FILE=".github/workflows/release.yml"

if [ -f "$FILE" ]; then
    if ! grep -q "concurrency:" "$FILE"; then
        sed -i "/tags:/a\\
\\
# Prevent multiple releases at once\\
concurrency:\\
  group: release-\${{ github.ref }}\\
  cancel-in-progress: false\\
\\
permissions: {}" "$FILE"
        
        # Update softprops/action-gh-release to v2
        sed -i 's/softprops\/action-gh-release@v1/softprops\/action-gh-release@v2/g' "$FILE"
        
        echo -e "${GREEN}  ✓ Added concurrency, permissions, and updated action${NC}"
        MODIFIED_FILES=$((MODIFIED_FILES + 1))
    else
        echo -e "${YELLOW}  ⊙ Already has concurrency${NC}"
    fi
else
    echo -e "${RED}  ✗ File not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =============================================================================
# 6. Update security.yml
# =============================================================================

echo -e "${BLUE}[6/7]${NC} Updating security.yml..."
TOTAL_FILES=$((TOTAL_FILES + 1))

FILE=".github/workflows/security.yml"

if [ -f "$FILE" ]; then
    if ! grep -q "concurrency:" "$FILE"; then
        sed -i '/^on:/i\
concurrency:\
  group: ${{ github.workflow }}-${{ github.ref }}\
  cancel-in-progress: true\
\
permissions: {}\
' "$FILE"
        
        # Update Snyk action
        sed -i 's/snyk\/actions\/node@master/snyk\/actions\/node@0.4.0/g' "$FILE"
        
        echo -e "${GREEN}  ✓ Added concurrency, permissions, and updated Snyk${NC}"
        MODIFIED_FILES=$((MODIFIED_FILES + 1))
    else
        echo -e "${YELLOW}  ⊙ Already has concurrency${NC}"
    fi
else
    echo -e "${RED}  ✗ File not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =============================================================================
# 7. Update verify-docs-fix.yml
# =============================================================================

echo -e "${BLUE}[7/7]${NC} Updating verify-docs-fix.yml..."
TOTAL_FILES=$((TOTAL_FILES + 1))

FILE=".github/workflows/verify-docs-fix.yml"

if [ -f "$FILE" ]; then
    if ! grep -q "concurrency:" "$FILE"; then
        sed -i '/^on:/i\
concurrency:\
  group: ${{ github.workflow }}-${{ github.ref }}\
  cancel-in-progress: true\
\
permissions:\
  contents: read\
' "$FILE"
        
        sed -i '/runs-on: ubuntu-latest/a\    timeout-minutes: 20' "$FILE"
        
        echo -e "${GREEN}  ✓ Added concurrency, permissions, and timeout${NC}"
        MODIFIED_FILES=$((MODIFIED_FILES + 1))
    else
        echo -e "${YELLOW}  ⊙ Already has concurrency${NC}"
    fi
else
    echo -e "${RED}  ✗ File not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                              ║${NC}"
echo -e "${BLUE}║                    Summary                                   ║${NC}"
echo -e "${BLUE}║                                                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total files processed:  ${BLUE}$TOTAL_FILES${NC}"
echo -e "Files modified:         ${GREEN}$MODIFIED_FILES${NC}"
echo -e "Errors:                 ${RED}$ERRORS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All improvements applied successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  1. Review changes: ${BLUE}git diff .github/workflows/${NC}"
    echo -e "  2. Test locally if possible"
    echo -e "  3. Commit changes: ${BLUE}git add .github/workflows/ && git commit -m 'ci: improve workflows security and performance'${NC}"
    echo -e "  4. Push to GitHub: ${BLUE}git push${NC}"
    echo ""
    echo -e "${YELLOW}Backup location:${NC} $BACKUP_DIR"
    echo -e "${YELLOW}To restore:${NC} rm -rf .github/workflows && mv $BACKUP_DIR .github/workflows"
else
    echo -e "${RED}⚠️  Some errors occurred during the process${NC}"
    echo -e "${YELLOW}Please review the output above and fix manually${NC}"
    echo ""
    echo -e "${YELLOW}Backup location:${NC} $BACKUP_DIR"
    echo -e "${YELLOW}To restore:${NC} rm -rf .github/workflows && mv $BACKUP_DIR .github/workflows"
    exit 1
fi

echo ""
echo -e "${GREEN}Done! 🎉${NC}"

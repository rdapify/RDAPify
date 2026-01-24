#!/bin/bash

# Enterprise Restructure Script
# RDAPify Project - Phase 1: Cleanup & Archive
# Date: January 24, 2026

set -e  # Exit on error

echo "🚀 Starting Enterprise Restructure - Phase 1"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Error: package.json not found. Are you in the project root?"
    exit 1
fi

print_success "Found package.json - in correct directory"
echo ""

# Step 1: Create backup
echo "📦 Step 1: Creating backup..."
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup important directories before changes
if [ -d "src_backup" ]; then
    cp -r src_backup "$BACKUP_DIR/"
    print_success "Backed up src_backup/"
fi

if [ -d "docs/internal" ]; then
    cp -r docs/internal "$BACKUP_DIR/"
    print_success "Backed up docs/internal/"
fi

if [ -d "docs/restructure" ]; then
    cp -r docs/restructure "$BACKUP_DIR/"
    print_success "Backed up docs/restructure/"
fi

if [ -d "docs/project-management" ]; then
    cp -r docs/project-management "$BACKUP_DIR/"
    print_success "Backed up docs/project-management/"
fi

print_success "Backup created in $BACKUP_DIR/"
echo ""

# Step 2: Create new directory structure
echo "📁 Step 2: Creating new directory structure..."

# Create .project directory structure
mkdir -p .project/internal/{decisions,planning,archive}
mkdir -p .project/team/{onboarding,workflows,contacts}
mkdir -p .project/releases/{checklists,notes,planning}

print_success "Created .project/ directory structure"

# Create .vscode directory
mkdir -p .vscode

print_success "Created .vscode/ directory"
echo ""

# Step 3: Move internal documentation
echo "📝 Step 3: Moving internal documentation..."

# Move docs/internal/* to .project/internal/archive/
if [ -d "docs/internal" ]; then
    mv docs/internal/* .project/internal/archive/ 2>/dev/null || true
    rmdir docs/internal 2>/dev/null || true
    print_success "Moved docs/internal/ → .project/internal/archive/"
fi

# Move docs/restructure/* to .project/internal/archive/
if [ -d "docs/restructure" ]; then
    mv docs/restructure/* .project/internal/archive/ 2>/dev/null || true
    rmdir docs/restructure 2>/dev/null || true
    print_success "Moved docs/restructure/ → .project/internal/archive/"
fi

# Move docs/project-management/* to .project/internal/planning/
if [ -d "docs/project-management" ]; then
    mv docs/project-management/* .project/internal/planning/ 2>/dev/null || true
    rmdir docs/project-management 2>/dev/null || true
    print_success "Moved docs/project-management/ → .project/internal/planning/"
fi

echo ""

# Step 4: Move root documentation files
echo "📄 Step 4: Organizing root documentation..."

# Move detailed files to .project
if [ -f "RESTRUCTURE.md" ]; then
    mv RESTRUCTURE.md .project/internal/archive/
    print_success "Moved RESTRUCTURE.md → .project/internal/archive/"
fi

if [ -f "PUBLIC_RELEASE_READY.md" ]; then
    mv PUBLIC_RELEASE_READY.md .project/releases/
    print_success "Moved PUBLIC_RELEASE_READY.md → .project/releases/"
fi

if [ -f "PROJECT_STRUCTURE.md" ]; then
    mv PROJECT_STRUCTURE.md .project/internal/archive/
    print_success "Moved PROJECT_STRUCTURE.md → .project/internal/archive/"
fi

echo ""

# Step 5: Clean up temporary files
echo "🧹 Step 5: Cleaning up temporary files..."

# Remove src_backup if it exists
if [ -d "src_backup" ]; then
    print_warning "Removing src_backup/ (backed up in $BACKUP_DIR)"
    rm -rf src_backup/
    print_success "Removed src_backup/"
fi

# Clean build artifacts
if [ -d "dist" ]; then
    print_info "Removing dist/ (will be regenerated)"
    rm -rf dist/
    print_success "Removed dist/"
fi

if [ -d "coverage" ]; then
    print_info "Removing coverage/ (will be regenerated)"
    rm -rf coverage/
    print_success "Removed coverage/"
fi

# Clean node_modules cache
if [ -d "node_modules/.cache" ]; then
    print_info "Removing node_modules/.cache/"
    rm -rf node_modules/.cache/
    print_success "Removed node_modules/.cache/"
fi

echo ""

# Step 6: Rename test_vectors to test-vectors
echo "📦 Step 6: Renaming directories..."

if [ -d "test_vectors" ]; then
    mv test_vectors test-vectors
    print_success "Renamed test_vectors/ → test-vectors/"
fi

echo ""

# Step 7: Create VS Code settings
echo "⚙️  Step 7: Creating VS Code settings..."

cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/.git": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/.DS_Store": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/.project": true
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/coverage/**": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.wordWrap": "on"
  }
}
EOF

print_success "Created .vscode/settings.json"

cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "orta.vscode-jest",
    "streetsidesoftware.code-spell-checker",
    "eamodio.gitlens"
  ]
}
EOF

print_success "Created .vscode/extensions.json"

cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Current Test",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["${file}", "--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
EOF

print_success "Created .vscode/launch.json"

echo ""

# Step 8: Create .project README files
echo "📝 Step 8: Creating README files..."

cat > .project/README.md << 'EOF'
# Project Internal Documentation

This directory contains internal project documentation not meant for public distribution.

## Structure

- **internal/** - Internal documentation and archives
  - **decisions/** - Architecture Decision Records (ADRs)
  - **planning/** - Project planning documents
  - **archive/** - Archived documentation

- **team/** - Team information and workflows
  - **onboarding/** - New team member onboarding
  - **workflows/** - Team workflows and processes
  - **contacts/** - Team contact information

- **releases/** - Release management
  - **checklists/** - Release checklists
  - **notes/** - Release notes drafts
  - **planning/** - Release planning documents

## Usage

This directory is excluded from:
- npm package (via .npmignore)
- Git searches (via .vscode/settings.json)
- Public documentation

Keep sensitive information here, not in public docs.
EOF

print_success "Created .project/README.md"

cat > .project/internal/README.md << 'EOF'
# Internal Documentation

## Decisions
Architecture Decision Records (ADRs) documenting important technical decisions.

## Planning
Project planning documents, roadmaps, and strategy documents.

## Archive
Historical documentation and completed project artifacts.
EOF

print_success "Created .project/internal/README.md"

cat > .project/team/README.md << 'EOF'
# Team Documentation

## Onboarding
Resources for new team members.

## Workflows
Team processes and workflows.

## Contacts
Team contact information and communication channels.
EOF

print_success "Created .project/team/README.md"

cat > .project/releases/README.md << 'EOF'
# Release Management

## Checklists
Release checklists for different release types.

## Notes
Draft release notes and announcements.

## Planning
Release planning and scheduling documents.
EOF

print_success "Created .project/releases/README.md"

echo ""

# Step 9: Update .npmignore
echo "📦 Step 9: Updating .npmignore..."

if [ -f ".npmignore" ]; then
    # Add .project to .npmignore if not already there
    if ! grep -q "^\.project" .npmignore; then
        echo "" >> .npmignore
        echo "# Internal project files" >> .npmignore
        echo ".project/" >> .npmignore
        print_success "Added .project/ to .npmignore"
    fi
    
    # Add backup directories
    if ! grep -q "^backup-" .npmignore; then
        echo "backup-*/" >> .npmignore
        print_success "Added backup-*/ to .npmignore"
    fi
fi

echo ""

# Step 10: Update .gitignore
echo "🔒 Step 10: Updating .gitignore..."

if [ -f ".gitignore" ]; then
    # Add backup directories to .gitignore if not already there
    if ! grep -q "^backup-" .gitignore; then
        echo "" >> .gitignore
        echo "# Backup directories" >> .gitignore
        echo "backup-*/" >> .gitignore
        print_success "Added backup-*/ to .gitignore"
    fi
fi

echo ""

# Step 11: Verify structure
echo "✅ Step 11: Verifying new structure..."

# Check if key directories exist
directories=(
    ".project/internal/decisions"
    ".project/internal/planning"
    ".project/internal/archive"
    ".project/team/onboarding"
    ".project/team/workflows"
    ".project/releases/checklists"
    ".vscode"
)

all_good=true
for dir in "${directories[@]}"; do
    if [ -d "$dir" ]; then
        print_success "✓ $dir exists"
    else
        print_error "✗ $dir missing"
        all_good=false
    fi
done

echo ""

# Check if key files exist
files=(
    "ARCHITECTURE.md"
    "DEVELOPMENT.md"
    "RELEASE_PROCESS.md"
    "ENTERPRISE_RESTRUCTURE_PLAN.md"
    ".vscode/settings.json"
    ".vscode/extensions.json"
    ".vscode/launch.json"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file exists"
    else
        print_warning "⚠ $file missing (may need manual creation)"
    fi
done

echo ""

# Final summary
echo "=============================================="
echo "✨ Phase 1 Complete!"
echo "=============================================="
echo ""
print_success "Backup created: $BACKUP_DIR/"
print_success "Internal docs moved to: .project/"
print_success "VS Code settings created: .vscode/"
print_success "Root documentation organized"
echo ""
print_info "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Test build: npm run build"
echo "  3. Run tests: npm test"
echo "  4. Review backup: ls -la $BACKUP_DIR/"
echo ""
print_warning "Note: Backup directory is excluded from git"
print_warning "Keep backup until you verify everything works!"
echo ""

# Development Scripts

Utility scripts for development, testing, and maintenance.

## Available Scripts

### verify-api.js
Verifies public API stability across refactors.

```bash
npm run verify:api
```

**Purpose:**
- Ensures exported symbols remain stable
- Detects breaking changes in public API
- Maintains API snapshot for comparison

**Usage:**
- Run before releases to verify API stability
- Update snapshot after intentional API changes: `npm run verify:api:update`

### check-dependencies.js
Checks for outdated and vulnerable dependencies.

```bash
node scripts/check-dependencies.js
```

**Checks:**
- Outdated packages
- Security vulnerabilities
- Production dependencies only

**Output:**
- Lists outdated packages with available versions
- Reports security audit results
- Exits with error if vulnerabilities found

### test-coverage.js
Generates and analyzes test coverage reports.

```bash
node scripts/test-coverage.js
```

**Features:**
- Runs full test suite with coverage
- Generates HTML coverage report
- Displays coverage summary
- Enforces 80% coverage threshold

**Output:**
- Coverage percentages (lines, statements, functions, branches)
- HTML report location
- Fails if below threshold

### benchmark.js
Measures query performance and cache efficiency.

```bash
node scripts/benchmark.js
```

**Benchmarks:**
1. Cold cache performance (first queries)
2. Warm cache performance (cached queries)
3. Parallel query performance

**Requirements:**
- Project must be built first: `npm run build`

**Output:**
- Query duration in milliseconds
- Cache hit performance
- Parallel processing statistics

### generate-docs.js
Prepares documentation structure.

```bash
node scripts/generate-docs.js
```

**Purpose:**
- Ensures documentation directories exist
- Provides TypeDoc integration instructions

**Note:** For full API documentation generation, use TypeDoc:
```bash
npm install --save-dev typedoc
npx typedoc --out docs/api src/index.ts
```

## Running Scripts

### Via npm
```bash
npm run verify:api
npm run test:coverage
```

### Directly
```bash
node scripts/benchmark.js
node scripts/check-dependencies.js
```

### Make Executable
```bash
chmod +x scripts/*.js
./scripts/benchmark.js
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Verify API Stability
  run: npm run verify:api

- name: Check Dependencies
  run: node scripts/check-dependencies.js

- name: Test Coverage
  run: node scripts/test-coverage.js

- name: Run Benchmarks
  run: npm run build && node scripts/benchmark.js
```

### Pre-commit Hook
```bash
# .husky/pre-commit
npm run lint
npm run typecheck
npm run verify:api
```

### Pre-push Hook
```bash
# .husky/pre-push
npm test
node scripts/test-coverage.js
```

## Script Development Guidelines

When adding new scripts:

1. **Use ES Modules**: All scripts use `import` syntax
2. **Add Shebang**: Start with `#!/usr/bin/env node`
3. **Error Handling**: Exit with appropriate codes
4. **Documentation**: Add to this README
5. **npm Scripts**: Add to package.json if frequently used

## Common Patterns

### Exit Codes
```javascript
process.exit(0); // Success
process.exit(1); // Error
```

### Running Commands
```javascript
import { execSync } from 'child_process';

try {
  execSync('npm test', { stdio: 'inherit' });
} catch (error) {
  console.error('Command failed');
  process.exit(1);
}
```

### File Operations
```javascript
import fs from 'fs';
import path from 'path';

const filePath = path.join(__dirname, '..', 'file.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
```

## Troubleshooting

### "Cannot find module"
Ensure project is built:
```bash
npm run build
```

### Permission Denied
Make script executable:
```bash
chmod +x scripts/script-name.js
```

### ES Module Errors
Scripts use ES modules. Ensure package.json has:
```json
{
  "type": "module"
}
```

Or use `.mjs` extension for scripts.

## Maintenance

Scripts should be:
- ✅ Self-contained
- ✅ Well-documented
- ✅ Error-tolerant
- ✅ Fast to execute
- ✅ CI/CD friendly

Review and update scripts when:
- Project structure changes
- Dependencies are updated
- New workflows are introduced

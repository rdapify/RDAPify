/**
 * verify-versions.js
 * Ensures all hardcoded version references match package.json.
 * Runs in CI and as part of prepublishOnly.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const CURRENT = pkg.version;

const errors = [];
const warnings = [];

// Rules: [file, pattern, description]
const RULES = [
  ['src/index.ts', /@version\s+(\S+)/, '@version in index.ts'],
  ['src/index.ts', /VERSION\s*=\s*'([^']+)'/, 'VERSION export in index.ts'],
];

// Template files — should use ^MAJOR.MINOR
const TEMPLATE_FILES = [
  'templates/cloud/aws_lambda/package.json',
  'templates/cloud/azure_functions/package.json',
  'templates/cloud/google_cloud_run/package.json',
  'examples/frameworks/express_app/package.json',
  'examples/frameworks/nextjs_app/package.json',
];

console.log(`\nVerifying versions match ${CURRENT}...\n`);

// Check hardcoded version rules
for (const [file, pattern, description] of RULES) {
  try {
    const content = readFileSync(join(root, file), 'utf8');
    const match = content.match(pattern);
    if (match) {
      const found = match[1];
      if (found !== CURRENT) {
        errors.push(`  \u2717 ${description}\n    Found: ${found}\n    Expected: ${CURRENT}\n    File: ${file}`);
      } else {
        console.log(`  \u2713 ${description}`);
      }
    }
  } catch (e) {
    warnings.push(`  \u26A0 Could not read ${file}: ${e.message}`);
  }
}

// Check TelemetryExporter does NOT have hardcoded version
try {
  const telemetry = readFileSync(join(root, 'src/infrastructure/monitoring/TelemetryExporter.ts'), 'utf8');
  const hardcoded = telemetry.match(/RDAPIFY_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (hardcoded) {
    errors.push(`  \u2717 TelemetryExporter.ts has hardcoded RDAPIFY_VERSION = '${hardcoded[1]}'\n    It should read from package.json dynamically`);
  } else {
    console.log('  \u2713 TelemetryExporter.ts reads version dynamically');
  }
} catch (e) {
  warnings.push(`  \u26A0 Could not check TelemetryExporter.ts`);
}

// Check templates
for (const templateFile of TEMPLATE_FILES) {
  try {
    const content = JSON.parse(readFileSync(join(root, templateFile), 'utf8'));
    const dep = content.dependencies?.rdapify || content.devDependencies?.rdapify;
    if (dep) {
      const [major, minor] = CURRENT.split('.');
      if (!dep.startsWith(`^${major}.${minor}`)) {
        warnings.push(`  \u26A0 Template outdated: ${templateFile}\n    rdapify: "${dep}" \u2014 consider updating to "^${CURRENT}"`);
      } else {
        console.log(`  \u2713 Template: ${templateFile} (rdapify: ${dep})`);
      }
    }
  } catch (e) {
    warnings.push(`  \u26A0 Could not check template ${templateFile}`);
  }
}

// Check CHANGELOG has entry for current version
try {
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  if (!changelog.includes(`## [${CURRENT}]`)) {
    errors.push(`  \u2717 CHANGELOG.md missing entry for [${CURRENT}]\n    Add a [${CURRENT}] section before publishing`);
  } else {
    console.log(`  \u2713 CHANGELOG.md has entry for ${CURRENT}`);
  }
} catch (e) {
  warnings.push('  \u26A0 Could not read CHANGELOG.md');
}

// Report
if (warnings.length > 0) {
  console.log('\nWarnings:');
  warnings.forEach(w => console.log(w));
}

if (errors.length > 0) {
  console.log('\nErrors (must fix before publishing):');
  errors.forEach(e => console.log(e));
  console.log(`\n\u2717 Version verification failed (${errors.length} error(s))\n`);
  process.exit(1);
}

console.log(`\n\u2713 All version references match ${CURRENT}\n`);

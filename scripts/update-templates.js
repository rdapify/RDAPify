/**
 * update-templates.js
 * Updates rdapify version in all templates/examples to match package.json.
 * Runs automatically via the npm "version" hook on every bump.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const CURRENT = pkg.version;

const TEMPLATE_FILES = [
  'templates/cloud/aws_lambda/package.json',
  'templates/cloud/azure_functions/package.json',
  'templates/cloud/google_cloud_run/package.json',
  'examples/frameworks/express_app/package.json',
  'examples/frameworks/nextjs_app/package.json',
];

let updated = 0;

for (const templatePath of TEMPLATE_FILES) {
  const fullPath = join(root, templatePath);
  try {
    const content = JSON.parse(readFileSync(fullPath, 'utf8'));
    let changed = false;

    if (content.dependencies?.rdapify) {
      content.dependencies.rdapify = `^${CURRENT}`;
      changed = true;
    }
    if (content.devDependencies?.rdapify) {
      content.devDependencies.rdapify = `^${CURRENT}`;
      changed = true;
    }

    if (changed) {
      writeFileSync(fullPath, JSON.stringify(content, null, 2) + '\n');
      console.log(`  \u2713 Updated ${templatePath} \u2192 ^${CURRENT}`);
      updated++;
    }
  } catch (e) {
    console.log(`  \u26A0 Skipped ${templatePath}: ${e.message}`);
  }
}

console.log(`\nUpdated ${updated} template(s) to ^${CURRENT}`);

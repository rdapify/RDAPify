#!/usr/bin/env node
/**
 * Documentation Generation Script
 * Generates API documentation from TypeScript source
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '..', 'src');
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'api_reference');

console.log('📚 Generating API documentation...\n');

// Check if source exists
if (!fs.existsSync(SRC_DIR)) {
  console.error('❌ Source directory not found');
  process.exit(1);
}

// Ensure docs directory exists
fs.mkdirSync(DOCS_DIR, { recursive: true });

console.log('Source:', SRC_DIR);
console.log('Output:', DOCS_DIR);
console.log('\n✅ Documentation structure ready');
console.log('\nNote: For full TypeDoc generation, install and run:');
console.log('  npm install --save-dev typedoc');
console.log('  npx typedoc --out docs/api src/index.ts');

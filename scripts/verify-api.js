/**
 * Public API verification script
 * Ensures exported symbols remain stable across refactors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const SNAPSHOT_PATH = path.join(__dirname, '..', 'api-snapshot.json');
const DIST_PATH = path.join(__dirname, '..', 'dist', 'index.js');

// Check if dist exists
if (!fs.existsSync(DIST_PATH)) {
  console.error('❌ dist/index.js not found. Run `npm run build` first.');
  process.exit(1);
}

// Load the built module
const api = require(DIST_PATH);

// Extract exported symbols
const exports = Object.keys(api).sort();
const snapshot = JSON.stringify(exports, null, 2);

console.log('📦 Exported symbols:', exports.length);

// Check if snapshot exists
if (fs.existsSync(SNAPSHOT_PATH)) {
  const existing = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
  
  if (existing !== snapshot) {
    console.error('\n❌ Public API has changed!\n');
    
    const existingExports = JSON.parse(existing);
    const currentExports = exports;
    
    const added = currentExports.filter(e => !existingExports.includes(e));
    const removed = existingExports.filter(e => !currentExports.includes(e));
    
    if (added.length > 0) {
      console.error('➕ Added exports:', added);
    }
    if (removed.length > 0) {
      console.error('➖ Removed exports:', removed);
    }
    
    console.error('\nExpected:', existingExports.length, 'exports');
    console.error('Got:', currentExports.length, 'exports');
    console.error('\nTo update snapshot: npm run verify:api:update');
    process.exit(1);
  }
  
  console.log('✅ Public API unchanged');
} else {
  fs.writeFileSync(SNAPSHOT_PATH, snapshot);
  console.log('✅ API snapshot created');
  console.log('\nExported symbols:');
  exports.forEach(e => console.log(`  - ${e}`));
}

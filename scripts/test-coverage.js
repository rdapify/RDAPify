#!/usr/bin/env node
/**
 * Test Coverage Report Script
 * Generates and displays test coverage statistics
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running tests with coverage...\n');

try {
  // Run tests with coverage
  execSync('npm run test:coverage', { stdio: 'inherit' });

  // Check if coverage directory exists
  const coverageDir = path.join(__dirname, '..', 'coverage');
  if (fs.existsSync(coverageDir)) {
    console.log('\n✅ Coverage report generated');
    console.log(`📊 View report: file://${path.join(coverageDir, 'lcov-report', 'index.html')}`);

    // Read coverage summary if available
    const summaryPath = path.join(coverageDir, 'coverage-summary.json');
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      const total = summary.total;

      console.log('\n📈 Coverage Summary:');
      console.log('='.repeat(60));
      console.log(`Lines:      ${total.lines.pct}%`);
      console.log(`Statements: ${total.statements.pct}%`);
      console.log(`Functions:  ${total.functions.pct}%`);
      console.log(`Branches:   ${total.branches.pct}%`);

      // Check if coverage meets threshold
      const threshold = 80;
      if (total.lines.pct < threshold) {
        console.log(`\n⚠️  Coverage below ${threshold}% threshold`);
        process.exit(1);
      }
    }
  }
} catch (error) {
  console.error('\n❌ Test coverage failed');
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Dependency Security Check Script
 * Checks for outdated and vulnerable dependencies
 */

import { execSync } from 'child_process';

console.log('🔍 Checking dependencies...\n');

// Check for outdated packages
console.log('📦 Outdated packages:');
console.log('='.repeat(60));
try {
  execSync('npm outdated', { stdio: 'inherit' });
} catch (error) {
  // npm outdated exits with code 1 if there are outdated packages
  // This is expected behavior
}

console.log('\n🔒 Security audit:');
console.log('='.repeat(60));
try {
  execSync('npm audit --production', { stdio: 'inherit' });
  console.log('\n✅ No security vulnerabilities found');
} catch (error) {
  console.log('\n⚠️  Security vulnerabilities detected');
  console.log('Run: npm audit fix');
  process.exit(1);
}

/**
 * Compliance Checker Example
 * Validates domain registration data for compliance requirements
 */

const { RDAPClient } = require('rdapify');

class ComplianceChecker {
  constructor(rules = {}) {
    this.client = new RDAPClient({
      cache: true,
      privacy: { redactPII: true },
    });

    this.rules = {
      requireTransferLock: rules.requireTransferLock ?? true,
      requireUpdateLock: rules.requireUpdateLock ?? false,
      minDaysUntilExpiration: rules.minDaysUntilExpiration ?? 30,
      requireRegistrarInfo: rules.requireRegistrarInfo ?? true,
      requireNameservers: rules.requireNameservers ?? true,
      minNameservers: rules.minNameservers ?? 2,
      allowedCountries: rules.allowedCountries ?? null,
    };
  }

  async checkDomain(domain) {
    const violations = [];
    const warnings = [];

    try {
      const result = await this.client.domain(domain);

      // Check transfer lock
      if (this.rules.requireTransferLock) {
        const hasTransferLock = result.status?.some(
          (s) => s.includes('Transfer') && s.includes('Prohibited')
        );
        if (!hasTransferLock) {
          violations.push({
            rule: 'TRANSFER_LOCK_REQUIRED',
            severity: 'high',
            message: 'Domain must have transfer lock enabled',
          });
        }
      }

      // Check update lock
      if (this.rules.requireUpdateLock) {
        const hasUpdateLock = result.status?.some(
          (s) => s.includes('Update') && s.includes('Prohibited')
        );
        if (!hasUpdateLock) {
          violations.push({
            rule: 'UPDATE_LOCK_REQUIRED',
            severity: 'medium',
            message: 'Domain should have update lock enabled',
          });
        }
      }

      // Check expiration date
      const expirationEvent = result.events?.find((e) => e.type === 'expiration');
      if (expirationEvent) {
        const expirationDate = new Date(expirationEvent.date);
        const daysUntilExpiration = Math.ceil(
          (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiration < this.rules.minDaysUntilExpiration) {
          violations.push({
            rule: 'EXPIRATION_TOO_SOON',
            severity: 'high',
            message: `Domain expires in ${daysUntilExpiration} days (minimum: ${this.rules.minDaysUntilExpiration})`,
            data: { daysUntilExpiration },
          });
        }
      } else {
        warnings.push({
          rule: 'NO_EXPIRATION_DATE',
          message: 'No expiration date found',
        });
      }

      // Check registrar information
      if (this.rules.requireRegistrarInfo) {
        const hasRegistrar = result.entities?.some((e) => e.roles?.includes('registrar'));
        if (!hasRegistrar) {
          violations.push({
            rule: 'REGISTRAR_INFO_REQUIRED',
            severity: 'medium',
            message: 'Registrar information is required',
          });
        }
      }

      // Check nameservers
      if (this.rules.requireNameservers) {
        const nsCount = result.nameservers?.length || 0;
        if (nsCount === 0) {
          violations.push({
            rule: 'NAMESERVERS_REQUIRED',
            severity: 'high',
            message: 'Domain must have nameservers configured',
          });
        } else if (nsCount < this.rules.minNameservers) {
          warnings.push({
            rule: 'INSUFFICIENT_NAMESERVERS',
            message: `Domain has ${nsCount} nameservers (recommended: ${this.rules.minNameservers})`,
          });
        }
      }

      // Check country restrictions
      if (this.rules.allowedCountries && result.country) {
        if (!this.rules.allowedCountries.includes(result.country)) {
          violations.push({
            rule: 'COUNTRY_NOT_ALLOWED',
            severity: 'high',
            message: `Domain registered in ${result.country} (allowed: ${this.rules.allowedCountries.join(', ')})`,
          });
        }
      }

      const isCompliant = violations.length === 0;

      return {
        domain,
        compliant: isCompliant,
        violations,
        warnings,
        summary: {
          totalViolations: violations.length,
          highSeverity: violations.filter((v) => v.severity === 'high').length,
          mediumSeverity: violations.filter((v) => v.severity === 'medium').length,
          totalWarnings: warnings.length,
        },
      };
    } catch (error) {
      return {
        domain,
        compliant: false,
        error: error.message,
        violations: [
          {
            rule: 'QUERY_FAILED',
            severity: 'high',
            message: `Failed to query domain: ${error.message}`,
          },
        ],
        warnings: [],
      };
    }
  }

  async checkMultipleDomains(domains) {
    console.log(`Checking compliance for ${domains.length} domains...\n`);

    const results = await Promise.all(domains.map((domain) => this.checkDomain(domain)));

    return results;
  }

  generateReport(results) {
    console.log('='.repeat(60));
    console.log('COMPLIANCE REPORT');
    console.log('='.repeat(60));

    const compliant = results.filter((r) => r.compliant);
    const nonCompliant = results.filter((r) => !r.compliant);

    console.log(`\nTotal Domains: ${results.length}`);
    console.log(`Compliant: ${compliant.length} (${((compliant.length / results.length) * 100).toFixed(1)}%)`);
    console.log(`Non-Compliant: ${nonCompliant.length}`);

    if (nonCompliant.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('NON-COMPLIANT DOMAINS:');
      console.log('='.repeat(60));

      nonCompliant.forEach((result) => {
        console.log(`\n${result.domain}:`);
        console.log(`  Violations: ${result.summary.totalViolations}`);
        console.log(`  High Severity: ${result.summary.highSeverity}`);
        console.log(`  Medium Severity: ${result.summary.mediumSeverity}`);
        console.log(`  Warnings: ${result.summary.totalWarnings}`);

        if (result.violations.length > 0) {
          console.log('\n  Issues:');
          result.violations.forEach((v) => {
            const icon = v.severity === 'high' ? '🔴' : '🟡';
            console.log(`    ${icon} [${v.severity.toUpperCase()}] ${v.message}`);
          });
        }

        if (result.warnings.length > 0) {
          console.log('\n  Warnings:');
          result.warnings.forEach((w) => {
            console.log(`    ⚠️  ${w.message}`);
          });
        }
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

async function main() {
  // Define compliance rules
  const checker = new ComplianceChecker({
    requireTransferLock: true,
    requireUpdateLock: false,
    minDaysUntilExpiration: 30,
    requireRegistrarInfo: true,
    requireNameservers: true,
    minNameservers: 2,
    allowedCountries: null, // null = all countries allowed
  });

  // Domains to check
  const domains = ['example.com', 'google.com', 'github.com'];

  console.log('Compliance Checker Example\n');
  console.log('Active Rules:');
  console.log('  - Transfer lock required');
  console.log('  - Minimum 30 days until expiration');
  console.log('  - Registrar information required');
  console.log('  - Minimum 2 nameservers required\n');

  // Run compliance check
  const results = await checker.checkMultipleDomains(domains);

  // Generate report
  checker.generateReport(results);

  // Export results as JSON
  console.log('\nExporting results to JSON...');
  const exportData = {
    timestamp: new Date().toISOString(),
    totalDomains: results.length,
    compliant: results.filter((r) => r.compliant).length,
    results,
  };

  console.log(JSON.stringify(exportData, null, 2));
}

main().catch(console.error);

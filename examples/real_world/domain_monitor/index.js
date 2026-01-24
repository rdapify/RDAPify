/**
 * Domain Monitor Example
 * Monitors domain expiration dates and sends alerts
 */

const { RDAPClient } = require('rdapify');

class DomainMonitor {
  constructor(options = {}) {
    this.client = new RDAPClient({
      cache: true,
      privacy: { redactPII: true },
    });

    this.alertThresholds = {
      critical: options.criticalDays || 7,
      warning: options.warningDays || 30,
      info: options.infoDays || 60,
    };
  }

  async checkDomain(domain) {
    try {
      const result = await this.client.domain(domain);

      // Find expiration event
      const expirationEvent = result.events?.find((e) => e.type === 'expiration');

      if (!expirationEvent) {
        return {
          domain,
          status: 'unknown',
          message: 'No expiration date found',
        };
      }

      const expirationDate = new Date(expirationEvent.date);
      const now = new Date();
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine alert level
      let alertLevel = 'ok';
      if (daysUntilExpiration <= 0) {
        alertLevel = 'expired';
      } else if (daysUntilExpiration <= this.alertThresholds.critical) {
        alertLevel = 'critical';
      } else if (daysUntilExpiration <= this.alertThresholds.warning) {
        alertLevel = 'warning';
      } else if (daysUntilExpiration <= this.alertThresholds.info) {
        alertLevel = 'info';
      }

      return {
        domain,
        status: result.status?.[0] || 'unknown',
        expirationDate: expirationDate.toISOString(),
        daysUntilExpiration,
        alertLevel,
        message: this.getAlertMessage(alertLevel, daysUntilExpiration),
      };
    } catch (error) {
      return {
        domain,
        status: 'error',
        error: error.message,
      };
    }
  }

  getAlertMessage(level, days) {
    switch (level) {
      case 'expired':
        return '🔴 EXPIRED - Domain has expired!';
      case 'critical':
        return `🔴 CRITICAL - Expires in ${days} days!`;
      case 'warning':
        return `🟡 WARNING - Expires in ${days} days`;
      case 'info':
        return `🔵 INFO - Expires in ${days} days`;
      default:
        return `✅ OK - Expires in ${days} days`;
    }
  }

  async monitorDomains(domains) {
    console.log(`Monitoring ${domains.length} domains...\n`);

    const results = await Promise.all(domains.map((domain) => this.checkDomain(domain)));

    // Group by alert level
    const grouped = {
      expired: [],
      critical: [],
      warning: [],
      info: [],
      ok: [],
      error: [],
    };

    results.forEach((result) => {
      const level = result.alertLevel || 'error';
      grouped[level].push(result);
    });

    return { results, grouped };
  }

  displayReport(monitoringResult) {
    const { results, grouped } = monitoringResult;

    console.log('='.repeat(60));
    console.log('DOMAIN EXPIRATION MONITORING REPORT');
    console.log('='.repeat(60));
    console.log(`Total Domains: ${results.length}`);
    console.log(`Expired: ${grouped.expired.length}`);
    console.log(`Critical: ${grouped.critical.length}`);
    console.log(`Warning: ${grouped.warning.length}`);
    console.log(`Info: ${grouped.info.length}`);
    console.log(`OK: ${grouped.ok.length}`);
    console.log(`Errors: ${grouped.error.length}`);
    console.log('='.repeat(60));

    // Display critical and expired domains
    if (grouped.expired.length > 0) {
      console.log('\n🔴 EXPIRED DOMAINS:');
      grouped.expired.forEach((r) => {
        console.log(`  ${r.domain} - ${r.message}`);
      });
    }

    if (grouped.critical.length > 0) {
      console.log('\n🔴 CRITICAL ALERTS:');
      grouped.critical.forEach((r) => {
        console.log(`  ${r.domain} - ${r.message}`);
        console.log(`     Expires: ${new Date(r.expirationDate).toLocaleDateString()}`);
      });
    }

    if (grouped.warning.length > 0) {
      console.log('\n🟡 WARNING ALERTS:');
      grouped.warning.forEach((r) => {
        console.log(`  ${r.domain} - ${r.message}`);
      });
    }

    if (grouped.error.length > 0) {
      console.log('\n❌ ERRORS:');
      grouped.error.forEach((r) => {
        console.log(`  ${r.domain} - ${r.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

async function main() {
  // List of domains to monitor
  const domains = [
    'example.com',
    'google.com',
    'github.com',
    'cloudflare.com',
    'amazon.com',
  ];

  // Create monitor with custom thresholds
  const monitor = new DomainMonitor({
    criticalDays: 7,
    warningDays: 30,
    infoDays: 60,
  });

  // Run monitoring
  const result = await monitor.monitorDomains(domains);

  // Display report
  monitor.displayReport(result);

  // Example: Send alerts (implement your own notification logic)
  const criticalDomains = result.grouped.critical.concat(result.grouped.expired);
  if (criticalDomains.length > 0) {
    console.log('\n📧 Sending alerts for critical domains...');
    // sendEmailAlert(criticalDomains);
    // sendSlackNotification(criticalDomains);
  }
}

main().catch(console.error);

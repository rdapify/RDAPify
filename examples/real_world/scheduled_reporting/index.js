/**
 * Scheduled Reporting Example
 * Generates periodic RDAP reports for domain portfolios
 */

const { RDAPClient } = require('rdapify');
const fs = require('fs').promises;
const path = require('path');

class ScheduledReporter {
  constructor(options = {}) {
    this.client = new RDAPClient({
      cache: true,
      privacy: { redactPII: true },
    });

    this.outputDir = options.outputDir || './reports';
    this.reportFormat = options.reportFormat || 'json'; // json, csv, html
  }

  async generateDomainReport(domains) {
    console.log(`Generating report for ${domains.length} domains...`);

    const results = await Promise.allSettled(
      domains.map((domain) => this.client.domain(domain))
    );

    const report = {
      timestamp: new Date().toISOString(),
      totalDomains: domains.length,
      successful: 0,
      failed: 0,
      domains: [],
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        report.successful++;

        // Extract key information
        const expirationEvent = data.events?.find((e) => e.type === 'expiration');
        const registrationEvent = data.events?.find((e) => e.type === 'registration');

        report.domains.push({
          domain: data.ldhName,
          status: data.status?.[0] || 'unknown',
          registrar: data.entities?.find((e) => e.roles?.includes('registrar'))?.handle || 'N/A',
          nameservers: data.nameservers || [],
          registered: registrationEvent?.date || null,
          expires: expirationEvent?.date || null,
          daysUntilExpiration: expirationEvent
            ? Math.ceil((new Date(expirationEvent.date) - new Date()) / (1000 * 60 * 60 * 24))
            : null,
        });
      } else {
        report.failed++;
        report.domains.push({
          domain: domains[index],
          status: 'error',
          error: result.reason.message,
        });
      }
    });

    return report;
  }

  async saveReport(report, filename) {
    await fs.mkdir(this.outputDir, { recursive: true });

    const filepath = path.join(this.outputDir, filename);

    if (this.reportFormat === 'json') {
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    } else if (this.reportFormat === 'csv') {
      const csv = this.convertToCSV(report);
      await fs.writeFile(filepath, csv);
    } else if (this.reportFormat === 'html') {
      const html = this.convertToHTML(report);
      await fs.writeFile(filepath, html);
    }

    console.log(`Report saved to: ${filepath}`);
    return filepath;
  }

  convertToCSV(report) {
    const headers = [
      'Domain',
      'Status',
      'Registrar',
      'Nameservers',
      'Registered',
      'Expires',
      'Days Until Expiration',
    ];

    const rows = report.domains.map((d) => [
      d.domain,
      d.status,
      d.registrar || 'N/A',
      d.nameservers?.join(';') || 'N/A',
      d.registered || 'N/A',
      d.expires || 'N/A',
      d.daysUntilExpiration || 'N/A',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  convertToHTML(report) {
    const rows = report.domains
      .map(
        (d) => `
      <tr>
        <td>${d.domain}</td>
        <td>${d.status}</td>
        <td>${d.registrar || 'N/A'}</td>
        <td>${d.nameservers?.length || 0}</td>
        <td>${d.registered ? new Date(d.registered).toLocaleDateString() : 'N/A'}</td>
        <td>${d.expires ? new Date(d.expires).toLocaleDateString() : 'N/A'}</td>
        <td>${d.daysUntilExpiration || 'N/A'}</td>
      </tr>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Domain Report - ${new Date(report.timestamp).toLocaleDateString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>Domain Portfolio Report</h1>
  <div class="summary">
    <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
    <p><strong>Total Domains:</strong> ${report.totalDomains}</p>
    <p><strong>Successful:</strong> ${report.successful}</p>
    <p><strong>Failed:</strong> ${report.failed}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Domain</th>
        <th>Status</th>
        <th>Registrar</th>
        <th>Nameservers</th>
        <th>Registered</th>
        <th>Expires</th>
        <th>Days Until Expiration</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
    `;
  }

  async runScheduledReport(domains, schedule = 'daily') {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `domain-report-${schedule}-${timestamp}.${this.reportFormat}`;

    console.log(`\nRunning ${schedule} report...`);
    console.log(`Timestamp: ${new Date().toLocaleString()}\n`);

    const report = await this.generateDomainReport(domains);

    // Display summary
    console.log('\nReport Summary:');
    console.log(`  Total: ${report.totalDomains}`);
    console.log(`  Successful: ${report.successful}`);
    console.log(`  Failed: ${report.failed}`);

    // Highlight expiring domains
    const expiringSoon = report.domains.filter(
      (d) => d.daysUntilExpiration && d.daysUntilExpiration <= 30
    );

    if (expiringSoon.length > 0) {
      console.log(`\n⚠️  Domains expiring within 30 days: ${expiringSoon.length}`);
      expiringSoon.forEach((d) => {
        console.log(`    ${d.domain} - ${d.daysUntilExpiration} days`);
      });
    }

    // Save report
    await this.saveReport(report, filename);

    return report;
  }
}

async function main() {
  // Domain portfolio to monitor
  const domains = ['example.com', 'google.com', 'github.com', 'cloudflare.com'];

  // Create reporter with HTML format
  const reporter = new ScheduledReporter({
    outputDir: './reports',
    reportFormat: 'html', // or 'json', 'csv'
  });

  console.log('Scheduled Reporting Example\n');

  // Generate daily report
  await reporter.runScheduledReport(domains, 'daily');

  console.log('\n' + '='.repeat(60));
  console.log('Report generation complete!');
  console.log('='.repeat(60));

  // Example: Schedule with cron (requires node-cron package)
  // const cron = require('node-cron');
  //
  // // Run daily at 9 AM
  // cron.schedule('0 9 * * *', async () => {
  //   await reporter.runScheduledReport(domains, 'daily');
  // });
  //
  // // Run weekly on Monday at 9 AM
  // cron.schedule('0 9 * * 1', async () => {
  //   await reporter.runScheduledReport(domains, 'weekly');
  // });
  //
  // // Run monthly on 1st at 9 AM
  // cron.schedule('0 9 1 * *', async () => {
  //   await reporter.runScheduledReport(domains, 'monthly');
  // });
}

main().catch(console.error);

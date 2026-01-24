# Scheduled Reporting

Generates periodic RDAP reports for domain portfolios with multiple output formats.

## Features

- Multiple report formats (JSON, CSV, HTML)
- Scheduled report generation
- Expiration alerts
- Portfolio summary statistics
- File-based report storage

## Usage

```bash
node index.js
```

## Report Formats

### JSON
```javascript
const reporter = new ScheduledReporter({
  outputDir: './reports',
  reportFormat: 'json'
});
```

### CSV
```javascript
const reporter = new ScheduledReporter({
  outputDir: './reports',
  reportFormat: 'csv'
});
```

### HTML
```javascript
const reporter = new ScheduledReporter({
  outputDir: './reports',
  reportFormat: 'html'
});
```

## Scheduling

### Using node-cron

```bash
npm install node-cron
```

```javascript
const cron = require('node-cron');

// Daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  await reporter.runScheduledReport(domains, 'daily');
});

// Weekly on Monday
cron.schedule('0 9 * * 1', async () => {
  await reporter.runScheduledReport(domains, 'weekly');
});

// Monthly on 1st
cron.schedule('0 9 1 * *', async () => {
  await reporter.runScheduledReport(domains, 'monthly');
});
```

### Using System Cron

```bash
# Edit crontab
crontab -e

# Add daily report at 9 AM
0 9 * * * cd /path/to/project && node index.js
```

## Use Cases

- **Portfolio Management**: Regular domain inventory reports
- **Executive Reporting**: Monthly domain status summaries
- **Compliance**: Scheduled compliance documentation
- **Audit Trail**: Historical domain data tracking
- **Renewal Planning**: Expiration tracking and alerts

## Report Contents

Each report includes:
- Domain name
- Current status
- Registrar information
- Nameserver count
- Registration date
- Expiration date
- Days until expiration
- Error information (if query failed)

## Integration Examples

### Email Reports
```javascript
const nodemailer = require('nodemailer');

async function emailReport(filepath) {
  const transporter = nodemailer.createTransporter({...});
  
  await transporter.sendMail({
    to: 'admin@example.com',
    subject: 'Daily Domain Report',
    html: await fs.readFile(filepath, 'utf8'),
  });
}
```

### Cloud Storage
```javascript
const { S3 } = require('@aws-sdk/client-s3');

async function uploadToS3(filepath) {
  const s3 = new S3({...});
  const fileContent = await fs.readFile(filepath);
  
  await s3.putObject({
    Bucket: 'domain-reports',
    Key: path.basename(filepath),
    Body: fileContent,
  });
}
```

### Database Storage
```javascript
async function saveToDatabase(report) {
  await db.reports.insert({
    timestamp: report.timestamp,
    totalDomains: report.totalDomains,
    successful: report.successful,
    failed: report.failed,
    data: report.domains,
  });
}
```

## Output Files

Reports are saved with naming pattern:
```
domain-report-{schedule}-{date}.{format}
```

Examples:
- `domain-report-daily-2026-01-24.html`
- `domain-report-weekly-2026-01-24.json`
- `domain-report-monthly-2026-01-24.csv`

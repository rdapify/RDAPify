# Domain Expiration Monitor

Monitors domain expiration dates and generates alerts based on configurable thresholds.

## Features

- Automatic expiration date checking
- Multi-level alerts (Critical, Warning, Info)
- Batch domain monitoring
- Detailed reporting
- Ready for integration with notification systems

## Usage

```bash
node index.js
```

## Alert Levels

- **🔴 Expired**: Domain has already expired
- **🔴 Critical**: Expires within 7 days (configurable)
- **🟡 Warning**: Expires within 30 days (configurable)
- **🔵 Info**: Expires within 60 days (configurable)
- **✅ OK**: More than 60 days until expiration

## Configuration

```javascript
const monitor = new DomainMonitor({
  criticalDays: 7,   // Alert if expires within 7 days
  warningDays: 30,   // Alert if expires within 30 days
  infoDays: 60,      // Alert if expires within 60 days
});
```

## Integration Examples

### Email Alerts
```javascript
if (criticalDomains.length > 0) {
  await sendEmail({
    to: 'admin@example.com',
    subject: 'Critical Domain Expiration Alert',
    body: formatAlertEmail(criticalDomains)
  });
}
```

### Slack Notifications
```javascript
await postToSlack({
  channel: '#domain-alerts',
  text: `⚠️ ${criticalDomains.length} domains expiring soon!`,
  attachments: formatSlackAttachments(criticalDomains)
});
```

### Scheduled Monitoring
```javascript
// Run daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  const result = await monitor.monitorDomains(domains);
  monitor.displayReport(result);
});
```

## Use Cases

- Domain portfolio management
- Automated renewal reminders
- Compliance monitoring
- Client domain tracking
- Enterprise asset management

# Compliance Checker

Validates domain registration data against configurable compliance rules.

## Features

- Configurable compliance rules
- Multi-domain batch checking
- Severity levels (high, medium, low)
- Detailed violation reporting
- JSON export for integration

## Compliance Rules

### Security Rules
- **Transfer Lock**: Ensures domain has transfer protection
- **Update Lock**: Ensures domain has update protection

### Operational Rules
- **Expiration Date**: Minimum days until expiration
- **Nameservers**: Minimum number of nameservers required
- **Registrar Info**: Requires registrar information

### Geographic Rules
- **Allowed Countries**: Restrict domains to specific countries

## Usage

```bash
node index.js
```

## Configuration

```javascript
const checker = new ComplianceChecker({
  requireTransferLock: true,
  requireUpdateLock: false,
  minDaysUntilExpiration: 30,
  requireRegistrarInfo: true,
  requireNameservers: true,
  minNameservers: 2,
  allowedCountries: ['US', 'CA', 'GB'], // null for all
});
```

## Use Cases

- **Enterprise Governance**: Enforce domain security policies
- **Regulatory Compliance**: Meet industry requirements (GDPR, SOC2)
- **Security Audits**: Regular domain security assessments
- **Portfolio Management**: Ensure consistent domain configuration
- **Risk Management**: Identify non-compliant domains

## Integration Examples

### Automated Audits
```javascript
// Run daily compliance check
cron.schedule('0 2 * * *', async () => {
  const results = await checker.checkMultipleDomains(allDomains);
  await saveAuditReport(results);
  await notifyIfNonCompliant(results);
});
```

### CI/CD Integration
```javascript
// Check compliance before deployment
const results = await checker.checkMultipleDomains(productionDomains);
const nonCompliant = results.filter(r => !r.compliant);

if (nonCompliant.length > 0) {
  console.error('Compliance check failed');
  process.exit(1);
}
```

### Reporting Dashboard
```javascript
// Generate compliance metrics
const metrics = {
  complianceRate: (compliant / total) * 100,
  highSeverityViolations: results.filter(r => 
    r.violations.some(v => v.severity === 'high')
  ).length,
  trends: calculateTrends(historicalData)
};
```

## Output Format

```json
{
  "domain": "example.com",
  "compliant": false,
  "violations": [
    {
      "rule": "TRANSFER_LOCK_REQUIRED",
      "severity": "high",
      "message": "Domain must have transfer lock enabled"
    }
  ],
  "warnings": [],
  "summary": {
    "totalViolations": 1,
    "highSeverity": 1,
    "mediumSeverity": 0,
    "totalWarnings": 0
  }
}
```

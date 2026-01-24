# IP Address Tracker

Tracks IP address ownership and network information changes over time.

## Features

- Historical tracking of IP information
- Change detection between snapshots
- Multi-IP batch tracking
- Export history in JSON format
- Network ownership monitoring

## Usage

```bash
node index.js
```

## Use Cases

- **Security Monitoring**: Detect unauthorized network changes
- **Asset Management**: Track IP address allocations
- **Compliance**: Monitor network ownership for regulatory requirements
- **Incident Response**: Historical data for security investigations
- **Network Planning**: Track IP space utilization

## API

### Track Single IP
```javascript
const snapshot = await tracker.trackIP('8.8.8.8');
```

### Track Multiple IPs
```javascript
const results = await tracker.trackMultipleIPs(['8.8.8.8', '1.1.1.1']);
```

### Detect Changes
```javascript
const changes = tracker.detectChanges('8.8.8.8');
if (changes.hasChanges) {
  console.log('Changes detected:', changes.changes);
}
```

### Export History
```javascript
const history = tracker.exportHistory('8.8.8.8');
```

## Integration Examples

### Database Storage
```javascript
// Store snapshots in database
snapshots.forEach(async (snapshot) => {
  await db.ipTracking.insert({
    ip: snapshot.ip,
    timestamp: snapshot.timestamp,
    data: snapshot
  });
});
```

### Alert System
```javascript
const changes = tracker.detectChanges(ip);
if (changes.hasChanges) {
  await sendAlert({
    type: 'IP_CHANGE',
    ip,
    changes: changes.changes
  });
}
```

### Scheduled Monitoring
```javascript
// Run every hour
setInterval(async () => {
  await tracker.trackMultipleIPs(monitoredIPs);
  checkForAlerts();
}, 3600000);
```

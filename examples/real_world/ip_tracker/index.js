/**
 * IP Address Tracker Example
 * Tracks IP address ownership and network information changes
 */

const { RDAPClient } = require('rdapify');

class IPTracker {
  constructor() {
    this.client = new RDAPClient({
      cache: false, // Disable cache to get fresh data
      privacy: { redactPII: true },
    });
    this.history = new Map();
  }

  async trackIP(ip) {
    try {
      const result = await this.client.ip(ip);

      const snapshot = {
        timestamp: new Date().toISOString(),
        ip,
        network: {
          range: `${result.startAddress} - ${result.endAddress}`,
          name: result.name,
          country: result.country,
          type: result.type,
        },
        status: result.status,
        entities: result.entities?.map((e) => ({
          handle: e.handle,
          roles: e.roles,
        })),
      };

      // Store in history
      if (!this.history.has(ip)) {
        this.history.set(ip, []);
      }
      this.history.get(ip).push(snapshot);

      return snapshot;
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        ip,
        error: error.message,
      };
    }
  }

  async trackMultipleIPs(ips) {
    console.log(`Tracking ${ips.length} IP addresses...\n`);

    const results = await Promise.all(ips.map((ip) => this.trackIP(ip)));

    return results;
  }

  detectChanges(ip) {
    const snapshots = this.history.get(ip);

    if (!snapshots || snapshots.length < 2) {
      return { hasChanges: false, message: 'Not enough data to compare' };
    }

    const previous = snapshots[snapshots.length - 2];
    const current = snapshots[snapshots.length - 1];

    const changes = [];

    // Check network name change
    if (previous.network.name !== current.network.name) {
      changes.push({
        field: 'Network Name',
        old: previous.network.name,
        new: current.network.name,
      });
    }

    // Check country change
    if (previous.network.country !== current.network.country) {
      changes.push({
        field: 'Country',
        old: previous.network.country,
        new: current.network.country,
      });
    }

    // Check status changes
    const oldStatus = previous.status?.join(',') || '';
    const newStatus = current.status?.join(',') || '';
    if (oldStatus !== newStatus) {
      changes.push({
        field: 'Status',
        old: oldStatus,
        new: newStatus,
      });
    }

    return {
      hasChanges: changes.length > 0,
      changes,
      previous: previous.timestamp,
      current: current.timestamp,
    };
  }

  generateReport(ips) {
    console.log('='.repeat(60));
    console.log('IP ADDRESS TRACKING REPORT');
    console.log('='.repeat(60));

    ips.forEach((ip) => {
      const snapshots = this.history.get(ip);

      if (!snapshots || snapshots.length === 0) {
        console.log(`\n${ip}: No data`);
        return;
      }

      const latest = snapshots[snapshots.length - 1];

      console.log(`\n${ip}:`);
      console.log(`  Network: ${latest.network.name || 'N/A'}`);
      console.log(`  Range: ${latest.network.range}`);
      console.log(`  Country: ${latest.network.country || 'N/A'}`);
      console.log(`  Type: ${latest.network.type || 'N/A'}`);
      console.log(`  Snapshots: ${snapshots.length}`);

      // Check for changes
      if (snapshots.length >= 2) {
        const changeInfo = this.detectChanges(ip);
        if (changeInfo.hasChanges) {
          console.log(`  ⚠️  Changes detected:`);
          changeInfo.changes.forEach((change) => {
            console.log(`     ${change.field}: ${change.old} → ${change.new}`);
          });
        } else {
          console.log(`  ✓ No changes detected`);
        }
      }
    });

    console.log('\n' + '='.repeat(60));
  }

  exportHistory(ip) {
    const snapshots = this.history.get(ip);
    if (!snapshots) {
      return null;
    }

    return {
      ip,
      totalSnapshots: snapshots.length,
      firstSeen: snapshots[0].timestamp,
      lastSeen: snapshots[snapshots.length - 1].timestamp,
      snapshots,
    };
  }
}

async function main() {
  const tracker = new IPTracker();

  // List of IPs to track
  const ips = ['8.8.8.8', '1.1.1.1', '208.67.222.222'];

  console.log('IP Address Tracker Example\n');

  // First tracking run
  console.log('=== Initial Tracking ===');
  await tracker.trackMultipleIPs(ips);
  tracker.generateReport(ips);

  // Simulate time passing and track again
  console.log('\n\n=== Second Tracking (simulating later check) ===');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await tracker.trackMultipleIPs(ips);
  tracker.generateReport(ips);

  // Export history for specific IP
  console.log('\n\n=== Export History for 8.8.8.8 ===');
  const history = tracker.exportHistory('8.8.8.8');
  if (history) {
    console.log(JSON.stringify(history, null, 2));
  }
}

main().catch(console.error);

/**
 * Custom Types Example
 * Demonstrates extending RDAPify types with custom interfaces
 */

import { RDAPClient, DomainResponse, Event, Entity } from 'rdapify';

// Extended domain response with computed properties
interface EnhancedDomainResponse extends DomainResponse {
  daysUntilExpiration?: number;
  isExpiringSoon?: boolean;
  registrarContact?: Entity;
  importantDates?: {
    registered?: Date;
    updated?: Date;
    expires?: Date;
  };
}

// Domain analysis result
interface DomainAnalysis {
  domain: string;
  status: 'active' | 'expired' | 'pending' | 'unknown';
  security: {
    hasTransferLock: boolean;
    hasUpdateLock: boolean;
    hasDeleteLock: boolean;
  };
  lifecycle: {
    age: number;
    daysUntilExpiration: number;
    isExpiringSoon: boolean;
  };
  registrar?: {
    name: string;
    handle: string;
  };
}

// Helper to enhance domain response
function enhanceDomainResponse(response: DomainResponse): EnhancedDomainResponse {
  const enhanced: EnhancedDomainResponse = { ...response };

  // Extract important dates
  const events = response.events || [];
  const registrationEvent = events.find((e: Event) => e.type === 'registration');
  const updateEvent = events.find((e: Event) => e.type === 'last changed');
  const expirationEvent = events.find((e: Event) => e.type === 'expiration');

  enhanced.importantDates = {
    registered: registrationEvent ? new Date(registrationEvent.date) : undefined,
    updated: updateEvent ? new Date(updateEvent.date) : undefined,
    expires: expirationEvent ? new Date(expirationEvent.date) : undefined,
  };

  // Calculate days until expiration
  if (expirationEvent) {
    const expirationDate = new Date(expirationEvent.date);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    enhanced.daysUntilExpiration = diffDays;
    enhanced.isExpiringSoon = diffDays <= 30 && diffDays > 0;
  }

  // Find registrar contact
  const entities = response.entities || [];
  enhanced.registrarContact = entities.find((e: Entity) => e.roles?.includes('registrar'));

  return enhanced;
}

// Analyze domain
function analyzeDomain(response: EnhancedDomainResponse): DomainAnalysis {
  const status = response.status || [];

  // Determine domain status
  let domainStatus: 'active' | 'expired' | 'pending' | 'unknown' = 'unknown';
  if (status.includes('active')) domainStatus = 'active';
  else if (status.includes('expired')) domainStatus = 'expired';
  else if (status.includes('pending')) domainStatus = 'pending';

  // Check security locks
  const security = {
    hasTransferLock: status.some((s) => s.includes('Transfer') && s.includes('Prohibited')),
    hasUpdateLock: status.some((s) => s.includes('Update') && s.includes('Prohibited')),
    hasDeleteLock: status.some((s) => s.includes('Delete') && s.includes('Prohibited')),
  };

  // Calculate lifecycle info
  const now = new Date();
  const registeredDate = response.importantDates?.registered;
  const age = registeredDate
    ? Math.floor((now.getTime() - registeredDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const lifecycle = {
    age,
    daysUntilExpiration: response.daysUntilExpiration || 0,
    isExpiringSoon: response.isExpiringSoon || false,
  };

  // Extract registrar info
  const registrar = response.registrarContact
    ? {
        name: response.registrarContact.handle || 'Unknown',
        handle: response.registrarContact.handle || 'N/A',
      }
    : undefined;

  return {
    domain: response.ldhName || 'unknown',
    status: domainStatus,
    security,
    lifecycle,
    registrar,
  };
}

// Display analysis
function displayAnalysis(analysis: DomainAnalysis): void {
  console.log('\nDomain Analysis:');
  console.log('================');
  console.log(`Domain: ${analysis.domain}`);
  console.log(`Status: ${analysis.status.toUpperCase()}`);

  console.log('\nSecurity:');
  console.log(`  Transfer Lock: ${analysis.security.hasTransferLock ? '✓' : '✗'}`);
  console.log(`  Update Lock: ${analysis.security.hasUpdateLock ? '✓' : '✗'}`);
  console.log(`  Delete Lock: ${analysis.security.hasDeleteLock ? '✓' : '✗'}`);

  console.log('\nLifecycle:');
  console.log(`  Age: ${analysis.lifecycle.age} days`);
  console.log(`  Days Until Expiration: ${analysis.lifecycle.daysUntilExpiration}`);
  console.log(
    `  Expiring Soon: ${analysis.lifecycle.isExpiringSoon ? '⚠️  YES' : '✓ No'}`
  );

  if (analysis.registrar) {
    console.log('\nRegistrar:');
    console.log(`  Name: ${analysis.registrar.name}`);
    console.log(`  Handle: ${analysis.registrar.handle}`);
  }
}

async function main(): Promise<void> {
  const client = new RDAPClient({
    cache: true,
    privacy: { redactPII: true },
  });

  console.log('Custom Types Example\n');

  try {
    // Query domain
    const response = await client.domain('example.com');

    // Enhance response
    const enhanced = enhanceDomainResponse(response);

    // Analyze domain
    const analysis = analyzeDomain(enhanced);

    // Display results
    displayAnalysis(analysis);

    // Display important dates
    if (enhanced.importantDates) {
      console.log('\nImportant Dates:');
      if (enhanced.importantDates.registered) {
        console.log(`  Registered: ${enhanced.importantDates.registered.toLocaleDateString()}`);
      }
      if (enhanced.importantDates.updated) {
        console.log(`  Last Updated: ${enhanced.importantDates.updated.toLocaleDateString()}`);
      }
      if (enhanced.importantDates.expires) {
        console.log(`  Expires: ${enhanced.importantDates.expires.toLocaleDateString()}`);
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main().catch(console.error);

/**
 * TypeScript Client Example
 * Demonstrates type-safe usage of RDAPify with TypeScript
 */

import { RDAPClient, RDAPClientOptions, DomainResponse, IPResponse, ASNResponse } from 'rdapify';

// Custom type for query results
interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
}

// Type-safe client wrapper
class TypedRDAPClient {
  private client: RDAPClient;

  constructor(options?: RDAPClientOptions) {
    this.client = new RDAPClient(options);
  }

  async queryDomain(domain: string): Promise<QueryResult<DomainResponse>> {
    const startTime = Date.now();

    try {
      const data = await this.client.domain(domain);
      return {
        success: true,
        data,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  async queryIP(ip: string): Promise<QueryResult<IPResponse>> {
    const startTime = Date.now();

    try {
      const data = await this.client.ip(ip);
      return {
        success: true,
        data,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  async queryASN(asn: number | string): Promise<QueryResult<ASNResponse>> {
    const startTime = Date.now();

    try {
      const data = await this.client.asn(asn);
      return {
        success: true,
        data,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }
}

// Helper function to display domain info with type safety
function displayDomainInfo(response: DomainResponse): void {
  console.log('\nDomain Information:');
  console.log('==================');
  console.log(`Domain: ${response.ldhName}`);
  console.log(`Handle: ${response.handle ?? 'N/A'}`);
  console.log(`Status: ${response.status?.join(', ') ?? 'N/A'}`);

  // Type-safe event filtering
  const registrationEvent = response.events?.find((e) => e.type === 'registration');
  const expirationEvent = response.events?.find((e) => e.type === 'expiration');

  if (registrationEvent) {
    console.log(`Registered: ${new Date(registrationEvent.date).toLocaleDateString()}`);
  }

  if (expirationEvent) {
    console.log(`Expires: ${new Date(expirationEvent.date).toLocaleDateString()}`);
  }

  // Type-safe nameserver access
  if (response.nameservers && response.nameservers.length > 0) {
    console.log(`Nameservers: ${response.nameservers.join(', ')}`);
  }
}

// Main function
async function main(): Promise<void> {
  const client = new TypedRDAPClient({
    cache: true,
    privacy: { redactPII: true },
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
    },
  });

  console.log('TypeScript Type-Safe RDAP Client Example\n');

  // Query domain with type safety
  const domainResult = await client.queryDomain('example.com');

  if (domainResult.success && domainResult.data) {
    displayDomainInfo(domainResult.data);
    console.log(`\nQuery Duration: ${domainResult.duration}ms`);
  } else {
    console.error(`Error: ${domainResult.error?.message}`);
  }

  // Query IP with type safety
  const ipResult = await client.queryIP('8.8.8.8');

  if (ipResult.success && ipResult.data) {
    console.log('\nIP Information:');
    console.log('===============');
    console.log(`Range: ${ipResult.data.startAddress} - ${ipResult.data.endAddress}`);
    console.log(`Version: IPv${ipResult.data.ipVersion === 'v4' ? '4' : '6'}`);
    console.log(`Country: ${ipResult.data.country ?? 'N/A'}`);
    console.log(`\nQuery Duration: ${ipResult.duration}ms`);
  }

  // Query ASN with type safety
  const asnResult = await client.queryASN(15169);

  if (asnResult.success && asnResult.data) {
    console.log('\nASN Information:');
    console.log('================');
    console.log(`ASN: AS${asnResult.data.startAutnum}`);
    console.log(`Name: ${asnResult.data.name ?? 'N/A'}`);
    console.log(`Country: ${asnResult.data.country ?? 'N/A'}`);
    console.log(`\nQuery Duration: ${asnResult.duration}ms`);
  }
}

main().catch(console.error);

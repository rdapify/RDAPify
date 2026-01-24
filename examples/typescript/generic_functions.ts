/**
 * Generic Functions Example
 * Demonstrates generic TypeScript patterns with RDAPify
 */

import { RDAPClient, DomainResponse, IPResponse, ASNResponse } from 'rdapify';

// Generic query result type
type QueryResponse = DomainResponse | IPResponse | ASNResponse;

// Generic query function with type discrimination
async function query<T extends QueryResponse>(
  client: RDAPClient,
  type: 'domain' | 'ip' | 'asn',
  value: string | number
): Promise<T> {
  switch (type) {
    case 'domain':
      return (await client.domain(value as string)) as T;
    case 'ip':
      return (await client.ip(value as string)) as T;
    case 'asn':
      return (await client.asn(value)) as T;
    default:
      throw new Error(`Unknown query type: ${type}`);
  }
}

// Type guard functions
function isDomainResponse(response: QueryResponse): response is DomainResponse {
  return 'ldhName' in response;
}

function isIPResponse(response: QueryResponse): response is IPResponse {
  return 'startAddress' in response && 'endAddress' in response;
}

function isASNResponse(response: QueryResponse): response is ASNResponse {
  return 'startAutnum' in response;
}

// Generic batch query function
async function batchQuery<T extends QueryResponse>(
  client: RDAPClient,
  type: 'domain' | 'ip' | 'asn',
  values: (string | number)[]
): Promise<Array<{ value: string | number; result?: T; error?: Error }>> {
  const results = await Promise.allSettled(
    values.map((value) => query<T>(client, type, value))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return { value: values[index], result: result.value };
    } else {
      return { value: values[index], error: result.reason };
    }
  });
}

// Display function with type discrimination
function displayResponse(response: QueryResponse): void {
  if (isDomainResponse(response)) {
    console.log(`Domain: ${response.ldhName}`);
    console.log(`Status: ${response.status?.join(', ') ?? 'N/A'}`);
  } else if (isIPResponse(response)) {
    console.log(`IP Range: ${response.startAddress} - ${response.endAddress}`);
    console.log(`Country: ${response.country ?? 'N/A'}`);
  } else if (isASNResponse(response)) {
    console.log(`ASN: AS${response.startAutnum}`);
    console.log(`Name: ${response.name ?? 'N/A'}`);
  }
}

async function main(): Promise<void> {
  const client = new RDAPClient({
    cache: true,
    privacy: { redactPII: true },
  });

  console.log('Generic Functions Example\n');

  // Single queries with generics
  console.log('1. Generic single queries:');
  const domainResult = await query<DomainResponse>(client, 'domain', 'example.com');
  displayResponse(domainResult);

  console.log('\n2. Batch domain queries:');
  const domains = ['example.com', 'google.com', 'github.com'];
  const batchResults = await batchQuery<DomainResponse>(client, 'domain', domains);

  batchResults.forEach(({ value, result, error }) => {
    if (result) {
      console.log(`  ✓ ${value}: ${result.status?.[0] ?? 'N/A'}`);
    } else {
      console.log(`  ✗ ${value}: ${error?.message}`);
    }
  });

  console.log('\n3. Mixed type queries:');
  const mixedQueries: Array<{
    type: 'domain' | 'ip' | 'asn';
    value: string | number;
  }> = [
    { type: 'domain', value: 'example.com' },
    { type: 'ip', value: '8.8.8.8' },
    { type: 'asn', value: 15169 },
  ];

  for (const { type, value } of mixedQueries) {
    try {
      const result = await query(client, type, value);
      console.log(`\n${type.toUpperCase()}: ${value}`);
      displayResponse(result);
    } catch (error) {
      console.log(`\n${type.toUpperCase()}: ${value} - Error: ${(error as Error).message}`);
    }
  }
}

main().catch(console.error);

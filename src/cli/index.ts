#!/usr/bin/env node
/**
 * RDAPify CLI
 * Command-line interface for querying RDAP information
 *
 * Usage:
 *   rdapify domain <name>     Query domain registration info
 *   rdapify ip <address>      Query IP address info
 *   rdapify asn <number>      Query ASN info
 *
 * Options:
 *   --json                    Output raw JSON
 *   --no-cache                Disable cache for this query
 *   --timeout <ms>            Request timeout in milliseconds (default: 10000)
 *   --version, -v             Show version
 *   --help, -h                Show help
 */

import { RDAPClient, VERSION } from '../index';
import type { DomainResponse, IPResponse, ASNResponse, NameserverResponse, EntityResponse } from '../index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Command = 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';

interface ParsedArgs {
  command: Command | null;
  query: string | null;
  json: boolean;
  noCache: boolean;
  timeout: number;
  version: boolean;
  help: boolean;
  server: string | null;
}

// ---------------------------------------------------------------------------
// Help / version text
// ---------------------------------------------------------------------------

const HELP_TEXT = `
RDAPify v${VERSION} — RDAP client CLI

Usage:
  rdapify domain <name>              Query domain registration info
  rdapify ip <address>               Query IP address info
  rdapify asn <number>               Query ASN info
  rdapify nameserver <hostname>      Query nameserver info
  rdapify entity <handle> --server <url>  Query entity (contact/registrar) info

Options:
  --json                      Output raw JSON
  --no-cache                  Disable cache for this query
  --timeout <ms>              Request timeout in milliseconds (default: 10000)
  --server <url>              RDAP server base URL (required for entity queries)
  --version, -v               Show version
  --help, -h                  Show this help message

Examples:
  rdapify domain example.com
  rdapify ip 8.8.8.8
  rdapify asn 15169
  rdapify nameserver ns1.example.com
  rdapify entity ARIN-HN-1 --server https://rdap.arin.net/registry
  rdapify domain example.com --json
  rdapify ip 1.1.1.1 --no-cache --timeout 5000
`.trimStart();

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: null,
    query: null,
    json: false,
    noCache: false,
    timeout: 10000,
    version: false,
    help: false,
    server: null,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === undefined) {
      i++;
      continue;
    }

    switch (arg) {
      case '--json':
        result.json = true;
        break;

      case '--no-cache':
        result.noCache = true;
        break;

      case '--timeout': {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('-')) {
          fatal('--timeout requires a numeric value in milliseconds');
        }
        const ms = parseInt(next, 10);
        if (isNaN(ms) || ms <= 0) {
          fatal(`--timeout value must be a positive integer, got: ${next}`);
        }
        result.timeout = ms;
        i++; // consume the value token
        break;
      }

      case '--server': {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('-')) {
          fatal('--server requires a URL value');
        }
        result.server = next;
        i++;
        break;
      }

      case '--version':
      case '-v':
        result.version = true;
        break;

      case '--help':
      case '-h':
        result.help = true;
        break;

      default:
        // Positional: first positional = command, second = query value
        if (!arg.startsWith('-')) {
          if (result.command === null) {
            if (arg !== 'domain' && arg !== 'ip' && arg !== 'asn' && arg !== 'nameserver' && arg !== 'entity') {
              fatal(`Unknown command: "${arg}". Valid commands are: domain, ip, asn, nameserver, entity`);
            }
            result.command = arg as Command;
          } else if (result.query === null) {
            result.query = arg;
          }
        } else {
          fatal(`Unknown option: "${arg}". Run rdapify --help for usage.`);
        }
        break;
    }

    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Left-pad a label to a fixed width for aligned output. */
function label(text: string, width = 13): string {
  return `${text}:`.padEnd(width);
}

/** Format an ISO date string to YYYY-MM-DD, or return the original on failure. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

/** Retrieve a specific event date from an events array. */
function getEventDate(
  events: Array<{ type: string; date: string }> | undefined,
  eventType: string,
): string | undefined {
  if (!events) return undefined;
  const ev = events.find((e) => e.type === eventType);
  return ev ? formatDate(ev.date) : undefined;
}

// ---------------------------------------------------------------------------
// Formatted output functions
// ---------------------------------------------------------------------------

function printDomain(res: DomainResponse): void {
  const name = res.ldhName ?? res.unicodeName ?? res.query;
  const registrar = res.registrar?.name ?? '—';
  const status = res.status?.join(', ') ?? '—';
  const created = getEventDate(res.events, 'registration') ?? '—';
  const expires = getEventDate(res.events, 'expiration') ?? '—';
  const updated = getEventDate(res.events, 'last changed') ?? '—';
  const nameservers = res.nameservers?.join(', ') ?? '—';

  process.stdout.write(
    [
      `${label('Domain')}${name}`,
      `${label('Registrar')}${registrar}`,
      `${label('Status')}${status}`,
      `${label('Created')}${created}`,
      `${label('Expires')}${expires}`,
      `${label('Updated')}${updated}`,
      `${label('Nameservers')}${nameservers}`,
    ].join('\n') + '\n',
  );
}

function printIP(res: IPResponse): void {
  const ip = res.query;
  const type = res.ipVersion ? `IPv${res.ipVersion.slice(1)}` : '—';
  const handle = res.handle ?? '—';
  const name = res.name ?? '—';
  const country = res.country ?? '—';
  const status = res.status?.join(', ') ?? '—';

  process.stdout.write(
    [
      `${label('IP Address')}${ip}`,
      `${label('Type')}${type}`,
      `${label('Handle')}${handle}`,
      `${label('Name')}${name}`,
      `${label('Country')}${country}`,
      `${label('Status')}${status}`,
    ].join('\n') + '\n',
  );
}

function printASN(res: ASNResponse): void {
  const asn = res.startAutnum ?? res.query;
  const handle = res.handle ?? '—';
  const name = res.name ?? '—';
  const country = res.country ?? '—';
  const status = res.status?.join(', ') ?? '—';

  process.stdout.write(
    [
      `${label('ASN')}${asn}`,
      `${label('Handle')}${handle}`,
      `${label('Name')}${name}`,
      `${label('Country')}${country}`,
      `${label('Status')}${status}`,
    ].join('\n') + '\n',
  );
}

function printNameserver(res: NameserverResponse): void {
  const name = res.ldhName ?? res.unicodeName ?? res.query;
  const handle = res.handle ?? '—';
  const status = res.status?.join(', ') ?? '—';
  const v4 = res.ipAddresses?.v4?.join(', ') || '—';
  const v6 = res.ipAddresses?.v6?.join(', ') || '—';

  process.stdout.write(
    [
      `${label('Nameserver')}${name}`,
      `${label('Handle')}${handle}`,
      `${label('Status')}${status}`,
      `${label('IPv4')}${v4}`,
      `${label('IPv6')}${v6}`,
    ].join('\n') + '\n',
  );
}

function printEntity(res: EntityResponse): void {
  const handle = res.handle ?? res.query;
  const roles = res.roles?.join(', ') ?? '—';
  const status = res.status?.join(', ') ?? '—';

  // Extract name from vcardArray if available
  let name = '—';
  if (res.vcardArray && Array.isArray(res.vcardArray) && res.vcardArray.length >= 2) {
    const vcard = res.vcardArray[1];
    if (Array.isArray(vcard)) {
      const fnField = vcard.find((field: any) => Array.isArray(field) && field[0] === 'fn');
      if (fnField && Array.isArray(fnField) && fnField.length >= 4) {
        name = fnField[3] ?? '—';
      }
    }
  }

  process.stdout.write(
    [
      `${label('Handle')}${handle}`,
      `${label('Name')}${name}`,
      `${label('Roles')}${roles}`,
      `${label('Status')}${status}`,
    ].join('\n') + '\n',
  );
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function fatal(message: string, code = 1): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  // Handle meta-commands first
  if (args.version) {
    process.stdout.write(`rdapify v${VERSION}\n`);
    return;
  }

  if (args.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  // Validate positional arguments
  if (args.command === null) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  if (args.query === null || args.query.trim() === '') {
    fatal(`Missing argument for command "${args.command}". Example: rdapify ${args.command} <value>`);
  }

  // Build client options
  const client = new RDAPClient({
    cache: args.noCache ? false : true,
    timeout: args.timeout,
  });

  const query = args.query.trim();

  try {
    switch (args.command) {
      case 'domain': {
        const result = await client.domain(query);
        if (args.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          printDomain(result);
        }
        break;
      }

      case 'ip': {
        const result = await client.ip(query);
        if (args.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          printIP(result);
        }
        break;
      }

      case 'asn': {
        const result = await client.asn(query);
        if (args.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          printASN(result);
        }
        break;
      }

      case 'nameserver': {
        const result = await client.nameserver(query);
        if (args.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          printNameserver(result);
        }
        break;
      }

      case 'entity': {
        if (!args.server) {
          fatal('Entity queries require --server <url>. Example: rdapify entity ARIN-HN-1 --server https://rdap.arin.net/registry');
        }
        const result = await client.entity(query, args.server);
        if (args.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          printEntity(result);
        }
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    fatal(message);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${message}\n`);
  process.exit(1);
});

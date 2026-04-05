# RDAPify CLI

The `rdapify` command-line tool provides direct access to RDAP queries from the shell. It is part of the main `rdapify` crate and is built with the `cli` feature.

## Installation

Install from crates.io:

```bash
cargo install rdapify --features cli
```

This builds the CLI binary and installs it to `~/.cargo/bin/rdapify`.

Verify installation:

```bash
rdapify --version
```

## Output Format

By default, the CLI outputs JSON responses in pretty-printed format (easy to read). Use the `--raw` flag to output compact JSON suitable for parsing by other tools.

```bash
# Pretty-printed (default)
rdapify domain example.com

# Compact JSON (machine-readable)
rdapify domain example.com --raw
```

All output is UTF-8 encoded. Errors are written to stderr; query results go to stdout.

## Subcommands and Examples

### domain

Query RDAP data for a domain name.

```bash
rdapify domain example.com
rdapify domain google.co.uk
rdapify domain münchen.de
```

**Output**: `DomainResponse` containing registrar, registrant (redacted), expiration date, name servers, and DNSSEC status.

### ip

Query RDAP data for an IPv4 or IPv6 address.

```bash
rdapify ip 8.8.8.8
rdapify ip 2001:4860:4860::8888
rdapify ip 192.0.2.1
```

**Output**: `IpResponse` containing IP version, CIDR range, ASN, registry, and abuse contact.

### asn

Query RDAP data for an Autonomous System Number. Accepts both numeric and "AS" prefixed forms.

```bash
rdapify asn 15169
rdapify asn AS15169
rdapify asn as15169
```

**Output**: `AsnResponse` containing ASN range, organization name, registry, and contact information.

### nameserver

Query RDAP data for a nameserver hostname.

```bash
rdapify nameserver ns1.google.com
rdapify nameserver ns.apple.com
rdapify nameserver dns1.example.net
```

**Output**: `NameserverResponse` containing nameserver hostname, IPv4 and IPv6 addresses, and registry information.

### entity

Query RDAP data for an entity (contact / registrar) by handle. An entity requires a server URL; there is no global bootstrap for entity lookups.

```bash
rdapify entity ARIN-HN-1 --server https://rdap.arin.net/registry
rdapify entity handle123 -s https://rdap.lacnic.net
```

**Flags**:
- `--server URL` or `-s URL`: RDAP server base URL (required)

**Output**: `EntityResponse` containing entity name, email, phone, roles (e.g., registrant, administrative contact), and status.

## Global Flags

All subcommands support:

- `--raw`: Output compact JSON instead of pretty-printed
- `--help` or `-h`: Show command-specific help
- `--version` or `-V`: Show CLI version

```bash
rdapify --help
rdapify domain --help
rdapify --version
```

## Usage Patterns

### Piping to Other Tools

The CLI outputs valid JSON, making it easy to pipe to other tools:

```bash
# Extract domain expiration date using jq
rdapify domain example.com | jq '.expires_at'

# Convert response to YAML
rdapify domain example.com --raw | python3 -m json.tool | yq -P

# Check if a domain is registered (via HTTP status code)
rdapify domain notregistered.xyz --raw > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "Domain exists"
else
  echo "Domain not found (404)"
fi
```

### Bulk Queries

For querying multiple domains, write a shell script:

```bash
#!/bin/bash

domains=("example.com" "google.com" "example.net")

for domain in "${domains[@]}"; do
  echo "=== $domain ==="
  rdapify domain "$domain" --raw | jq '{expires_at: .expires_at, nameservers: .nameservers}'
done
```

Or use `xargs` for parallelization:

```bash
echo -e "example.com\ngoogle.com\nexample.net" | \
  xargs -I {} -P 5 rdapify domain {} --raw | \
  jq '.objectClassName'
```

### Error Handling

Exit codes:
- `0`: Query succeeded
- `1`: Error (invalid input, network error, SSRF block, etc.)

Errors are printed to stderr:

```bash
rdapify domain invalid!domain.com 2>&1
# Output: Error: Invalid input: invalid domain name
```

Use this in scripts:

```bash
if rdapify ip 8.8.8.8 > /tmp/ip_response.json 2>/dev/null; then
  echo "Query succeeded"
  cat /tmp/ip_response.json
else
  echo "Query failed"
fi
```

## Response Examples

### domain

```json
{
  "objectClassName": "domain",
  "ldhName": "example.com",
  "unicodeName": "example.com",
  "status": ["clientUpdateProhibited", "serverUpdateProhibited"],
  "registrar": {
    "name": "VeriSign Global Registry Services",
    "rdapConformance": ["rdap_level_0"]
  },
  "nameservers": [
    {
      "ldhName": "a.iana-servers.net",
      "ipAddresses": {
        "v4": ["199.43.135.53"],
        "v6": ["2001:500:8f::53"]
      }
    }
  ],
  "expirationDate": "2025-08-14T04:00:00Z"
}
```

### ip

```json
{
  "objectClassName": "ip network",
  "handle": "NET-8-8-8-0-1",
  "startAddress": "8.8.8.0",
  "endAddress": "8.8.8.255",
  "ipVersion": "v4",
  "cidrPrefix": "8.8.8.0/24",
  "country": "US",
  "status": ["active"],
  "abuseContact": "abuse@google.com"
}
```

### asn

```json
{
  "objectClassName": "autnum",
  "asEventType": "registration",
  "asEventDate": "1999-08-02T00:00:00Z",
  "handle": "AS15169",
  "startAutnum": 15169,
  "endAutnum": 15169,
  "name": "GOOGLE",
  "abuseContact": "abuse@google.com",
  "status": ["active"]
}
```

### nameserver

```json
{
  "objectClassName": "nameserver",
  "ldhName": "ns1.google.com",
  "ipAddresses": {
    "v4": ["216.239.32.10"],
    "v6": ["2001:4860:4802:32::a"]
  },
  "status": ["active"],
  "remarks": []
}
```

### entity

```json
{
  "objectClassName": "entity",
  "handle": "ARIN-HN-1",
  "fn": "Admin, Admin",
  "email": "admin@example.com",
  "tel": "+1.2025551000",
  "kind": "individual",
  "roles": ["administrative", "technical"],
  "status": ["validated"]
}
```

## Configuration

The CLI uses the default `RdapClient` configuration:
- SSRF protection: enabled
- Cache: enabled
- Bootstrap: official IANA endpoint
- Timeout: 30 seconds per request
- Retries: 3 attempts (with exponential back-off)

For custom configuration, use the Rust API (see RUST_API.md).

## Performance

Typical query latencies (on a modern connection):
- Domain: 200–800ms (includes bootstrap discovery)
- IP: 150–600ms
- ASN: 150–600ms
- Nameserver: 200–800ms
- Entity: 100–500ms (direct server, no bootstrap)

First query to a registry is slower (includes bootstrap download); subsequent queries are faster (bootstrap cached).

## Troubleshooting

### "No RDAP server found for: example.com"

The TLD is not registered in the IANA bootstrap data. This can happen for:
- Newly created TLDs (bootstrap updates are periodic)
- Non-standard or test TLDs (e.g., `.local`, `.test`)
- Typos in the domain name

Verify the domain is correct, or wait for bootstrap data to update.

### "SSRF protection blocked request to..."

The CLI rejected the URL because it targets a private IP address. This indicates a misconfigured RDAP server URL or a network routing issue. Check that the RDAP server hostname resolves to a public IP.

### "Request timed out after 30000ms"

The RDAP server took longer than 30 seconds to respond. Try again; this may be a temporary network hiccup or server overload.

### "Failed to parse RDAP response"

The RDAP server returned malformed JSON or data that doesn't match the RDAP schema. This is a bug in the RDAP server or a compatibility issue. Check the raw response:

```bash
rdapify domain example.com --raw 2>&1 | jq .
```

### "Invalid input: ..."

Your input (domain, IP, ASN, etc.) failed validation. Check that:
- Domain names are valid (no spaces, special characters, or invalid Unicode)
- IP addresses are valid IPv4 or IPv6 format
- ASNs are numeric or in "AS" prefix form
- Entity handles and server URLs are non-empty

## Secure Usage

- Never pipe credentials or secrets to the CLI
- The CLI may make multiple outbound HTTPS connections; ensure your network policies allow this
- Responses contain PII; don't log them to shared systems or public logs
- Respect RDAP registry rate limits and Terms of Service

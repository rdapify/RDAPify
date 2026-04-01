# rdapify

A fast, secure RDAP client for Python — powered by Rust.

## Installation

```bash
pip install rdapify-py
```

## Usage

```python
import rdapify_py as rdap

# Query a domain
result = rdap.domain("example.com")
print(result["registrar"]["name"])
print(result["expiration_date"])

# Query an IP address
ip = rdap.ip("8.8.8.8")
print(ip["country"])

# Query an ASN
asn = rdap.asn("AS15169")
print(asn["name"])

# Query a nameserver
ns = rdap.nameserver("ns1.google.com")
print(ns["ip_addresses"])

# Query an entity
entity = rdap.entity("ARIN-HN-1", "https://rdap.arin.net/registry")
print(entity["handle"])
```

## Features

- 5 query types: domain, IP, ASN, nameserver, entity
- IANA Bootstrap — automatic server discovery
- SSRF protection built-in
- In-memory cache
- IDN/Punycode support
- Zero OpenSSL dependency (rustls)

## License

MIT

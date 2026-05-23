# RDAPify Rust API Reference

The primary API for RDAPify is the `RdapClient` struct, which provides async methods for querying RDAP data. All APIs are non-blocking and require Tokio.

## Quick Start

```rust
use rdapify::RdapClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create a client with default configuration
    let client = RdapClient::new()?;

    // Query a domain
    let domain_response = client.domain("example.com").await?;
    println!("Domain: {}", domain_response.ldhName);

    // Query an IP address
    let ip_response = client.ip("8.8.8.8").await?;
    println!("ASN: {}", ip_response.asn);

    // Query an ASN
    let asn_response = client.asn("15169").await?;
    println!("ASN Name: {}", asn_response.name);

    Ok(())
}
```

## RdapClient

The main RDAP query client. Cheap to clone (all state is behind `Arc` pointers).

### Construction

#### `RdapClient::new() -> Result<Self>`

Creates a client with default configuration.

```rust
let client = RdapClient::new()?;
```

Defaults:
- SSRF protection: enabled
- Cache: enabled (in-memory, lock-free)
- Bootstrap: official IANA endpoint (https://data.iana.org/rdap/)
- Timeout: 30 seconds
- Retries: 3 attempts with exponential back-off
- Connection pooling: 10 connections per host

#### `RdapClient::with_config(config: ClientConfig) -> Result<Self>`

Creates a client with custom configuration.

```rust
use rdapify::{RdapClient, ClientConfig, FetcherConfig, SsrfConfig};
use std::time::Duration;

let config = ClientConfig {
    fetcher: FetcherConfig {
        timeout: Duration::from_secs(60),
        user_agent: "MyApp/1.0".to_string(),
        max_attempts: 5,
        initial_backoff: Duration::from_millis(100),
        max_backoff: Duration::from_secs(10),
        reuse_connections: true,
        max_connections_per_host: 20,
    },
    ssrf: SsrfConfig {
        enabled: true,
        blocked_domains: vec!["internal.corp".to_string()],
        allowed_domains: vec![],
    },
    cache: true,
    bootstrap_url: Some("https://custom-rdap-bootstrap.example.com/".to_string()),
    custom_bootstrap_servers: Default::default(),
    reuse_connections: true,
    max_connections_per_host: 10,
};

let client = RdapClient::with_config(config)?;
```

## Query Methods

All query methods are async and return `Result<ResponseType>`.

### `domain(&self, domain: &str) -> Result<DomainResponse>`

Query RDAP information for a domain name.

```rust
let response = client.domain("example.com").await?;

println!("Registrar: {}", response.registrar);
println!("Expires: {:?}", response.expires_at);
println!("Status: {:?}", response.status);
```

**Validation**:
- Domain name is normalized via IDNA (Internationalized Domain Names)
- Empty strings are rejected
- Invalid Unicode is rejected

**Bootstrap**: Uses IANA bootstrap to discover the authoritative RDAP server for the TLD.

**Return type**: `DomainResponse`
- `ldhName: String` – the domain name (ASCII-compatible)
- `unicodeName: Option<String>` – Unicode representation (if different)
- `registrar: Option<String>` – registrar name
- `registrant: Option<RdapEntity>` – registrant contact (often redacted)
- `status: Vec<RdapStatus>` – domain status flags (e.g., "clientUpdateProhibited")
- `nameservers: Vec<RdapLink>` – authoritative nameservers
- `expires_at: Option<DateTime<Utc>>` – expiration timestamp
- `dnssec: Option<bool>` – DNSSEC enabled

### `ip(&self, ip: &str) -> Result<IpResponse>`

Query RDAP information for an IPv4 or IPv6 address.

```rust
let response = client.ip("8.8.8.8").await?;

println!("IP version: {:?}", response.ip_version);
println!("CIDR: {}", response.cidr_prefix);
println!("ASN: {}", response.asn);
println!("Country: {:?}", response.country);
```

**Validation**:
- IP address is parsed as `std::net::IpAddr`
- Invalid addresses are rejected

**Bootstrap**: Uses IANA bootstrap to discover the authoritative RDAP server for the IP range (ARIN, RIPE, APNIC, LACNIC, AFRINIC).

**Return type**: `IpResponse`
- `ip_version: IpVersion` – enum: `V4` or `V6`
- `start_address: String` – first IP in the range
- `end_address: String` – last IP in the range
- `cidr_prefix: Option<String>` – CIDR notation (e.g., "8.8.8.0/24")
- `asn: Option<u32>` – Autonomous System Number
- `country: Option<String>` – ISO country code
- `status: Vec<RdapStatus>` – status flags (e.g., "active")
- `abuseContact: Option<String>` – abuse report email

### `asn(&self, asn: impl AsRef<str>) -> Result<AsnResponse>`

Query RDAP information for an Autonomous System Number. Accepts both numeric and "AS" prefixed forms.

```rust
// All of these work:
let response = client.asn("15169").await?;
let response = client.asn("AS15169").await?;
let response = client.asn("as15169").await?;

println!("ASN Name: {}", response.name);
println!("Range: {} – {}", response.start_autnum, response.end_autnum);
```

**Validation**:
- "AS" or "as" prefix is stripped
- Remaining value is parsed as u32 (0 – 4,294,967,295)
- Non-numeric values are rejected

**Bootstrap**: Uses IANA bootstrap to discover the authoritative RDAP server for the ASN range.

**Return type**: `AsnResponse`
- `handle: String` – ASN identifier
- `start_autnum: u32` – first ASN in the range
- `end_autnum: u32` – last ASN in the range
- `name: Option<String>` – organization name
- `country: Option<String>` – ISO country code
- `status: Vec<RdapStatus>` – status flags
- `abuseContact: Option<String>` – abuse report email

### `nameserver(&self, hostname: &str) -> Result<NameserverResponse>`

Query RDAP information for a nameserver hostname.

```rust
let response = client.nameserver("ns1.google.com").await?;

println!("Hostname: {}", response.ldhName);
println!("IPv4: {:?}", response.ipAddresses.v4);
println!("IPv6: {:?}", response.ipAddresses.v6);
```

**Validation**:
- Hostname is normalized via IDNA
- Empty strings are rejected

**Bootstrap**: Uses IANA bootstrap to discover the authoritative RDAP server for the nameserver's TLD.

**Return type**: `NameserverResponse`
- `ldhName: String` – nameserver hostname (ASCII)
- `unicodeName: Option<String>` – Unicode representation
- `ipAddresses: NameserverIpAddresses` – IPv4 and IPv6 addresses
  - `ipAddresses.v4: Vec<String>` – IPv4 addresses
  - `ipAddresses.v6: Vec<String>` – IPv6 addresses
- `status: Vec<RdapStatus>` – status flags

### `entity(&self, handle: &str, server_url: &str) -> Result<EntityResponse>`

Query RDAP information for an entity (contact / registrar) by handle. Unlike other query types, entities do not have a global bootstrap endpoint; you must provide the server URL.

```rust
let response = client
    .entity("ARIN-HN-1", "https://rdap.arin.net/registry")
    .await?;

println!("Name: {}", response.fn_);
println!("Email: {:?}", response.email);
println!("Roles: {:?}", response.roles);
```

**Validation**:
- `handle` must not be empty
- `server_url` must not be empty
- `server_url` is validated via SSRF guard (HTTPS only)

**Bootstrap**: No bootstrap; the provided server URL is used directly.

**Return type**: `EntityResponse`
- `handle: String` – entity identifier
- `fn_: Option<String>` – formatted name
- `email: Option<String>` – email address
- `tel: Option<String>` – phone number
- `roles: Vec<RdapRole>` – roles (e.g., "administrative", "registrant", "technical")
- `status: Vec<RdapStatus>` – status flags

## Availability Checking

### `domain_available(&self, name: &str) -> Result<AvailabilityResult>`

Check whether a domain is available for registration (returns `available: true` if RDAP returns HTTP 404).

```rust
let result = client.domain_available("available-domain.com").await?;

if result.available {
    println!("Domain is available!");
} else {
    println!("Domain is registered, expires {}", result.expires_at.unwrap());
}
```

**Return type**: `AvailabilityResult`
- `domain: String` – the domain name
- `available: bool` – true if not registered (RDAP 404)
- `expires_at: Option<String>` – expiration date (if registered)

### `domain_available_batch(&self, names: Vec<String>, concurrency: Option<usize>) -> Vec<Result<AvailabilityResult>>`

Check availability for multiple domains concurrently.

```rust
let domains = vec![
    "google.com".to_string(),
    "example.com".to_string(),
    "notregistered.xyz".to_string(),
];

let results = client.domain_available_batch(domains, Some(5)).await;

for result in results {
    match result {
        Ok(avail) => {
            let status = if avail.available { "available" } else { "taken" };
            println!("{}: {}", avail.domain, status);
        }
        Err(e) => eprintln!("Error: {}", e),
    }
}
```

**Parameters**:
- `names`: list of domain names
- `concurrency`: max parallel queries (default: 10 if `None`)

**Return**: A vector of results maintaining input order.

## Streaming API

For bulk queries, use the streaming API to process results as they arrive, without waiting for all queries to complete.

### `stream_domain(&self, names: Vec<String>, config: StreamConfig) -> ReceiverStream<DomainEvent>`

Stream domain queries.

```rust
use futures::stream::StreamExt;

let domains = vec![
    "example.com".to_string(),
    "google.com".to_string(),
    "test.net".to_string(),
];

let mut stream = client.stream_domain(
    domains,
    StreamConfig {
        buffer_size: 10,
    },
);

while let Some(event) = stream.next().await {
    match event {
        DomainEvent::Result(response) => {
            println!("Domain: {}", response.ldhName);
        }
        DomainEvent::Error { query, error } => {
            eprintln!("Error querying {}: {}", query, error);
        }
    }
}
```

**Event type**: `DomainEvent`
- `Result(Box<DomainResponse>)` – successful response
- `Error { query: String, error: RdapError }` – query failed

### `stream_ip(&self, addresses: Vec<String>, config: StreamConfig) -> ReceiverStream<IpEvent>`

Stream IP queries (IPv4 and IPv6).

```rust
let ips = vec!["8.8.8.8".to_string(), "1.1.1.1".to_string()];
let mut stream = client.stream_ip(ips, StreamConfig { buffer_size: 5 });

while let Some(event) = stream.next().await {
    match event {
        IpEvent::Result(response) => println!("IP: {}", response.cidr_prefix.unwrap()),
        IpEvent::Error { query, error } => eprintln!("Error: {} – {}", query, error),
    }
}
```

### `stream_asn(&self, asns: Vec<String>, config: StreamConfig) -> ReceiverStream<AsnEvent>`

Stream ASN queries.

```rust
let asns = vec!["15169".to_string(), "8075".to_string()];
let mut stream = client.stream_asn(asns, StreamConfig { buffer_size: 5 });

while let Some(event) = stream.next().await {
    match event {
        AsnEvent::Result(response) => println!("ASN: {}", response.name.unwrap()),
        AsnEvent::Error { query, error } => eprintln!("Error: {}", error),
    }
}
```

### `stream_nameserver(&self, nameservers: Vec<String>, config: StreamConfig) -> ReceiverStream<NameserverEvent>`

Stream nameserver queries.

```rust
let nameservers = vec!["ns1.google.com".to_string()];
let mut stream = client.stream_nameserver(
    nameservers,
    StreamConfig { buffer_size: 5 },
);

while let Some(event) = stream.next().await {
    match event {
        NameserverEvent::Result(response) => {
            println!("Nameserver: {}", response.ldhName);
        }
        NameserverEvent::Error { query, error } => eprintln!("Error: {}", error),
    }
}
```

## Configuration

### ClientConfig

```rust
pub struct ClientConfig {
    pub fetcher: FetcherConfig,
    pub ssrf: SsrfConfig,
    pub cache: bool,
    pub bootstrap_url: Option<String>,
    pub custom_bootstrap_servers: HashMap<String, String>,
    pub reuse_connections: bool,
    pub max_connections_per_host: usize,
}
```

- `fetcher`: HTTP-level configuration
- `ssrf`: SSRF guard configuration
- `cache`: enable/disable query response caching
- `bootstrap_url`: custom IANA bootstrap endpoint (defaults to official IANA)
- `custom_bootstrap_servers`: per-TLD/ASN/IP-range RDAP server overrides
- `reuse_connections`: enable HTTP keep-alive
- `max_connections_per_host`: connection pool size per hostname

### FetcherConfig

```rust
pub struct FetcherConfig {
    pub timeout: Duration,
    pub user_agent: String,
    pub max_attempts: u32,
    pub initial_backoff: Duration,
    pub max_backoff: Duration,
    pub reuse_connections: bool,
    pub max_connections_per_host: usize,
}
```

- `timeout`: per-request timeout (default: 30s)
- `user_agent`: HTTP User-Agent header (default: "rdapify/[version]")
- `max_attempts`: number of retry attempts (default: 3)
- `initial_backoff`: starting delay before first retry (default: 100ms)
- `max_backoff`: maximum retry delay (default: 10s)
- `reuse_connections`: enable TCP keep-alive (default: true)
- `max_connections_per_host`: HTTP connection pool size (default: 10)

Retry strategy: exponential back-off. If a request fails due to transient errors (5xx, timeouts), the client retries with increasing delays, capping at `max_backoff`.

### SsrfConfig

```rust
pub struct SsrfConfig {
    pub enabled: bool,
    pub blocked_domains: Vec<String>,
    pub allowed_domains: Vec<String>,
}
```

- `enabled`: activate SSRF checks (default: true; never disable in production)
- `blocked_domains`: additional domain suffixes to block (default: empty)
- `allowed_domains`: if non-empty, only these domains are allowed (allowlist takes priority)

### StreamConfig

```rust
pub struct StreamConfig {
    pub buffer_size: usize,
}
```

- `buffer_size`: internal async channel capacity (default: 10; higher values consume more memory but allow more buffering)

## Error Handling

All public methods return `Result<T>` where `Result<T> = std::result::Result<T, RdapError>`.

The unified error type is `RdapError`:

```rust
pub enum RdapError {
    // Input validation
    InvalidInput(String),

    // SSRF protection
    SsrfBlocked { url: String, reason: String },
    InsecureScheme { scheme: String },

    // Bootstrap (server discovery)
    NoServerFound { query: String },
    BootstrapFetch { resource: String, source: Box<RdapError> },

    // Network & HTTP
    Network(reqwest::Error),
    HttpStatus { status: u16, url: String },
    Timeout { millis: u64, url: String },

    // Response parsing
    ParseError { reason: String },
    MissingObjectClass,
    UnknownObjectClass { class: String },

    // Cache
    Cache(String),

    // URL utilities
    InvalidUrl { url: String, source: url::ParseError },
}
```

### Error Examples

```rust
use rdapify::RdapError;

let client = RdapClient::new()?;

match client.domain("example.com").await {
    Ok(response) => println!("Success: {}", response.ldhName),
    Err(RdapError::InvalidInput(msg)) => {
        eprintln!("Bad input: {}", msg);
    }
    Err(RdapError::NoServerFound { query }) => {
        eprintln!("No RDAP server for: {}", query);
    }
    Err(RdapError::SsrfBlocked { url, reason }) => {
        eprintln!("Blocked by SSRF guard: {} – {}", url, reason);
    }
    Err(RdapError::HttpStatus { status, url }) => {
        eprintln!("HTTP {}: {}", status, url);
    }
    Err(RdapError::Timeout { millis, url }) => {
        eprintln!("Timeout after {}ms: {}", millis, url);
    }
    Err(e) => eprintln!("Error: {}", e),
}
```

## Common Patterns

### Retrying on Failure

```rust
use std::time::Duration;

async fn query_with_retry(
    client: &RdapClient,
    domain: &str,
    max_retries: usize,
) -> Result<DomainResponse, RdapError> {
    let mut retries = 0;
    loop {
        match client.domain(domain).await {
            Ok(response) => return Ok(response),
            Err(e) if retries < max_retries => {
                eprintln!("Retry {} failed: {}", retries, e);
                retries += 1;
                tokio::time::sleep(Duration::from_millis(100 * retries as u64)).await;
            }
            Err(e) => return Err(e),
        }
    }
}
```

### Batch Processing with Error Recovery

```rust
async fn process_domains(domains: Vec<&str>) -> Vec<(String, String)> {
    let client = RdapClient::new().expect("Failed to create client");
    let mut results = Vec::new();

    for domain in domains {
        match client.domain(domain).await {
            Ok(response) => {
                results.push((
                    domain.to_string(),
                    response.expires_at.map(|d| d.to_string()).unwrap_or_default(),
                ));
            }
            Err(e) => {
                eprintln!("Failed to query {}: {}", domain, e);
            }
        }
    }

    results
}
```

### Custom Configuration for High-Volume Queries

```rust
use rdapify::{RdapClient, ClientConfig, FetcherConfig};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = ClientConfig {
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(60),        // higher timeout
            max_attempts: 5,                         // more retries
            initial_backoff: Duration::from_millis(200),
            max_backoff: Duration::from_secs(30),
            reuse_connections: true,
            max_connections_per_host: 50,            // larger pool
        },
        ..Default::default()
    };

    let client = RdapClient::with_config(config)?;
    let domains = vec!["example.com", "google.com", "test.net"];

    for domain in domains {
        match client.domain(domain).await {
            Ok(resp) => println!("OK: {}", resp.ldhName),
            Err(e) => eprintln!("FAIL: {} – {}", domain, e),
        }
    }

    Ok(())
}
```

## Thread Safety

`RdapClient` is `Send + Sync` and cheap to clone. Share a single instance across threads or async tasks:

```rust
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Arc::new(RdapClient::new()?);

    let mut handles = vec![];

    for i in 0..5 {
        let client = client.clone();
        let handle = tokio::spawn(async move {
            let domain = format!("example{}.com", i);
            client.domain(&domain).await
        });
        handles.push(handle);
    }

    for handle in handles {
        let result = handle.await?;
        println!("Result: {:?}", result);
    }

    Ok(())
}
```

## Testing

Import test utilities from `rdapify`:

```rust
#[cfg(test)]
mod tests {
    use rdapify::RdapClient;

    #[tokio::test]
    async fn test_domain_query() {
        let client = RdapClient::new().expect("client creation failed");
        let result = client.domain("example.com").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_invalid_input() {
        let client = RdapClient::new().expect("client creation failed");
        let result = client.domain("invalid!domain.com").await;
        assert!(result.is_err());
    }
}
```

Use mockito for offline testing:

```rust
#[tokio::test]
async fn test_with_mock_server() {
    let mut mock_server = mockito::Server::new_async().await;
    let _m = mock_server
        .mock("GET", "/domain/example.com")
        .with_status(200)
        .with_body(r#"{"objectClassName":"domain","ldhName":"example.com"}"#)
        .create();

    // Use custom bootstrap_url pointing to mock_server...
}
```

## Dependency Management

RDAPify is published on crates.io. Add to `Cargo.toml`:

```toml
[dependencies]
rdapify = "0.4"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
serde_json = "1"  # for manual response inspection (optional)
```

Or use the low-level crates directly:

```toml
[dependencies]
rdap-client = "0.1"
rdap-types = "0.1"
rdap-core = "0.1"
```

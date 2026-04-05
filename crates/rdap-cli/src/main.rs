//! `rdapify` CLI binary.
//!
//! Usage examples:
//! ```
//! rdapify domain example.com
//! rdapify ip 8.8.8.8
//! rdapify asn 15169
//! rdapify asn AS15169
//! rdapify nameserver ns1.google.com
//! rdapify entity ARIN-HN-1 --server https://rdap.arin.net/registry
//!
//! # Pretty-print JSON output (default)
//! rdapify domain example.com
//!
//! # Raw JSON (machine-readable)
//! rdapify domain example.com --raw
//! ```

use clap::{Parser, Subcommand};
use rdapify_client::RdapClient;

#[derive(Parser)]
#[command(
    name = "rdapify",
    version,
    about = "Query RDAP registration data for domains, IPs, ASNs, nameservers, and entities",
    long_about = None,
)]
struct Cli {
    /// Output raw JSON (default: pretty-printed JSON)
    #[arg(long, global = true)]
    raw: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Query RDAP data for a domain name
    Domain {
        /// Domain name (e.g., example.com)
        domain: String,
    },

    /// Query RDAP data for an IP address
    Ip {
        /// IPv4 or IPv6 address (e.g., 8.8.8.8)
        ip: String,
    },

    /// Query RDAP data for an Autonomous System Number
    Asn {
        /// ASN number or prefixed form (e.g., 15169 or AS15169)
        asn: String,
    },

    /// Query RDAP data for a nameserver hostname
    Nameserver {
        /// Nameserver hostname (e.g., ns1.google.com)
        hostname: String,
    },

    /// Query RDAP data for an entity (contact / registrar)
    Entity {
        /// Entity handle (e.g., ARIN-HN-1)
        handle: String,

        /// RDAP server base URL (required — no global bootstrap for entities)
        #[arg(long, short)]
        server: String,
    },
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    if let Err(e) = run(cli).await {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

async fn run(cli: Cli) -> rdap_types::error::Result<()> {
    let client = RdapClient::new()?;

    let json_value: serde_json::Value = match cli.command {
        Command::Domain { domain } => {
            serde_json::to_value(client.domain(&domain).await?).expect("serialization cannot fail")
        }
        Command::Ip { ip } => {
            serde_json::to_value(client.ip(&ip).await?).expect("serialization cannot fail")
        }
        Command::Asn { asn } => {
            serde_json::to_value(client.asn(&asn).await?).expect("serialization cannot fail")
        }
        Command::Nameserver { hostname } => {
            serde_json::to_value(client.nameserver(&hostname).await?)
                .expect("serialization cannot fail")
        }
        Command::Entity { handle, server } => {
            serde_json::to_value(client.entity(&handle, &server).await?)
                .expect("serialization cannot fail")
        }
    };

    let output = if cli.raw {
        serde_json::to_string(&json_value).expect("serialization cannot fail")
    } else {
        serde_json::to_string_pretty(&json_value).expect("serialization cannot fail")
    };

    println!("{output}");
    Ok(())
}

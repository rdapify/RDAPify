//! `rdapify` CLI — query RDAP registration data from the command line.
//!
//! # Quick start
//!
//! ```bash
//! rdapify domain example.com
//! rdapify ip 8.8.8.8
//! rdapify asn 15169
//! rdapify ns ns1.google.com
//! rdapify batch domains.txt --concurrency 50 --json
//! rdapify batch domains.txt --csv > results.csv
//! ```
//!
//! # Exit codes
//!
//! | Code | Meaning        |
//! |------|----------------|
//! | 0    | success        |
//! | 1    | general error  |
//! | 2    | invalid input  |
//! | 3    | not found      |
//! | 4    | rate limited   |

mod batch_cmd;
mod config;
mod error;
mod output;

use clap::{CommandFactory, Parser, Subcommand};
use clap_complete::Shell;
use rdapify_client::RdapClient;

use config::load_cli_config;
use error::{exit_code, format_error};
use output::{resolve_format, OutputFormat};

// ── CLI definition ────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(
    name = "rdapify",
    version,
    about = "High-performance RDAP client — query domains, IPs, ASNs, and nameservers",
    long_about = "Query RDAP registration data for domains, IP addresses, ASNs, nameservers,\n\
                  and entities. Supports streaming batch lookups with progress reporting.",
    after_help = "EXAMPLES:\n  \
        rdapify domain google.com --pretty\n  \
        rdapify ip 8.8.8.8 --json\n  \
        rdapify asn 15169 --text\n  \
        rdapify batch domains.txt --concurrency 50 --json\n  \
        rdapify batch domains.txt --csv > results.csv\n  \
        rdapify completions bash >> ~/.bashrc"
)]
struct Cli {
    // ── Output format flags ───────────────────────────────────────────────────
    /// Compact JSON output (best for scripts and pipes)
    #[arg(long, global = true)]
    json: bool,

    /// Pretty-printed JSON output (default)
    #[arg(long, global = true)]
    pretty: bool,

    /// Human-readable text summary
    #[arg(long, global = true)]
    text: bool,

    /// CSV output (recommended for batch export)
    #[arg(long, global = true)]
    csv: bool,

    // ── Verbosity ─────────────────────────────────────────────────────────────
    /// Suppress all non-data output (progress, summaries)
    #[arg(long, short, global = true)]
    quiet: bool,

    /// Enable verbose/debug logging
    #[arg(long, short, global = true)]
    verbose: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Query RDAP data for a domain name
    ///
    /// Examples:
    ///   rdapify domain example.com
    ///   rdapify domain google.com --json
    Domain {
        /// Domain name (e.g., example.com or google.co.uk)
        domain: String,
    },

    /// Query RDAP data for an IP address
    ///
    /// Examples:
    ///   rdapify ip 8.8.8.8
    ///   rdapify ip 2001:4860:4860::8888 --text
    Ip {
        /// IPv4 or IPv6 address (e.g., 8.8.8.8 or 2001:db8::1)
        ip: String,
    },

    /// Query RDAP data for an Autonomous System Number
    ///
    /// Examples:
    ///   rdapify asn 15169
    ///   rdapify asn AS15169
    Asn {
        /// ASN number or prefixed form (e.g., 15169 or AS15169)
        asn: String,
    },

    /// Query RDAP data for a nameserver hostname
    ///
    /// Examples:
    ///   rdapify ns ns1.google.com
    Ns {
        /// Nameserver hostname (e.g., ns1.google.com)
        hostname: String,
    },

    /// Query RDAP data for an entity (contact or registrar)
    ///
    /// Examples:
    ///   rdapify entity ARIN-HN-1 --server https://rdap.arin.net/registry
    Entity {
        /// Entity handle (e.g., ARIN-HN-1)
        handle: String,

        /// RDAP server base URL (required — entities have no global bootstrap)
        #[arg(long, short)]
        server: String,
    },

    /// Run RDAP lookups for a list of queries from a file
    ///
    /// Reads one domain (or prefixed query) per line. Empty lines and
    /// lines starting with `#` are ignored. Supported prefixes:
    ///   domain:example.com  ip:8.8.8.8  asn:15169  ns:ns1.example.com
    ///
    /// Examples:
    ///   rdapify batch domains.txt --concurrency 50
    ///   rdapify batch queries.txt --csv > results.csv
    ///   rdapify batch domains.txt --json | jq .
    Batch {
        /// Path to input file (one query per line)
        file: String,

        /// Number of simultaneous RDAP requests [default: 50]
        #[arg(long, short, default_value = "50")]
        concurrency: usize,
    },

    /// Start the RDAP HTTP service (rdap-service)
    ///
    /// The service exposes a REST API on port 8080 (configurable via
    /// rdapify.toml). Requires `rdap-service` to be built and in PATH,
    /// or run `cargo run --bin rdap-service` directly.
    Serve,

    /// Show version information
    Version,

    /// Show current configuration
    ///
    /// Displays the config file path and effective settings.
    Config,

    /// Generate shell completion scripts
    ///
    /// Examples:
    ///   rdapify completions bash >> ~/.bashrc
    ///   rdapify completions zsh  >> ~/.zshrc
    ///   rdapify completions fish > ~/.config/fish/completions/rdapify.fish
    Completions {
        /// Shell to generate completions for
        shell: Shell,
    },
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let cfg = load_cli_config();

    let format = resolve_format(
        cli.json,
        cli.pretty,
        cli.text,
        cli.csv,
        cfg.default.format.as_deref(),
    );

    match run(cli, format, &cfg).await {
        Ok(()) => {}
        Err(e) => {
            let code = exit_code(&e);
            eprintln!("Error: {}", format_error(&e));
            std::process::exit(code);
        }
    }
}

// ── Command dispatch ──────────────────────────────────────────────────────────

async fn run(
    cli: Cli,
    format: OutputFormat,
    cfg: &config::CliConfig,
) -> rdap_types::error::Result<()> {
    match cli.command {
        Commands::Domain { domain } => {
            let client = RdapClient::new()?;
            let resp = client.domain(&domain).await?;
            format.print(&serde_json::to_value(resp).expect("serialization cannot fail"));
        }

        Commands::Ip { ip } => {
            let client = RdapClient::new()?;
            let resp = client.ip(&ip).await?;
            format.print(&serde_json::to_value(resp).expect("serialization cannot fail"));
        }

        Commands::Asn { asn } => {
            let client = RdapClient::new()?;
            let resp = client.asn(&asn).await?;
            format.print(&serde_json::to_value(resp).expect("serialization cannot fail"));
        }

        Commands::Ns { hostname } => {
            let client = RdapClient::new()?;
            let resp = client.nameserver(&hostname).await?;
            format.print(&serde_json::to_value(resp).expect("serialization cannot fail"));
        }

        Commands::Entity { handle, server } => {
            let client = RdapClient::new()?;
            let resp = client.entity(&handle, &server).await?;
            format.print(&serde_json::to_value(resp).expect("serialization cannot fail"));
        }

        Commands::Batch { file, concurrency } => {
            let concurrency = if concurrency == 50 {
                // CLI default: honour config file setting
                cfg.default.concurrency
            } else {
                concurrency
            };
            if let Err(msg) = batch_cmd::run_batch(&file, concurrency, format, cli.quiet).await {
                eprintln!("Error: {msg}");
                std::process::exit(1);
            }
        }

        Commands::Serve => {
            serve_command(cli.quiet).await;
        }

        Commands::Version => {
            print_version();
        }

        Commands::Config => {
            print_config(cfg);
        }

        Commands::Completions { shell } => {
            let mut cmd = Cli::command();
            clap_complete::generate(shell, &mut cmd, "rdapify", &mut std::io::stdout());
        }
    }

    Ok(())
}

// ── Sub-command implementations ───────────────────────────────────────────────

async fn serve_command(quiet: bool) {
    if !quiet {
        eprintln!("Starting rdap-service...");
        eprintln!("Press Ctrl+C to stop.");
    }

    let result = tokio::process::Command::new("rdap-service").status().await;

    match result {
        Ok(status) => {
            std::process::exit(status.code().unwrap_or(1));
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            eprintln!("Error: rdap-service binary not found.");
            eprintln!();
            eprintln!("Build it with:");
            eprintln!("  cargo build --release --bin rdap-service");
            eprintln!();
            eprintln!("Or run directly from the workspace:");
            eprintln!("  cargo run --bin rdap-service");
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("Error: failed to start rdap-service: {e}");
            std::process::exit(1);
        }
    }
}

fn print_version() {
    println!("rdapify     {}", env!("CARGO_PKG_VERSION"));
    println!("License:    Apache-2.0");
    println!("Repository: https://github.com/rdapify/RDAPify");
}

fn print_config(cfg: &config::CliConfig) {
    let path = config::config_path()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| "(unknown — $HOME not set)".into());

    let exists = config::config_path().map(|p| p.exists()).unwrap_or(false);

    println!("Config file: {path}");
    println!(
        "Exists:      {}",
        if exists { "yes" } else { "no (using defaults)" }
    );
    println!();
    println!("[default]");
    println!(
        "  format      = {}",
        cfg.default.format.as_deref().unwrap_or("pretty")
    );
    println!("  concurrency = {}", cfg.default.concurrency);
    println!();
    println!("[rate_limit]");
    println!("  global_rps   = {}", cfg.rate_limit.global_rps);
    println!("  per_host_rps = {}", cfg.rate_limit.per_host_rps);
}

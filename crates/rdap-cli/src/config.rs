//! CLI configuration loaded from `~/.rdapify/config.toml`.
//!
//! CLI flags always take precedence over config file values, which in turn
//! take precedence over compiled-in defaults.
//!
//! # Config file format
//!
//! ```toml
//! [default]
//! format = "json"      # json | pretty | text | csv
//! concurrency = 50
//!
//! [rate_limit]
//! global_rps = 100
//! per_host_rps = 10
//! ```

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// Top-level CLI configuration.
#[derive(Debug, Default, Deserialize, Serialize)]
pub struct CliConfig {
    #[serde(default)]
    pub default: DefaultConfig,
    #[serde(default)]
    pub rate_limit: RateLimitConfig,
}

/// `[default]` section — general CLI preferences.
#[derive(Debug, Deserialize, Serialize)]
pub struct DefaultConfig {
    /// Output format: "json" | "pretty" | "text" | "csv"
    pub format: Option<String>,
    /// Default concurrency for batch operations.
    pub concurrency: usize,
}

impl Default for DefaultConfig {
    fn default() -> Self {
        Self {
            format: None,
            concurrency: 50,
        }
    }
}

/// `[rate_limit]` section — outbound request throttling.
#[derive(Debug, Deserialize, Serialize)]
pub struct RateLimitConfig {
    pub global_rps: u32,
    pub per_host_rps: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            global_rps: 100,
            per_host_rps: 10,
        }
    }
}

/// Loads CLI config from `~/.rdapify/config.toml`.
/// Returns `Default` if the file does not exist or cannot be parsed.
pub fn load_cli_config() -> CliConfig {
    let Some(path) = config_path() else {
        return CliConfig::default();
    };
    let Ok(contents) = std::fs::read_to_string(&path) else {
        return CliConfig::default();
    };
    toml::from_str(&contents).unwrap_or_default()
}

/// Returns the path to the CLI config file, or `None` if `$HOME` is unset.
pub fn config_path() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()?;
    Some(PathBuf::from(home).join(".rdapify").join("config.toml"))
}

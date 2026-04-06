//! Config file discovery and loading.
//!
//! # Search order
//!
//! 1. `path` argument (from `--config` CLI flag) — error if explicitly given but missing
//! 2. `$RDAPIFY_CONFIG` environment variable — error if set but missing
//! 3. `./rdapify.toml` (current directory)
//! 4. `~/.rdapify/rdapify.toml`
//! 5. `/etc/rdapify/rdapify.toml`
//!
//! If no file is found at steps 3–5, defaults are used without error.

use std::path::{Path, PathBuf};

use crate::{
    config::RdapifyConfig, env::apply_env_overrides, validate::validate_config, ConfigError, Result,
};

/// Load configuration following the standard priority chain.
///
/// # Arguments
///
/// * `path` — explicit config file path (e.g. from `--config` CLI flag).
///   When `Some`, the file **must** exist or an error is returned.
///   When `None`, the standard search order is used.
///
/// # Steps
///
/// 1. Start with [`RdapifyConfig::default()`]
/// 2. Locate and parse the config file (TOML)
/// 3. Apply [`apply_env_overrides`] on top
/// 4. Run [`validate_config`]
/// 5. Return the final [`RdapifyConfig`]
pub fn load_config(path: Option<PathBuf>) -> Result<RdapifyConfig> {
    // Step 1: defaults
    let mut config = RdapifyConfig::default();

    // Step 2: locate and parse config file
    if let Some(file_path) = resolve_config_path(path)? {
        let contents =
            std::fs::read_to_string(&file_path).map_err(|source| ConfigError::ReadError {
                path: file_path.display().to_string(),
                source,
            })?;
        config = toml::from_str(&contents).map_err(|source| ConfigError::ParseError {
            path: file_path.display().to_string(),
            source,
        })?;
    }

    // Step 3: env overrides
    apply_env_overrides(&mut config)?;

    // Step 4: validate
    validate_config(&config)?;

    Ok(config)
}

/// Expand a leading `~/` in a path string to the current user's home directory.
///
/// Falls back to the raw string if `$HOME` / `$USERPROFILE` is not set.
pub fn expand_tilde(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }
    PathBuf::from(path)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/// Resolve which config file to load, returning `None` when no file is found
/// and no explicit path was given.
fn resolve_config_path(explicit: Option<PathBuf>) -> Result<Option<PathBuf>> {
    // Priority 1: --config flag
    if let Some(path) = explicit {
        return if path.exists() {
            Ok(Some(path))
        } else {
            Err(ConfigError::FileNotFound(path.display().to_string()))
        };
    }

    // Priority 2: $RDAPIFY_CONFIG
    if let Ok(val) = std::env::var("RDAPIFY_CONFIG") {
        let path = PathBuf::from(&val);
        return if path.exists() {
            Ok(Some(path))
        } else {
            Err(ConfigError::FileNotFound(val))
        };
    }

    // Priority 3: ./rdapify.toml
    let local = PathBuf::from("rdapify.toml");
    if local.exists() {
        return Ok(Some(local));
    }

    // Priority 4: ~/.rdapify/rdapify.toml
    if let Some(home) = home_dir() {
        let home_cfg = home.join(".rdapify").join("rdapify.toml");
        if home_cfg.exists() {
            return Ok(Some(home_cfg));
        }
    }

    // Priority 5: /etc/rdapify/rdapify.toml
    let system = Path::new("/etc/rdapify/rdapify.toml");
    if system.exists() {
        return Ok(Some(system.to_path_buf()));
    }

    // No file found — use pure defaults
    Ok(None)
}

fn home_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| std::env::var("USERPROFILE").ok().map(PathBuf::from))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_with_no_file_returns_defaults() {
        // Ensure RDAPIFY_CONFIG is not set so this test uses pure defaults.
        std::env::remove_var("RDAPIFY_CONFIG");
        // The test runs in the workspace directory which has no rdapify.toml,
        // so load_config(None) should return defaults without error.
        // (If a rdapify.toml happens to exist it is parsed instead — still ok.)
        let result = load_config(None);
        assert!(result.is_ok(), "expected Ok, got: {:?}", result);
    }

    #[test]
    fn explicit_missing_path_returns_error() {
        let result = load_config(Some(PathBuf::from("/nonexistent/rdapify.toml")));
        assert!(matches!(result, Err(ConfigError::FileNotFound(_))));
    }

    #[test]
    fn parse_valid_toml_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("rdapify.toml");
        std::fs::write(
            &path,
            r#"
[rdap]
timeout_seconds = 20

[logging]
level = "debug"
"#,
        )
        .unwrap();

        let cfg = load_config(Some(path)).unwrap();
        assert_eq!(cfg.rdap.timeout_seconds, 20);
        assert_eq!(cfg.logging.level, crate::config::LogLevel::Debug);
        // Fields not in file must still have defaults
        assert_eq!(cfg.server.port, 8080);
    }

    #[test]
    fn parse_invalid_toml_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("rdapify.toml");
        std::fs::write(&path, "not valid toml }{{{").unwrap();
        let result = load_config(Some(path));
        assert!(matches!(result, Err(ConfigError::ParseError { .. })));
    }

    #[test]
    fn validation_failure_from_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("rdapify.toml");
        std::fs::write(
            &path,
            r#"
[rdap]
timeout_seconds = 999
"#,
        )
        .unwrap();
        let result = load_config(Some(path));
        assert!(matches!(result, Err(ConfigError::ValidationError { .. })));
    }

    #[test]
    fn expand_tilde_replaces_home() {
        std::env::set_var("HOME", "/home/testuser");
        let expanded = expand_tilde("~/.rdapify/cache.db");
        assert_eq!(expanded, PathBuf::from("/home/testuser/.rdapify/cache.db"));
    }

    #[test]
    fn expand_tilde_noop_for_absolute_path() {
        let path = "/etc/rdapify/rdapify.toml";
        assert_eq!(expand_tilde(path), PathBuf::from(path));
    }
}

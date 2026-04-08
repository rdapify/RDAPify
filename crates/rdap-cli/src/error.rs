//! Exit code mapping and error formatting for the CLI.
//!
//! Exit codes follow a consistent convention:
//! - 0: success
//! - 1: general / unexpected error
//! - 2: invalid input (bad domain, IP, ASN format)
//! - 3: not found (no RDAP server, HTTP 404)
//! - 4: rate limited

use rdap_types::error::RdapError;

/// Maps an `RdapError` to a Unix process exit code.
pub fn exit_code(e: &RdapError) -> i32 {
    match e {
        RdapError::InvalidInput(_) | RdapError::InvalidUrl { .. } => 2,
        RdapError::NoServerFound { .. } => 3,
        RdapError::HttpStatus { status: 404, .. } => 3,
        RdapError::RateLimited { .. } => 4,
        _ => 1,
    }
}

/// Formats an error for stderr, with a human-readable prefix.
pub fn format_error(e: &RdapError) -> String {
    match e {
        RdapError::InvalidInput(msg) => format!("Invalid input: {msg}"),
        RdapError::NoServerFound { query } => format!("No RDAP server found for: {query}"),
        RdapError::RateLimited { host, wait_time } => {
            format!("Rate limited by {host} — retry after {wait_time:.1?}")
        }
        RdapError::Timeout { millis, url } => format!("Timed out after {millis}ms: {url}"),
        RdapError::HttpStatus { status, url } => format!("HTTP {status}: {url}"),
        RdapError::SsrfBlocked { url, reason } => {
            format!("SSRF protection blocked: {url} ({reason})")
        }
        other => other.to_string(),
    }
}

//! RDAP response `Content-Type` validation.
//!
//! Per RFC 9083 §4.1 the media type for RDAP responses is
//! `application/rdap+json`. Many registries also return plain
//! `application/json`, which is accepted here for compatibility.

use reqwest::header::HeaderMap;

use crate::error::SecurityError;

/// Validates that the response `Content-Type` is acceptable for an RDAP
/// response.
///
/// Accepted values (parameters such as `; charset=utf-8` are ignored):
///
/// * `application/rdap+json`
/// * `application/json`
///
/// Returns [`SecurityError::InvalidContentType`] for anything else, including
/// a missing header.
pub fn validate_rdap_content_type(headers: &HeaderMap) -> Result<(), SecurityError> {
    let raw = headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // Strip parameters (e.g., "; charset=utf-8").
    let mime = raw.split(';').next().unwrap_or("").trim();

    match mime {
        "application/rdap+json" | "application/json" => Ok(()),
        _ => Err(SecurityError::InvalidContentType),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};

    fn headers_with(value: &str) -> HeaderMap {
        let mut m = HeaderMap::new();
        m.insert(CONTENT_TYPE, HeaderValue::from_str(value).unwrap());
        m
    }

    #[test]
    fn accepts_rdap_json() {
        assert!(validate_rdap_content_type(&headers_with("application/rdap+json")).is_ok());
    }

    #[test]
    fn accepts_application_json() {
        assert!(validate_rdap_content_type(&headers_with("application/json")).is_ok());
    }

    #[test]
    fn accepts_rdap_json_with_charset() {
        assert!(
            validate_rdap_content_type(&headers_with("application/rdap+json; charset=utf-8"))
                .is_ok()
        );
    }

    #[test]
    fn rejects_text_html() {
        assert!(matches!(
            validate_rdap_content_type(&headers_with("text/html")),
            Err(SecurityError::InvalidContentType)
        ));
    }

    #[test]
    fn rejects_missing_header() {
        assert!(matches!(
            validate_rdap_content_type(&HeaderMap::new()),
            Err(SecurityError::InvalidContentType)
        ));
    }
}

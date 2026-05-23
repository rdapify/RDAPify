use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use rdap_types::error::RdapError;
use serde_json::json;

/// Newtype wrapper that makes `RdapError` usable as an Axum response.
pub struct ServiceError(pub RdapError);

impl IntoResponse for ServiceError {
    fn into_response(self) -> Response {
        let status =
            StatusCode::from_u16(self.0.status_code()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

        let body = Json(json!({
            "error": error_code(&self.0),
            "message": self.0.to_string(),
        }));

        (status, body).into_response()
    }
}

impl From<RdapError> for ServiceError {
    fn from(e: RdapError) -> Self {
        ServiceError(e)
    }
}

fn error_code(err: &RdapError) -> &'static str {
    match err {
        RdapError::InvalidInput(_) | RdapError::InvalidUrl { .. } => "invalid_input",
        RdapError::SsrfBlocked { .. } | RdapError::InsecureScheme { .. } => "forbidden",
        RdapError::NoServerFound { .. } => "not_found",
        RdapError::HttpStatus { status: 404, .. } => "not_found",
        RdapError::HttpStatus { .. } => "upstream_error",
        RdapError::Timeout { .. } => "timeout",
        RdapError::Network(_) | RdapError::BootstrapFetch { .. } => "upstream_error",
        RdapError::RateLimited { .. } => "rate_limited",
        RdapError::CircuitOpen { .. } => "upstream_unavailable",
        RdapError::ParseError { .. }
        | RdapError::MissingObjectClass
        | RdapError::UnknownObjectClass { .. }
        | RdapError::Cache(_) => "internal_error",
    }
}

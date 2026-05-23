use std::time::Instant;

use axum::{extract::State, Json};
use rdap_types::{
    error::RdapError,
    {AsnResponse, DomainResponse, IpResponse, NameserverResponse},
};
use serde::{Deserialize, Serialize};

use crate::{error::ServiceError, state::AppState};

/// Request body for `POST /rdap`.
#[derive(Deserialize)]
pub struct RdapRequest {
    /// The value to look up (domain name, IP address, ASN, or nameserver hostname).
    pub query: String,
    /// Query type: `"domain"`, `"ip"`, `"asn"`, or `"nameserver"`.
    pub kind: String,
}

/// Untagged response enum — serialises as the inner type directly.
#[derive(Serialize)]
#[serde(untagged)]
pub enum RdapResponse {
    Domain(DomainResponse),
    Ip(IpResponse),
    Asn(AsnResponse),
    Nameserver(NameserverResponse),
}

impl RdapResponse {
    fn cached(&self) -> bool {
        match self {
            RdapResponse::Domain(r) => r.meta.cached,
            RdapResponse::Ip(r) => r.meta.cached,
            RdapResponse::Asn(r) => r.meta.cached,
            RdapResponse::Nameserver(r) => r.meta.cached,
        }
    }
}

/// Single RDAP lookup endpoint.
///
/// Dispatches to the appropriate `RdapClient` method based on `kind`, records
/// cache hit/miss metrics, and logs the query result.
pub async fn rdap_lookup(
    State(state): State<AppState>,
    Json(req): Json<RdapRequest>,
) -> Result<Json<RdapResponse>, ServiceError> {
    let start = Instant::now();
    state.metrics.http_requests_total.inc();
    state.metrics.rdap_requests_total.inc();

    let result: Result<RdapResponse, RdapError> = match req.kind.as_str() {
        "domain" => state
            .client
            .domain(&req.query)
            .await
            .map(RdapResponse::Domain),
        "ip" => state.client.ip(&req.query).await.map(RdapResponse::Ip),
        "asn" => state.client.asn(&req.query).await.map(RdapResponse::Asn),
        "nameserver" => state
            .client
            .nameserver(&req.query)
            .await
            .map(RdapResponse::Nameserver),
        other => {
            return Err(ServiceError::from(RdapError::InvalidInput(format!(
                "Unknown query kind '{other}'. Expected: domain, ip, asn, nameserver"
            ))))
        }
    };

    let response = match result {
        Ok(r) => r,
        Err(e) => {
            match &e {
                RdapError::Timeout { .. } => {
                    state.metrics.rdap_errors_timeout_total.inc();
                }
                RdapError::RateLimited { .. } => {
                    state.metrics.rdap_errors_rate_limited_total.inc();
                }
                RdapError::HttpStatus { .. } | RdapError::Network(_) => {
                    state.metrics.rdap_errors_http_total.inc();
                }
                _ => {}
            }
            tracing::warn!(
                event = "rdap_error",
                kind = %req.kind,
                query = %req.query,
                error = %e,
            );
            return Err(ServiceError::from(e));
        }
    };

    let latency = start.elapsed();
    state
        .metrics
        .http_request_duration_seconds
        .observe(latency.as_secs_f64());

    if response.cached() {
        state.metrics.cache_hits_total.inc();
    } else {
        state.metrics.cache_misses_total.inc();
    }

    tracing::info!(
        event = "rdap_query",
        kind = %req.kind,
        query = %req.query,
        cached = response.cached(),
        latency_ms = latency.as_millis() as u64,
    );

    Ok(Json(response))
}

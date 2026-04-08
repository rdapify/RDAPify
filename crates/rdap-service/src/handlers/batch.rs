use std::sync::Arc;

use axum::{extract::State, http::StatusCode, Json};
use futures::StreamExt;
use rdap_batch::{
    BatchConfig, BatchExecutor, BatchItemResult, BatchQuery, ErrorCategory, RdapResponse,
};
use rdap_types::error::RdapError;
use serde::{Deserialize, Serialize};

use crate::{error::ServiceError, state::AppState};

/// Maximum number of queries allowed in a single batch request.
const MAX_BATCH_SIZE: usize = 100;

/// Request body for `POST /batch`.
#[derive(Deserialize)]
pub struct BatchRequest {
    /// Domain names to check for availability.
    pub queries: Vec<String>,
    /// Maximum concurrent RDAP queries (default: 10, capped at 50).
    pub concurrency: Option<usize>,
}

/// Result for a single domain in a batch response.
#[derive(Serialize)]
pub struct BatchDomainResult {
    pub domain: String,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    /// Set when this specific query failed; other items may still succeed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Batch domain-availability lookup endpoint.
///
/// Uses the streaming batch engine (`buffer_unordered`) to keep `concurrency`
/// queries in-flight at all times. Partial failures are reported per-item.
pub async fn batch_lookup(
    State(state): State<AppState>,
    Json(req): Json<BatchRequest>,
) -> Result<(StatusCode, Json<Vec<BatchDomainResult>>), ServiceError> {
    if req.queries.is_empty() {
        return Err(ServiceError::from(RdapError::InvalidInput(
            "queries must not be empty".to_string(),
        )));
    }
    if req.queries.len() > MAX_BATCH_SIZE {
        return Err(ServiceError::from(RdapError::InvalidInput(format!(
            "queries exceeds maximum batch size of {MAX_BATCH_SIZE}"
        ))));
    }

    state.metrics.http_requests_total.inc();
    state.metrics.batch_jobs_total.inc();

    let concurrency = req.concurrency.map(|c| c.min(50)).unwrap_or(10);

    let domain_names: Vec<String> = req.queries.clone();
    let queries: Vec<BatchQuery> = domain_names
        .iter()
        .map(|d| BatchQuery::Domain(d.clone()))
        .collect();

    let executor = BatchExecutor::new(Arc::clone(&state.client));
    let cfg = BatchConfig {
        concurrency,
        ordered: true, // preserve input order for the response
        buffer: 64,
    };

    let mut stream = executor.run_stream(queries, cfg);
    let mut items: Vec<BatchDomainResult> = Vec::with_capacity(domain_names.len());
    let mut name_iter = domain_names.into_iter();

    while let Some(batch_result) = stream.next().await {
        let domain = name_iter.next().unwrap_or_default();
        let item = match batch_result {
            BatchItemResult::Ok(RdapResponse::Domain(r)) => BatchDomainResult {
                domain,
                available: false,
                expires_at: r.expiration_date().map(str::to_owned),
                error: None,
            },
            BatchItemResult::Err(e) if e.category == ErrorCategory::NotFound => BatchDomainResult {
                domain,
                available: true,
                expires_at: None,
                error: None,
            },
            BatchItemResult::Err(e) => BatchDomainResult {
                domain,
                available: false,
                expires_at: None,
                error: Some(e.to_string()),
            },
            // Safety: only Domain queries are submitted; other variants are unreachable.
            BatchItemResult::Ok(_) => unreachable!("only Domain queries submitted"),
        };
        items.push(item);
    }

    tracing::info!(
        event = "batch_lookup",
        count = items.len(),
        errors = items.iter().filter(|i| i.error.is_some()).count(),
    );

    Ok((StatusCode::OK, Json(items)))
}

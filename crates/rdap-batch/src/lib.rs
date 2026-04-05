//! Batch RDAP query execution with concurrency control.

#![forbid(unsafe_code)]

use rdap_types::{error::Result, AvailabilityResult};
use rdapify_client::RdapClient;

/// Executes batch RDAP queries with configurable concurrency.
pub struct BatchExecutor {
    client: RdapClient,
}

impl BatchExecutor {
    pub fn new(client: RdapClient) -> Self {
        Self { client }
    }

    /// Checks availability for multiple domains concurrently.
    ///
    /// Runs up to `concurrency` queries in parallel (default: 10).
    pub async fn domain_available_batch(
        &self,
        names: Vec<String>,
        concurrency: Option<usize>,
    ) -> Vec<Result<AvailabilityResult>> {
        self.client.domain_available_batch(names, concurrency).await
    }
}

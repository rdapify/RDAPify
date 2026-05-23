//! RDAP HTTP client core: fetcher, normalizer, retry logic, and response validation.

#![forbid(unsafe_code)]

pub mod circuit_breaker;
pub mod error_class;
pub mod fetcher;
pub mod normalizer;
pub mod validation;

pub use circuit_breaker::{
    CircuitBreaker, CircuitBreakerRegistry, CircuitState, Origin, DEFAULT_COOLDOWN_MS,
    DEFAULT_FAILURE_THRESHOLD,
};
pub use error_class::{classify_error, classify_retry, ErrorClass, RetryClass};
pub use fetcher::{Fetcher, FetcherConfig};
pub use normalizer::Normalizer;
pub use validation::{validate_rdap_response, RdapValidationLimits, ValidationError};

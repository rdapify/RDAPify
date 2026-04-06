//! RDAP HTTP client core: fetcher, normalizer, retry logic, and response validation.

#![forbid(unsafe_code)]

pub mod fetcher;
pub mod normalizer;
pub mod validation;

pub use fetcher::{Fetcher, FetcherConfig};
pub use normalizer::Normalizer;
pub use validation::{validate_rdap_response, RdapValidationLimits, ValidationError};

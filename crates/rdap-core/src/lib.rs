//! RDAP HTTP client core: fetcher, normalizer, and retry logic.

#![forbid(unsafe_code)]

pub mod fetcher;
pub mod normalizer;

pub use fetcher::{Fetcher, FetcherConfig};
pub use normalizer::Normalizer;

//! Response-body size limiting.
//!
//! [`read_limited`] streams the response body in chunks and stops as soon as
//! the accumulated size would exceed `max_size`, preventing memory exhaustion
//! from maliciously large or misconfigured RDAP servers.

use bytes::Bytes;
use reqwest::Response;

use crate::error::SecurityError;

/// Reads the body of `response` up to `max_size` bytes.
///
/// # Errors
///
/// * [`SecurityError::ResponseTooLarge`] — if the `Content-Length` header
///   already exceeds `max_size`, or if the streamed body grows beyond it.
/// * [`SecurityError::Network`] — for any transport error while reading chunks.
pub async fn read_limited(response: Response, max_size: usize) -> Result<Bytes, SecurityError> {
    // Fast-path: reject immediately if Content-Length already exceeds the limit.
    if let Some(len) = response.content_length() {
        if len as usize > max_size {
            return Err(SecurityError::ResponseTooLarge);
        }
    }

    // Stream body in chunks, accumulating into a single buffer.
    let mut buf: Vec<u8> = Vec::new();
    let mut stream = response;

    while let Some(chunk) = stream.chunk().await.map_err(SecurityError::Network)? {
        if buf.len() + chunk.len() > max_size {
            return Err(SecurityError::ResponseTooLarge);
        }
        buf.extend_from_slice(&chunk);
    }

    Ok(Bytes::from(buf))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    // Integration tests for read_limited require a live HTTP server; they live
    // in the integration test suite.  Unit coverage for the Content-Length
    // fast-path is provided there via mockito.
}

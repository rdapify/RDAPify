//! Python binding for rdapify — built with PyO3.
//!
//! Exposes all 5 query types as synchronous Python functions
//! (using tokio::runtime::Runtime under the hood).

use pyo3::prelude::*;
use pyo3::types::{PyDict, PyModule};
use rdapify::{AsnEvent, NameserverEvent, RdapClient, StreamConfig};

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Runtime::new().expect("failed to create Tokio runtime")
}

fn client() -> PyResult<RdapClient> {
    RdapClient::new().map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e.to_string()))
}

fn to_py_dict<T: serde::Serialize>(py: Python<'_>, value: &T) -> PyResult<Py<PyDict>> {
    let json = serde_json::to_string(value)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let json_module = PyModule::import_bound(py, "json")?;
    let result = json_module.call_method1("loads", (json,))?;
    result.extract::<Py<PyDict>>()
}

/// Query RDAP information for a domain name.
///
/// :param domain_name: Domain name (e.g. "example.com"). Unicode IDNs supported.
/// :returns: Dictionary with normalised RDAP domain data.
#[pyfunction]
fn domain(py: Python<'_>, domain_name: &str) -> PyResult<Py<PyDict>> {
    let c = client()?;
    let result = runtime()
        .block_on(c.domain(domain_name))
        .map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e.to_string()))?;
    to_py_dict(py, &result)
}

/// Query RDAP information for an IP address (IPv4 or IPv6).
///
/// :param ip_address: IP address string (e.g. "8.8.8.8").
/// :returns: Dictionary with normalised RDAP IP network data.
#[pyfunction]
fn ip(py: Python<'_>, ip_address: &str) -> PyResult<Py<PyDict>> {
    let c = client()?;
    let result = runtime()
        .block_on(c.ip(ip_address))
        .map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e.to_string()))?;
    to_py_dict(py, &result)
}

/// Query RDAP information for an Autonomous System Number.
///
/// :param asn_value: ASN as string: "15169" or "AS15169".
/// :returns: Dictionary with normalised RDAP autnum data.
#[pyfunction]
fn asn(py: Python<'_>, asn_value: &str) -> PyResult<Py<PyDict>> {
    let c = client()?;
    let result = runtime()
        .block_on(c.asn(asn_value))
        .map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e.to_string()))?;
    to_py_dict(py, &result)
}

/// Query RDAP information for a nameserver hostname.
///
/// :param hostname: Nameserver hostname (e.g. "ns1.google.com").
/// :returns: Dictionary with normalised RDAP nameserver data.
#[pyfunction]
fn nameserver(py: Python<'_>, hostname: &str) -> PyResult<Py<PyDict>> {
    let c = client()?;
    let result = runtime()
        .block_on(c.nameserver(hostname))
        .map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e.to_string()))?;
    to_py_dict(py, &result)
}

/// Query RDAP information for an entity (contact / registrar).
///
/// :param handle: Entity handle (e.g. "ARIN-HN-1").
/// :param server_url: RDAP server base URL (e.g. "https://rdap.arin.net/registry").
/// :returns: Dictionary with normalised RDAP entity data.
#[pyfunction]
fn entity(py: Python<'_>, handle: &str, server_url: &str) -> PyResult<Py<PyDict>> {
    let c = client()?;
    let result = runtime()
        .block_on(c.entity(handle, server_url))
        .map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e.to_string()))?;
    to_py_dict(py, &result)
}

/// Check whether a single domain name is available for registration.
///
/// :param name: Domain name (e.g. "example.com").
/// :returns: Dictionary with keys ``available`` (bool) and ``expires_at`` (str or None).
#[pyfunction]
fn domain_available(py: Python<'_>, name: &str) -> PyResult<Py<PyDict>> {
    let c = client()?;
    let result = runtime()
        .block_on(c.domain_available(name))
        .map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(e.to_string()))?;
    let dict = PyDict::new_bound(py);
    dict.set_item("available", result.available)?;
    dict.set_item("expires_at", result.expires_at)?;
    Ok(dict.unbind())
}

/// Check domain availability for a batch of domain names concurrently.
///
/// :param names: List of domain name strings.
/// :returns: List of dicts, each with keys ``name``, ``available``, ``expires_at``, ``error``.
#[pyfunction]
fn domain_available_batch(py: Python<'_>, names: Vec<String>) -> PyResult<Vec<Py<PyDict>>> {
    let c = client()?;
    let results = runtime().block_on(c.domain_available_batch(names.clone(), None));
    let mut output = Vec::with_capacity(results.len());
    for (i, res) in results.into_iter().enumerate() {
        let dict = PyDict::new_bound(py);
        let name = names.get(i).map(|s| s.as_str()).unwrap_or("?");
        match res {
            Ok(avail) => {
                dict.set_item("name", &avail.domain)?;
                dict.set_item("available", avail.available)?;
                dict.set_item("expires_at", avail.expires_at)?;
                dict.set_item("error", py.None())?;
            }
            Err(e) => {
                dict.set_item("name", name)?;
                dict.set_item("available", false)?;
                dict.set_item("expires_at", py.None())?;
                dict.set_item("error", e.to_string())?;
            }
        }
        output.push(dict.unbind());
    }
    Ok(output)
}

/// Stream RDAP ASN results for multiple queries, collecting all into a list.
///
/// :param queries: List of ASN strings (e.g. ["AS15169", "AS32934"]).
/// :returns: List of dicts with keys ``query``, ``result`` (dict or None), ``error`` (str or None).
#[pyfunction]
fn stream_asn(py: Python<'_>, queries: Vec<String>) -> PyResult<Vec<Py<PyDict>>> {
    let c = client()?;
    let events: Vec<AsnEvent> = runtime().block_on(
        tokio_stream::StreamExt::collect::<Vec<_>>(c.stream_asn(queries, StreamConfig::default())),
    );
    let mut output = Vec::with_capacity(events.len());
    for event in events {
        let dict = PyDict::new_bound(py);
        match event {
            AsnEvent::Result(r) => {
                let query = r.query.to_string();
                let result_dict = to_py_dict(py, r.as_ref())?;
                dict.set_item("query", query)?;
                dict.set_item("result", result_dict)?;
                dict.set_item("error", py.None())?;
            }
            AsnEvent::Error { query, error } => {
                dict.set_item("query", query)?;
                dict.set_item("result", py.None())?;
                dict.set_item("error", error.to_string())?;
            }
        }
        output.push(dict.unbind());
    }
    Ok(output)
}

/// Stream RDAP nameserver results for multiple queries, collecting all into a list.
///
/// :param queries: List of nameserver hostnames (e.g. ["ns1.google.com"]).
/// :returns: List of dicts with keys ``query``, ``result`` (dict or None), ``error`` (str or None).
#[pyfunction]
fn stream_nameserver(py: Python<'_>, queries: Vec<String>) -> PyResult<Vec<Py<PyDict>>> {
    let c = client()?;
    let events: Vec<NameserverEvent> = runtime().block_on(
        tokio_stream::StreamExt::collect::<Vec<_>>(
            c.stream_nameserver(queries, StreamConfig::default()),
        ),
    );
    let mut output = Vec::with_capacity(events.len());
    for event in events {
        let dict = PyDict::new_bound(py);
        match event {
            NameserverEvent::Result(r) => {
                let query = r.query.clone();
                let result_dict = to_py_dict(py, r.as_ref())?;
                dict.set_item("query", query)?;
                dict.set_item("result", result_dict)?;
                dict.set_item("error", py.None())?;
            }
            NameserverEvent::Error { query, error } => {
                dict.set_item("query", query)?;
                dict.set_item("result", py.None())?;
                dict.set_item("error", error.to_string())?;
            }
        }
        output.push(dict.unbind());
    }
    Ok(output)
}

/// rdapify_py — Unified RDAP client for Python, powered by Rust.
#[pymodule]
#[pyo3(name = "rdapify_py")]
fn rdapify_py(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(domain, m)?)?;
    m.add_function(wrap_pyfunction!(ip, m)?)?;
    m.add_function(wrap_pyfunction!(asn, m)?)?;
    m.add_function(wrap_pyfunction!(nameserver, m)?)?;
    m.add_function(wrap_pyfunction!(entity, m)?)?;
    m.add_function(wrap_pyfunction!(domain_available, m)?)?;
    m.add_function(wrap_pyfunction!(domain_available_batch, m)?)?;
    m.add_function(wrap_pyfunction!(stream_asn, m)?)?;
    m.add_function(wrap_pyfunction!(stream_nameserver, m)?)?;
    m.add("__version__", env!("CARGO_PKG_VERSION"))?;
    Ok(())
}

# RDAPify Benchmarks

Performance benchmarking suite for RDAPify library.

## Status

🚧 **Under Development** - Benchmarks will be added in a future release (planned for v0.1.8).

## Planned Benchmarks

### Cache Performance
- Cache hit/miss ratios
- Cache lookup latency
- Memory usage patterns
- TTL effectiveness

### Query Performance
- Domain lookup latency
- IP lookup latency
- ASN lookup latency
- Batch processing throughput

### Memory Usage
- Memory footprint analysis
- Memory leak detection
- Cache size optimization
- GC impact measurement

### Throughput Testing
- Concurrent query handling
- Rate limiting effectiveness
- Connection pooling efficiency
- Bootstrap discovery performance

## Directory Structure

```
benchmarks/
├── README.md          # This file
├── scripts/           # Benchmark scripts
├── data/              # Test data and fixtures
└── results/           # Benchmark results and reports
```

## Running Benchmarks

Benchmarks will be available in future releases. To run them:

```bash
npm run benchmark
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on adding new benchmarks.

---

**Note**: This is a placeholder for future benchmark implementation. The library is currently at v0.1.7 (alpha). Benchmarks are planned for v0.1.8.

# Benchmark Scripts

This directory contains scripts for running performance benchmarks and generating reports.

## Available Scripts

Scripts for testing:
- Query performance
- Cache efficiency
- Memory profiling
- Load testing
- Comparison benchmarks

## Running Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark
node benchmarks/scripts/query-performance.js

# Generate report
node benchmarks/scripts/generate-report.js
```

## Requirements

- Node.js 16+
- Sufficient system resources
- Network access for live tests

## Output

Results are saved to `../results/` directory with timestamps.

## Contributing

When adding scripts:
1. Use consistent output format
2. Include progress indicators
3. Handle errors gracefully
4. Document parameters

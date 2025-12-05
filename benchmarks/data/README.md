# Benchmark Data

This directory contains test data and datasets used for performance benchmarking.

## Contents

- Sample RDAP responses
- Test query lists
- Performance baseline data
- Comparison datasets

## Data Format

Data files are typically in JSON format, matching RDAP response structures.

## Usage

Benchmark scripts in `../scripts/` use this data to measure:
- Query performance
- Cache efficiency
- Memory usage
- Normalization speed

## Adding Data

When adding benchmark data:
1. Use realistic RDAP responses
2. Include variety (domains, IPs, ASNs)
3. Document data sources
4. Anonymize sensitive information

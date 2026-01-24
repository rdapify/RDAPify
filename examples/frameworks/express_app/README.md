# Express.js Integration Example

REST API server using RDAPify with Express.js.

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

Server will start at `http://localhost:3000`

## API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### Domain Lookup
```bash
curl http://localhost:3000/api/domain/example.com
```

### IP Lookup
```bash
curl http://localhost:3000/api/ip/8.8.8.8
```

### ASN Lookup
```bash
curl http://localhost:3000/api/asn/15169
```

### Batch Query
```bash
curl -X POST http://localhost:3000/api/batch \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      {"type": "domain", "value": "example.com"},
      {"type": "ip", "value": "8.8.8.8"},
      {"type": "asn", "value": 15169}
    ]
  }'
```

## Features

- RESTful API design
- Error handling middleware
- Batch query support
- Built-in caching
- PII redaction enabled

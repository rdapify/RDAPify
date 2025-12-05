# Playground API

Backend API for the RDAPify interactive playground.

## Purpose

Provides API endpoints for the playground web interface to:
- Execute RDAP queries
- Test different configurations
- Demonstrate features
- Validate responses

## Endpoints

- `POST /api/lookup` - Perform RDAP lookup
- `GET /api/registries` - List available registries
- `POST /api/validate` - Validate RDAP response
- `GET /api/examples` - Get example queries

## Running

```bash
npm install
npm run dev  # Development mode
npm start    # Production mode
```

## Security

Playground API includes:
- Rate limiting
- Input validation
- CORS configuration
- Request size limits

## Configuration

Configure via environment variables:
- `PORT` - API port (default: 3000)
- `RATE_LIMIT` - Requests per minute
- `CACHE_TTL` - Cache duration

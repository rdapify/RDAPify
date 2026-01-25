# Playground Setup Guide

Quick guide to get the RDAPify Playground running locally.

## Prerequisites

- Node.js 16+ installed
- RDAPify library built (`npm run build` in root)

## Quick Start

### From Root Directory

```bash
# Build the library and start playground
npm run playground
```

This will:
1. Build the RDAPify library
2. Install playground dependencies
3. Start the server at http://localhost:3000

### From Playground Directory

```bash
# Make sure library is built first
cd ..
npm run build
cd playground

# Install dependencies
npm install

# Start server
npm start
```

## Development Mode

For development with auto-reload:

```bash
# From root
npm run playground:dev

# Or from playground directory
npm run dev
```

## Environment Variables

Create a `.env` file in the playground directory (optional):

```bash
PORT=3000                    # Server port
NODE_ENV=development         # Environment
RDAP_TIMEOUT=10000          # Request timeout (ms)
```

## Testing the Playground

1. Open http://localhost:3000 in your browser
2. Try example queries:
   - Domain: `example.com`
   - IPv4: `8.8.8.8`
   - IPv6: `2001:4860:4860::8888`
   - ASN: `AS15169`

## API Endpoints

### Query Endpoint
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "type": "domain",
    "query": "example.com",
    "options": {
      "cache": true,
      "redactPII": false
    }
  }'
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Batch Query
```bash
curl -X POST http://localhost:3000/api/batch \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      {"type": "domain", "query": "example.com"},
      {"type": "ip", "query": "8.8.8.8"}
    ]
  }'
```

## Troubleshooting

### Port Already in Use

```bash
# Use different port
PORT=3001 npm start
```

### Library Not Built

```bash
# Build from root directory
cd ..
npm run build
cd playground
```

### Dependencies Not Installed

```bash
# Install playground dependencies
npm install

# Also ensure root dependencies are installed
cd ..
npm install
cd playground
```

## Project Structure

```
playground/
├── api/
│   └── proxy.js          # Express server + RDAP proxy
├── public/
│   ├── index.html        # Frontend UI
│   ├── app.js            # Application logic
│   └── style.css         # Styling
├── package.json          # Dependencies
├── .gitignore           # Git ignore rules
├── README.md            # Full documentation
└── SETUP.md             # This file
```

## Next Steps

- Read [README.md](./README.md) for full documentation
- Explore the API endpoints
- Customize the UI in `public/`
- Add features to `api/proxy.js`

## Support

For issues or questions:
- GitHub Issues: https://github.com/rdapify/RDAPify/issues
- Documentation: https://rdapify.com/docs

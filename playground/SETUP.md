# Playground Setup Guide

Quick guide to get the RDAPify Playground running locally and understanding production deployment.

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

## Production Deployment

### Architecture Overview

The playground uses a **split architecture** for production:

1. **Frontend (Static)**: Hosted on GitHub Pages
   - Files: `public/index.html`, `public/app.js`, `public/style.css`
   - No server-side code
   - Makes API calls to `/api/*` endpoints on same domain

2. **Backend (Cloudflare Worker)**: Handles API requests
   - Deployed as Cloudflare Worker
   - Routes: `/api/*` on `rdapify.com`
   - Implements rate limiting and quota management
   - No paid services required (uses free tier)

### Local Dev vs Production

| Aspect | Local Development | Production |
|--------|------------------|------------|
| Frontend | Served by Express (`api/proxy.js`) | GitHub Pages (static) |
| Backend | Express proxy at `localhost:3000` | Cloudflare Worker |
| API Base | `/api/*` (same origin) | `/api/*` (same origin) |
| CORS | Handled by Express | Handled by Worker |
| Rate Limiting | None | Daily quota + per-minute limits |

### Important Notes

- ⚠️ **`api/proxy.js` is for LOCAL DEVELOPMENT ONLY**
- ⚠️ In production, GitHub Pages cannot run Node.js/Express
- ⚠️ Cloudflare Worker handles all `/api/*` routes in production
- ✅ Frontend code uses relative paths (`/api/query`) - works in both environments

2. **Backend (Cloudflare Worker)**: Handles API requests
   - Deployed as Cloudflare Worker
   - Routes: `/api/*` on `rdapify.com`
   - Implements rate limiting and quota management

### Important Notes

- ⚠️ **`api/proxy.js` is for LOCAL DEVELOPMENT ONLY**
- ⚠️ In production, API requests go to Cloudflare Worker
- ⚠️ GitHub Pages cannot run Node.js/Express servers

### Cloudflare Worker Setup

1. **Deploy Worker**:
   - Worker name: `rdapify-api`
   - Implements endpoints: `/api/health`, `/api/query`

2. **Configure Routes**:
   ```
   rdapify.com/api*        → rdapify-api
   www.rdapify.com/api*    → rdapify-api
   ```

3. **Rate Limiting**:
   - Daily quota per client (e.g., 5 queries/day)
   - Per-minute rate limiting (e.g., 2 queries/minute)
   - Client tracking via `X-Client-Id` header

4. **CORS Configuration**:
   - Restrict to `rdapify.com` domain only
   - No wildcard (`*`) in production

### Frontend Deployment

1. Build static files (already in `public/`)
2. Deploy to GitHub Pages or any static host
3. Ensure `/api/*` routes are handled by Cloudflare Worker

## Environment Variables

Create a `.env` file in the playground directory (optional for local dev):

```bash
PORT=3000                    # Server port (local dev only)
NODE_ENV=development         # Environment
RDAP_TIMEOUT=10000          # Request timeout (ms)
```

## Testing the Playground

### Local Testing

1. Open http://localhost:3000 in your browser
2. Try example queries:
   - Domain: `example.com`
   - IPv4: `8.8.8.8`
   - IPv6: `2001:4860:4860::8888`
   - ASN: `AS15169`

### Production Testing

1. Open https://rdapify.com/playground
2. Verify quota display appears after first query
3. Test rate limiting by exceeding daily quota
4. Verify 429 error message shows install instructions

## API Endpoints

### Query Endpoint (Local Dev)
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-123" \
  -d '{
    "type": "domain",
    "query": "example.com",
    "options": {
      "cache": true,
      "redactPII": false
    }
  }'
```

### Query Endpoint (Production)
```bash
curl -X POST https://rdapify.com/api/query \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-123" \
  -d '{
    "type": "domain",
    "query": "example.com"
  }'
```

**Response with Quota**:
```json
{
  "success": true,
  "data": { ... },
  "queryTime": 234,
  "timestamp": "2026-01-26T...",
  "remainingToday": 4,
  "resetAt": "2026-01-27T00:00:00.000Z"
}
```

### Health Check
```bash
# Local
curl http://localhost:3000/api/health

# Production
curl https://rdapify.com/api/health
```

## Troubleshooting

### Port Already in Use (Local)

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

### CORS Errors (Local)

- Ensure `api/proxy.js` server is running
- Check that requests go to `http://localhost:3000/api/*`

### Quota Issues (Production)

- Check `X-Client-Id` header is being sent
- Verify Cloudflare Worker is returning quota info
- Check browser localStorage for client ID

## Project Structure

```
playground/
├── api/
│   └── proxy.js          # Express server (LOCAL DEV ONLY)
├── public/
│   ├── index.html        # Frontend UI
│   ├── app.js            # Application logic (works in dev & prod)
│   └── style.css         # Styling
├── package.json          # Dependencies
├── .gitignore           # Git ignore rules
├── README.md            # Full documentation
└── SETUP.md             # This file
```

## Key Differences: Dev vs Production

| Feature | Local Dev | Production |
|---------|-----------|------------|
| Frontend | Served by Express | GitHub Pages |
| Backend | `api/proxy.js` | Cloudflare Worker |
| CORS | Allow all (`*`) | Restricted to domain |
| Rate Limiting | None | Daily + per-minute |
| Quota Display | Not shown | Shows remaining queries |
| API Base URL | `http://localhost:3000` | `https://rdapify.com` |

## Next Steps

- Read [README.md](./README.md) for full documentation
- Explore the API endpoints
- Customize the UI in `public/`
- Test rate limiting behavior
- Review Cloudflare Worker configuration

## Support

For issues or questions:
- GitHub Issues: https://github.com/rdapify/RDAPify/issues
- Documentation: https://rdapify.com/docs

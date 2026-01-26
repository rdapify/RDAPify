# 🎮 RDAPify Playground

Interactive web-based playground for testing RDAPify queries in real-time.

## 🚀 Quick Start

### Development Mode (Local)

```bash
# Install dependencies
npm install

# Start the playground server
npm run playground

# Open in browser
# http://localhost:3000
```

### Production Deployment

The playground is designed to work with:
- **Frontend**: Static hosting (GitHub Pages)
- **Backend**: Cloudflare Worker for API endpoints

**Important**: The `api/proxy.js` file is for **local development only**. In production, API requests are handled by a Cloudflare Worker deployed at `/api/*` routes on the same domain.

#### Production Architecture

```
rdapify.com (GitHub Pages - Static Files)
    ├── /playground/index.html
    ├── /playground/app.js
    ├── /playground/style.css
    └── /api/* → Cloudflare Worker
        ├── GET  /api/health
        ├── POST /api/query
        └── Redirect /api → /api/health
```

#### Production Checklist

1. **Deploy Frontend to GitHub Pages**:
   - Upload `public/` folder contents to GitHub Pages
   - Ensure files are accessible at `rdapify.com/playground/`

2. **Configure Cloudflare Worker**:
   - Deploy Worker to handle `/api/*` routes
   - **Critical**: Set route as `rdapify.com/api*` (NOT `*.rdapify.com/*`)
   - Worker must respond to:
     - `GET /api/health` - Health check
     - `POST /api/query` - RDAP queries with rate limiting
     - `GET /api` - Redirect to `/api/health`

3. **Verify Routes**:
   - ✅ `rdapify.com/api*` → Cloudflare Worker
   - ❌ Remove any wildcard routes like `*.rdapify.com/*`
   - ℹ️ Email DNS records (MX/DKIM/SPF/DMARC) remain DNS-only

4. **Test Endpoints**:
   ```bash
   # Health check
   curl https://rdapify.com/api/health
   
   # Query test
   curl -X POST https://rdapify.com/api/query \
     -H "Content-Type: application/json" \
     -H "X-Client-Id: test-123" \
     -d '{"type":"domain","query":"example.com"}'
   ```

5. **Verify Features**:
   - Quota display shows remaining queries
   - Button disables when `remainingToday = 0`
   - 429 errors show "Daily limit reached" message
   - Retry-After hint displays when available

## 📁 Structure

```
playground/
├── api/
│   └── proxy.js          # API proxy server (LOCAL DEV ONLY)
├── public/
│   ├── index.html        # Main HTML page
│   ├── app.js            # Application logic
│   └── style.css         # Styling
├── package.json          # Dependencies
└── README.md             # This file
```

## ✨ Features

### Current Features
- ✅ Real-time RDAP queries
- ✅ Domain, IP, and ASN lookups
- ✅ Syntax highlighting for JSON responses
- ✅ Error handling and display
- ✅ Query history
- ✅ Example queries
- ✅ Responsive design
- ✅ Rate limiting with quota display
- ✅ Client ID tracking for fair usage
- ✅ Install section with quick examples

### Planned Features
- ⏳ Query builder with options
- ⏳ Response comparison
- ⏳ Export results (JSON, CSV)
- ⏳ Share queries via URL
- ⏳ Dark mode toggle
- ⏳ Performance metrics

## 🎯 Usage

### Query Types

**Domain Lookup**:
```
example.com
google.com
github.com
```

**IP Address Lookup**:
```
8.8.8.8
2001:4860:4860::8888
1.1.1.1
```

**ASN Lookup**:
```
AS15169
AS13335
15169
```

### Example Queries

The playground includes pre-configured examples:
- Domain: `example.com`
- IPv4: `8.8.8.8`
- IPv6: `2001:4860:4860::8888`
- ASN: `AS15169`

## 🔧 Configuration

### Local Development (api/proxy.js)

The playground uses a proxy server to handle CORS issues when making RDAP requests during local development.

**Configuration** (`api/proxy.js`):
```javascript
const PORT = process.env.PORT || 3000;
const RDAP_TIMEOUT = 10000; // 10 seconds
```

### Production (Cloudflare Worker)

In production, the Cloudflare Worker handles all API requests with:
- Rate limiting (daily quota + per-minute limits)
- Client ID tracking via `X-Client-Id` header
- CORS configuration restricted to `rdapify.com`
- Quota information in responses

### Environment Variables

```bash
PORT=3000                    # Server port (local dev only)
NODE_ENV=development         # Environment
RDAP_TIMEOUT=10000          # Request timeout (ms)
```

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev:playground

# Run tests
npm run test:playground
```

### Adding New Features

1. **Frontend** (`public/app.js`):
   - Add UI components
   - Implement query logic
   - Handle responses
   - Update quota display

2. **Backend** (Cloudflare Worker):
   - Update worker code (not in this repo)
   - Add new endpoints
   - Implement caching
   - Adjust rate limiting

### Code Style

- Use ES6+ features
- Follow Airbnb style guide
- Add JSDoc comments
- Write tests for new features

## 📊 API Endpoints

### Query Endpoint

```
POST /api/query
Content-Type: application/json
X-Client-Id: <uuid>

{
  "type": "domain|ip|asn",
  "query": "example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-01-26T...",
  "remainingToday": 3,
  "resetAt": "2026-01-27T00:00:00.000Z"
}
```

**Rate Limit Response (429)**:
```json
{
  "success": false,
  "error": "Daily quota exceeded",
  "remainingToday": 0,
  "resetAt": "2026-01-27T00:00:00.000Z"
}
```

### Health Check

```
GET /api/health
```

**Response**:
```json
{
  "status": "ok",
  "uptime": 12345
}
```

## 🎨 Customization

### Styling

Edit `public/style.css` to customize:
- Colors and themes
- Layout and spacing
- Responsive breakpoints
- Animations

### Branding

Update `public/index.html`:
- Logo and favicon
- Meta tags
- Social media cards

## 🔒 Security

### CORS Configuration

**Local Development**: Allows all origins (`*`)
**Production**: Restricted to `rdapify.com` domain only

### Rate Limiting

Production implements:
- Daily quota per client (e.g., 5 queries/day)
- Per-minute rate limiting (e.g., 2 queries/minute)
- Client ID tracking via localStorage + `X-Client-Id` header
- IP-based fallback for additional protection

### Input Validation

All queries are validated before processing:
- Domain name validation
- IP address validation (IPv4/IPv6)
- ASN format validation

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🐛 Troubleshooting

### Common Issues

**Port already in use** (local dev):
```bash
# Change port
PORT=3001 npm run playground
```

**CORS errors** (local dev):
- Ensure proxy server is running
- Check browser console for details

**Quota exceeded** (production):
- Install RDAPify for unlimited queries
- Wait for daily reset (shown in UI)

**Timeout errors**:
- Increase timeout in `api/proxy.js` (local)
- Check network connectivity

## 📚 Resources

- [RDAPify Documentation](https://rdapify.com/docs)
- [RDAP RFC 7483](https://tools.ietf.org/html/rfc7483)
- [IANA Bootstrap Service](https://data.iana.org/rdap/)
- [Cloudflare Workers](https://workers.cloudflare.com/)

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details

---

**Built with ❤️ by the RDAPify team**

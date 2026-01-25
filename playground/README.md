# 🎮 RDAPify Playground

Interactive web-based playground for testing RDAPify queries in real-time.

## 🚀 Quick Start

### Development Mode

```bash
# Install dependencies
npm install

# Start the playground server
npm run playground

# Open in browser
# http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build:playground

# Serve production build
npm run serve:playground
```

## 📁 Structure

```
playground/
├── api/
│   └── proxy.js          # API proxy server (CORS handling)
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

### API Proxy

The playground uses a proxy server to handle CORS issues when making RDAP requests.

**Configuration** (`api/proxy.js`):
```javascript
const PORT = process.env.PORT || 3000;
const RDAP_TIMEOUT = 10000; // 10 seconds
```

### Environment Variables

```bash
PORT=3000                    # Server port
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

2. **Backend** (`api/proxy.js`):
   - Add new endpoints
   - Implement caching
   - Add rate limiting

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
  "timestamp": "2025-01-24T..."
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

The proxy server implements CORS headers:
```javascript
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type'
```

### Rate Limiting

Implement rate limiting to prevent abuse:
```javascript
// TODO: Add rate limiting
const rateLimit = require('express-rate-limit');
```

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

**Port already in use**:
```bash
# Change port
PORT=3001 npm run playground
```

**CORS errors**:
- Ensure proxy server is running
- Check browser console for details

**Timeout errors**:
- Increase timeout in `api/proxy.js`
- Check network connectivity

## 📚 Resources

- [RDAPify Documentation](https://rdapify.com/docs)
- [RDAP RFC 7483](https://tools.ietf.org/html/rfc7483)
- [IANA Bootstrap Service](https://data.iana.org/rdap/)

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

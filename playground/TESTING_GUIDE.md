# Testing Guide - RDAPify Playground

Quick manual testing steps to verify all functionality works correctly.

## Local Testing

### 1. Start the Server

```bash
cd RDAPify/playground
npm install
npm start
```

Expected output:
```
🎮 RDAPify Playground Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Server running at: http://localhost:3000
📦 Environment: development
⏱️  Timeout: 10000ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 12.345,
  "timestamp": "2026-01-26T...",
  "version": "0.1.1"
}
```

### 3. Test Query Endpoint

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-123" \
  -d '{
    "type": "domain",
    "query": "example.com"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": { /* RDAP response */ },
  "queryTime": 234,
  "timestamp": "2026-01-26T..."
}
```

### 4. Test Frontend

Open browser to `http://localhost:3000`

#### Test Client ID
1. Open DevTools → Application → Local Storage
2. Verify `rdapify_client_id` exists with a UUID value
3. Refresh page - ID should remain the same

#### Test Query Functionality
1. Enter `example.com` in the query input
2. Select "Domain" type
3. Click "Query" button
4. Verify:
   - ✅ Results appear in JSON format
   - ✅ Status bar shows "✅ Query successful"
   - ✅ Query time is displayed

#### Test Different Query Types
1. **IP Query**: Enter `8.8.8.8`, select "IP Address", click Query
2. **IPv6 Query**: Enter `2001:4860:4860::8888`, select "IP Address", click Query
3. **ASN Query**: Enter `AS15169`, select "ASN", click Query

#### Test Example Buttons
1. Click each example button
2. Verify input field populates correctly
3. Verify query type radio button updates

#### Test History
1. Perform several queries
2. Verify history section shows recent queries
3. Click a history item - should populate the input field
4. Click "Clear History" - should empty the history

#### Test Copy Functionality
1. Perform a query
2. Click "📋 Copy" button
3. Paste into a text editor
4. Verify JSON is copied correctly

#### Test Install Section
1. Scroll to "Ready for More?" section
2. Verify three package manager commands are visible:
   - npm install rdapify
   - yarn add rdapify
   - pnpm add rdapify
3. Click each copy button (📋)
4. Paste into text editor
5. Verify correct command is copied

#### Test Network Requests
1. Open DevTools → Network tab
2. Perform a query
3. Find the `/api/query` request
4. Verify headers include:
   - `Content-Type: application/json`
   - `X-Client-Id: <uuid>`

---

## Production Testing

### 1. Test Health Endpoint

```bash
curl https://rdapify.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T..."
}
```

### 2. Test Query Endpoint

```bash
curl -X POST https://rdapify.com/api/query \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-123" \
  -d '{
    "type": "domain",
    "query": "example.com"
  }'
```

Expected response (with quota):
```json
{
  "success": true,
  "data": { /* RDAP response */ },
  "queryTime": 234,
  "timestamp": "2026-01-26T...",
  "remainingToday": 4,
  "resetAt": "2026-01-27T00:00:00.000Z"
}
```

### 3. Test Frontend

Open browser to `https://rdapify.com/playground`

#### Test Quota Display
1. Perform a query
2. Verify quota info appears below the query input:
   - "Remaining today: X"
   - "Resets at: [timestamp]"
3. Perform another query
4. Verify remaining count decreases

#### Test Quota Exhaustion
1. Perform queries until `remainingToday = 0`
2. Verify:
   - ✅ Query button becomes disabled
   - ✅ Button tooltip shows "Daily limit reached..."
   - ✅ Error message displays: "Daily Limit Reached"
   - ✅ Install instructions are shown

#### Test 429 Response
1. Exhaust quota (remainingToday = 0)
2. Try to perform another query
3. Verify response:
   - Status: 429
   - Error message: "Daily Limit Reached"
   - "Try again in X minutes" hint appears (if Retry-After header present)
   - Install instructions visible

#### Test Retry-After Hint
1. When 429 error occurs with Retry-After header
2. Verify message shows: "Try again in X minute(s)."
3. Verify calculation is correct (seconds → minutes, rounded up)

#### Test Button Disable Logic
1. When `remainingToday = 0`:
   - ✅ Button is disabled
   - ✅ Button has tooltip
2. When `remainingToday > 0`:
   - ✅ Button is enabled
   - ✅ No tooltip

---

## Checklist

### Local Development
- [ ] Server starts without errors
- [ ] `/api/health` returns OK
- [ ] `/api/query` processes requests
- [ ] Client ID is generated and stored
- [ ] X-Client-Id header is sent
- [ ] Queries work for domain/IP/ASN
- [ ] Results display correctly
- [ ] History tracking works
- [ ] Copy functionality works
- [ ] Install section shows all 3 package managers
- [ ] Copy buttons work for all commands

### Production
- [ ] `https://rdapify.com/api/health` returns OK
- [ ] `https://rdapify.com/api/query` works
- [ ] Quota info displays after first query
- [ ] Remaining count decreases with each query
- [ ] Button disables when quota = 0
- [ ] 429 error shows correct message
- [ ] Retry-After hint displays (if header present)
- [ ] Install section is visible and functional
- [ ] All copy buttons work
- [ ] No console errors
- [ ] Works on mobile devices
- [ ] Works on different browsers

### Edge Cases
- [ ] Empty query shows validation error
- [ ] Invalid domain format shows error
- [ ] Invalid IP format shows error
- [ ] Invalid ASN format shows error
- [ ] Network error shows appropriate message
- [ ] Rapid clicking doesn't cause issues
- [ ] Page refresh preserves client ID
- [ ] History persists across page reloads

---

## Troubleshooting

### Local: Port Already in Use
```bash
PORT=3001 npm start
```

### Local: CORS Errors
- Ensure `api/proxy.js` is running
- Check browser console for details
- Verify requests go to `http://localhost:3000/api/*`

### Production: 404 on /api/*
- Verify Cloudflare Worker is deployed
- Check route configuration: `rdapify.com/api*`
- Ensure no wildcard routes interfere

### Production: CORS Errors
- Verify Worker sets correct CORS headers
- Check Origin header matches allowed domain
- Ensure OPTIONS requests are handled

### Quota Not Updating
- Check Network tab for response
- Verify `remainingToday` and `resetAt` in response
- Check console for JavaScript errors
- Verify `updateQuotaDisplay()` is called

### Button Not Disabling
- Check `state.quotaInfo.remainingToday` value
- Verify `updateQuotaDisplay()` logic
- Check for JavaScript errors in console

---

## Success Criteria

All tests pass when:
- ✅ Local development works perfectly
- ✅ Production endpoints respond correctly
- ✅ Quota tracking functions as expected
- ✅ Button disables when quota exhausted
- ✅ 429 errors handled gracefully
- ✅ Retry-After hint displays correctly
- ✅ Install section shows all package managers
- ✅ No console errors
- ✅ Works across browsers and devices

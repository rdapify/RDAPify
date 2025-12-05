# Express.js Integration

## Overview

Integrate RDAPify with Express.js applications for building RDAP APIs.

## Basic Setup

```typescript
import express from 'express';
import { RDAPClient } from 'rdapify';

const app = express();
const client = new RDAPClient();

app.get('/api/domain/:domain', async (req, res) => {
  try {
    const result = await client.domain(req.params.domain);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message,
      code: error.code
    });
  }
});

app.listen(3000, () => {
  console.log('RDAP API running on port 3000');
});
```

## Middleware

```typescript
function rdapMiddleware(client: RDAPClient) {
  return (req, res, next) => {
    req.rdap = client;
    next();
  };
}

app.use(rdapMiddleware(client));

app.get('/api/domain/:domain', async (req, res) => {
  const result = await req.rdap.domain(req.params.domain);
  res.json(result);
});
```

## See Also

- [Next.js Integration](./nextjs.md)
- [NestJS Integration](./nestjs.md)

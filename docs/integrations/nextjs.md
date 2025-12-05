# Next.js Integration

## Overview

Use RDAPify in Next.js applications with API routes and server components.

## API Routes

```typescript
// app/api/domain/[domain]/route.ts
import { RDAPClient } from 'rdapify';
import { NextResponse } from 'next/server';

const client = new RDAPClient();

export async function GET(
  request: Request,
  { params }: { params: { domain: string } }
) {
  try {
    const result = await client.domain(params.domain);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

## Server Components

```typescript
// app/domain/[domain]/page.tsx
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

export default async function DomainPage({
  params
}: {
  params: { domain: string }
}) {
  const result = await client.domain(params.domain);

  return (
    <div>
      <h1>{result.ldhName}</h1>
      <p>Status: {result.status.join(', ')}</p>
    </div>
  );
}
```

## See Also

- [Express Integration](./express.md)
- [TypeScript Usage](../guides/typescript_usage.md)

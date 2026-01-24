# Next.js Integration Example

Server-side RDAP queries with Next.js App Router.

## Installation

```bash
npm install
```

## Usage

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Features

- Server-side rendering
- Server components (no client-side JavaScript for queries)
- Built-in caching
- Type-safe with TypeScript
- Simple search interface

## File Structure

```
app/
└── page.tsx          # Main page with RDAP lookup
```

## How It Works

1. User enters domain in search form
2. Form submits to same page with query parameter
3. Server component fetches RDAP data
4. Results rendered on server and sent to client
5. No API routes needed - direct server-side queries

## Benefits

- SEO-friendly (server-rendered)
- Fast initial page load
- Reduced client-side JavaScript
- Automatic caching with RDAPify

/**
 * Express.js middleware / router factory for RDAPify.
 *
 * Framework-agnostic: accepts any object that implements the minimal
 * `express.Router` interface (`router.get(path, handler)`).  No `express`
 * package dependency is required at runtime.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { RDAPClient } from 'rdapify';
 * import { rdapifyExpress } from 'rdapify/integrations/express';
 *
 * const app = express();
 * const client = new RDAPClient();
 *
 * app.use('/rdap', rdapifyExpress(client));
 * app.listen(3000);
 * ```
 *
 * @module integrations/express
 */

import type { RDAPClient } from '../application/client';

// ---------------------------------------------------------------------------
// Minimal interface — duck-type compatible with express.Router
// ---------------------------------------------------------------------------

export interface RouterLike {
  get(path: string, handler: RouteHandler): this;
}

export interface RequestLike {
  params: Record<string, string>;
}

export interface ResponseLike {
  status(code: number): this;
  json(body: unknown): this;
}

type RouteHandler = (req: RequestLike, res: ResponseLike) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Minimal built-in router (no express needed for testing / custom use)
// ---------------------------------------------------------------------------

interface RouteEntry {
  path: string;
  handler: RouteHandler;
}

/**
 * Minimal router implementation.  Routes are stored in-order and matched by
 * exact path template (supports `:param` express-style parameters).
 *
 * This is returned by `rdapifyExpress()` when no external router is provided.
 * Pass this to your framework's middleware chain or use `.routes` directly.
 */
export class MinimalRouter implements RouterLike {
  readonly routes: RouteEntry[] = [];

  get(path: string, handler: RouteHandler): this {
    this.routes.push({ path, handler });
    return this;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Attaches RDAP query routes to the provided router.
 *
 * Routes added:
 *  - `GET /domain/:name`
 *  - `GET /ip/:address`
 *  - `GET /asn/:number`
 *
 * @param client  Configured `RDAPClient` instance.
 * @param router  Express-compatible router.  When omitted, a `MinimalRouter`
 *                is created and returned so the factory can be used without
 *                express installed.
 * @returns The router with RDAP routes attached.
 */
export function rdapifyExpress<R extends RouterLike>(
  client: RDAPClient,
  router?: R,
): R | MinimalRouter {
  const r = router ?? new MinimalRouter();

  r.get('/domain/:name', async (req: RequestLike, res: ResponseLike) => {
    try {
      const result = await client.domain(req.params['name'] ?? '');
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  r.get('/ip/:address', async (req: RequestLike, res: ResponseLike) => {
    try {
      const result = await client.ip(req.params['address'] ?? '');
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  r.get('/asn/:number', async (req: RequestLike, res: ResponseLike) => {
    try {
      const result = await client.asn(req.params['number'] ?? '');
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  return r;
}

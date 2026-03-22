/**
 * GraphQL schema and resolvers for RDAPify.
 *
 * Framework-agnostic: returns a `typeDefs` string and a `resolvers` object
 * that can be passed directly to graphql-yoga, Apollo Server, or any other
 * GraphQL runtime.
 *
 * @example With graphql-yoga
 * ```typescript
 * import { createYoga } from 'graphql-yoga';
 * import { RDAPClient } from 'rdapify';
 * import { createRdapifySchema } from 'rdapify/integrations/graphql';
 *
 * const client = new RDAPClient();
 * const { typeDefs, resolvers } = createRdapifySchema(client);
 *
 * const yoga = createYoga({ typeDefs, resolvers });
 * ```
 *
 * @module integrations/graphql
 */

import type { RDAPClient } from '../application/client';

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export const RDAPIFY_TYPE_DEFS = /* GraphQL */ `
  type DomainResponse {
    query:         String!
    ldhName:       String
    registrar:     String
    status:        [String!]!
    expiresAt:     String
    createdAt:     String
    updatedAt:     String
  }

  type IpResponse {
    query:         String!
    country:       String
    name:          String
    status:        [String!]!
    startAddress:  String
    endAddress:    String
  }

  type AsnResponse {
    query:         String!
    name:          String
    status:        [String!]!
    startAutnum:   Int
    endAutnum:     Int
  }

  type Query {
    """Query RDAP information for a domain name."""
    domain(name: String!): DomainResponse

    """Query RDAP information for an IP address (IPv4 or IPv6)."""
    ip(address: String!): IpResponse

    """Query RDAP information for an Autonomous System Number."""
    asn(number: String!): AsnResponse
  }
`;

// ---------------------------------------------------------------------------
// Resolver types
// ---------------------------------------------------------------------------

export interface RdapifyResolvers {
  Query: {
    domain(_: unknown, args: { name: string }): Promise<unknown>;
    ip(_: unknown, args: { address: string }): Promise<unknown>;
    asn(_: unknown, args: { number: string }): Promise<unknown>;
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates GraphQL resolvers backed by the provided `RDAPClient`.
 *
 * @param client  Configured `RDAPClient` instance.
 * @returns `{ typeDefs, resolvers }` ready to pass to any GraphQL server.
 */
export function createRdapifySchema(client: RDAPClient): {
  typeDefs: string;
  resolvers: RdapifyResolvers;
} {
  const resolvers: RdapifyResolvers = {
    Query: {
      domain: async (_: unknown, args: { name: string }) => {
        const r = await client.domain(args.name);
        const findEvent = (type: string) =>
          r.events?.find((e) => e.type === type)?.date ?? null;
        return {
          query: r.query,
          ldhName: r.ldhName ?? null,
          registrar: r.registrar?.name ?? null,
          status: r.status ?? [],
          expiresAt: findEvent('expiration'),
          createdAt: findEvent('registration'),
          updatedAt: findEvent('last changed'),
        };
      },

      ip: async (_: unknown, args: { address: string }) => {
        const r = await client.ip(args.address);
        return {
          query: r.query,
          country: r.country ?? null,
          name: r.name ?? null,
          status: r.status ?? [],
          startAddress: r.startAddress ?? null,
          endAddress: r.endAddress ?? null,
        };
      },

      asn: async (_: unknown, args: { number: string }) => {
        const r = await client.asn(args.number);
        return {
          query: String(r.query),
          name: r.name ?? null,
          status: r.status ?? [],
          startAutnum: r.startAutnum ?? null,
          endAutnum: r.endAutnum ?? null,
        };
      },
    },
  };

  return { typeDefs: RDAPIFY_TYPE_DEFS, resolvers };
}

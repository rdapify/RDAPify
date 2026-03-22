/**
 * NestJS integration module for RDAPify.
 *
 * Provides `RdapifyModule.forRoot(config)` which registers `RDAPClient` as a
 * NestJS provider, and `@InjectRdapClient()` which injects it into any service.
 *
 * @example
 * ```typescript
 * // app.module.ts
 * import { Module } from '@nestjs/common';
 * import { RdapifyModule } from 'rdapify';
 *
 * @Module({
 *   imports: [RdapifyModule.forRoot({ cache: { strategy: 'memory' } })],
 * })
 * export class AppModule {}
 *
 * // domain.service.ts
 * import { Injectable } from '@nestjs/common';
 * import { InjectRdapClient, RDAPClient } from 'rdapify';
 *
 * @Injectable()
 * export class DomainService {
 *   constructor(@InjectRdapClient() private client: RDAPClient) {}
 *
 *   lookup(domain: string) {
 *     return this.client.domain(domain);
 *   }
 * }
 * ```
 *
 * @module integrations/nestjs
 */

import { RDAPClient } from '../application/client';
import type { RDAPClientOptions } from '../shared/types/options';

// ---------------------------------------------------------------------------
// Injection token
// ---------------------------------------------------------------------------

/**
 * Injection token used to identify the `RDAPClient` provider in the NestJS
 * dependency injection container.
 */
export const RDAPIFY_CLIENT_TOKEN = Symbol('RDAPIFY_CLIENT');

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Options accepted by `RdapifyModule.forRoot()`. */
export type RdapifyModuleOptions = RDAPClientOptions;

/**
 * Minimal NestJS-compatible provider descriptor.
 * Mirrors `FactoryProvider` from `@nestjs/common`.
 */
export interface RdapifyProvider {
  provide: symbol;
  useFactory: () => RDAPClient;
}

/**
 * Minimal NestJS-compatible dynamic module descriptor.
 * Mirrors `DynamicModule` from `@nestjs/common`.
 */
export interface RdapifyDynamicModule {
  module: typeof RdapifyModule;
  providers: RdapifyProvider[];
  exports: symbol[];
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

/**
 * NestJS module that registers `RDAPClient` as a provider.
 *
 * Use `RdapifyModule.forRoot(options)` inside your root or feature `@Module`
 * imports array.  The client is then injectable via `@InjectRdapClient()`.
 */
export class RdapifyModule {
  /**
   * Creates a dynamic module that provides a configured `RDAPClient`.
   *
   * @param options  Options forwarded directly to `new RDAPClient(options)`.
   * @returns        NestJS-compatible `DynamicModule`.
   */
  static forRoot(options: RdapifyModuleOptions = {}): RdapifyDynamicModule {
    const provider: RdapifyProvider = {
      provide: RDAPIFY_CLIENT_TOKEN,
      useFactory: () => new RDAPClient(options),
    };

    return {
      module: RdapifyModule,
      providers: [provider],
      exports: [RDAPIFY_CLIENT_TOKEN],
    };
  }
}

// ---------------------------------------------------------------------------
// Injection decorator
// ---------------------------------------------------------------------------

/**
 * Parameter decorator for injecting the `RDAPClient` instance into NestJS
 * controllers and services.
 *
 * @example
 * ```typescript
 * constructor(@InjectRdapClient() private client: RDAPClient) {}
 * ```
 *
 * When `@nestjs/common` is installed, wrap this with NestJS's own `Inject`:
 * ```typescript
 * import { Inject } from '@nestjs/common';
 * const InjectRdapClient = () => Inject(RDAPIFY_CLIENT_TOKEN);
 * ```
 *
 * This implementation is a standalone version that works without `@nestjs/common`
 * by creating a parameter decorator directly.
 */
export function InjectRdapClient(): ParameterDecorator {
  return (_target: object, _propertyKey: string | symbol | undefined, _index: number) => {
    // In real NestJS usage, this would call Reflect.defineMetadata.
    // This stub is intentionally minimal — it marks the parameter so
    // frameworks that read NestJS metadata can inject via RDAPIFY_CLIENT_TOKEN.
    if (typeof Reflect !== 'undefined' && typeof (Reflect as Record<string, unknown>)['defineMetadata'] === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      const defineMetadata = (Reflect as Record<string, Function>)['defineMetadata']!;
      defineMetadata('self:paramtypes', RDAPIFY_CLIENT_TOKEN, _target, _propertyKey);
    }
  };
}

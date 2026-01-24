/**
 * Bootstrap discovery port interface (Dependency Inversion)
 * @module core/ports
 */

/**
 * Bootstrap port - defines contract for RDAP server discovery
 */
export interface IBootstrapPort {
  discoverDomain(domain: string): Promise<string>;
  discoverIPv4(ip: string): Promise<string>;
  discoverIPv6(ip: string): Promise<string>;
  discoverASN(asn: number): Promise<string>;
  clearCache(): void;
}

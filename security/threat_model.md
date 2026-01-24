# Threat Model

## Overview

This document outlines potential security threats to RDAPify and mitigation strategies.

## Threat Categories

### 1. Network-Based Threats

#### 1.1 Server-Side Request Forgery (SSRF)

**Threat**: Attacker manipulates RDAP queries to access internal resources.

**Attack Vectors**:
- Malicious domain names resolving to private IPs
- URL manipulation in bootstrap discovery
- DNS rebinding attacks

**Mitigations**:
- ✅ Private IP range blocking (RFC 1918)
- ✅ Localhost access prevention
- ✅ URL validation before requests
- ✅ HTTPS-only enforcement

**Risk Level**: HIGH → LOW (mitigated)

#### 1.2 Man-in-the-Middle (MITM)

**Threat**: Attacker intercepts RDAP queries and responses.

**Attack Vectors**:
- Unencrypted HTTP connections
- Invalid SSL certificates
- Certificate spoofing

**Mitigations**:
- ✅ HTTPS-only connections
- ✅ Strict certificate validation
- ✅ TLS 1.2+ enforcement
- ✅ Certificate pinning support

**Risk Level**: HIGH → LOW (mitigated)

#### 1.3 DNS Poisoning

**Threat**: Attacker manipulates DNS responses.

**Attack Vectors**:
- Compromised DNS servers
- Cache poisoning
- DNS hijacking

**Mitigations**:
- ✅ DNSSEC validation (where available)
- ✅ Multiple bootstrap sources
- ✅ Response validation
- ⚠️ Consider DNS-over-HTTPS (future)

**Risk Level**: MEDIUM → LOW

### 2. Data Security Threats

#### 2.1 PII Exposure

**Threat**: Personal information leaked in RDAP responses.

**Attack Vectors**:
- Unredacted contact information
- Email addresses in responses
- Phone numbers in entity data

**Mitigations**:
- ✅ Automatic PII redaction
- ✅ Privacy-by-default configuration
- ✅ Configurable redaction rules
- ✅ GDPR/CCPA compliance

**Risk Level**: HIGH → LOW (mitigated)

#### 2.2 Cache Poisoning

**Threat**: Attacker injects malicious data into cache.

**Attack Vectors**:
- Cache key collision
- Race conditions
- Malicious RDAP responses

**Mitigations**:
- ✅ Cryptographic cache keys
- ✅ Response validation
- ✅ TTL enforcement
- ✅ Cache isolation

**Risk Level**: MEDIUM → LOW (mitigated)

#### 2.3 Data Injection

**Threat**: Malicious data in RDAP responses.

**Attack Vectors**:
- XSS payloads in domain names
- SQL injection in entity data
- Command injection in remarks

**Mitigations**:
- ✅ Input sanitization
- ✅ Output encoding
- ✅ Schema validation
- ✅ Type safety (TypeScript)

**Risk Level**: MEDIUM → LOW (mitigated)

### 3. Application-Level Threats

#### 3.1 Denial of Service (DoS)

**Threat**: Resource exhaustion through excessive queries.

**Attack Vectors**:
- Rapid query flooding
- Large batch requests
- Memory exhaustion
- Cache overflow

**Mitigations**:
- ✅ Request timeout enforcement
- ✅ LRU cache with size limits
- ✅ Retry backoff strategy
- ⚠️ Rate limiting (user-implemented)

**Risk Level**: MEDIUM → MEDIUM

**Recommendations**:
- Implement application-level rate limiting
- Use queue systems for batch processing
- Monitor resource usage

#### 3.2 Dependency Vulnerabilities

**Threat**: Security issues in third-party dependencies.

**Attack Vectors**:
- Known CVEs in dependencies
- Supply chain attacks
- Malicious packages

**Mitigations**:
- ✅ Minimal dependency footprint
- ✅ Regular `npm audit` checks
- ✅ Automated security updates
- ✅ Dependency pinning

**Risk Level**: MEDIUM → LOW (mitigated)

#### 3.3 Code Injection

**Threat**: Execution of malicious code.

**Attack Vectors**:
- eval() usage
- Dynamic require()
- Unsafe deserialization

**Mitigations**:
- ✅ No eval() or Function()
- ✅ No dynamic require()
- ✅ Safe JSON parsing
- ✅ TypeScript type safety

**Risk Level**: HIGH → LOW (mitigated)

### 4. Privacy Threats

#### 4.1 Query Tracking

**Threat**: Monitoring of user queries.

**Attack Vectors**:
- Query logging
- Network traffic analysis
- Cache inspection

**Mitigations**:
- ✅ No query logging by default
- ✅ HTTPS encryption
- ✅ Configurable logging
- ⚠️ Consider query anonymization

**Risk Level**: LOW → LOW

#### 4.2 Data Retention

**Threat**: Excessive data storage.

**Attack Vectors**:
- Indefinite caching
- Log retention
- Metadata collection

**Mitigations**:
- ✅ TTL-based cache expiration
- ✅ Minimal logging
- ✅ No telemetry by default
- ✅ User-controlled cache

**Risk Level**: LOW → LOW

## Attack Surface Analysis

### External Attack Surface

1. **RDAP Servers**
   - Trust: External, untrusted
   - Mitigation: Response validation, HTTPS

2. **IANA Bootstrap**
   - Trust: External, semi-trusted
   - Mitigation: Multiple sources, validation

3. **DNS Resolvers**
   - Trust: External, varies
   - Mitigation: DNSSEC, validation

### Internal Attack Surface

1. **Cache System**
   - Trust: Internal, trusted
   - Mitigation: Isolation, validation

2. **Configuration**
   - Trust: User-controlled
   - Mitigation: Validation, safe defaults

## Security Controls

### Preventive Controls

- Input validation
- SSRF protection
- Certificate validation
- PII redaction
- Type safety

### Detective Controls

- Response validation
- Anomaly detection
- Error logging
- Audit trails

### Corrective Controls

- Automatic retry with backoff
- Error recovery
- Cache invalidation
- Graceful degradation

## Threat Scenarios

### Scenario 1: SSRF Attack

**Attack**: Attacker queries `internal.company.local`

**Response**:
1. Domain validation fails (private TLD)
2. SSRF protection blocks request
3. Error returned to user
4. No internal access gained

**Result**: ✅ Attack prevented

### Scenario 2: Cache Poisoning

**Attack**: Attacker injects malicious data

**Response**:
1. Response validation detects anomaly
2. Data rejected before caching
3. Error logged
4. Cache remains clean

**Result**: ✅ Attack prevented

### Scenario 3: PII Exposure

**Attack**: Response contains email addresses

**Response**:
1. PII redactor scans response
2. Email addresses detected
3. Data redacted automatically
4. Clean response returned

**Result**: ✅ Privacy protected

## Risk Assessment Matrix

| Threat | Likelihood | Impact | Risk | Status |
|--------|-----------|--------|------|--------|
| SSRF | Medium | High | HIGH | Mitigated |
| MITM | Low | High | MEDIUM | Mitigated |
| PII Exposure | High | High | HIGH | Mitigated |
| Cache Poisoning | Low | Medium | LOW | Mitigated |
| DoS | Medium | Medium | MEDIUM | Partial |
| Dependency Vuln | Low | Medium | LOW | Monitored |

## Recommendations

### For Users

1. **Enable all security features**
2. **Implement rate limiting**
3. **Monitor for anomalies**
4. **Keep dependencies updated**
5. **Use HTTPS-only environments**

### For Developers

1. **Regular security audits**
2. **Dependency scanning**
3. **Penetration testing**
4. **Code reviews**
5. **Security training**

## Future Enhancements

- [ ] DNS-over-HTTPS support
- [ ] Query anonymization
- [ ] Advanced anomaly detection
- [ ] Security event logging
- [ ] Threat intelligence integration

## References

- OWASP Top 10
- CWE/SANS Top 25
- RFC 7480-7484 (RDAP)
- NIST Cybersecurity Framework

---

**Last Updated**: January 24, 2026  
**Version**: 0.1.0-alpha.4

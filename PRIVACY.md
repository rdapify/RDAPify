# Privacy Policy

**Effective Date:** December 5, 2025  
**Version:** 1.0

## Executive Summary

RDAPify is a client-side library that **does not collect, store, or transmit any personal data by default**. Your applications maintain full control over data handling.

## Core Principles

- **Data Minimization**: Only process necessary data
- **Default Privacy**: PII redaction enabled by default
- **Transparency**: Clear documentation of data flows
- **User Control**: Applications control data retention
- **No Tracking**: No analytics or telemetry by default

## How RDAPify Processes Data

### What We DON'T Do
- ❌ Collect usage statistics
- ❌ Transmit data to our servers
- ❌ Include tracking code
- ❌ Store query results

### What We DO
- ✅ Query public RDAP servers (as directed by your application)
- ✅ Cache responses locally (in-memory, configurable)
- ✅ Redact PII by default (configurable)
- ✅ Provide privacy controls to your application

## GDPR/CCPA Compliance

RDAPify provides tools to help your application comply with:
- Right to erasure (cache clearing)
- Data minimization (PII redaction)
- Purpose limitation (query-specific data)
- Transparency (clear data flows)

## Your Responsibilities

As a developer using RDAPify:
1. Configure appropriate PII redaction for your use case
2. Implement data retention policies
3. Provide privacy notices to your users
4. Handle user data rights requests

## Contact

Privacy questions: **privacy@rdapify.com**

---

**Full Policy**: See `.project/internal/PRIVACY.md` for complete privacy documentation.

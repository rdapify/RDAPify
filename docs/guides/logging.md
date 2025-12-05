# Logging Guide

## Overview

Implement comprehensive logging for debugging, monitoring, and auditing RDAP queries.

## Built-in Logging

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  logging: {
    enabled: true,
    level: 'info',
    format: 'json'
  }
});
```

## Log Levels

- **error**: Critical errors only
- **warn**: Warnings and errors
- **info**: General information
- **debug**: Detailed debugging information
- **trace**: Very detailed trace information

## Custom Logger Integration

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'rdap.log' })
  ]
});

const client = new RDAPClient({
  logger: {
    error: (msg, meta) => logger.error(msg, meta),
    warn: (msg, meta) => logger.warn(msg, meta),
    info: (msg, meta) => logger.info(msg, meta),
    debug: (msg, meta) => logger.debug(msg, meta)
  }
});
```

## See Also

- [Error Handling](./error_handling.md)
- [Performance Guide](./performance.md)

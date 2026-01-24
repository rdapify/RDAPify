# Code Generation Rules - قواعد إنشاء الكود

## CRITICAL RULES - قواعد حاسمة

### 1. Minimal Code Only - كود أساسي فقط
- Write ONLY the code that directly solves the requested feature
- NO extra features, NO "nice to have" additions
- NO placeholder comments like "Add more features here"
- NO example data unless explicitly requested

### 2. No Hallucination - لا اختراع
- NEVER invent APIs, libraries, or methods that don't exist
- If unsure about a library API, search documentation first
- Use ONLY standard TypeScript/Node.js APIs unless dependencies are confirmed
- Check package.json before using any external library

### 3. Complete Implementation - تنفيذ كامل
- Every function must be fully implemented
- NO TODO comments
- NO "implement this later" placeholders
- If you can't implement something, say so explicitly

### 4. Existing Code Respect - احترام الكود الموجود
- READ existing files before modifying
- NEVER overwrite working code without explicit permission
- Maintain existing code style and patterns
- Check for existing implementations before creating new ones

## TypeScript Specific Rules

### Type Safety
```typescript
// ✅ GOOD - Explicit types
interface RDAPResponse {
  handle: string;
  status: string[];
}

function query(domain: string): Promise<RDAPResponse> {
  // implementation
}

// ❌ BAD - Any types or missing types
function query(domain): Promise<any> {
  // implementation
}
```

### Error Handling
```typescript
// ✅ GOOD - Proper error handling
try {
  const result = await fetch(url);
  if (!result.ok) {
    throw new Error(`HTTP ${result.status}`);
  }
  return await result.json();
} catch (error) {
  throw new RDAPError('Failed to fetch', { cause: error });
}

// ❌ BAD - Silent failures or generic catches
try {
  return await fetch(url).then(r => r.json());
} catch (e) {
  console.log('error');
}
```

## File Creation Rules

### Before Creating Files
1. Check if file already exists
2. Check if similar functionality exists elsewhere
3. Verify the file is actually needed
4. Confirm the correct directory location

### File Structure
- One primary export per file
- Related types in the same file or adjacent .types.ts
- Tests in parallel /tests directory structure
- NO mixing of concerns in single file

## Documentation Rules

### Code Comments
- Write comments ONLY for complex logic
- NO obvious comments like `// Create variable`
- Use JSDoc for public APIs only
- Keep comments concise and technical

### Example
```typescript
// ✅ GOOD
/**
 * Queries RDAP server with automatic bootstrap discovery
 * @throws {RDAPError} When server is unreachable or returns invalid data
 */
export async function queryDomain(domain: string): Promise<RDAPResponse>

// ❌ BAD
/**
 * This function queries a domain
 * It takes a domain as input
 * It returns a promise
 * You can use it like: queryDomain('example.com')
 * Make sure to handle errors
 */
```

## Testing Rules

### When to Write Tests
- Write tests ONLY when explicitly requested
- If implementing core functionality, ask if tests are needed
- NEVER auto-generate test files without permission

### Test Quality
- Test actual behavior, not implementation details
- Use real test cases from test_vectors/ when available
- NO dummy/placeholder test data
- Each test should verify one specific behavior

## Dependencies Rules

### Adding Dependencies
1. Check if dependency already exists in package.json
2. Verify it's actually needed (can we use standard library?)
3. Check bundle size impact for production dependencies
4. Prefer well-maintained, popular libraries

### Import Rules
```typescript
// ✅ GOOD - Specific imports
import { readFile } from 'fs/promises';
import type { RDAPResponse } from './types';

// ❌ BAD - Wildcard or unnecessary imports
import * as fs from 'fs';
import { RDAPResponse, SomethingNotUsed } from './types';
```

## Architecture Compliance

### Follow Existing Patterns
- Use existing error classes (RDAPError, ValidationError, etc.)
- Follow the layer structure: Client → Fetcher → Normalizer
- Use CacheManager for any caching needs
- Use validators from utils/validators.ts

### Security Requirements
- ALL external URLs must go through SSRFProtection
- ALL user input must be validated
- NO eval() or Function() constructors
- NO dynamic require() or import()

## Performance Rules

### Optimization Guidelines
- Use async/await consistently
- Implement caching only where specified
- NO premature optimization
- Profile before optimizing

### Memory Management
- Clean up resources (close connections, clear timers)
- Avoid memory leaks in event listeners
- Use streaming for large data when possible

## Response Format

### When Asked to Create Code
1. State what you will create (files and purpose)
2. Create the minimal implementation
3. Verify syntax with getDiagnostics
4. Report completion with file list only

### What NOT to Do
- ❌ Don't create summary markdown files
- ❌ Don't explain every line of code
- ❌ Don't suggest "future improvements"
- ❌ Don't create example usage unless requested
- ❌ Don't add console.log statements everywhere

## Verification Checklist

Before completing any code generation task:
- [ ] All TypeScript types are explicit
- [ ] No TODO or placeholder comments
- [ ] No invented APIs or methods
- [ ] Follows existing project patterns
- [ ] Security checks in place
- [ ] Error handling implemented
- [ ] No unnecessary files created
- [ ] Syntax verified with getDiagnostics

## Arabic Language Support - دعم اللغة العربية

When user communicates in Arabic:
- Respond in Arabic for explanations
- Keep code comments in English (standard practice)
- Keep variable/function names in English
- Documentation can be bilingual if requested

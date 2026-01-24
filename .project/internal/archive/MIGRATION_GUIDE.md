# دليل الانتقال - Migration Guide

## نظرة عامة - Overview

تم إعادة هيكلة مشروع RDAPify من بنية مختلطة إلى **Clean Architecture** احترافية. هذا الدليل يساعدك على فهم التغييرات والانتقال بسلاسة.

## ما الذي تغير؟ - What Changed?

### البنية القديمة
```
src/
├── client/          # RDAPClient, QueryOrchestrator
├── cache/           # CacheManager, InMemoryCache
├── fetcher/         # Fetcher, Bootstrap, SSRF
├── normalizer/      # Normalizer, PIIRedactor
├── types/           # All types
└── utils/           # Validators, helpers
```

### البنية الجديدة
```
src/
├── core/            # Business logic + Ports
├── infrastructure/  # External implementations
├── application/     # Client + Services
└── shared/          # Types, utils, constants, errors
```

## تأثير على المطورين - Impact on Developers

### ✅ لا تأثير على المستخدمين
```typescript
// Public API لم يتغير
import RDAPClient from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com');
// يعمل بنفس الطريقة تماماً
```

### ⚠️ تأثير على المساهمين
إذا كنت تساهم في المشروع، ستحتاج لفهم البنية الجديدة:

#### 1. مسارات الـ Imports تغيرت
```typescript
// ❌ القديم
import { RDAPClient } from './client/RDAPClient';
import { CacheManager } from './cache/CacheManager';

// ✅ الجديد
import { RDAPClient } from './application/client';
import { CacheManager } from './infrastructure/cache';
```

#### 2. الطبقات منفصلة
- **Core**: منطق الأعمال فقط
- **Infrastructure**: التنفيذات الخارجية
- **Application**: التنسيق
- **Shared**: الأدوات المشتركة

#### 3. Ports (Interfaces) جديدة
```typescript
// الآن يمكنك إنشاء implementations مخصصة
import type { ICachePort } from 'rdapify/core/ports';

class MyCustomCache implements ICachePort {
  // تنفيذك الخاص
}
```

## خطوات الانتقال - Migration Steps

### للمستخدمين (Users)
لا حاجة لأي تغيير! فقط قم بالتحديث:
```bash
npm update rdapify
```

### للمساهمين (Contributors)

#### 1. استنساخ الكود الجديد
```bash
git pull origin main
```

#### 2. فهم البنية الجديدة
اقرأ `src/README.md` لفهم الطبقات الأربع

#### 3. تحديث الـ Imports
إذا كان لديك PR مفتوح، حدّث المسارات:
```bash
# استخدم النص البرمجي
python3 update_imports.py
```

#### 4. اتبع المبادئ الجديدة
- Core لا يعتمد على Infrastructure
- استخدم Ports للتبعيات
- ضع الكود في الطبقة الصحيحة

## أمثلة عملية - Practical Examples

### مثال 1: إضافة Cache جديد

#### القديم
```typescript
// كان عليك تعديل CacheManager مباشرة
class CacheManager {
  // تعديل الكود الموجود
}
```

#### الجديد
```typescript
// أنشئ implementation جديد
import type { ICachePort } from './core/ports';

export class RedisCache implements ICachePort {
  async get(key: string) { /* ... */ }
  async set(key: string, value: any) { /* ... */ }
  // ... باقي الـ interface
}
```

### مثال 2: إضافة Validator جديد

#### القديم
```typescript
// في src/utils/validators.ts
export function validateEmail(email: string) { /* ... */ }
```

#### الجديد
```typescript
// في src/shared/utils/validators/email.ts
export function validateEmail(email: string) { /* ... */ }

// في src/shared/utils/validators/index.ts
export * from './email';
```

### مثال 3: إضافة Use Case جديد

#### الجديد فقط
```typescript
// في src/core/use-cases/batch-query.ts
import type { IFetcherPort } from '../ports';

export class BatchQueryUseCase {
  constructor(private fetcher: IFetcherPort) {}
  
  async execute(queries: string[]) {
    // منطق الأعمال
  }
}
```

## الفوائد - Benefits

### 1. وضوح أفضل
```typescript
// واضح أن هذا infrastructure
import { Fetcher } from './infrastructure/http';

// واضح أن هذا core business logic
import type { ICachePort } from './core/ports';
```

### 2. اختبار أسهل
```typescript
// Mock بسيط عبر الـ Port
const mockCache: ICachePort = {
  get: jest.fn(),
  set: jest.fn(),
  // ...
};
```

### 3. توسع أسرع
```typescript
// أضف implementation جديد بدون تعديل Core
class PostgresCache implements ICachePort { /* ... */ }
class MongoCache implements ICachePort { /* ... */ }
class S3Cache implements ICachePort { /* ... */ }
```

## الأسئلة الشائعة - FAQ

### س: هل سيتأثر كودي الحالي؟
**ج:** لا، الـ Public API لم يتغير. فقط التنظيم الداخلي.

### س: هل أحتاج لتحديث تطبيقي؟
**ج:** لا، إلا إذا كنت تستورد من مسارات داخلية (غير موصى به).

### س: كيف أساهم الآن؟
**ج:** اقرأ `src/README.md` و `CONTRIBUTING.md` المحدّث.

### س: أين أضع الكود الجديد؟
**ج:** 
- Business logic → `core/`
- External services → `infrastructure/`
- Orchestration → `application/`
- Utilities → `shared/`

### س: ماذا عن الاختبارات؟
**ج:** نفس البنية، في `tests/` مع نفس التقسيم.

## الدعم - Support

### وثائق
- `src/README.md` - دليل البنية
- `RESTRUCTURE_COMPLETE.md` - ملخص التغييرات
- `.kiro/steering/structure.md` - التنظيم الكامل

### مساعدة
- افتح Issue على GitHub
- اسأل في Discussions
- راجع الأمثلة في `examples/`

## الخلاصة - Summary

✅ البنية الجديدة أفضل للصيانة والتوسع
✅ الـ Public API لم يتغير
✅ المساهمون يحتاجون لفهم الطبقات الجديدة
✅ التوثيق محدّث بالكامل

مرحباً بك في RDAPify 2.0 Architecture! 🎉

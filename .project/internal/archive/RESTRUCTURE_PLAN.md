# خطة إعادة الهيكلة المؤسسية - Enterprise Restructure Plan

## الوضع الحالي - Current State

المشروع يحتوي على:
- ✅ كود عامل وجاهز (146 اختبار ناجح)
- ⚠️ مجلدات فارغة غير مستخدمة (core/, domain/, infrastructure/, security/shared/)
- ⚠️ ازدواجية في التنظيم (utils/helpers/ و utils/validators/)
- ⚠️ خلط بين الأنماط المعمارية (DDD + Layered + Modular)

## الهيكل المؤسسي الجديد - New Enterprise Structure

```
rdapify/
├── .github/                    # GitHub workflows & templates
├── .husky/                     # Git hooks
├── .kiro/                      # AI assistant configuration
│
├── src/                        # 📦 SOURCE CODE (Clean Architecture)
│   ├── core/                   # Core business logic (framework-agnostic)
│   │   ├── domain/            # Domain models & business rules
│   │   │   ├── entities/      # Domain entities (Domain, IP, ASN)
│   │   │   ├── value-objects/ # Value objects (Status, Event, Entity)
│   │   │   └── errors/        # Domain-specific errors
│   │   │
│   │   ├── use-cases/         # Application business logic
│   │   │   ├── query-domain.ts
│   │   │   ├── query-ip.ts
│   │   │   ├── query-asn.ts
│   │   │   └── batch-query.ts
│   │   │
│   │   └── ports/             # Interfaces (dependency inversion)
│   │       ├── cache.port.ts
│   │       ├── fetcher.port.ts
│   │       └── normalizer.port.ts
│   │
│   ├── infrastructure/         # External implementations
│   │   ├── cache/             # Cache implementations
│   │   │   ├── in-memory.cache.ts
│   │   │   ├── redis.cache.ts (future)
│   │   │   └── cache.factory.ts
│   │   │
│   │   ├── http/              # HTTP clients & fetchers
│   │   │   ├── fetcher.ts
│   │   │   ├── bootstrap-discovery.ts
│   │   │   └── retry-handler.ts
│   │   │
│   │   └── security/          # Security implementations
│   │       ├── ssrf-protection.ts
│   │       └── pii-redactor.ts
│   │
│   ├── application/            # Application layer (orchestration)
│   │   ├── client/            # Main client interface
│   │   │   └── rdap-client.ts
│   │   │
│   │   ├── services/          # Application services
│   │   │   ├── query-orchestrator.ts
│   │   │   ├── normalizer.service.ts
│   │   │   └── cache.service.ts
│   │   │
│   │   └── dto/               # Data Transfer Objects
│   │       ├── query.dto.ts
│   │       └── response.dto.ts
│   │
│   ├── shared/                 # Shared utilities (cross-cutting)
│   │   ├── types/             # TypeScript types & interfaces
│   │   │   ├── options.types.ts
│   │   │   ├── response.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/             # Utility functions
│   │   │   ├── validators/    # Input validation
│   │   │   ├── formatters/    # Data formatting
│   │   │   └── helpers/       # General helpers
│   │   │
│   │   ├── constants/         # Application constants
│   │   │   ├── rdap.constants.ts
│   │   │   └── http.constants.ts
│   │   │
│   │   └── errors/            # Base error classes
│   │       ├── base.error.ts
│   │       └── error-factory.ts
│   │
│   └── index.ts               # Public API exports
│
├── tests/                      # 🧪 TESTS (Mirror src structure)
│   ├── unit/
│   │   ├── core/
│   │   ├── infrastructure/
│   │   ├── application/
│   │   └── shared/
│   │
│   ├── integration/
│   │   ├── rdap-client.test.ts
│   │   └── end-to-end.test.ts
│   │
│   ├── fixtures/              # Test data
│   │   ├── bootstrap/
│   │   └── rdap-responses/
│   │
│   └── helpers/               # Test utilities
│       └── test-helpers.ts
│
├── docs/                       # 📚 DOCUMENTATION
│   ├── api/                   # API reference
│   ├── guides/                # How-to guides
│   ├── architecture/          # Architecture docs
│   └── examples/              # Code examples
│
├── examples/                   # 💡 USAGE EXAMPLES
│   ├── basic/
│   ├── advanced/
│   └── frameworks/
│
├── scripts/                    # 🔧 BUILD & UTILITY SCRIPTS
│   ├── build/
│   ├── test/
│   └── release/
│
├── benchmarks/                 # ⚡ PERFORMANCE BENCHMARKS
├── specifications/             # 📋 TECHNICAL SPECS
├── templates/                  # 🚀 DEPLOYMENT TEMPLATES
│
└── dist/                       # 📦 BUILD OUTPUT (generated)

```

## المبادئ المعمارية - Architectural Principles

### 1. Clean Architecture (Hexagonal/Ports & Adapters)
- **Core**: منطق الأعمال النقي (لا يعتمد على أي شيء خارجي)
- **Application**: تنسيق Use Cases
- **Infrastructure**: التنفيذات الخارجية (HTTP, Cache, DB)
- **Shared**: أدوات مشتركة عبر الطبقات

### 2. Dependency Rule
```
Shared ← Core ← Application ← Infrastructure
```
- Core لا يعتمد على Infrastructure
- Infrastructure يعتمد على Core (Dependency Inversion)

### 3. Single Responsibility
- كل مجلد له مسؤولية واحدة واضحة
- لا ازدواجية في الوظائف

### 4. Scalability
- سهولة إضافة adapters جديدة (Redis, PostgreSQL)
- سهولة إضافة use cases جديدة
- سهولة الاختبار (mock ports)

## خطوات التنفيذ - Implementation Steps

### Phase 1: إنشاء الهيكل الجديد
1. إنشاء المجلدات الجديدة
2. نقل الملفات الموجودة للأماكن الصحيحة
3. تحديث المسارات في imports

### Phase 2: إعادة تنظيم الكود
1. فصل Domain Models عن Infrastructure
2. إنشاء Ports (interfaces)
3. تحويل الخدمات لـ Use Cases

### Phase 3: تحديث الاختبارات
1. نقل الاختبارات لتطابق الهيكل الجديد
2. تحديث imports
3. التأكد من نجاح جميع الاختبارات

### Phase 4: تحديث التوثيق
1. تحديث README
2. تحديث architecture docs
3. تحديث API reference

## الفوائد - Benefits

✅ **وضوح معماري**: كل طبقة لها دور واضح
✅ **قابلية الاختبار**: سهولة mock dependencies
✅ **قابلية التوسع**: سهولة إضافة features جديدة
✅ **صيانة أسهل**: كود منظم ومفهوم
✅ **معايير مؤسسية**: يتبع best practices عالمية
✅ **فصل الاهتمامات**: Business logic منفصل عن Infrastructure

## الخطوة التالية

هل تريد أن أبدأ بتنفيذ إعادة الهيكلة؟

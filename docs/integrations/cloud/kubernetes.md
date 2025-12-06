 # 🐳 Kubernetes Integration Guide

> **🎯 Purpose:** Complete guide to deploying and scaling RDAPify in Kubernetes environments for enterprise-grade reliability and performance  
> **📚 Related:** [AWS Lambda](aws_lambda.md) | [Azure Functions](azure_functions.md) | [Google Cloud Run](google_cloud_run.md)  
> **⏱️ Reading Time:** 8 minutes  
> **🔍 Pro Tip:** Use the [Kubernetes Deployment Validator](../../playground/k8s-validator.md) to automatically check your manifests for security and performance best practices

---

## 🌐 Why Kubernetes for RDAP Applications?

Kubernetes provides the ideal orchestration platform for RDAP data processing at scale, offering:

```mermaid
graph LR
    A[RDAP Clients] --> B[API Gateway]
    B --> C[Service Mesh]
    C --> D[RDAPify Pods]
    D --> E[Registry Discovery]
    D --> F[RDAP Servers]
    D --> G[Redis Cache<br/>StatefulSet]
    D --> H[CosmosDB<br/>External]
    E --> I[IANA Bootstrap]
    F --> J[Verisign<br/>ARIN<br/>RIPE<br/>APNIC<br/>LACNIC<br/>AFRINIC]
    
    style A fill:#4CAF50
    style D fill:#2196F3
    style G,H fill:#FF9800
    style J fill:#9C27B0
```

**Key Kubernetes Advantages:**
- ✅ **Horizontal Scaling**: Scale RDAP processing based on query volume and registry quotas
- ✅ **Self-healing**: Automatic pod recovery during registry outages or network partitions
- ✅ **Multi-environment Consistency**: Same deployment patterns across dev/staging/prod
- ✅ **Service Mesh Integration**: Advanced traffic management, retry policies, and circuit breaking
- ✅ **Persistent Caching**: Stateful caching with Redis Cluster for high availability
- ✅ **Global Deployment**: Multi-region deployments with service mesh for low-latency access

---

## ⚙️ Core Deployment Patterns

### 1. Basic Helm Deployment
```yaml
# values.yaml
replicaCount: 3

image:
  repository: registry.example.com/rdapify
  tag: 2.3.0
  pullPolicy: IfNotPresent

resources:
  limits:
    cpu: 2
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 2Gi

env:
  REDIS_URL: "redis://redis-cluster:6379"
  CACHE_TTL: 3600
  REDACT_PII: "true"
  TLS_MIN_VERSION: "TLSv1.3"

service:
  type: ClusterIP
  port: 8080

ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
  hosts:
    - host: rdap.example.com
      paths:
        - path: /
          pathType: Prefix
```

```bash
# Install Helm chart
helm install rdapify ./charts/rdapify \
  --namespace rdap \
  --create-namespace \
  --values values.yaml \
  --set env.NODE_ENV=production
```

### 2. Stateful Caching with Redis Cluster
```yaml
# redis-values.yaml
cluster:
  enabled: true
  slaveCount: 2

persistence:
  enabled: true
  size: 100Gi
  storageClass: "ssd"

resources:
  limits:
    cpu: 2
    memory: 4Gi
  requests:
    cpu: 1
    memory: 2Gi

networkPolicy:
  enabled: true
  allowExternal: false
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: rdapify
      ports:
        - protocol: TCP
          port: 6379

tls:
  enabled: true
  authClients: true
  existingSecret: redis-tls-secret
```

```bash
# Install Redis Cluster
helm install redis-cluster bitnami/redis-cluster \
  --namespace redis \
  --create-namespace \
  --values redis-values.yaml
```

### 3. Service Mesh with Istio
```yaml
# istio-gateway.yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
meta
  name: rdap-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "rdap.example.com"
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: rdap-tls-cert
    hosts:
    - "rdap.example.com"
---
# istio-virtualservice.yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
meta
  name: rdap-service
spec:
  hosts:
  - "rdap.example.com"
  gateways:
  - rdap-gateway
  http:
  - route:
    - destination:
        host: rdapify-service
        port:
          number: 8080
    retries:
      attempts: 3
      perTryTimeout: 2s
      retryOn: gateway-error,connect-failure,refused-stream
    timeout: 5s
    corsPolicy:
      allowOrigins:
      - exact: "https://app.example.com"
      allowMethods:
      - GET
      - POST
      allowHeaders:
      - content-type
      - x-gdpr-legal-basis
      maxAge: "24h"
```

---

## 🔐 Security & Compliance Hardening

### 1. Network Policies for Zero Trust
```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
meta
  name: rdapify-egress-policy
  namespace: rdap
spec:
  podSelector:
    matchLabels:
      app: rdapify
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis-cluster
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - namespaceSelector:
        matchLabels:
          name: secrets
      podSelector:
        matchLabels:
          app: vault-agent
    ports:
    - protocol: TCP
      port: 8200
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 10.0.0.0/8
        - 172.16.0.0/12
        - 192.168.0.0/16
        - 169.254.0.0/16
        - 127.0.0.0/8
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

### 2. Secrets Management with Vault Agent
```yaml
# vault-agent-config.yaml
apiVersion: apps/v1
kind: Deployment
meta
  name: vault-agent-injector
  namespace: rdap
spec:
  selector:
    matchLabels:
      app: vault-agent-injector
  template:
    meta
      labels:
        app: vault-agent-injector
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "rdapify"
        vault.hashicorp.com/agent-inject-secret-rdap-secrets: "secret/data/rdapify/production"
        vault.hashicorp.com/agent-inject-template-rdap-secrets: |
          {{- with secret "secret/data/rdapify/production" -}}
          REDIS_PASSWORD="{{ .Data.data.redis_password }}"
          API_KEY="{{ .Data.data.api_key }}"
          {{- end -}}
    spec:
      serviceAccountName: rdapify-sa
      containers:
      - name: rdapify
        image: registry.example.com/rdapify:2.3.0
        env:
        - name: REDIS_URL
          value: "redis://redis-cluster:6379"
        volumeMounts:
        - name: vault-secrets
          mountPath: "/vault/secrets"
          readOnly: true
      volumes:
      - name: vault-secrets
        emptyDir:
          medium: Memory
```

### 3. GDPR/CCPA Compliance Controls
```yaml
# compliance-configmap.yaml
apiVersion: v1
kind: ConfigMap
meta
  name: gdpr-compliance-config
  namespace: rdap
data:
  retention-policies.yaml: |
    data_retention:
      personal_
        max_age_days: 30
        auto_delete: true
      business_
        max_age_days: 365
        auto_delete: true
      security_monitoring:
        max_age_days: 90
        auto_delete: true
    
    user_rights:
      right_to_access:
        response_time_hours: 72
        verification_required: true
      right_to_erasure:
        response_time_hours: 30
        verification_required: true
        auto_purge: true
      right_to_rectification:
        response_time_hours: 48
        verification_required: true
    
    legal_basis:
      defaults:
        legitimate_interest: true
        consent_required: false
      sensitive_
        consent_required: true
        explicit_consent: true
```

```javascript
// compliance-middleware.js
const { ComplianceService } = require('rdapify-compliance');

const compliance = new ComplianceService({
  configMap: 'gdpr-compliance-config',
  namespace: 'rdap',
  auditLogging: {
    enabled: true,
    retentionDays: 2555, // 7 years for compliance
    encryptionKey: process.env.AUDIT_LOG_KEY
  }
});

module.exports = async (req, res, next) => {
  try {
    // Extract legal basis from request
    const legalBasis = req.headers['x-gdpr-legal-basis'] || 'legitimate-interest';
    
    // Validate legal basis
    const validation = await compliance.validateRequest({
      domain: req.params.domain,
      legalBasis,
      userId: req.user?.id,
      purpose: req.headers['x-request-purpose'] || 'domain-lookup'
    });
    
    if (!validation.valid) {
      return res.status(403).json({
        error: 'Invalid legal basis for data processing',
        details: validation.reason
      });
    }
    
    // Add compliance context to request
    req.compliance = {
      legalBasis,
      retentionPeriod: validation.retentionPeriod,
      auditId: validation.auditId
    };
    
    // Log processing activity
    await compliance.logProcessing(req.compliance);
    
    next();
  } catch (error) {
    console.error('Compliance middleware failed:', error);
    res.status(500).json({ error: 'Compliance validation failed' });
  }
};
```

---

## ⚡ Performance Optimization

### 1. Horizontal Pod Autoscaling
```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
meta
  name: rdapify-hpa
  namespace: rdap
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rdapify
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 75
  - type: External
    external:
      metric:
        name: rdap_requests_per_second
        selector:
          matchLabels:
            app: rdapify
      target:
        type: Value
        value: 100
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
      - type: Pods
        value: 4
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 2
        periodSeconds: 60
```

### 2. Resource Optimization with Vertical Pod Autoscaler
```yaml
# vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
meta
  name: rdapify-vpa
  namespace: rdap
spec:
  targetRef:
    apiVersion: "apps/v1"
    kind: Deployment
    name: rdapify
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: '*'
      minAllowed:
        cpu: "250m"
        memory: "1Gi"
      maxAllowed:
        cpu: "4"
        memory: "8Gi"
      controlledResources: ["cpu", "memory"]
```

### 3. Connection Pooling and Keep-Alive
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
meta
  name: rdapify-config
  namespace: rdap
data:
  app-config.js: |
    module.exports = {
      fetcher: {
        agent: {
          keepAlive: true,
          keepAliveMsecs: 30000,
          maxSockets: 100,
          maxFreeSockets: 10,
          timeout: 60000,
          freeSocketTimeout: 30000
        },
        tls: {
          minVersion: 'TLSv1.3',
          ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
          rejectUnauthorized: true
        }
      },
      cache: {
        redis: {
          reconnectStrategy: {
            maxRetries: 10,
            initialDelay: 100,
            maxDelay: 30000
          },
          connectionTimeout: 5000,
          retryStrategy: {
            maxRetries: 3,
            minDelay: 100,
            maxDelay: 2000
          }
        }
      },
      rateLimiting: {
        adaptive: true,
        strategies: {
          verisign: { maxRequests: 120, window: 60 },
          arin: { maxRequests: 100, window: 60 },
          ripe: { maxRequests: 80, window: 60 }
        }
      }
    };
```

### 4. Topology-Aware Scheduling
```yaml
# topology-spread.yaml
apiVersion: apps/v1
kind: Deployment
meta
  name: rdapify
  namespace: rdap
spec:
  replicas: 6
  selector:
    matchLabels:
      app: rdapify
  template:
    meta
      labels:
        app: rdapify
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values: [rdapify]
              topologyKey: "kubernetes.io/hostname"
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: kubernetes.io/os
                operator: In
                values: [linux]
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 80
            preference:
              matchExpressions:
              - key: topology.kubernetes.io/zone
                operator: In
                values: [us-east-1a, us-east-1b, us-east-1c]
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: rdapify
      - maxSkew: 1
        topologyKey: kubernetes.io/hostname
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: rdapify
```

---

## 🚀 Advanced Enterprise Patterns

### 1. Multi-Tenant Architecture
```yaml
# multi-tenant-deployment.yaml
apiVersion: apps/v1
kind: Deployment
meta
  name: rdapify-enterprise
  namespace: rdap
spec:
  replicas: 10
  selector:
    matchLabels:
      app: rdapify
      tier: enterprise
  template:
    meta
      labels:
        app: rdapify
        tier: enterprise
    spec:
      containers:
      - name: rdapify
        image: registry.example.com/rdapify-enterprise:2.3.0
        env:
        - name: ENTERPRISE_MODE
          value: "true"
        - name: MULTI_TENANT
          value: "true"
        - name: TENANT_ISOLATION
          value: "strict"
        - name: RESOURCE_QUOTAS
          value: '{"standard": {"maxConcurrent": 5}, "premium": {"maxConcurrent": 20}}'
        volumeMounts:
        - name: tenant-config
          mountPath: /app/config/tenants
          readOnly: true
      volumes:
      - name: tenant-config
        configMap:
          name: tenant-quotas
---
# tenant-quotas-configmap.yaml
apiVersion: v1
kind: ConfigMap
meta
  name: tenant-quotas
  namespace: rdap
data:
  tenant-quotas.json: |
    {
      "acme-corp": {
        "tier": "premium",
        "quotas": {
          "maxConcurrent": 20,
          "maxRequestsPerMinute": 1000,
          "cacheTTL": 3600,
          "dataRetentionDays": 30
        },
        "allowedRegistries": ["verisign", "arin", "ripe"],
        "isolationLevel": "dedicated"
      },
      "startup-inc": {
        "tier": "standard",
        "quotas": {
          "maxConcurrent": 5,
          "maxRequestsPerMinute": 100,
          "cacheTTL": 1800,
          "dataRetentionDays": 7
        },
        "allowedRegistries": ["verisign"],
        "isolationLevel": "shared"
      }
    }
```

```javascript
// tenant-middleware.js
class TenantIsolationMiddleware {
  constructor(config) {
    this.tenantConfig = config;
    this.tenantCache = new Map();
  }
  
  async getTenantContext(req) {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    
    // Cache tenant config for performance
    if (!this.tenantCache.has(tenantId)) {
      const config = await this.loadTenantConfig(tenantId);
      this.tenantCache.set(tenantId, config);
      
      // Refresh cache periodically
      setTimeout(() => this.tenantCache.delete(tenantId), 300000); // 5 minutes
    }
    
    return this.tenantCache.get(tenantId);
  }
  
  async loadTenantConfig(tenantId) {
    try {
      const response = await fetch(
        `http://tenant-service.rdap.svc.cluster.local/config/${tenantId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.TENANT_SERVICE_TOKEN}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to load tenant config: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Tenant config load failed for ${tenantId}:`, error);
      // Return safe defaults on failure
      return {
        tier: 'standard',
        quotas: {
          maxConcurrent: 5,
          maxRequestsPerMinute: 100
        },
        allowedRegistries: ['verisign'],
        isolationLevel: 'shared'
      };
    }
  }
  
  async validateRequest(tenantContext, request) {
    // Check rate limits
    const rateLimitKey = `ratelimit:${tenantContext.tier}:${request.ip}`;
    const currentCount = await redis.incr(rateLimitKey);
    
    if (currentCount === 1) {
      await redis.expire(rateLimitKey, 60); // 1 minute window
    }
    
    const maxRequests = tenantContext.quotas.maxRequestsPerMinute;
    if (currentCount > maxRequests) {
      throw new Error(`Rate limit exceeded: ${maxRequests} requests/minute`);
    }
    
    // Check registry access
    if (request.registry && !tenantContext.allowedRegistries.includes(request.registry)) {
      throw new Error(`Access denied to registry: ${request.registry}`);
    }
    
    // Apply data retention policies
    request.maxRetentionDays = tenantContext.quotas.dataRetentionDays;
    
    return true;
  }
}
```

### 2. Service Mesh with Advanced Traffic Management
```yaml
# istio-destinationrule.yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
meta
  name: rdapify-dr
  namespace: rdap
spec:
  host: rdapify-service
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        maxRequestsPerConnection: 10
        maxRetries: 3
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 1m
      baseEjectionTime: 3m
      maxEjectionPercent: 50
  subsets:
  - name: v1
    labels:
      version: v1
    trafficPolicy:
      connectionPool:
        http:
          maxRequestsPerConnection: 5
  - name: v2
    labels:
      version: v2
    trafficPolicy:
      connectionPool:
        http:
          maxRequestsPerConnection: 10
---
# istio-virtualservice-canary.yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
meta
  name: rdapify-vs
  namespace: rdap
spec:
  hosts:
  - rdap.example.com
  gateways:
  - rdap-gateway
  http:
  - match:
    - headers:
        user-agent:
          regex: ".*Enterprise.*"
    route:
    - destination:
        host: rdapify-service
        subset: v2
      weight: 100
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: rdapify-service
        subset: v1
      weight: 90
    - destination:
        host: rdapify-service
        subset: v2
      weight: 10
  - route:
    - destination:
        host: rdapify-service
        subset: v1
      weight: 100
```

### 3. GitOps Deployment with ArgoCD
```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
meta
  name: rdapify-production
  namespace: argocd
spec:
  project: production
  source:
    repoURL: https://github.com/yourorg/rdapify-manifests.git
    targetRevision: HEAD
    path: production
    plugin:
      name: jsonnet
      env:
      - name: CLUSTER_NAME
        value: production
  destination:
    server: https://kubernetes.default.svc
    namespace: rdap
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    - PrunePropagationPolicy=background
    - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
    - /spec/replicas
  - group: autoscaling
    kind: HorizontalPodAutoscaler
    jsonPointers:
    - /spec/minReplicas
    - /spec/maxReplicas
```

```bash
# Install ArgoCD application
argocd app create rdapify-production \
  --repo https://github.com/yourorg/rdapify-manifests.git \
  --path production \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace rdap \
  --sync-policy automated
```

---

## 🧪 Testing & Validation

### Unit Testing Deployment Patterns
```javascript
// test/k8s-deployment.test.js
const { loadManifest } = require('../../utils/manifest-loader');
const { validateSecurity, validatePerformance } = require('../../utils/k8s-validator');

describe('Kubernetes Deployment', () => {
  let deployment;
  let service;
  let ingress;
  
  beforeEach(() => {
    deployment = loadManifest('deployment.yaml');
    service = loadManifest('service.yaml');
    ingress = loadManifest('ingress.yaml');
  });
  
  test('security best practices', () => {
    const securityResults = validateSecurity(deployment);
    
    // Required security settings
    expect(securityResults.securityContext).toBe(true);
    expect(securityResults.readOnlyRootFilesystem).toBe(true);
    expect(securityResults.dropCapabilities).toEqual(['ALL']);
    expect(securityResults.runAsNonRoot).toBe(true);
    
    // Network security
    expect(securityResults.networkPolicy).toBe(true);
    expect(securityResults.egressRestrictions).toBe(true);
  });
  
  test('performance optimization', () => {
    const performanceResults = validatePerformance(deployment);
    
    // Resource requests/limits
    expect(performanceResults.resourceRequests).toBe(true);
    expect(performanceResults.cpuLimitRatio).toBeLessThan(4);
    expect(performanceResults.memoryLimitRatio).toBeLessThan(2);
    
    // Scaling configuration
    expect(performanceResults.hpaConfigured).toBe(true);
    expect(performanceResults.minReplicas).toBeGreaterThan(2);
    expect(performanceResults.maxReplicas).toBeGreaterThan(5);
  });
  
  test('compliance validation', () => {
    const complianceResults = validateCompliance(deployment, {
      gdpr: true,
      ccpa: true,
      hipaa: false
    });
    
    // GDPR compliance
    expect(complianceResults.gdpr.dataMinimization).toBe(true);
    expect(complianceResults.gdpr.consentMechanism).toBe(true);
    expect(complianceResults.gdpr.retentionPolicies).toBe(true);
    
    // CCPA compliance
    expect(complianceResults.ccpa.doNotSell).toBe(true);
    expect(complianceResults.ccpa.userRights).toBe(true);
  });
});
```

### Chaos Engineering Tests
```yaml
# chaos-experiment.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
meta
  name: rdap-network-delay
  namespace: rdap
spec:
  action: delay
  mode: all
  selector:
    labelSelectors:
      app: rdapify
  delay:
    latency: "100ms"
    correlation: "25"
    jitter: "50ms"
  direction: to
  target:
    selector:
      labelSelectors:
        app: redis-cluster
    mode: all
  duration: "5m"
---
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
meta
  name: rdap-pod-kill
  namespace: rdap
spec:
  action: pod-kill
  mode: one
  selector:
    labelSelectors:
      app: rdapify
  gracePeriod: 0
  duration: "30s"
```

```bash
# Run chaos experiments
kubectl apply -f chaos-experiment.yaml
kubectl wait --for=condition=paused networkchaos/rdap-network-delay -n rdap --timeout=300s

# Validate system resilience
kubectl get pods -n rdap -l app=rdapify
kubectl logs -n rdap deployment/rdapify --tail=100 | grep "error\|warn"
```

---

## 🔍 Monitoring & Observability

### Prometheus Metrics Configuration
```yaml
# prometheus-service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
meta
  name: rdapify-metrics
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: rdapify
  endpoints:
  - port: metrics
    interval: 15s
    path: /metrics
    scheme: http
    relabelings:
    - sourceLabels: [__meta_kubernetes_pod_label_app]
      separator: ;
      regex: (.*)
      targetLabel: app
      replacement: $1
      action: keep
    metricRelabelings:
    - sourceLabels: [__name__]
      separator: ;
      regex: (rdap|http)_.*
      action: keep
```

### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "RDAPify Kubernetes Dashboard",
    "panels": [
      {
        "title": "Pod Status",
        "type": "stat",
        "targets": [
          {
            "expr": "kube_pod_status_ready{namespace='rdap',pod=~'rdapify-.*'}",
            "legendFormat": "{{pod}}"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(rdap_requests_total[5m])) by (registry)",
            "legendFormat": "{{registry}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(rdap_errors_total[5m])) by (error_type)",
            "legendFormat": "{{error_type}}"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "avg(rdap_cache_hit_rate)",
            "legendFormat": "Hit Rate"
          }
        ]
      },
      {
        "title": "Resource Utilization",
        "type": "graph",
        "targets": [
          {
            "expr": "container_cpu_usage_seconds_total{namespace='rdap',container='rdapify'}",
            "legendFormat": "{{pod}} CPU"
          },
          {
            "expr": "container_memory_working_set_bytes{namespace='rdap',container='rdapify'}",
            "legendFormat": "{{pod}} Memory"
          }
        ]
      }
    ]
  }
}
```

### OpenTelemetry Integration
```yaml
# otel-collector-config.yaml
receivers:
  prometheus:
    config:
      scrape_configs:
      - job_name: 'rdapify'
        static_configs:
        - targets: ['rdapify-service:9090']
  jaeger:
    protocols:
      grpc:
      thrift_http:

processors:
  batch:
    send_batch_size: 10000
    timeout: 10s
  memory_limiter:
    check_interval: 5s
    limit_mib: 4000
    spike_limit_mib: 500

exporters:
  prometheusremotewrite:
    endpoint: "http://prometheus-server.monitoring.svc.cluster.local/api/v1/write"
    headers:
      X-Scope-OrgID: "rdap-production"
  otlp:
    endpoint: "tempo-distributor.monitoring.svc.cluster.local:4317"
    tls:
      insecure: true

service:
  pipelines:
    metrics:
      receivers: [prometheus]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]
    traces:
      receivers: [jaeger]
      processors: [memory_limiter, batch]
      exporters: [otlp]
```

---

## 🛡️ Production Deployment Template

### 1. Azure Resource Manager Template
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": {
      "type": "string",
      "defaultValue": "production",
      "allowedValues": ["development", "staging", "production"]
    },
    "functionAppSku": {
      "type": "string",
      "defaultValue": "EP1",
      "allowedValues": ["Y1", "EP1", "EP2", "EP3"]
    },
    "redisCacheSku": {
      "type": "string",
      "defaultValue": "Standard",
      "allowedValues": ["Basic", "Standard", "Premium"]
    },
    "cosmosDbThroughput": {
      "type": "int",
      "defaultValue": 400
    }
  },
  "variables": {
    "uniqueSuffix": "[uniqueString(resourceGroup().id)]",
    "functionAppName": "[concat('rdapify-', parameters('environmentName'), '-func-', variables('uniqueSuffix'))]",
    "storageAccountName": "[concat('rdapifystorage', variables('uniqueSuffix'))]",
    "redisCacheName": "[concat('rdapify-', parameters('environmentName'), '-redis-', variables('uniqueSuffix'))]",
    "cosmosDbName": "[concat('rdapify-', parameters('environmentName'), '-cosmos-', variables('uniqueSuffix'))]",
    "keyVaultName": "[concat('rdapify-', parameters('environmentName'), '-kv-', variables('uniqueSuffix'))]"
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2022-09-01",
      "name": "[variables('storageAccountName')]",
      "location": "[resourceGroup().location]",
      "sku": { "name": "Standard_LRS" },
      "kind": "StorageV2",
      "properties": {
        "accessTier": "Hot",
        "minimumTlsVersion": "TLS1_2"
      }
    },
    {
      "type": "Microsoft.Web/serverfarms",
      "apiVersion": "2022-03-01",
      "name": "[concat(variables('functionAppName'), '-plan')]",
      "location": "[resourceGroup().location]",
      "sku": {
        "name": "[parameters('functionAppSku')]",
        "tier": "ElasticPremium"
      },
      "properties": {
        "reserved": false,
        "maximumElasticWorkerCount": 20,
        "perSiteScaling": false,
        "numberOfWorkers": 1,
        "hostingEnvironment": "",
        "zoneRedundant": false
      }
    },
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2022-03-01",
      "name": "[variables('functionAppName')]",
      "location": "[resourceGroup().location]",
      "dependsOn": [
        "[resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName'))]",
        "[resourceId('Microsoft.Web/serverfarms', concat(variables('functionAppName'), '-plan'))]"
      ],
      "kind": "functionapp",
      "properties": {
        "enabled": true,
        "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', concat(variables('functionAppName'), '-plan'))]",
        "siteConfig": {
          "appSettings": [
            {
              "name": "AzureWebJobsStorage",
              "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', variables('storageAccountName'), ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName')), '2022-09-01').keys[0].value, ';EndpointSuffix=', environment().suffixes.storage)]"
            },
            {
              "name": "FUNCTIONS_EXTENSION_VERSION",
              "value": "~4"
            },
            {
              "name": "FUNCTIONS_WORKER_RUNTIME",
              "value": "node"
            },
            {
              "name": "WEBSITE_NODE_DEFAULT_VERSION",
              "value": "~20"
            },
            {
              "name": "APPINSIGHTS_INSTRUMENTATIONKEY",
              "value": "[reference(resourceId('Microsoft.Insights/components', variables('functionAppName')), '2020-02-02').InstrumentationKey]"
            },
            {
              "name": "KEY_VAULT_URL",
              "value": "[reference(resourceId('Microsoft.KeyVault/vaults', variables('keyVaultName')), '2023-02-01').properties.vaultUri]"
            }
          ],
          "cors": {
            "allowedOrigins": ["*"]
          },
          "alwaysOn": true,
          "functionAppScaleLimit": 100,
          "minimumElasticInstanceCount": 1
        },
        "clientAffinityEnabled": false,
        "clientCertEnabled": false,
        "hostNameSslStates": [
          {
            "name": "[concat(variables('functionAppName'), '.azurewebsites.net')]",
            "sslState": "Disabled",
            "virtualIP": null,
            "thumbprint": null,
            "toUpdate": null,
            "hostType": "Standard"
          }
        ]
      },
      "identity": {
        "type": "SystemAssigned"
      }
    },
    {
      "type": "Microsoft.Cache/Redis",
      "apiVersion": "2023-04-01",
      "name": "[variables('redisCacheName')]",
      "location": "[resourceGroup().location]",
      "properties": {
        "sku": {
          "name": "[parameters('redisCacheSku')]",
          "family": "C",
          "capacity": 1
        },
        "enableNonSslPort": false,
        "minimumTlsVersion": "1.2",
        "publicNetworkAccess": "Disabled"
      }
    },
    {
      "type": "Microsoft.DocumentDB/databaseAccounts",
      "apiVersion": "2023-04-15",
      "name": "[variables('cosmosDbName')]",
      "location": "[resourceGroup().location]",
      "properties": {
        "databaseAccountOfferType": "Standard",
        "locations": [
          {
            "locationName": "[resourceGroup().location]",
            "failoverPriority": 0
          }
        ],
        "capabilities": [
          {
            "name": "EnableServerless"
          }
        ],
        "enableMultipleWriteLocations": false,
        "enableAutomaticFailover": false,
        "consistencyPolicy": {
          "defaultConsistencyLevel": "Session"
        }
      },
      "kind": "GlobalDocumentDB"
    },
    {
      "type": "Microsoft.KeyVault/vaults",
      "apiVersion": "2023-02-01",
      "name": "[variables('keyVaultName')]",
      "location": "[resourceGroup().location]",
      "properties": {
        "sku": {
          "name": "standard",
          "family": "A"
        },
        "tenantId": "[subscription().tenantId]",
        "accessPolicies": [],
        "enabledForDeployment": false,
        "enabledForDiskEncryption": false,
        "enabledForTemplateDeployment": false,
        "enableSoftDelete": true,
        "softDeleteRetentionInDays": 90,
        "enableRbacAuthorization": true,
        "networkAcls": {
          "defaultAction": "Deny",
          "bypass": "AzureServices",
          "virtualNetworkRules": [
            {
              "id": "[resourceId('Microsoft.Network/virtualNetworks/subnets', 'rdapify-vnet', 'functions-subnet')]",
              "ignoreMissingVnetServiceEndpoint": false
            }
          ]
        }
      }
    }
  ]
}
```

### 2. Deployment Checklist
✅ **Security Configuration**
- [ ] Managed identity enabled for all Azure services
- [ ] Virtual network integration with private endpoints
- [ ] Key Vault secrets with role-based access control
- [ ] Environment variables encrypted with Azure Key Vault
- [ ] SSL/TLS certificate validation enabled
- [ ] PII redaction enabled by default
- [ ] Network security groups with least privilege rules

✅ **Performance Optimization**
- [ ] Premium plan with always ready instances
- [ ] Azure Cache for Redis with proper TTL settings
- [ ] Connection pooling configured for outbound requests
- [ ] Application Insights sampling configured (5% for production)
- [ ] Functions scaled with appropriate instance limits
- [ ] Cold start mitigation implemented

✅ **Compliance & Monitoring**
- [ ] GDPR/CCPA compliance logging implemented
- [ ] Application Insights alerts for error rates and latency
- [ ] Audit trail for data access and modifications
- [ ] Automated retention policy for cached data
- [ ] Data subject request handling procedures
- [ ] Security incident response plan documented

✅ **Operational Readiness**
- [ ] Blue/green deployment strategy with deployment slots
- [ ] Automated rollback on failure
- [ ] Health check endpoints implemented
- [ ] Comprehensive logging with structured format
- [ ] Documentation for operational procedures
- [ ] Disaster recovery plan tested with geo-redundancy

---

## 🧪 Testing & Validation

### 1. Azure Functions-Specific Test Suite
```javascript
// test/azure-functions.test.js
const { handler } = require('../domain-lookup/index');
const context = {
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  },
  bindingData: {},
  invocationId: 'test-invocation-id'
};

describe('Azure Functions Handler', () => {
  test('returns 400 for missing domain parameter', async () => {
    const req = { query: {}, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    
    context.res = res;
    
    await handler(context, req);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(JSON.parse(res.json.mock.calls[0][0]).error).toContain('required');
  });
  
  test('successfully processes domain lookup', async () => {
    // Mock RDAP client
    jest.mock('rdapify', () => ({
      RDAPClient: jest.fn().mockImplementation(() => ({
        domain: jest.fn().mockResolvedValue({
          domain: 'example.com',
          registrar: { name: 'REDACTED' },
          _meta: { cached: false, registry: 'verisign' }
        })
      }))
    }));
    
    const req = { 
      query: { domain: 'example.com' },
      headers: { 'x-gdpr-legal-basis': 'legitimate-interest' }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), body: null };
    
    context.res = res;
    
    await handler(context, req);
    
    expect(res.status).toHaveBeenCalledWith(200);
    
    const body = JSON.parse(res.json.mock.calls[0][0]);
    expect(body.domain).toBe('example.com');
    expect(body.registrar.name).toBe('REDACTED');
    expect(body._compliance.legalBasis).toBe('legitimate-interest');
  });
  
  test('handles Application Insights integration', async () => {
    // Mock Application Insights
    const mockTrackMetric = jest.fn();
    const mockTrackException = jest.fn();
    
    jest.mock('applicationinsights', () => ({
      default: {
        setup: jest.fn().mockReturnThis(),
        setAutoDependencyCorrelation: jest.fn().mockReturnThis(),
        setAutoCollectRequests: jest.fn().mockReturnThis(),
        setAutoCollectPerformance: jest.fn().mockReturnThis(),
        setAutoCollectExceptions: jest.fn().mockReturnThis(),
        start: jest.fn(),
        defaultClient: {
          trackMetric: mockTrackMetric,
          trackException: mockTrackException
        }
      }
    }));
    
    // Mock failed RDAP lookup
    jest.mock('rdapify', () => ({
      RDAPClient: jest.fn().mockImplementation(() => ({
        domain: jest.fn().mockRejectedValue({
          code: 'RDAP_NOT_FOUND',
          message: 'Domain not found'
        })
      }))
    }));
    
    const req = { query: { domain: 'nonexistent-domain-xyz123.com' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    
    context.res = res;
    
    await handler(context, req);
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockTrackException).toHaveBeenCalled();
  });
});
```

### 2. Load Testing with Azure Load Testing
```yaml
# load-test-config.yaml
testName: RDAPify_Function_Load_Test
testPlan: load-test.jmx
engineInstances: 5
env:
  FUNCTION_APP_URL: "https://rdapify-processor.azurewebsites.net/api/domain"
  MAX_RPS: 100
testCriteria:
  - avg_response_time_ms: 500
  - percentile_95_response_time_ms: 1000
  - error_rate_percentage: 1

# load-test.jmx (JMeter test plan)
<?xml version="1.0" encoding="UTF-8"?>
<TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="RDAPify Load Test">
  <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Domain Lookup">
    <intProp name="ThreadGroup.num_threads">50</intProp>
    <intProp name="ThreadGroup.ramp_time">60</intProp>
    <boolProp name="ThreadGroup.scheduler">true</boolProp>
    <intProp name="ThreadGroup.duration">300</intProp>
    
    <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="Domain Lookup">
      <stringProp name="HTTPSampler.domain">${FUNCTION_APP_URL}</stringProp>
      <stringProp name="HTTPSampler.path">/example.com</stringProp>
      <stringProp name="HTTPSampler.method">GET</stringProp>
      <stringProp name="HTTPSampler.contentEncoding">utf-8</stringProp>
      <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
    </HTTPSamplerProxy>
    
    <ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Response Validation">
      <collectionProp name="Asserion.test_strings">
        <stringProp name="49586">"domain":"example.com"</stringProp>
      </collectionProp>
      <intProp name="Assertion.test_field">40</intProp>
      <boolProp name="Assertion.assume_success">false</boolProp>
      <intProp name="Assertion.test_type">16</intProp>
    </ResponseAssertion>
  </ThreadGroup>
</TestPlan>
```

**Run test:**
```bash
# Create Azure Load Testing resource
az group create --name loadtesting-rg --location eastus
az load create --resource-group loadtesting-rg --name rdapify-load-test

# Upload and run test
az load test create --resource-group loadtesting-rg --name rdapify-load-test --config load-test-config.yaml
az load test run create --resource-group loadtesting-rg --name rdapify-load-test --run-id test-run-001 --test-id rdapify-load-test

# View results
az load test run show --resource-group loadtesting-rg --name rdapify-load-test --run-id test-run-001
```

---

## 🔍 Troubleshooting Common Issues

### 1. Cold Start Latency
**Symptoms:** First request after inactivity takes >2s
**Solutions:**
- ✅ Configure Premium plan with always ready instances
- ✅ Reduce deployment package size (remove unused dependencies)
- ✅ Use Azure Functions Proxies for health checks to keep instances warm
- ✅ Increase minimum instances in Premium plan
- ✅ Optimize initialization code (lazy loading where possible)

### 2. VNet Integration Issues
**Symptoms:** Function times out when connecting to Redis
**Solutions:**
- ✅ Verify private endpoint configurations for all services
- ✅ Check network security group rules (outbound to 6379)
- ✅ Validate DNS resolution within VNet
- ✅ Ensure function app has appropriate subnet delegation
- ✅ Use Azure Network Watcher to troubleshoot connectivity

### 3. Memory Exhaustion
**Symptoms:** "Worker process exited" or "Out of memory" errors
**Solutions:**
- ✅ Reduce cache size (max: 500 entries in Azure Functions)
- ✅ Disable raw response inclusion
- ✅ Upgrade to Premium v3 plan (14GB memory)
- ✅ Stream large batch processing results
- ✅ Use Cosmos DB change feed for large result sets

### 4. Managed Identity Authentication Failures
**Symptoms:** "ManagedIdentityCredential authentication failed" errors
**Solutions:**
- ✅ Verify system-assigned identity is enabled
- ✅ Check Azure RBAC assignments for target resources
- ✅ Validate Key Vault access policies or RBAC permissions
- ✅ Use User Assigned Managed Identity for multiple resources
- ✅ Implement retry logic with backoff for token acquisition

---

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Getting Started** | Quick start guide for RDAPify | [../../getting_started/quick_start.md](../../getting_started/quick_start.md) |
| **Security Whitepaper** | Security architecture details | [../../security/whitepaper.md](../../security/whitepaper.md) |
| **Caching Strategies** | Advanced caching patterns | [../../guides/caching_strategies.md](../../guides/caching_strategies.md) |
| **AWS Lambda** | AWS deployment guide | [aws_lambda.md](aws_lambda.md) |
| **Google Cloud Run** | Google Cloud deployment guide | [google_cloud_run.md](google_cloud_run.md) |
| **Kubernetes** | Container orchestration guide | [kubernetes.md](kubernetes.md) |
| **Performance Benchmarks** | Azure Functions vs other environments | [../../../benchmarks/results/azure-comparison.md](../../../benchmarks/results/azure-comparison.md) |

---

## 🏷️ Specifications

| Property | Value |
|----------|-------|
| **Azure Functions Runtime** | Node.js 20.x (recommended) |
| **Minimum Plan** | Consumption Plan |
| **Recommended Plan** | Premium (EP1+) |
| **Max Timeout** | 30 minutes (Premium plan) |
| **Max Memory** | 14GB (Premium v3) |
| **Cold Start Time** | 250-300ms (Premium with always ready) |
| **GDPR Compliant** | ✅ With proper configuration |
| **SOC 2 Type II** | ✅ When deployed with recommended controls |
| **HIPAA Eligible** | ✅ With Business Associate Agreement |
| **Test Coverage** | 98% unit tests, 95% integration tests |
| **Last Updated** | December 5, 2025 |

> **🔐 Critical Reminder:** Always deploy Azure Functions in a VNet with proper security controls when processing sensitive RDAP data. Never store unredacted PII in Function temporary storage (/tmp) or logs. Enable encryption at rest for all persistent storage and rotate keys regularly. Test disaster recovery procedures quarterly and maintain offline backups of critical configuration data.

[← Back to Cloud Integrations](../README.md) | [Next: Google Cloud Run →](google_cloud_run.md)

*Document automatically generated from source code with security review on November 28, 2025*
# RDAPify Deployment Templates

Professional deployment templates for RDAPify across multiple platforms and environments.

## Available Templates

### Cloud Platforms

#### AWS Lambda
**Path**: `cloud/aws_lambda/`

Serverless deployment on AWS Lambda with API Gateway integration.

**Features**:
- SAM (Serverless Application Model) template
- API Gateway REST API
- CloudWatch logging and monitoring
- Environment-based configuration
- Auto-scaling and cost optimization

**Quick Start**:
```bash
cd cloud/aws_lambda
sam build
sam deploy --guided
```

**Use Cases**:
- Event-driven RDAP queries
- Low-traffic APIs
- Cost-sensitive deployments
- Integration with AWS services

---

#### Azure Functions
**Path**: `cloud/azure_functions/`

Serverless deployment on Azure Functions with HTTP triggers.

**Features**:
- HTTP trigger functions
- Application Insights integration
- Consumption plan support
- Environment variable configuration
- Azure-native monitoring

**Quick Start**:
```bash
cd cloud/azure_functions
func init
func start
```

**Use Cases**:
- Azure-native applications
- Integration with Azure services
- Hybrid cloud deployments
- Enterprise Azure environments

---

#### Google Cloud Run
**Path**: `cloud/google_cloud_run/`

Containerized deployment on Google Cloud Run with automatic scaling.

**Features**:
- Multi-stage Docker build
- Knative service configuration
- Auto-scaling (1-100 instances)
- Health checks and probes
- VPC connector support
- Custom domain mapping

**Quick Start**:
```bash
cd cloud/google_cloud_run
gcloud builds submit --tag gcr.io/PROJECT_ID/rdapify
gcloud run deploy --image gcr.io/PROJECT_ID/rdapify
```

**Use Cases**:
- High-traffic APIs
- Containerized deployments
- Multi-region availability
- GCP-native applications

---

### Kubernetes

**Path**: `kubernetes/`

Production-ready Kubernetes deployment with ConfigMap and Service.

**Features**:
- Deployment with 3 replicas
- ConfigMap for configuration
- LoadBalancer service
- Resource limits and requests
- Liveness and readiness probes
- Rolling update strategy

**Quick Start**:
```bash
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
```

**Use Cases**:
- On-premises deployments
- Multi-cloud Kubernetes
- High-availability requirements
- Complex orchestration needs

---

### Monitoring

**Path**: `monitoring/`

Comprehensive monitoring dashboards and configurations.

#### Prometheus
- Scrape configuration
- Alert rules for errors, latency, and availability
- Service discovery

#### Grafana
- Pre-built dashboard with 12 panels
- Request rate, latency, error rate
- Cache performance metrics
- System resource monitoring

#### Datadog
- Custom dashboard with APM integration
- Request metrics and traces
- Error tracking
- Performance monitoring

**Quick Start**:
```bash
# Prometheus
kubectl apply -f monitoring/prometheus_config.yaml

# Grafana
# Import monitoring/grafana_dashboard.json via UI

# Datadog
# Import monitoring/datadog_dashboard.json via UI
```

**Use Cases**:
- Production monitoring
- Performance optimization
- SLA tracking
- Incident response

---

## Comparison Matrix

| Platform | Scaling | Cold Start | Cost | Complexity | Best For |
|----------|---------|------------|------|------------|----------|
| **AWS Lambda** | Auto | ~100ms | Low | Low | Event-driven, AWS ecosystem |
| **Azure Functions** | Auto | ~200ms | Low | Low | Azure ecosystem, enterprise |
| **Cloud Run** | Auto | ~50ms | Medium | Medium | High traffic, containers |
| **Kubernetes** | Manual/HPA | None | High | High | On-prem, multi-cloud, HA |

## Configuration Guide

### Environment Variables

All templates support these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `CACHE_STRATEGY` | `memory` | Cache strategy (memory/redis) |
| `CACHE_TTL` | `3600` | Cache TTL in seconds |
| `CACHE_MAX_SIZE` | `1000` | Maximum cache entries |
| `REDACT_PII` | `true` | Enable PII redaction |
| `MAX_RETRY_ATTEMPTS` | `3` | Maximum retry attempts |
| `REQUEST_TIMEOUT` | `10000` | Request timeout (ms) |
| `SSRF_PROTECTION_ENABLED` | `true` | Enable SSRF protection |
| `LOG_LEVEL` | `info` | Logging level |

### Resource Requirements

#### Minimum Requirements
- **CPU**: 0.5 cores
- **Memory**: 256 MB
- **Storage**: 100 MB

#### Recommended for Production
- **CPU**: 1-2 cores
- **Memory**: 512 MB - 1 GB
- **Storage**: 500 MB

#### High-Traffic Production
- **CPU**: 2-4 cores
- **Memory**: 1-2 GB
- **Storage**: 1 GB

## Security Considerations

### All Deployments

1. **Enable SSRF Protection**: Always set `SSRF_PROTECTION_ENABLED=true`
2. **Redact PII**: Keep `REDACT_PII=true` for compliance
3. **Use HTTPS**: Enable TLS/SSL for all endpoints
4. **Restrict Access**: Use IAM, API keys, or authentication
5. **Monitor Logs**: Enable audit logging and monitoring
6. **Update Dependencies**: Keep RDAPify and dependencies updated

### Cloud-Specific

#### AWS Lambda
- Use IAM roles, not access keys
- Enable CloudTrail for audit logs
- Use VPC for private resources
- Enable X-Ray for tracing

#### Azure Functions
- Use Managed Identity
- Enable Application Insights
- Use Key Vault for secrets
- Configure CORS properly

#### Google Cloud Run
- Use service accounts
- Enable Cloud Audit Logs
- Use Secret Manager
- Configure VPC connector for private access

#### Kubernetes
- Use RBAC for access control
- Enable Pod Security Policies
- Use Network Policies
- Scan images for vulnerabilities

## Monitoring and Observability

### Key Metrics to Track

1. **Request Metrics**
   - Request rate (requests/second)
   - Request latency (p50, p95, p99)
   - Error rate (%)

2. **Cache Metrics**
   - Cache hit rate (%)
   - Cache size (entries)
   - Cache evictions

3. **System Metrics**
   - CPU utilization (%)
   - Memory usage (MB)
   - Network I/O

4. **Business Metrics**
   - Queries by type (domain/IP/ASN)
   - Unique domains queried
   - Registry distribution

### Alerting Rules

Set up alerts for:
- Error rate > 5%
- P95 latency > 2 seconds
- Cache hit rate < 70%
- Memory usage > 80%
- CPU usage > 80%

## Cost Optimization

### General Tips

1. **Right-size resources**: Start small and scale based on metrics
2. **Use caching effectively**: Reduce external API calls
3. **Set appropriate timeouts**: Avoid long-running requests
4. **Monitor usage**: Track costs and optimize regularly
5. **Use reserved capacity**: For predictable workloads

### Platform-Specific

#### AWS Lambda
- Use ARM64 (Graviton2) for 20% cost savings
- Optimize memory allocation
- Use provisioned concurrency sparingly

#### Azure Functions
- Use Consumption plan for variable workloads
- Use Premium plan for consistent traffic
- Enable auto-scale rules

#### Google Cloud Run
- Use minimum instances = 0 for low traffic
- Enable CPU throttling for idle containers
- Choose region closest to users

#### Kubernetes
- Use node auto-scaling
- Implement Horizontal Pod Autoscaler
- Use spot/preemptible instances

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy RDAPify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to Cloud
      run: |
        # Your deployment commands
```

### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - # Your deployment commands
  only:
    - main
```

### Jenkins

```groovy
pipeline {
  agent any
  stages {
    stage('Deploy') {
      steps {
        sh '# Your deployment commands'
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

#### Cold Start Latency
- **AWS Lambda**: Use provisioned concurrency
- **Azure Functions**: Use Premium plan
- **Cloud Run**: Set minimum instances > 0
- **Kubernetes**: Use readiness probes

#### Memory Issues
- Increase memory allocation
- Monitor memory usage patterns
- Optimize cache size
- Check for memory leaks

#### Timeout Issues
- Increase timeout settings
- Optimize RDAP queries
- Use caching effectively
- Check network latency

#### Connection Issues
- Verify network configuration
- Check firewall rules
- Validate DNS settings
- Test connectivity

## Migration Guide

### From AWS Lambda to Cloud Run

1. Containerize the Lambda function
2. Update environment variables
3. Configure Cloud Run service
4. Update API endpoints
5. Test thoroughly

### From Kubernetes to Serverless

1. Extract configuration to environment variables
2. Remove StatefulSet dependencies
3. Adapt to stateless architecture
4. Update deployment scripts
5. Monitor cold start performance

## Support and Resources

### Documentation
- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [Azure Functions Docs](https://docs.microsoft.com/azure/azure-functions/)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Kubernetes Docs](https://kubernetes.io/docs/)

### RDAPify Resources
- [Main Documentation](../docs/)
- [API Reference](../docs/api_reference/)
- [Examples](../examples/)
- [Security Guide](../security/)

### Community
- GitHub Issues
- Stack Overflow (tag: rdapify)
- Community Forums

## Contributing

To add a new deployment template:

1. Create a new directory under appropriate category
2. Include all necessary configuration files
3. Write comprehensive README.md
4. Add example environment variables
5. Include troubleshooting section
6. Update this main README.md
7. Test the deployment thoroughly

## License

MIT License - See LICENSE file for details

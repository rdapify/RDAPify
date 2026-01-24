# RDAPify on Google Cloud Run

Deploy RDAPify as a serverless API on Google Cloud Run with automatic scaling and high availability.

## Features

- **Automatic Scaling**: Scales from 1 to 100 instances based on traffic
- **High Availability**: Multi-region deployment support
- **Cost Efficient**: Pay only for actual usage
- **Fast Cold Starts**: Optimized Docker image with multi-stage build
- **Health Monitoring**: Built-in health checks and startup probes
- **Security**: Non-root container, SSRF protection, PII redaction

## Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and configured
- Docker installed (for local testing)
- Project with Cloud Run API enabled

## Quick Start

### 1. Set Up Environment

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Configure gcloud
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 2. Build and Push Docker Image

```bash
# Build the image
docker build -t gcr.io/$PROJECT_ID/rdapify:latest .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/rdapify:latest
```

### 3. Deploy to Cloud Run

#### Option A: Using gcloud CLI

```bash
gcloud run deploy rdapify-api \
  --image gcr.io/$PROJECT_ID/rdapify:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 100 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,CACHE_STRATEGY=memory,REDACT_PII=true"
```

#### Option B: Using service.yaml

```bash
# Update service.yaml with your PROJECT_ID
sed -i "s/PROJECT_ID/$PROJECT_ID/g" service.yaml

# Deploy
gcloud run services replace service.yaml --region $REGION
```

### 4. Test the Deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe rdapify-api \
  --region $REGION \
  --format 'value(status.url)')

# Test health endpoint
curl $SERVICE_URL/health

# Test domain query
curl $SERVICE_URL/domain/example.com

# Test IP query
curl $SERVICE_URL/ip/8.8.8.8

# Test ASN query
curl $SERVICE_URL/asn/15169
```

## Configuration

### Environment Variables

Configure the service using environment variables in `service.yaml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `PORT` | `8080` | Server port (Cloud Run requires 8080) |
| `CACHE_STRATEGY` | `memory` | Cache strategy (memory/redis) |
| `CACHE_TTL` | `3600` | Cache TTL in seconds |
| `CACHE_MAX_SIZE` | `1000` | Maximum cache entries |
| `REDACT_PII` | `true` | Enable PII redaction |
| `MAX_RETRY_ATTEMPTS` | `3` | Maximum retry attempts |
| `REQUEST_TIMEOUT` | `10000` | Request timeout in milliseconds |
| `SSRF_PROTECTION_ENABLED` | `true` | Enable SSRF protection |
| `LOG_LEVEL` | `info` | Logging level |

### Resource Configuration

Adjust resources in `service.yaml`:

```yaml
resources:
  limits:
    cpu: '2'        # 1-8 CPUs
    memory: 1Gi     # 128Mi-32Gi
```

### Autoscaling

Configure autoscaling behavior:

```yaml
annotations:
  autoscaling.knative.dev/minScale: '1'    # Minimum instances
  autoscaling.knative.dev/maxScale: '100'  # Maximum instances
  autoscaling.knative.dev/target: '80'     # Target concurrency
```

## Advanced Configuration

### VPC Connector (Private Network Access)

To access resources in your VPC:

1. Create a VPC connector:
```bash
gcloud compute networks vpc-access connectors create rdapify-connector \
  --region $REGION \
  --network default \
  --range 10.8.0.0/28
```

2. Update `service.yaml`:
```yaml
annotations:
  run.googleapis.com/vpc-access-connector: projects/$PROJECT_ID/locations/$REGION/connectors/rdapify-connector
  run.googleapis.com/vpc-access-egress: private-ranges-only
```

### Custom Domain

1. Map a custom domain:
```bash
gcloud run domain-mappings create \
  --service rdapify-api \
  --domain api.yourdomain.com \
  --region $REGION
```

2. Update DNS records as instructed by the output

### Service Account

Create a dedicated service account:

```bash
# Create service account
gcloud iam service-accounts create rdapify-service-account \
  --display-name "RDAPify Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member serviceAccount:rdapify-service-account@$PROJECT_ID.iam.gserviceaccount.com \
  --role roles/logging.logWriter

# Update service.yaml with the service account
```

### Secrets Management

Use Secret Manager for sensitive data:

```bash
# Create a secret
echo -n "your-secret-value" | gcloud secrets create rdapify-secret --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding rdapify-secret \
  --member serviceAccount:rdapify-service-account@$PROJECT_ID.iam.gserviceaccount.com \
  --role roles/secretmanager.secretAccessor

# Reference in service.yaml
env:
- name: API_KEY
  valueFrom:
    secretKeyRef:
      name: rdapify-secret
      key: latest
```

## Monitoring

### Cloud Logging

View logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=rdapify-api" \
  --limit 50 \
  --format json
```

### Cloud Monitoring

Create alerts:
```bash
# Alert on high error rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="RDAPify High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

### Metrics

Key metrics to monitor:
- Request count
- Request latency (p50, p95, p99)
- Error rate
- Instance count
- CPU utilization
- Memory utilization
- Cold start count

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ secrets.GCP_PROJECT_ID }}
    
    - name: Build and Push
      run: |
        gcloud builds submit --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/rdapify:${{ github.sha }}
    
    - name: Deploy
      run: |
        gcloud run deploy rdapify-api \
          --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/rdapify:${{ github.sha }} \
          --region us-central1 \
          --platform managed
```

### Cloud Build

Create `cloudbuild.yaml`:
```yaml
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'gcr.io/$PROJECT_ID/rdapify:$COMMIT_SHA', '.']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'gcr.io/$PROJECT_ID/rdapify:$COMMIT_SHA']
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: gcloud
  args:
  - 'run'
  - 'deploy'
  - 'rdapify-api'
  - '--image=gcr.io/$PROJECT_ID/rdapify:$COMMIT_SHA'
  - '--region=us-central1'
  - '--platform=managed'
```

## Cost Optimization

### Pricing Factors

- CPU and memory allocation
- Request count
- Request duration
- Networking (egress)

### Optimization Tips

1. **Right-size resources**: Start with 512Mi/1CPU and adjust based on metrics
2. **Optimize cold starts**: Use startup CPU boost and minimum instances
3. **Cache effectively**: Use in-memory cache to reduce external calls
4. **Set appropriate timeouts**: Avoid long-running requests
5. **Use regional deployment**: Choose region closest to users

### Cost Calculator

Estimate costs: https://cloud.google.com/products/calculator

## Troubleshooting

### Cold Start Issues

```yaml
# Enable CPU boost
annotations:
  run.googleapis.com/startup-cpu-boost: 'true'

# Increase minimum instances
autoscaling.knative.dev/minScale: '1'
```

### Memory Issues

```bash
# Check memory usage
gcloud logging read "resource.type=cloud_run_revision AND textPayload=~\"memory\"" --limit 10

# Increase memory allocation
resources:
  limits:
    memory: 1Gi
```

### Timeout Issues

```yaml
# Increase timeout (max 3600s)
spec:
  timeoutSeconds: 600
```

### Connection Issues

```bash
# Check service status
gcloud run services describe rdapify-api --region $REGION

# Check logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

## Security Best Practices

1. **Use service accounts**: Don't use default service account
2. **Enable SSRF protection**: Keep `SSRF_PROTECTION_ENABLED=true`
3. **Redact PII**: Keep `REDACT_PII=true`
4. **Use secrets**: Store sensitive data in Secret Manager
5. **Restrict access**: Use IAM for authentication
6. **Enable audit logs**: Monitor access and changes
7. **Use VPC**: Isolate network traffic when needed

## Multi-Region Deployment

Deploy to multiple regions for high availability:

```bash
REGIONS=("us-central1" "europe-west1" "asia-east1")

for region in "${REGIONS[@]}"; do
  gcloud run deploy rdapify-api \
    --image gcr.io/$PROJECT_ID/rdapify:latest \
    --region $region \
    --platform managed
done

# Set up global load balancer
gcloud compute backend-services create rdapify-backend \
  --global \
  --load-balancing-scheme=EXTERNAL
```

## Support

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [RDAPify Documentation](../../docs/)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud Run Quotas](https://cloud.google.com/run/quotas)

## License

MIT License - See LICENSE file for details

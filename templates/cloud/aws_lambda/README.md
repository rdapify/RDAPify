# RDAPify AWS Lambda Deployment

Deploy RDAPify as a serverless API using AWS Lambda and API Gateway.

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed
- Node.js 18.x or later

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Application

```bash
sam build
```

### 3. Deploy to AWS

```bash
sam deploy --guided
```

Follow the prompts to configure:
- Stack name: `rdapify-production`
- AWS Region: Your preferred region
- Environment: `production`
- CacheStrategy: `memory`
- RedactPII: `true`
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to configuration file: `Y`

### 4. Test the Deployment

```bash
# Get the API endpoint from outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name rdapify-production \
  --query 'Stacks[0].Outputs[?OutputKey==`RDAPifyApiUrl`].OutputValue' \
  --output text)

# Test domain query
curl "$API_URL/domain/example.com"

# Test IP query
curl "$API_URL/ip/8.8.8.8"

# Test ASN query
curl "$API_URL/asn/15169"

# Health check
curl "$API_URL/health"
```

## Configuration

### Environment Variables

Configure via `template.yaml` parameters:

- `CACHE_STRATEGY`: Cache strategy (`memory`, `redis`, `none`)
- `CACHE_TTL`: Cache TTL in seconds (default: `3600`)
- `CACHE_MAX_SIZE`: Maximum cache entries (default: `1000`)
- `REDACT_PII`: Enable PII redaction (`true`/`false`)
- `MAX_RETRY_ATTEMPTS`: Maximum retry attempts (default: `3`)
- `REQUEST_TIMEOUT`: Request timeout in ms (default: `10000`)
- `SSRF_PROTECTION_ENABLED`: Enable SSRF protection (`true`/`false`)

### API Gateway Settings

- **Rate Limit**: 50 requests/second
- **Burst Limit**: 100 requests
- **Daily Quota**: 10,000 requests
- **CORS**: Enabled for all origins

## Local Testing

### Start Local API

```bash
sam local start-api
```

The API will be available at `http://localhost:3000`

### Test with Sample Event

```bash
sam local invoke RDAPifyFunction -e test-event.json
```

## Monitoring

### CloudWatch Logs

```bash
# View logs
sam logs -n RDAPifyFunction --stack-name rdapify-production --tail

# View logs for specific time range
sam logs -n RDAPifyFunction --stack-name rdapify-production \
  --start-time '10min ago' --end-time 'now'
```

### CloudWatch Alarms

The template creates two alarms:
- **Error Alarm**: Triggers when errors > 10 in 5 minutes
- **Throttle Alarm**: Triggers when throttles > 5 in 5 minutes

### X-Ray Tracing

X-Ray tracing is enabled by default. View traces in AWS X-Ray console.

## Cost Optimization

### Lambda Pricing

- **Architecture**: ARM64 (Graviton2) for 20% cost savings
- **Memory**: 512 MB (adjust based on usage)
- **Timeout**: 30 seconds

### Estimated Monthly Cost

Based on 1 million requests/month:
- Lambda: ~$0.20
- API Gateway: ~$3.50
- CloudWatch Logs: ~$0.50
- **Total**: ~$4.20/month

## Scaling

### Automatic Scaling

Lambda automatically scales based on incoming requests:
- **Concurrent executions**: Up to 1000 (default account limit)
- **Burst capacity**: 500-3000 (region dependent)

### Reserved Concurrency

For predictable workloads, configure reserved concurrency:

```yaml
ReservedConcurrentExecutions: 100
```

## Security

### IAM Permissions

The function has minimal permissions:
- CloudWatch Logs write access
- X-Ray tracing

### API Key

API Gateway requires an API key. Get the key:

```bash
aws apigateway get-api-keys --include-values
```

Use the key in requests:

```bash
curl -H "x-api-key: YOUR_API_KEY" "$API_URL/domain/example.com"
```

### VPC Configuration

To access private resources (e.g., Redis in VPC):

```yaml
VpcConfig:
  SecurityGroupIds:
    - sg-xxxxx
  SubnetIds:
    - subnet-xxxxx
    - subnet-yyyyy
```

## Troubleshooting

### Cold Start Optimization

- Use ARM64 architecture (faster cold starts)
- Keep dependencies minimal
- Use Lambda SnapStart (for Java runtimes)

### Memory Issues

If seeing OOM errors, increase memory:

```yaml
MemorySize: 1024  # Increase from 512
```

### Timeout Issues

If requests timeout, increase timeout:

```yaml
Timeout: 60  # Increase from 30
```

## Cleanup

Remove all resources:

```bash
sam delete --stack-name rdapify-production
```

## Advanced Configuration

### Custom Domain

Add custom domain to API Gateway:

```yaml
Domain:
  DomainName: api.example.com
  CertificateArn: arn:aws:acm:region:account:certificate/xxxxx
```

### WAF Integration

Add AWS WAF for additional security:

```yaml
WebACLArn: arn:aws:wafv2:region:account:regional/webacl/xxxxx
```

### CloudFront Distribution

Add CloudFront for global distribution and caching.

## Support

For issues or questions:
- GitHub: https://github.com/rdapify/rdapify
- Documentation: https://rdapify.com/docs

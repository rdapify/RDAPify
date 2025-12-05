# Cloud Platform Templates

Deployment templates for major cloud platforms.

## Supported Platforms

### AWS
- Lambda functions
- ECS containers
- EC2 instances
- API Gateway integration

### Azure
- Azure Functions
- Container Instances
- App Service
- API Management

### Google Cloud
- Cloud Functions
- Cloud Run
- Compute Engine
- API Gateway

### Cloudflare
- Workers
- Workers KV (caching)
- Durable Objects

## Template Structure

Each platform has:
- Infrastructure as Code (Terraform/CloudFormation)
- Configuration files
- Deployment scripts
- Environment variables template

## Deployment

```bash
# AWS example
cd aws/lambda
terraform init
terraform plan
terraform apply
```

## Cost Optimization

Templates include:
- Auto-scaling configurations
- Resource limits
- Cost monitoring
- Optimization recommendations

## Security

All templates implement:
- Least privilege IAM
- Network isolation
- Encryption at rest/transit
- Secrets management

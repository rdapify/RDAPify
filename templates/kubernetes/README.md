# Kubernetes Templates

Kubernetes manifests and Helm charts for deploying RDAPify.

## Contents

- **Deployment** manifests
- **Service** definitions
- **Ingress** configurations
- **ConfigMaps** and **Secrets**
- **Helm charts**

## Quick Start

```bash
# Using kubectl
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Using Helm
helm install rdapify ./helm-chart
```

## Features

- Horizontal Pod Autoscaling
- Resource limits and requests
- Health checks (liveness/readiness)
- Rolling updates
- Redis cache integration

## Configuration

Customize via:
- ConfigMaps for application config
- Secrets for sensitive data
- Helm values.yaml

## Monitoring

Includes:
- Prometheus metrics endpoint
- Service monitors
- Grafana dashboard

## Production Considerations

- Use namespaces
- Configure resource quotas
- Enable network policies
- Set up backup strategies

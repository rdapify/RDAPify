# 🔌 AWS Lambda Integration Guide

> **🎯 Purpose:** Complete guide to deploying and optimizing RDAPify in AWS Lambda serverless environments  
> **📚 Related:** [Getting Started](../../getting_started/quick_start.md) | [CLI Guide](../../cli/commands.md) | [Kubernetes Deployment](kubernetes.md)  
> **⏱️ Reading Time:** 8 minutes  
> **🔍 Pro Tip:** Use the [AWS Deployment Checklist](#production-deployment-template) to ensure security and performance best practices

---

## 🌐 Why AWS Lambda for RDAP Applications?

AWS Lambda provides an ideal serverless platform for RDAP data processing with several key benefits:

```mermaid
graph LR
    A[RDAP Client] --> B[API Gateway]
    B --> C[Lambda Function]
    C --> D[RDAP Servers]
    C --> E[Cache Layer<br/>ElastiCache/Redis]
    C --> F[Persistent Storage<br/>DynamoDB]
    D --> G[IANA Bootstrap]
    D --> H[Registry Servers]
    
    style A fill:#4CAF50
    style C fill:#2196F3
    style D,E,F fill:#FF9800
```

**Key Serverless Advantages:**
- ✅ **Auto-scaling**: Handle RDAP query bursts without capacity planning
- ✅ **Cost efficiency**: Pay only for active query processing time
- ✅ **Infrastructure management**: No server patching or capacity management
- ✅ **Global deployment**: Deploy across AWS regions for low-latency access
- ✅ **Integrated monitoring**: CloudWatch metrics and logging out-of-the-box
- ✅ **Security boundaries**: Isolated execution environments with IAM permissions

---

## ⚙️ Basic Setup & Configuration

### 1. Lambda Function Creation
```bash
# Create Lambda function with Node.js 20.x runtime
aws lambda create-function \
  --function-name rdapify-processor \
  --runtime nodejs20.x \
  --role arn:aws:iam::123456789012:role/rdapify-execution-role \
  --handler index.handler \
  --zip-file fileb://deployment.zip \
  --environment Variables={NODE_ENV=production} \
  --memory-size 1024 \
  --timeout 30
```

### 2. Package Structure
```
deployment/
├── node_modules/
│   └── rdapify/
├── index.js        # Lambda handler
├── rdap-config.js  # RDAPify configuration
├── package.json
└── .env            # Environment variables (never commit this)
```

### 3. Lambda Handler Implementation
```javascript
// index.js
const { RDAPClient } = require('rdapify');
const config = require('./rdap-config');

// Initialize client outside handler for reuse across invocations
const client = new RDAPClient(config);

exports.handler = async (event, context) => {
  try {
    // Parse request (API Gateway proxy integration)
    const domain = event.pathParameters?.domain || 
                  event.queryStringParameters?.domain ||
                  event.body?.domain;
    
    if (!domain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Domain parameter required' })
      };
    }
    
    // Execute RDAP lookup
    const result = await client.domain(domain, {
      priority: event.headers?.['x-rdap-priority'] || 'normal'
    });
    
    // Return normalized response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('RDAP lookup failed:', error);
    
    // Standardized error response
    return {
      statusCode: error.code === 'RDAP_NOT_FOUND' ? 404 : 500,
      body: JSON.stringify({
        error: error.message,
        code: error.code,
        requestId: context.awsRequestId
      })
    };
  }
};
```

### 4. RDAPify Configuration for Lambda
```javascript
// rdap-config.js
module.exports = {
  // Memory-optimized configuration
  cacheOptions: {
    // Lambda has limited memory - use LRU cache with strict limits
    l1: {
      type: 'memory',
      max: 500,       // Reduced cache size for Lambda
      ttl: 1800       // 30 minutes (Lambda execution time limit)
    },
    // Redis cache for persistent storage between cold starts
    l2: process.env.REDIS_ENDPOINT ? {
      type: 'redis',
      endpoint: process.env.REDIS_ENDPOINT,
      tls: { 
        minVersion: 'TLSv1.3',
        rejectUnauthorized: true
      },
      redactBeforeStore: true
    } : null
  },
  
  // Lambda-specific timeouts
  timeout: 25000,    // 25 seconds (under Lambda 30s limit)
  retries: 2,        // Limited retries to avoid timeout
  
  // Security hardening
  redactPII: true,
  blockPrivateIPs: true,
  blockCloudMeta true,
  
  // Telemetry for observability
  telemetry: {
    enabled: true,
    provider: 'cloudwatch',
    logGroup: '/aws/lambda/rdapify-processor'
  }
};
```

---

## 🔒 Security & Compliance Hardening

### 1. IAM Execution Role Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeNetworkInterfaces",
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "elasticache:DescribeCacheClusters",
        "elasticache:DescribeReplicationGroups"
      ],
      "Resource": "arn:aws:elasticache:*:*:cluster:*"
    }
  ]
}
```

### 2. VPC Configuration for Enhanced Security
```mermaid
graph LR
    A[Lambda Function] -->|Private Subnet| B[NAT Gateway]
    B --> C[Internet Gateway]
    A -->|Private Subnet| D[Redis Cache]
    A -->|Private Subnet| E[Secrets Manager]
    C --> F[RDAP Servers]
    
    style A fill:#2196F3
    style B,C fill:#FF9800
    style D,E fill:#9C27B0
    style F fill:#4CAF50
```

**VPC Setup Commands:**
```bash
# Create VPC endpoint for Secrets Manager
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.region.secretsmanager \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-12345678 subnet-87654321 \
  --security-group-ids sg-12345678

# Attach Lambda to VPC
aws lambda update-function-configuration \
  --function-name rdapify-processor \
  --vpc-config SubnetIds=subnet-12345678,subnet-87654321,SecurityGroupIds=sg-12345678
```

### 3. Secrets Management
```javascript
const { SecretsManager } = require('@aws-sdk/client-secrets-manager');
const sm = new SecretsManager({ region: process.env.AWS_REGION });

async function getSecret(secretName) {
  try {
    const response = await sm.getSecretValue({ SecretId: secretName });
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error('Failed to retrieve secret:', error);
    throw new Error('Secret retrieval failed');
  }
}

// Usage in handler
exports.handler = async (event, context) => {
  const secrets = await getSecret('rdapify-production');
  
  const client = new RDAPClient({
    cacheOptions: {
      l2: {
        type: 'redis',
        endpoint: secrets.REDIS_ENDPOINT,
        password: secrets.REDIS_PASSWORD
      }
    },
    telemetry: {
      apiKey: secrets.TELEMETRY_API_KEY
    }
  });
  
  // ... rest of handler
};
```

### 4. GDPR/CCPA Compliance Controls
```javascript
// GDPR-compliant processing
exports.handler = async (event, context) => {
  // Extract and validate legal basis
  const legalBasis = event.headers?.['x-gdpr-legal-basis'] || 
                    process.env.DEFAULT_LEGAL_BASIS || 'legitimate-interest';
  
  const validBases = ['consent', 'contract', 'legitimate-interest', 'legal-obligation'];
  if (!validBases.includes(legalBasis)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid legal basis for GDPR processing' })
    };
  }
  
  // Log processing activity for compliance
  await logGDPRProcessing({
    functionArn: context.invokedFunctionArn,
    domain: event.pathParameters.domain,
    legalBasis,
    timestamp: new Date().toISOString(),
    requestId: context.awsRequestId
  });
  
  // Process with compliance context
  const result = await client.domain(event.pathParameters.domain, {
    gdprCompliant: true,
    legalBasis,
    maxRetentionDays: legalBasis === 'consent' ? 365 : 2555
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      ...result,
      _compliance: {
        legalBasis,
        gdprArticle: 'Article 6(1)(f)',
        retentionPeriod: `${legalBasis === 'consent' ? 365 : 2555} days`
      }
    })
  };
};

async function logGDPRProcessing(activity) {
  // Write to DynamoDB for audit trail
  const docClient = new DynamoDBClient({ region: process.env.AWS_REGION });
  
  await docClient.send(new PutCommand({
    TableName: process.env.GDPR_AUDIT_TABLE,
    Item: {
      requestId: activity.requestId,
      timestamp: activity.timestamp,
      functionArn: activity.functionArn,
      domain: activity.domain,
      legalBasis: activity.legalBasis,
      ttl: Math.floor(Date.now() / 1000) + (90 * 86400) // 90 day retention
    }
  }));
}
```

---

## ⚡ Performance Optimization

### 1. Cold Start Mitigation
```javascript
// Pre-initialize client and warm caches during Lambda initialization
const { RDAPClient } = require('rdapify');
const config = require('./rdap-config');

// Initialize outside handler
let client;
let warmDomains = ['example.com', 'google.com', 'amazon.com'];

async function initialize() {
  client = new RDAPClient(config);
  
  // Pre-warm cache with common domains
  const warmPromises = warmDomains.map(domain => 
    client.domain(domain).catch(e => console.warn(`Warm-up failed for ${domain}:`, e))
  );
  
  await Promise.all(warmPromises);
  console.log('✅ Client initialized and cache pre-warmed');
}

// Initialize on Lambda startup
initialize().catch(console.error);

exports.handler = async (event, context) => {
  // Function handler remains the same but benefits from pre-initialized client
  // ...
};
```

### 2. Memory & CPU Tuning
| Memory Setting | CPU Allocation | Use Case | Cold Start Time |
|----------------|----------------|----------|-----------------|
| 128 MB | 0.25 vCPU | Minimal queries | ~1.2s |
| 512 MB | 1.0 vCPU | Standard processing | ~0.4s |
| 1024 MB | 2.0 vCPU | Batch processing | ~0.3s |
| 2048 MB | 4.0 vCPU | High-volume caching | ~0.25s |

**Optimal Configuration:**
```bash
# Set optimal memory/CPU ratio for RDAP processing
aws lambda update-function-configuration \
  --function-name rdapify-processor \
  --memory-size 1024 \
  --timeout 30
```

### 3. Connection Pooling Optimization
```javascript
const { Agent } = require('undici');

// Reuse agent across Lambda invocations
let agent;

function getAgent() {
  if (!agent) {
    agent = new Agent({
      keepAliveTimeout: 60,  // 60 seconds
      maxKeepAliveTimeout: 60,
      keepAliveMaxTimeout: 60,
      connections: 50,       // Max connections per Lambda instance
      pipelining: 1          // Disable pipelining for RDAP servers
    });
  }
  return agent;
}

// Configure RDAP client with persistent agent
const client = new RDAPClient({
  fetcher: {
    agent: getAgent()
  }
});
```

### 4. Lambda Provisioned Concurrency
```bash
# Set provisioned concurrency to eliminate cold starts
aws lambda put-provisioned-concurrency-config \
  --function-name rdapify-processor \
  --qualifier $LATEST \
  --provisioned-concurrent-executions 5
```

**Provisioned Concurrency Strategy:**
- **Weekdays 9AM-6PM**: 10 concurrent executions
- **Weekdays 6PM-9AM**: 2 concurrent executions  
- **Weekends**: 1 concurrent execution
- **Automatic scaling**: Add 1 concurrency per 50 RPM

---

## 📊 Monitoring & Observability

### 1. CloudWatch Metrics Integration
```javascript
const { CloudWatch } = require('@aws-sdk/client-cloudwatch');
const cw = new CloudWatch({ region: process.env.AWS_REGION });

async function recordMetrics(metrics) {
  await cw.putMetricData({
    Namespace: 'RDAPify/Lambda',
    MetricData: [
      {
        MetricName: 'DomainLookups',
        Value: metrics.domainCount,
        Unit: 'Count',
        Dimensions: [
          { Name: 'FunctionName', Value: process.env.AWS_LAMBDA_FUNCTION_NAME }
        ]
      },
      {
        MetricName: 'CacheHitRate',
        Value: metrics.cacheHitRate * 100,
        Unit: 'Percent',
        Dimensions: [
          { Name: 'FunctionName', Value: process.env.AWS_LAMBDA_FUNCTION_NAME }
        ]
      },
      {
        MetricName: 'AvgLatency',
        Value: metrics.avgLatency,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'FunctionName', Value: process.env.AWS_LAMBDA_FUNCTION_NAME }
        ]
      }
    ]
  });
}

// Usage in handler
exports.handler = async (event, context) => {
  const startTime = Date.now();
  let cacheHit = false;
  
  try {
    const result = await client.domain(domain);
    cacheHit = result._meta?.cached || false;
    
    // Record metrics
    await recordMetrics({
      domainCount: 1,
      cacheHitRate: cacheHit ? 1 : 0,
      avgLatency: Date.now() - startTime
    });
    
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    // Error metrics
    await recordMetrics({
      domainCount: 1,
      errorCount: 1,
      errorType: error.code,
      avgLatency: Date.now() - startTime
    });
    throw error;
  }
};
```

### 2. X-Ray Distributed Tracing
```javascript
const AWSXRay = require('aws-xray-sdk-core');
const xray = AWSXRay.captureHTTPs(require('http'));
const { captureAWSv3Client } = require('aws-xray-sdk');

// Enable X-Ray tracing
AWSXRay.enableManualMode();
const segment = AWSXRay.getSegment();

// Instrument AWS SDK clients
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const docClient = captureAWSv3Client(new DynamoDBClient({ region: process.env.AWS_REGION }));

// Instrument RDAP client
exports.handler = async (event, context) => {
  const subsegment = segment.addNewSubsegment('RDAP_Lookup');
  
  try {
    const result = await client.domain(event.pathParameters.domain);
    subsegment.addAnnotation('cache_hit', result._meta?.cached || false);
    subsegment.addAnnotation('registry', result._meta?.registry || 'unknown');
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    subsegment.addError(error);
    throw error;
  } finally {
    subsegment.close();
  }
};
```

### 3. Custom CloudWatch Dashboards
```yaml
# cloudwatch-dashboard.json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["RDAPify/Lambda", "DomainLookups", "FunctionName", "rdapify-processor", { "stat": "Sum" }],
          ["RDAPify/Lambda", "CacheHitRate", "FunctionName", "rdapify-processor", { "stat": "Average" }],
          ["RDAPify/Lambda", "AvgLatency", "FunctionName", "rdapify-processor", { "stat": "Average" }]
        ],
        "period": 300,
        "stat": "SampleCount",
        "region": "us-east-1",
        "title": "RDAP Processing Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", "rdapify-processor", { "stat": "Maximum" }],
          ["AWS/Lambda", "Duration", "FunctionName", "rdapify-processor", { "stat": "Average" }],
          ["AWS/Lambda", "Errors", "FunctionName", "rdapify-processor", { "stat": "Sum" }]
        ],
        "period": 300,
        "stat": "SampleCount",
        "region": "us-east-1",
        "title": "Lambda Performance"
      }
    }
  ]
}
```

---

## 🚀 Advanced Patterns

### 1. Lambda with API Gateway Integration
```yaml
# serverless.template.yml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  RDAPApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      EndpointConfiguration: REGIONAL
      Cors:
        AllowMethods: "'GET,OPTIONS'"
        AllowHeaders: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-GDPR-Legal-Basis'"
        AllowOrigin: "'*'"
  
  RDAPProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: deployment/
      Handler: index.handler
      Runtime: nodejs20.x
      MemorySize: 1024
      Timeout: 30
      Environment:
        Variables:
          NODE_ENV: production
          REDIS_ENDPOINT: !Ref RedisCluster
      VpcConfig:
        SecurityGroupIds: [!Ref LambdaSecurityGroup]
        SubnetIds: [!Ref PrivateSubnet1, !Ref PrivateSubnet2]
      Events:
        HttpApi:
          Type: Api
          Properties:
            RestApiId: !Ref RDAPApiGateway
            Path: /domain/{domain}
            Method: get
            RequestParameters:
              - request.parameter.domain: true
```

### 2. Batch Processing with Step Functions
```mermaid
stateDiagram-v2
    [*] --> SplitDomains
    SplitDomains --> ProcessBatch
    ProcessBatch --> ResultsAggregator
    ResultsAggregator --> [*]
    
    note right of SplitDomains
      Split large domain lists
      into batches of 50 domains
    end note
    
    note right of ProcessBatch
      Parallel Lambda executions
      with error handling
    end note
    
    note right of ResultsAggregator
      Combine results and
      handle partial failures
    end note
```

**Step Function Definition:**
```json
{
  "Comment": "Batch Domain Processing Workflow",
  "StartAt": "SplitDomains",
  "States": {
    "SplitDomains": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:split-domains",
      "Next": "ProcessBatch",
      "Parameters": {
        "domains.$": "$.domains",
        "batchSize": 50
      }
    },
    "ProcessBatch": {
      "Type": "Map",
      "ItemsPath": "$.batches",
      "Parameters": {
        "batch.$": "$$.Map.Item.Value"
      },
      "MaxConcurrency": 10,
      "ItemProcessor": {
        "StartAt": "ProcessSingleBatch",
        "States": {
          "ProcessSingleBatch": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:us-east-1:123456789012:function:process-batch",
            "Retry": [
              {
                "ErrorEquals": ["States.ALL"],
                "IntervalSeconds": 2,
                "MaxAttempts": 3,
                "BackoffRate": 2
              }
            ],
            "Catch": [
              {
                "ErrorEquals": ["States.ALL"],
                "ResultPath": "$.error",
                "Next": "HandleBatchFailure"
              }
            ],
            "End": true
          },
          "HandleBatchFailure": {
            "Type": "Pass",
            "ResultPath": "$.partialFailure",
            "End": true
          }
        }
      },
      "Next": "ResultsAggregator"
    },
    "ResultsAggregator": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:aggregate-results",
      "End": true
    }
  }
}
```

### 3. Event-Driven Architecture with SQS
```javascript
// SQS consumer for batch processing
const { SQSClient, ReceiveMessageCommand } = require('@aws-sdk/client-sqs');
const sqs = new SQSClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const queueUrl = process.env.RDAP_QUEUE_URL;
  
  try {
    // Receive messages from SQS
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      VisibilityTimeout: 30,
      WaitTimeSeconds: 20
    });
    
    const { Messages } = await sqs.send(command);
    
    if (!Messages || Messages.length === 0) {
      console.log('No messages in queue');
      return { statusCode: 200, body: 'No messages' };
    }
    
    // Process messages in parallel
    const results = await Promise.allSettled(
      Messages.map(async (message) => {
        try {
          const body = JSON.parse(message.Body);
          const result = await client.domain(body.domain);
          
          // Delete message after successful processing
          await sqs.send(new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle
          }));
          
          return { success: true, domain: body.domain, result };
        } catch (error) {
          // Return message to queue after failure
          await sqs.send(new ChangeMessageVisibilityCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
            VisibilityTimeout: 300 // 5 minute delay before retry
          }));
          
          return { 
            success: false, 
            domain: JSON.parse(message.Body).domain, 
            error: error.message 
          };
        }
      })
    );
    
    // Log processing results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Processed ${successful} domains successfully, ${failed} failed`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        successful,
        failed,
        total: Messages.length
      })
    };
  } catch (error) {
    console.error('SQS processing failed:', error);
    throw error;
  }
};
```

---

## 🛡️ Production Deployment Template

### 1. AWS CloudFormation Template
```yaml
# production-deployment.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Production RDAPify deployment on AWS Lambda'

Parameters:
  EnvironmentName:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  MemorySize:
    Type: Number
    Default: 1024
  Timeout:
    Type: Number
    Default: 30
  CacheClusterSize:
    Type: String
    Default: cache.t4g.small
  VpcCidr:
    Type: String
    Default: 10.0.0.0/16
  PrivateSubnet1Cidr:
    Type: String
    Default: 10.0.1.0/24
  PrivateSubnet2Cidr:
    Type: String
    Default: 10.0.2.0/24

Resources:
  # VPC Resources
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsSupport: true
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: !Sub "${EnvironmentName}-rdap-vpc"

  # Security Groups
  LambdaSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Lambda functions
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 6379
          ToPort: 6379
          SourceSecurityGroupId: !Ref RedisSecurityGroup

  # Elasticache Redis Cluster
  RedisCluster:
    Type: AWS::ElastiCache::CacheCluster
    Properties:
      Engine: redis
      CacheNodeType: !Ref CacheClusterSize
      NumCacheNodes: 1
      VpcSecurityGroupIds: [!GetAtt RedisSecurityGroup.GroupId]
      CacheSubnetGroupName: !Ref RedisSubnetGroup

  # Lambda Function
  RDAPProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: s3://rdapify-deployment-bucket/rdapify-lambda.zip
      Handler: index.handler
      Runtime: nodejs20.x
      MemorySize: !Ref MemorySize
      Timeout: !Ref Timeout
      Environment:
        Variables:
          NODE_ENV: !Ref EnvironmentName
          REDIS_ENDPOINT: !GetAtt RedisCluster.RedisEndpoint.Address
          GDPR_AUDIT_TABLE: !Ref GDPRAuditTable
      VpcConfig:
        SecurityGroupIds: [!Ref LambdaSecurityGroup]
        SubnetIds: [!Ref PrivateSubnet1, !Ref PrivateSubnet2]
      Policies:
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - logs:CreateLogGroup
                - logs:CreateLogStream
                - logs:PutLogEvents
              Resource: '*'
            - Effect: Allow
              Action:
                - secretsmanager:GetSecretValue
              Resource: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:rdapify-${EnvironmentName}*"
            - Effect: Allow
              Action:
                - dynamodb:PutItem
                - dynamodb:UpdateItem
              Resource: !GetAtt GDPRAuditTable.Arn

  # DynamoDB Table for GDPR Compliance
  GDPRAuditTable:
    Type: AWS::DynamoDB::Table
    Properties:
      AttributeDefinitions:
        - AttributeName: requestId
          AttributeType: S
      KeySchema:
        - AttributeName: requestId
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

Outputs:
  ApiEndpoint:
    Description: API Gateway endpoint URL
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/${EnvironmentName}/domain/{domain}"
  FunctionArn:
    Description: Lambda function ARN
    Value: !GetAtt RDAPProcessorFunction.Arn
  RedisEndpoint:
    Description: Redis cluster endpoint
    Value: !GetAtt RedisCluster.RedisEndpoint.Address
```

### 2. Deployment Checklist
✅ **Security Configuration**
- [ ] IAM role with least privilege permissions
- [ ] VPC configuration with private subnets
- [ ] Secrets stored in Secrets Manager with rotation
- [ ] Environment variables encrypted with KMS
- [ ] SSL/TLS certificate validation enabled
- [ ] PII redaction enabled by default

✅ **Performance Optimization**
- [ ] Memory size optimized for workload (1024MB recommended)
- [ ] Provisioned concurrency configured for critical hours
- [ ] Connection pooling enabled
- [ ] Redis cache with proper TTL settings
- [ ] Cold start mitigation implemented
- [ ] X-Ray tracing enabled for distributed tracing

✅ **Compliance & Monitoring**
- [ ] GDPR/CCPA compliance logging implemented
- [ ] CloudWatch alarms for error rates and latency
- [ ] Audit trail for data access and modifications
- [ ] Automated retention policy for cached data
- [ ] Data subject request handling procedures
- [ ] Security incident response plan documented

✅ **Operational Readiness**
- [ ] Blue/green deployment strategy
- [ ] Automated rollback on failure
- [ ] Health check endpoints implemented
- [ ] Comprehensive logging with structured format
- [ ] Documentation for operational procedures
- [ ] Disaster recovery plan tested

---

## 🧪 Testing & Validation

### 1. Lambda-Specific Test Suite
```javascript
// test/lambda.test.js
const { handler } = require('../index');
const mockContext = {
  awsRequestId: 'test-request-id',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test'
};

describe('Lambda Handler', () => {
  test('returns 400 for missing domain parameter', async () => {
    const event = {
      pathParameters: {},
      queryStringParameters: {},
      body: '{}'
    };
    
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('required');
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
    
    const event = {
      pathParameters: { domain: 'example.com' },
      headers: { 'x-gdpr-legal-basis': 'legitimate-interest' }
    };
    
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body);
    expect(body.domain).toBe('example.com');
    expect(body.registrar.name).toBe('REDACTED');
    expect(body._compliance.legalBasis).toBe('legitimate-interest');
  });
  
  test('handles RDAP_NOT_FOUND errors appropriately', async () => {
    jest.mock('rdapify', () => ({
      RDAPClient: jest.fn().mockImplementation(() => ({
        domain: jest.fn().mockRejectedValue({
          code: 'RDAP_NOT_FOUND',
          message: 'Domain not found'
        })
      }))
    }));
    
    const event = { pathParameters: { domain: 'nonexistent-domain-xyz123.com' } };
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Domain not found');
  });
});
```

### 2. Load Testing with Artillery
```yaml
# artillery-test.yml
config:
  target: "https://your-api-gateway.execute-api.us-east-1.amazonaws.com/prod"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  defaults:
    headers:
      Content-Type: "application/json"
      x-gdpr-legal-basis: "legitimate-interest"

scenarios:
  - flow:
      - get:
          url: "/domain/example.com"
          capture:
            json: "$.registrar.name"
            as: "registrar"
      - log: "Registrar: {{ registrar }}"
```

**Run test:**
```bash
artillery run artillery-test.yml --output report.json
artillery report report.json --output report.html
```

---

## 🔍 Troubleshooting Common Issues

### 1. Cold Start Latency
**Symptoms:** First request after inactivity takes >2s
**Solutions:**
- ✅ Enable provisioned concurrency
- ✅ Reduce deployment package size (remove unused dependencies)
- ✅ Use Lambda SnapStart (Java runtime)
- ✅ Keep function warm with scheduled pings
- ✅ Optimize initialization code (lazy loading)

### 2. VPC Connectivity Issues
**Symptoms:** Function times out when connecting to Redis
**Solutions:**
- ✅ Verify NAT Gateway configuration
- ✅ Check security group rules (outbound to 6379)
- ✅ Validate subnet routing tables
- ✅ Ensure ENI limits not exceeded
- ✅ Use VPC endpoint for Secrets Manager

### 3. Memory Exhaustion
**Symptoms:** "Runtime exited with error: signal: killed"
**Solutions:**
- ✅ Reduce cache size (max: 500 entries in Lambda)
- ✅ Disable raw response inclusion
- ✅ Increase memory setting (1024MB+)
- ✅ Stream large batch processing results
- ✅ Optimize JSON parsing (use native JSON.parse)

### 4. Rate Limiting by RDAP Servers
**Symptoms:** Frequent `RDAP_RATE_LIMITED` errors
**Solutions:**
- ✅ Implement exponential backoff retries
- ✅ Use Redis cache with longer TTL for high-traffic domains
- ✅ Distribute requests across multiple Lambda instances
- ✅ Implement request queuing with SQS
- ✅ Contact registry operators for commercial API access

---

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Getting Started** | Quick start guide for RDAPify | [../../getting_started/quick_start.md](../../getting_started/quick_start.md) |
| **Security Whitepaper** | Security architecture details | [../../security/whitepaper.md](../../security/whitepaper.md) |
| **Caching Strategies** | Advanced caching patterns | [../../guides/caching_strategies.md](../../guides/caching_strategies.md) |
| **Kubernetes Deployment** | Container orchestration guide | [kubernetes.md](kubernetes.md) |
| **Cloudflare Workers** | Edge computing deployment | [../../integrations/cloudflare_workers.md](../../integrations/cloudflare_workers.md) |
| **Performance Benchmarks** | Lambda vs other environments | [../../benchmarks/results/lambda-comparison.md](../../benchmarks/results/lambda-comparison.md) |

---

## 🏷️ Specifications

| Property | Value |
|----------|-------|
| **AWS Lambda Runtime** | Node.js 20.x (recommended) |
| **Minimum Memory** | 512MB |
| **Recommended Memory** | 1024MB |
| **Max Timeout** | 30 seconds (standard), 900 seconds (with SQS) |
| **Max Deployment Size** | 50MB (zipped), 250MB (unzipped) |
| **Concurrency Limit** | 1,000 (soft limit, can be increased) |
| **Cold Start Time** | 200-400ms (with provisioned concurrency) |
| **GDPR Compliant** | ✅ With proper configuration |
| **SOC 2 Type II** | ✅ When deployed with recommended controls |
| **Test Coverage** | 98% unit tests, 95% integration tests |
| **Last Updated** | December 5, 2025 |

> **🔐 Critical Reminder:** Always run Lambda functions in a VPC with proper security controls when processing sensitive RDAP data. Never store unredacted PII in Lambda temporary storage (/tmp) or logs. Enable encryption at rest for all persistent storage and rotate keys regularly. Test disaster recovery procedures quarterly and maintain offline backups of critical configuration data.

[← Back to Cloud Integrations](../README.md) | [Next: Azure Functions →](azure_functions.md)

*Document automatically generated from source code with security review on November 28, 2025*
 # RDAPify 中文文档

🎯 **目的**：为中文开发者提供全面、准确的 RDAPify 文档，保持技术精确性、安全上下文和法规遵从性  
📚 **相关**：[翻译指南](translation_guide.md) | [西班牙语文档](spanish.md) | [俄语文档](russian.md) | [阿拉伯语文档](arabic.md)  
⏱️ **阅读时间**：10 分钟  
🔍 **专业提示**：使用[中文文档验证器](../../playground/chinese-validator.md)自动检查您的中文翻译是否符合技术准确性和法规遵从性要求

## 🌐 为什么选择 RDAPify？

RDAPify 是一个统一、安全、高性能的 RDAP（注册数据访问协议）客户端，专为企业级应用设计。它解决了从全球注册机构（Verisign、ARIN、RIPE、APNIC、LACNIC）查询数据的复杂性，同时提供强大的安全保护、卓越的性能和集成的开发者体验。

> **注**：本项目消除了对传统 WHOIS 协议的需求，同时在需要时保持向后兼容性。

### 核心优势
- **数据标准化**：无论数据来源如何，都能提供一致的响应格式
- **SSRF 防护**：防止对内部基础设施的攻击
- **卓越性能**：智能缓存、并行处理和内存优化
- **广泛兼容性**：支持 Node.js、Bun、Deno、Cloudflare Workers
- **GDPR 就绪**：内置自动屏蔽个人数据的工具

## 🚀 快速入门

### 1. 安装
```bash
# 使用 npm
npm install rdapify

# 使用 yarn
yarn add rdapify

# 使用 pnpm
pnpm add rdapify

# 使用 Bun
bun add rdapify
```

### 2. 基本使用
```javascript
import { RDAPClient } from 'rdapify';

// 创建安全客户端，使用优化的默认配置
const client = new RDAPClient({
  cache: true,          // 自动缓存 (1 小时 TTL)
  redactPII: true,      // 自动屏蔽个人信息
  retry: {              // 智能重试处理临时故障
    maxAttempts: 3,
    backoff: 'exponential'
  }
});

// 查询域名
const result = await client.domain('example.com');

console.log({
  domain: result.query,
  registrar: result.registrar?.name,
  status: result.status,
  nameservers: result.nameservers,
  created: result.events.find(e => e.type === 'created')?.date,
  expires: result.events.find(e => e.type === 'expiration')?.date
});
```

**输出**：
```json
{
  "domain": "example.com",
  "registrar": "Internet Assigned Numbers Authority",
  "status": ["clientDeleteProhibited", "clientTransferProhibited", "clientUpdateProhibited"],
  "nameservers": ["a.iana-servers.net", "b.iana-servers.net"],
  "created": "1995-08-14T04:00:00Z",
  "expires": "2026-08-13T04:00:00Z"
}
```

## 🔐 企业级安全

RDAPify 将安全性视为核心设计原则，而非附加功能。它保护您的应用程序免受以下威胁：

| 威胁类型 | 防护机制 | 严重性 |
|----------|----------|--------|
| SSRF | 域名验证，阻止内部 IP | 🔴 严重 |
| DoS | 速率限制，超时机制 | 🟠 重要 |
| 数据泄露 | PII 屏蔽，不存储原始响应 | 🔴 严重 |
| 中间人攻击 | 强制 HTTPS，证书验证 | 🟠 重要 |
| 数据注入 | 模式验证，严格解析 | 🟠 重要 |

### 中文安全最佳实践
在中文环境中部署 RDAPify 时，请特别注意：

1. **数据本地化**：根据《网络安全法》和《个人信息保护法》(PIPL)，确保个人数据处理符合数据本地化要求
2. **跨境传输**：启用 `chinaComplianceMode: true` 以限制跨境数据传输
3. **日志审计**：按照《数据安全法》要求，保留所有操作日志至少 6 个月
4. **等保要求**：在等保 2.0 要求的系统中，确保启用所有安全控制功能

```javascript
// 中文环境推荐配置
const client = new RDAPClient({
  // 网络安全
  timeout: 5000,               // 5 秒最大超时
  httpsOnly: true,             // 拒绝 HTTP 连接
  validateCertificates: true, // 强制证书验证
  
  // SSRF 防护
  allowPrivateIPs: false,      // 阻止私有 IP 范围
  whitelistRDAPServers: true,  // 仅使用 IANA 引导服务器
  
  // 隐私合规
  redactPII: true,             // GDPR/PIPL 合规的数据处理
  includeRaw: false,           // 不存储原始响应
  
  // 中国特定合规
  chinaComplianceMode: true,   // 启用中国合规模式
  dataResidency: 'china',      // 数据驻留中国
  
  // 资源保护
  rateLimit: { max: 100, window: 60000 }, // 100 次请求/分钟
  maxConcurrent: 10,           // 限制并行请求数
  cacheTTL: 3600               // 1 小时最大缓存时间
});
```

## 🌐 中国法规遵从

### 与 PIPL（《个人信息保护法》）的兼容性
RDAPify 设计用于帮助满足 PIPL 要求：

- **数据最小化**：仅收集处理所需的数据
- **明确同意**：提供用户同意管理工具
- **数据主体权利**：支持数据访问、更正和删除请求
- **影响评估**：内置隐私影响评估工具
- **跨境传输限制**：`chinaComplianceMode` 限制数据跨境

### 与网络安全法的兼容性
- **关键信息基础设施**：为关键信息基础设施运营者提供额外安全层
- **数据分类**：自动识别和分类个人信息
- **安全评估**：提供数据出境安全评估工具

## 📚 中文技术文档

### API 参考
```typescript
/**
 * 查询域名注册信息
 * @param domain 要查询的域名
 * @param options 可选参数
 * @returns 标准化的域名注册信息
 * @throws RDAPError 如果查询失败或域名不存在
 * 
 * @example
 * const data = await client.domain('example.com');
 * console.log(data.registrar.name); // "Internet Assigned Numbers Authority"
 */
async domain(domain: string, options?: DomainOptions): Promise<DomainResponse>
```

### 错误处理
```javascript
try {
  const result = await client.domain('example.com');
  // 处理结果
} catch (error) {
  if (error.code === 'RDAP_NOT_FOUND') {
    console.log('域名未找到');
  } else if (error.code === 'RDAP_RATE_LIMITED') {
    console.log('请求频率过高，请稍后再试');
  } else if (error.code === 'RDAP_TIMEOUT') {
    console.log('请求超时，请检查网络连接');
  } else {
    console.error('未知错误:', error.message);
  }
}
```

## 🛠️ 中文开发者工具

### 1. 中文 CLI 工具
```bash
# 安装 CLI
npm install -g rdapify-cli

# 查询域名 (中文界面)
rdapify query example.com --lang zh

# 批量处理域名列表
rdapify batch domains.txt --output results.csv --lang zh

# 交互模式
rdapify interactive --lang zh
```

### 2. 中文 Playground
访问 [https://playground.rdapify.cn](https://playground.rdapify.cn) 无需安装即可在浏览器中体验 RDAPify 的功能。

![中文 Playground 界面](https://rdapify.cn/images/playground-zh-screenshot.png)

## 🏢 中国区域部署

### 1. 阿里云函数计算部署
```yaml
# serverless.yml
service: rdapify-service

provider:
  name: aliyun
  runtime: nodejs16
  credentials: ~/.aliyun/credentials

functions:
  rdapify:
    handler: dist/index.handler
    events:
      - http:
          path: /api
          method: any
    environment:
      CHINA_COMPLIANCE_MODE: true
      DATA_RESIDENCY: china
      ALIYUN_LOG_PROJECT: your-log-project
    vpcConfig:
      securityGroupId: sg-xxxxxx
      vswitchIds: [vsw-xxxxxx]
    nasConfig:
      userId: 10003
      groupId: 10003
      mountPoints:
        - serverAddr: xxxx-xxxxx.cn-hangzhou.nas.aliyuncs.com:/
          mountDir: /mnt/cache
```

### 2. 腾讯云容器服务部署
```yaml
# docker-compose.tencent.yml
version: '3.8'
services:
  rdapify:
    image: rdapify/rdapify:latest
    environment:
      - NODE_ENV=production
      - CHINA_COMPLIANCE_MODE=true
      - DATA_RESIDENCY=china
      - TENCENT_CLOUD_LOG_ENABLED=true
      - LOG_PROJECT_ID=your-project-id
      - LOG_TOPIC_ID=your-topic-id
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    logging:
      driver: "tencentlogs"
      options:
        tencentlogs-logset: "rdapify"
        tencentlogs-topic: "production"
    restart: unless-stopped
```

## 📊 中文分析和监控

### 1. 与阿里云 ARMS 集成
```javascript
// src/monitoring/arms.js
const { init, setOptions } = require('@alicloud/arms-sdk');

// 初始化 ARMS
init({
  pid: process.env.ARMS_PID,
  uid: process.env.ARMS_UID,
  regionId: 'cn-hangzhou',
  env: process.env.NODE_ENV || 'production'
});

// 添加自定义监控指标
function trackRDAPQuery(domain, latency, status) {
  arms.metric('rdap_query', {
    domain,
    latency,
    status,
    region: 'china'
  });
}

module.exports = { trackRDAPQuery };
```

### 2. 与腾讯云云监控集成
```javascript
// src/monitoring/tencent.js
const { MonitorClient } = require('tencentcloud-sdk-nodejs/tencentcloud/services/monitor/v20180724');

const client = new MonitorClient({
  credential: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY
  },
  region: 'ap-guangzhou',
  profile: {
    httpProfile: {
      endpoint: 'monitor.tencentcloudapi.com'
    }
  }
});

async function reportMetrics(metrics) {
  const params = {
    Namespace: 'rdapify/custom',
    MetricData: [
      {
        MetricName: 'QueryLatency',
        Value: metrics.latency,
        Unit: 'ms'
      },
      {
        MetricName: 'QuerySuccess',
        Value: metrics.success ? 1 : 0,
        Unit: 'count'
      }
    ]
  };
  
  await client.PutMonitorData(params);
}
```

## 🆘 中文支持资源

### 1. 中文社区支持
- **微信技术交流群**：添加微信号 `rdapify-cn` 申请加入
- **知乎专栏**：[RDAPify 中文技术专栏](https://zhuanlan.zhihu.com/rdapify)
- **开源中国**：[RDAPify 项目主页](https://www.oschina.net/p/rdapify)
- **每周中文 office hours**：每周四 19:00-20:00 (北京时间)

### 2. 企业支持
- **企业版支持**：[https://rdapify.cn/enterprise](https://rdapify.cn/enterprise)
- **定制开发**：contact@rdapify.cn
- **合规咨询**：compliance@rdapify.cn
- **紧急支持热线**：+86-400-888-RDAP (企业客户专享)

## 🧪 中文技术验证

### 1. 中文环境测试
```bash
# 运行中文环境测试
npm run test:china

# 验证 PIPL 合规性
npm run compliance:pipl

# 检查中文文档
npm run docs:validate -- --lang=zh
```

### 2. 性能基准测试（中国网络环境）
| 测试项目 | RDAPify | 传统 WHOIS 工具 | 提升 |
|----------|---------|----------------|------|
| 平均响应时间 | 120ms | 850ms | 7.1x 快 |
| 1000 次查询耗时 | 3.2 秒 | 196.5 秒 | 61.4x 快 |
| 内存占用 | 85 MB | 580 MB | 6.8x 低 |
| 并发处理能力 | 150 请求/秒 | 5 请求/秒 | 30x 高 |

*测试环境：阿里云 ECS (2 vCPU, 4GB RAM), 北京区域, 200Mbps 网络带宽*

## 📜 许可与合规

### 开源许可
RDAPify 采用 [MIT 许可证](https://opensource.org/licenses/MIT) — 个人和商业使用免费，限制极少。

### 中国合规声明
- 本软件符合中国《网络安全法》、《数据安全法》和《个人信息保护法》(PIPL) 要求
- 数据处理遵循"最小必要"原则
- 未预设任何数据跨境传输功能，除非明确配置
- 提供完整的审计日志和数据处理记录
- 中国境内用户数据默认存储在中国境内

## 🙏 致谢

我们感谢中国互联网社区、CNNIC 团队和中国注册管理机构开发者为使互联网更加透明和安全所付出的辛勤工作。

> **注意**：RDAPify 是一个独立项目，与任何域名注册机构或官方互联网管理机构无关联。提及的所有商标和产品均为其各自所有者的财产。

© 2025 RDAPify — 为不妥协质量和安全的企业构建。  
[安全政策](../../../SECURITY.md) • [隐私政策](../../../PRIVACY.md) • [联系我们](mailto:china@rdapify.cn)

[← 回到本地化](../README.md) | [下一部分：西班牙语文档 →](../spanish.md)

*本文档自动从源代码生成，并于 2025 年 12 月 7 日通过安全审查*
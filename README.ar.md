# rdapify

مكتبة عميل RDAP سريعة وآمنة وجاهزة للإنتاج لـ Rust.

RDAP (بروتوكول الوصول إلى بيانات التسجيل) هو البديل الحديث لـ WHOIS، المحدد في [RFC 9083](https://www.rfc-editor.org/rfc/rfc9083) و [RFC 9224](https://www.rfc-editor.org/rfc/rfc9224).

[![Crates.io](https://img.shields.io/crates/v/rdapify)](https://crates.io/crates/rdapify)
[![docs.rs](https://img.shields.io/docsrs/rdapify)](https://docs.rs/rdapify)
[![CI](https://github.com/rdapify/rdapify-rs/actions/workflows/ci.yml/badge.svg)](https://github.com/rdapify/rdapify-rs/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

> **نظام rdapify**
> | المكتبة | اللغة | الحزمة |
> |--------|-------|--------|
> | [rdapify-rs](https://github.com/rdapify/rdapify-rs) ← **أنت هنا** | Rust | [`rdapify`](https://crates.io/crates/rdapify) على crates.io |
> | [RDAPify](https://github.com/rdapify/RDAPify) | TypeScript / Node.js | [`rdapify`](https://www.npmjs.com/package/rdapify) على npm |
> | [rdapify-nd](https://www.npmjs.com/package/rdapify-nd) | Node.js (Rust native) | [`rdapify-nd`](https://www.npmjs.com/package/rdapify-nd) على npm |
> | [rdapify-py](https://pypi.org/project/rdapify-py/) | Python (Rust native) | [`rdapify-py`](https://pypi.org/project/rdapify-py/) على PyPI |

## الميزات

- **5 أنواع استعلامات** — نطاق و IP و ASN و nameserver و entity
- **Bootstrap IANA** (RFC 9224) — اكتشاف خادم تلقائي، لا حاجة للتكوين اليدوي
- **حماية SSRF** — حجب الطلبات إلى عناوين خاصة و loopback و link-local
- **ذاكرة مؤقتة داخل الذاكرة** — TTL وسعة قابلة للتكوين، خالية من القفل عبر `DashMap`
- **دعم IDN** — يقبل أسماء نطاقات Unicode، تطبيع تلقائي إلى Punycode
- **إعادة محاولة مع تراجع** — تراجع أسي على أخطاء الشبكة و 5xx/429 responses
- **بدون OpenSSL** — يستخدم `rustls` (TLS من Rust النقي)
- **Async-first** — مبني على `tokio`

## التثبيت

```toml
[dependencies]
rdapify = "0.4"
```

## البدء السريع

```rust
use rdapify::RdapClient;

#[tokio::main]
async fn main() -> rdapify::Result<()> {
    let client = RdapClient::new();

    // استعلام نطاق
    let domain = client.domain("example.com").await?;
    println!("المسجل: {:?}", domain.registrar);
    println!("ينتهي في:   {:?}", domain.expiration_date());

    // استعلام عنوان IP
    let ip = client.ip("8.8.8.8").await?;
    println!("الشبكة: {:?}", ip.name);
    println!("البلد: {:?}", ip.country);

    // استعلام ASN
    let asn = client.asn("AS15169").await?;
    println!("اسم ASN: {:?}", asn.name);

    Ok(())
}
```

## الاستخدام

### استعلام النطاق

```rust
let res = client.domain("rust-lang.org").await?;

println!("{}", res.ldh_name.as_deref().unwrap_or("-"));
println!("{:?}", res.status);
println!("{:?}", res.expiration_date());

if let Some(r) = &res.registrar {
    println!("المسجل: {}", r.name.as_deref().unwrap_or("-"));
}
```

### استعلام عنوان IP

```rust
// IPv4
let res = client.ip("1.1.1.1").await?;

// IPv6
let res = client.ip("2606:4700::1111").await?;

println!("CIDR:    {:?}", res.cidr);
println!("البلد: {:?}", res.country);
```

### استعلام ASN

```rust
// يتم قبول كلا الصيغتين
let res = client.asn("15169").await?;
let res = client.asn("AS15169").await?;
```

## التوثيق

توثيق كامل متاح على [docs.rs](https://docs.rs/rdapify).

## الترخيص

Apache License 2.0 — حر للاستخدام الشخصي والتجاري.

© 2026 RDAPify Contributors

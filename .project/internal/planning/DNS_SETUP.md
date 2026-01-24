# DNS Setup Guide for rdapify.com

## Overview

This document provides the DNS configuration needed for rdapify.com and its subdomains.

---

## Main Domain

### A Records (IPv4)

```
rdapify.com.        A       [Your-Server-IP]
www.rdapify.com.    A       [Your-Server-IP]
```

### AAAA Records (IPv6) - Optional

```
rdapify.com.        AAAA    [Your-IPv6-Address]
www.rdapify.com.    AAAA    [Your-IPv6-Address]
```

---

## Subdomains

### Documentation & Website

```
# GitHub Pages (if using)
docs.rdapify.com.   CNAME   rdapify.github.io.

# Or custom server
docs.rdapify.com.   A       [Docs-Server-IP]
```

### Playground

```
playground.rdapify.com.     CNAME   [Playground-Host]
# Or
playground.rdapify.com.     A       [Playground-Server-IP]
```

### API Services

```
api.rdapify.com.            A       [API-Server-IP]
status.rdapify.com.         CNAME   [Status-Page-Provider]
```

### Community & Communication

```
discord.rdapify.com.        CNAME   discord.gg.
meet.rdapify.com.           CNAME   [Meeting-Platform]
chat.rdapify.com.           CNAME   [Chat-Platform]
```

### Enterprise Services

```
enterprise.rdapify.com.     A       [Enterprise-Server-IP]
support.rdapify.com.        CNAME   [Support-Platform]
portal.rdapify.com.         A       [Portal-Server-IP]
```

---

## Email Configuration

### MX Records (Mail Exchange)

```
rdapify.com.        MX      10      mail1.rdapify.com.
rdapify.com.        MX      20      mail2.rdapify.com.
```

Or using email service provider:

```
rdapify.com.        MX      10      mx1.emailprovider.com.
rdapify.com.        MX      20      mx2.emailprovider.com.
```

### SPF Record (Sender Policy Framework)

```
rdapify.com.        TXT     "v=spf1 include:_spf.emailprovider.com ~all"
```

### DKIM Record (DomainKeys Identified Mail)

```
default._domainkey.rdapify.com.     TXT     "v=DKIM1; k=rsa; p=[Your-Public-Key]"
```

### DMARC Record

```
_dmarc.rdapify.com.         TXT     "v=DMARC1; p=quarantine; rua=mailto:dmarc@rdapify.com"
```

---

## Security Records

### CAA Records (Certificate Authority Authorization)

```
rdapify.com.        CAA     0 issue "letsencrypt.org"
rdapify.com.        CAA     0 issuewild "letsencrypt.org"
rdapify.com.        CAA     0 iodef "mailto:security@rdapify.com"
```

---

## Verification Records

### Domain Verification (for various services)

```
# Google Search Console
rdapify.com.        TXT     "google-site-verification=[verification-code]"

# GitHub Pages
_github-pages-challenge-rdapify.rdapify.com.    TXT     "[verification-code]"

# Other services as needed
rdapify.com.        TXT     "[service-verification-code]"
```

---

## CDN Configuration (if using)

### Cloudflare Example

```
# Enable Cloudflare proxy (orange cloud)
rdapify.com.        A       [Cloudflare-IP]      (Proxied)
www.rdapify.com.    A       [Cloudflare-IP]      (Proxied)
api.rdapify.com.    A       [Cloudflare-IP]      (Proxied)
```

---

## Complete DNS Zone File Example

```zone
; rdapify.com DNS Zone File
$TTL 3600
@       IN      SOA     ns1.rdapify.com. admin.rdapify.com. (
                        2025012201      ; Serial
                        7200            ; Refresh
                        3600            ; Retry
                        1209600         ; Expire
                        3600 )          ; Minimum TTL

; Name Servers
@               IN      NS      ns1.rdapify.com.
@               IN      NS      ns2.rdapify.com.

; Main Domain
@               IN      A       [Your-Server-IP]
www             IN      A       [Your-Server-IP]

; Subdomains
docs            IN      CNAME   rdapify.github.io.
playground      IN      A       [Playground-IP]
api             IN      A       [API-IP]
status          IN      CNAME   [Status-Provider]
discord         IN      URL     https://discord.gg/[invite-code]
meet            IN      CNAME   [Meeting-Platform]

; Email
@               IN      MX      10      mx1.emailprovider.com.
@               IN      MX      20      mx2.emailprovider.com.

; Email Security
@               IN      TXT     "v=spf1 include:_spf.emailprovider.com ~all"
default._domainkey  IN  TXT     "v=DKIM1; k=rsa; p=[Public-Key]"
_dmarc          IN      TXT     "v=DMARC1; p=quarantine; rua=mailto:dmarc@rdapify.com"

; Security
@               IN      CAA     0 issue "letsencrypt.org"
@               IN      CAA     0 iodef "mailto:security@rdapify.com"
```

---

## SSL/TLS Certificates

### Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot

# Get certificate for main domain and subdomains
sudo certbot certonly --dns-[provider] \
  -d rdapify.com \
  -d www.rdapify.com \
  -d api.rdapify.com \
  -d docs.rdapify.com \
  -d playground.rdapify.com
```

### Wildcard Certificate

```bash
sudo certbot certonly --dns-[provider] \
  -d rdapify.com \
  -d *.rdapify.com
```

---

## Testing DNS Configuration

### Check DNS Propagation

```bash
# Check A record
dig rdapify.com A

# Check MX records
dig rdapify.com MX

# Check TXT records
dig rdapify.com TXT

# Check from specific nameserver
dig @8.8.8.8 rdapify.com
```

### Online Tools

- https://dnschecker.org/
- https://mxtoolbox.com/
- https://www.whatsmydns.net/

---

## Recommended TTL Values

```
Main Domain (A/AAAA):       3600 (1 hour)
Subdomains (CNAME):         3600 (1 hour)
MX Records:                 3600 (1 hour)
TXT Records:                3600 (1 hour)
CAA Records:                86400 (24 hours)
```

---

## DNS Providers Recommendations

### For Small Projects

- Cloudflare (Free, with CDN)
- Google Cloud DNS
- AWS Route 53

### For Enterprise

- AWS Route 53
- Azure DNS
- Google Cloud DNS
- Cloudflare Enterprise

---

## Monitoring

### DNS Monitoring Services

- UptimeRobot (free tier available)
- Pingdom
- StatusCake
- Custom monitoring with `dig` commands

### Example Monitoring Script

```bash
#!/bin/bash
# Check if rdapify.com resolves correctly
if dig +short rdapify.com | grep -q "[Your-IP]"; then
    echo "DNS OK"
else
    echo "DNS PROBLEM" | mail -s "DNS Alert" admin@rdapify.com
fi
```

---

## Troubleshooting

### Common Issues

1. **DNS not propagating**
   - Wait 24-48 hours for full propagation
   - Check TTL values
   - Verify nameserver configuration

2. **Email not working**
   - Verify MX records
   - Check SPF/DKIM/DMARC
   - Test with mail-tester.com

3. **SSL certificate issues**
   - Verify CAA records
   - Check DNS validation records
   - Ensure A/AAAA records are correct

---

## Security Best Practices

1. **Enable DNSSEC** (if provider supports)
2. **Use CAA records** to restrict certificate issuance
3. **Implement DMARC** for email security
4. **Regular monitoring** of DNS records
5. **Keep nameserver software updated**
6. **Use strong passwords** for DNS provider account
7. **Enable 2FA** on DNS provider account

---

## Maintenance Checklist

- [ ] Verify all DNS records monthly
- [ ] Check SSL certificate expiration
- [ ] Monitor DNS query logs
- [ ] Review and update SPF/DKIM records
- [ ] Test email deliverability
- [ ] Verify subdomain functionality
- [ ] Check DNS propagation globally

---

_Last Updated: January 22, 2025_  
_For DNS support: admin@rdapify.com_

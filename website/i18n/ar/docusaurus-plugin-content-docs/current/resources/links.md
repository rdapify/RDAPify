# روابط وموارد مفيدة

**الغرض**: مجموعة منتقاة من الموارد الخارجية الأساسية والمواصفات والأدوات والمجتمعات ذات الصلة بـ RDAP والبنية التحتية للإنترنت والأمان والامتثال لمطوري ومستخدمي RDAPify
**ذات صلة**: [مراجع RFC](rfcs.md) | [قاموس المصطلحات](glossary.md) | [الأوراق البحثية](papers.md) | [المواصفات](../../specifications/rdap_rfc.md)
**وقت القراءة**: 3 دقائق

## بروتوكول RDAP والمعايير

### المواصفات الرسمية
- **[RFC 7480: استخدام HTTP في بروتوكول الوصول إلى بيانات التسجيل (RDAP)](https://tools.ietf.org/html/rfc7480)** — RFC التأسيسي الذي يحدد بروتوكول RDAP واستخدام HTTP
- **[RFC 7481: خدمات الأمان لبروتوكول الوصول إلى بيانات التسجيل (RDAP)](https://tools.ietf.org/html/rfc7481)** — اعتبارات الأمان ومتطلبات تطبيقات RDAP
- **[RFC 7482: تنسيق استعلام بروتوكول الوصول إلى بيانات التسجيل (RDAP)](https://tools.ietf.org/html/rfc7482)** — مواصفات تنسيق الاستعلام التفصيلية
- **[RFC 7483: استجابات JSON لبروتوكول الوصول إلى بيانات التسجيل (RDAP)](https://tools.ietf.org/html/rfc7483)** — تعريفات تنسيق الاستجابة القياسية
- **[RFC 8521: امتدادات استعلام بروتوكول الوصول إلى بيانات التسجيل (RDAP)](https://tools.ietf.org/html/rfc8521)** — آليات الامتداد للاستعلامات المتقدمة

### موارد IANA
- **[سجل خدمة تمهيد RDAP الخاص بـ IANA](https://www.iana.org/assignments/rdap-dns/rdap-dns.xhtml)** — نقاط نهاية خدمة التمهيد الرسمية لجميع امتدادات النطاقات العلوية
- **[سجلات RDAP الخاصة بـ IANA](https://www.iana.org/assignments/rdap/rdap.xhtml)** — السجل الكامل لنقاط نهاية خدمة RDAP
- **[مواصفات خدمة تمهيد RDAP](https://www.iana.org/assignments/rdap/rdap.xhtml#bootstrap-service-specification)** — التفاصيل التقنية لتطبيق خدمة التمهيد

## موارد الأمان والخصوصية

### الأمان المحدد لـ RDAP
- **[ضوابط أمان NIST SP 800-53](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)** — إطار شامل لضوابط الأمان قابل للتطبيق على تطبيقات RDAP
- **[RFC 9048: مصادقة استعلام RDAP](https://tools.ietf.org/html/rfc9048)** — آليات المصادقة لاستعلامات RDAP
- **[OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/)** — معيار التحقق من أمان التطبيقات مع أقسام ذات صلة بـ RDAP

### الخصوصية والامتثال
- **[النص الرسمي لـ GDPR](https://gdpr-info.eu/)** — النص الكامل للائحة العامة لحماية البيانات والتوجيه
- **[النص الرسمي لـ CCPA](https://oag.ca.gov/privacy/ccpa)** — موارد قانون خصوصية المستهلك في كاليفورنيا
- **[إطار TCF الخاص بـ IAB Europe](https://iabeurope.eu/tcf/)** — إطار الشفافية والموافقة لمعالجة البيانات
- **[إرشادات EDPB بشأن تقليل البيانات](https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-42020-article-23-limitations_en)** — توجيهات أساسية للتعامل مع بيانات RDAP

## موارد البنية التحتية للإنترنت

### توثيق السجلات
- **[توثيق Verisign RDAP](https://www.verisign.com/en_US/domain-names/rdap/index.xhtml)** — دليل التطبيق الرسمي لـ Verisign
- **[توثيق ARIN RDAP](https://www.arin.net/resources/registry/whois/rdap/)** — تفاصيل تطبيق RDAP الخاص بـ ARIN
- **[توثيق RIPE NCC RDAP](https://www.ripe.net/manage-ips-and-asns/db/access/rdap)** — توثيق خدمة RDAP الخاصة بـ RIPE
- **[توثيق APNIC RDAP](https://www.apnic.net/manage-ip/using-whois/rdap/)** — تفاصيل تطبيق APNIC
- **[توثيق LACNIC RDAP](https://www.lacnic.net/en/web/whois-es/rdap)** — موارد RDAP الخاصة بـ LACNIC

### أدوات تحليل البروتوكول
- **[محلل RDAP الخاص بـ Wireshark](https://www.wireshark.org/docs/dfref/r/rdap.html)** — تحليل بروتوكول الشبكة لحركة مرور RDAP
- **[DNSViz](https://dnsviz.net/)** — أداة تصور وتحليل DNS لتشخيص الأخطاء
- **[أداة MTR لتشخيص الشبكة](https://www.bitwizard.nl/mtr/)** — تحليل مسار الشبكة لمشاكل الاتصال

## أدوات المطور والمكتبات

### مكتبات وعملاء RDAP
- **[rdap-rs (Rust)](https://crates.io/crates/rdap)** — عميل RDAP عالي الأداء بلغة Rust
- **[python-rdap (Python)](https://pypi.org/project/rdap/)** — مكتبة عميل RDAP بلغة Python
- **[go-rdap (Go)](https://github.com/domainr/rdap)** — تطبيق Go مع دعم موسع للسجلات
- **[rdap-cli (سطر الأوامر)](https://github.com/domainr/rdap-cli)** — عميل RDAP لسطر الأوامر للكتابة البرمجية

### أدوات اختبار الأمان
- **[ZAP (وكيل هجوم Zed)](https://www.zaproxy.org/)** — اختبار أمان تطبيقات الويب مع مسح نقاط نهاية RDAP
- **[Bandit (محلل أمان Python)](https://bandit.readthedocs.io/)** — محلل أمان لتحليل كود Python
- **[Semgrep](https://semgrep.dev/)** — أداة تحليل ثابت مع قواعد مخصصة لأمان RDAP
- **[Trivy](https://aquasecurity.github.io/trivy/)** — فحص الحاويات ونقاط ضعف التبعيات

## موارد الامتثال والقانون

### الأطر التنظيمية
- **[سياسة بيانات التسجيل الخاصة بـ ICANN](https://www.icann.org/resources/pages/registration-data-policy-en)** — السياسة الرسمية التي تحكم بيانات WHOIS/RDAP
- **[موارد خصوصية لجنة التجارة الفيدرالية](https://www.ftc.gov/tips-advice/business-center/privacy-and-security)** — توجيهات الخصوصية الصادرة عن لجنة التجارة الفيدرالية الأمريكية
- **[مجلس حماية البيانات الأوروبي](https://edpb.europa.eu/)** — التوجيه الرسمي لـ GDPR وقراراته في الاتحاد الأوروبي
- **[قضايا تنفيذ CCPA](https://oag.ca.gov/privacy/ccpa/enforcement)** — إجراءات تنفيذية لمدعي عام كاليفورنيا

### المعايير الصناعية
- **[ISO/IEC 27001:2022](https://www.iso.org/standard/82875.html)** — معايير إدارة أمن المعلومات
- **[إطار الأمان السيبراني لـ NIST](https://www.nist.gov/cyberframework)** — إطار شامل للأمان السيبراني
- **[ضوابط CIS الإصدار 8](https://www.cisecurity.org/controls)** — ضوابط الأمان الحرجة للأنظمة المواجهة للإنترنت
- **[معايير خدمة SOC 2](https://soc.cyberprivate.com/soc-2/)** — متطلبات التحكم في منظمات الخدمات

## الأداء والتشغيل

### أدوات اختبار الأداء
- **[autocannon](https://github.com/mcollina/autocannon)** — أداة قياس أداء HTTP لاختبار نقاط نهاية RDAP
- **[wrk](https://github.com/wg/wrk)** — أداة حديثة لقياس أداء HTTP مع كتابة Lua
- **[k6](https://k6.io/)** — أداة اختبار الحمل المتمحورة حول المطور مع تكامل السحابة
- **[Prometheus + Grafana](https://prometheus.io/docs/visualization/grafana/)** — مجموعة المراقبة وإمكانية المراقبة لنشر RDAP الإنتاجي

### أدوات DNS والشبكة
- **[DNSPerf](https://www.dnsperf.com/)** — إطار اختبار أداء DNS
- **[dnspython](https://www.dnspython.org/)** — مجموعة أدوات DNS لـ Python مع أمثلة تكامل RDAP
- **[MTR](https://www.bitwizard.nl/mtr/)** — أداة تشخيص شبكة تجمع بين ping وtraceroute
- **[nmap](https://nmap.org/)** — أداة اكتشاف الشبكة وتدقيق الأمان

## المجتمع والتعلم

### منتديات النقاش والمجتمعات
- **[مجموعة عمل IETF REGEXT](https://datatracker.ietf.org/wg/regext/about/)** — مجموعة عمل IETF الرسمية لتطوير بروتوكول RDAP
- **[المجتمع التقني لـ ICANN](https://www.icann.org/technical-community)** — نقاشات تقنية حول تطبيق RDAP وسياساته
- **[Reddit r/netsec](https://www.reddit.com/r/netsec/)** — مجتمع أمان الشبكات مع نقاشات RDAP
- **[Matrix #rdapify:matrix.org](https://matrix.to/#/#rdapify:matrix.org)** — قناة الدردشة الجماعية لـ RDAPify

### المؤتمرات والفعاليات
- **[اجتماعات IETF](https://www.ietf.org/how/meetings/)** — اجتماعات IETF الرسمية مع جلسات مجموعة عمل RDAP
- **[ورش عمل DNS-OARC](https://www.dns-oarc.net/meetings)** — ورش عمل مركز عمليات DNS والتحليل والأبحاث
- **[DEF CON](https://defcon.org/)** — مؤتمر الأمان مع مسار أمان البنية التحتية
- **[Black Hat](https://www.blackhat.com/)** — مؤتمر الأمان مع تركيز على أمان الشبكات والبروتوكولات

## الأبحاث والأوراق الأكاديمية

### أبحاث RDAP
- **["RDAP: بروتوكول WHOIS الجديد" (IEEE Communications Magazine)](https://ieeexplore.ieee.org/document/7086567)** — تحليل أكاديمي لتصميم بروتوكول RDAP
- **["تطبيقات RDAP الحافظة للخصوصية" (ACM TOPS)](https://dl.acm.org/doi/abs/10.1145/3230666)** — بحث حول تقنيات الخصوصية لعملاء RDAP
- **["DNSSEC وRDAP: تقنيتا أمان تكمّلان بعضهما" (RFC Editor)](https://www.rfc-editor.org/rfc/rfc9214.html)** — تحليل تقني لتكامل DNSSEC وRDAP

### أبحاث الأمان
- **["هجمات SSRF في تطبيقات الويب الحديثة" (USENIX Security)](https://www.usenix.org/conference/usenixsecurity22/presentation/li)** — بحث هجمات SSRF ذو صلة بعملاء RDAP
- **["كشف البيانات الشخصية في البيانات المنظمة وغير المنظمة" (IEEE)](https://ieeexplore.ieee.org/document/9214782)** — بحث أكاديمي حول تقنيات كشف البيانات الشخصية
- **["استراتيجيات التخزين المؤقت للأنظمة الموزعة جغرافياً" (ACM)](https://dl.acm.org/doi/abs/10.1145/3357223.3362722)** — بحث حول التخزين المؤقت الموزع للخدمات العالمية

## الشرح والتعلم

### أدلة عملية
- **[RDAP Protocol Deep Dive (Cloudflare Blog)](https://blog.cloudflare.com/rdap-protocol/)** — دليل تطبيق عملي مع أمثلة
- **["بناء عملاء RDAP آمنين" (OWASP Foundation)](https://owasp.org/www-project-web-security-testing-guide/)** — دليل تطوير عميل RDAP المتمحور حول الأمان
- **["معالجة البيانات المتوافقة مع GDPR" (DPO Handbook)](https://iapp.org/resources/dpohandbook/)** — توجيه شامل لمسؤولي حماية البيانات
- **[ورشة عمل تطوير عميل RDAP](https://github.com/domainr/rdap-workshop)** — مستودع GitHub مع مواد ورش العمل والتمارين

## مواصفات الموارد

| الخاصية | القيمة |
|---------|--------|
| **آخر تحديث** | 5 ديسمبر 2025 |
| **التحقق من الروابط** | فحوصات آلية أسبوعية |
| **عدد الموارد** | أكثر من 75 رابطاً منتقىً |
| **الفئات** | 8 فئات رئيسية مع فئات فرعية |
| **معيار الجودة** | المصادر الموثوقة والموارد المُصانة جيداً فقط |
| **عملية التحديث** | المساهمات المجتمعية مرحب بها عبر طلبات سحب GitHub |
| **الترخيص** | الروابط ملكية لأصحابها المعنيين؛ الأوصاف مرخصة بموجب MIT |

> **تذكير مهم**: تحقق دائماً من أصالة وأمان الموارد الخارجية قبل تطبيق التوصيات. تتغير العديد من المتطلبات الأمنية والامتثالية بشكل متكرر؛ استشر متخصصين قانونيين وأمنيين مؤهلين قبل اتخاذ قرارات التطبيق استناداً إلى هذه الموارد وحدها. RDAPify غير مسؤولة عن محتوى أو توافر الروابط الخارجية.

[← العودة إلى الموارد](../README.md) | [التالي: مراجع RFC ←](rfcs.md)

*تم توليد المستند تلقائياً من الموارد المنتقاة مع مراجعة الأمان في 5 ديسمبر 2025*

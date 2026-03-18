/**
 * RDAPify Playground - Interactive RDAP Query Tool
 *
 * @author RDAPify Contributors
 * @license MIT
 */

// ============================================
// Client ID Management
// ============================================
const CLIENT_KEY = "rdapify_client_id";
let clientId = localStorage.getItem(CLIENT_KEY);
if (!clientId) {
    clientId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    localStorage.setItem(CLIENT_KEY, clientId);
}

// ============================================
// State Management
// ============================================
const state = {
    queryHistory: [],
    currentQuery: null,
    currentData: null,
    currentType: null,
    isLoading: false,
    quotaInfo: {
        remainingToday: null,
        resetAt: null
    }
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    queryInput: document.getElementById('queryInput'),
    queryButton: document.getElementById('queryButton'),
    queryTypeRadios: document.querySelectorAll('input[name="queryType"]'),
    resultsContainer: document.getElementById('resultsContainer'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    statusTime: document.getElementById('statusTime'),
    copyButton: document.getElementById('copyButton'),
    clearButton: document.getElementById('clearButton'),
    historyContainer: document.getElementById('historyContainer'),
    clearHistoryButton: document.getElementById('clearHistoryButton'),
    exampleButtons: document.querySelectorAll('.example-btn'),
    optionCache: document.getElementById('optionCache'),
    optionRedact: document.getElementById('optionRedact'),
    optionVerbose: document.getElementById('optionVerbose'),
    quotaInfo: document.getElementById('quotaInfo'),
    installSection: document.getElementById('installSection')
};

// ============================================
// Utility Functions
// ============================================

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getQueryType() {
    const selected = document.querySelector('input[name="queryType"]:checked');
    return selected ? selected.value : 'domain';
}

function validateQuery(query, type) {
    if (!query || query.trim() === '') {
        return { valid: false, error: 'Query cannot be empty' };
    }
    query = query.trim();
    switch (type) {
        case 'domain':
            const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            if (!domainRegex.test(query)) return { valid: false, error: 'Invalid domain format' };
            break;
        case 'ip':
            const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
            const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
            if (!ipv4Regex.test(query) && !ipv6Regex.test(query)) return { valid: false, error: 'Invalid IP address format' };
            break;
        case 'asn':
            const asnRegex = /^(AS)?(\d+)$/i;
            if (!asnRegex.test(query)) return { valid: false, error: 'Invalid ASN format (use AS12345 or 12345)' };
            break;
        case 'nameserver':
            if (!query.includes('.')) return { valid: false, error: 'Invalid nameserver hostname (e.g. ns1.example.com)' };
            break;
        case 'entity':
            if (!/^[a-zA-Z0-9][\w\-.]*$/.test(query)) return { valid: false, error: 'Invalid entity handle format (e.g. ARIN-HN-1)' };
            break;
        default:
            return { valid: false, error: 'Unknown query type' };
    }
    return { valid: true, query };
}

function showLoading() {
    state.isLoading = true;
    elements.queryButton.disabled = true;
    elements.queryButton.querySelector('.btn-text').style.display = 'none';
    elements.queryButton.querySelector('.btn-loader').style.display = 'inline';
}

function hideLoading() {
    state.isLoading = false;
    elements.queryButton.disabled = false;
    elements.queryButton.querySelector('.btn-text').style.display = 'inline';
    elements.queryButton.querySelector('.btn-loader').style.display = 'none';
}

// ============================================
// JSON Tree Renderer (collapsible + copy)
// ============================================

function jsonValueHtml(value) {
    if (value === null) return '<span class="jt-null">null</span>';
    if (typeof value === 'boolean') return `<span class="jt-bool">${value}</span>`;
    if (typeof value === 'number') return `<span class="jt-num">${value}</span>`;
    if (typeof value === 'string') return `<span class="jt-str">"${escapeHtml(value)}"</span>`;
    if (Array.isArray(value)) {
        if (value.length === 0) return '<span class="jt-bracket">[]</span>';
        return renderJsonNode(value);
    }
    if (typeof value === 'object') {
        if (Object.keys(value).length === 0) return '<span class="jt-bracket">{}</span>';
        return renderJsonNode(value);
    }
    return escapeHtml(String(value));
}

function summarizeValue(value) {
    if (Array.isArray(value)) return `[${value.length} item${value.length !== 1 ? 's' : ''}]`;
    if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value);
        return `{${keys.slice(0, 2).join(', ')}${keys.length > 2 ? ', …' : ''}}`;
    }
    return '';
}

function renderJsonNode(obj, topLevel = false) {
    const isArray = Array.isArray(obj);
    const entries = isArray
        ? obj.map((v, i) => ({ key: String(i), value: v, isIndex: true }))
        : Object.keys(obj).map(k => ({ key: k, value: obj[k], isIndex: false }));

    const rows = entries.map(({ key, value, isIndex }) => {
        const isComplex = value !== null && typeof value === 'object';
        const summary = isComplex ? summarizeValue(value) : '';

        const keyHtml = isIndex
            ? `<span class="jt-index">${key}</span>`
            : `<span class="jt-key">"${escapeHtml(key)}"</span><span class="jt-colon">:</span>`;

        const copyBtn = topLevel
            ? `<button class="jt-copy-btn" title="Copy ${escapeHtml(key)}" data-copy='${escapeHtml(JSON.stringify(value))}'>📋</button>`
            : '';

        if (isComplex) {
            return `
            <div class="jt-row jt-complex" data-collapsed="true">
              <div class="jt-row-header">
                <button class="jt-toggle" aria-label="toggle">▶</button>
                ${keyHtml}
                <span class="jt-summary">${escapeHtml(summary)}</span>
                ${copyBtn}
              </div>
              <div class="jt-children" style="display:none">
                ${renderJsonNode(value)}
              </div>
            </div>`;
        } else {
            return `
            <div class="jt-row">
              <span class="jt-toggle-ph"></span>
              ${keyHtml}
              ${jsonValueHtml(value)}
              ${copyBtn}
            </div>`;
        }
    }).join('');

    const open = isArray ? '[' : '{';
    const close = isArray ? ']' : '}';
    return `<div class="jt-block"><span class="jt-bracket">${open}</span>${rows}<span class="jt-bracket">${close}</span></div>`;
}

// ============================================
// Visual View Renderer
// ============================================

function extractEvents(events) {
    if (!Array.isArray(events)) return {};
    const map = {};
    events.forEach(e => {
        if (e.eventAction && e.eventDate) map[e.eventAction] = e.eventDate;
    });
    return map;
}

function extractEntityName(entity) {
    try {
        const vcard = entity.vcardArray && entity.vcardArray[1];
        if (!vcard) return null;
        const fn = vcard.find(f => f[0] === 'fn');
        return fn ? fn[3] : null;
    } catch { return null; }
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
}

function statusBadge(s) {
    return `<span class="vis-badge">${escapeHtml(s)}</span>`;
}

function renderVisualView(data, type) {
    const events = extractEvents(data.events);
    const rows = [];

    if (type === 'domain') {
        const name = data.ldhName || data.unicodeName || data.handle || '—';
        const registrar = data.entities
            ? (data.entities.find(e => Array.isArray(e.roles) && e.roles.includes('registrar')))
            : null;
        const registrant = data.entities
            ? (data.entities.find(e => Array.isArray(e.roles) && e.roles.includes('registrant')))
            : null;
        const ns = data.nameservers ? data.nameservers.map(n => n.ldhName || n.unicodeName).filter(Boolean) : [];
        const statuses = Array.isArray(data.status) ? data.status : [];
        const dnssec = data.secureDNS ? (data.secureDNS.delegationSigned ? 'Signed ✅' : 'Not signed') : '—';

        rows.push(['Domain', name]);
        rows.push(['Status', statuses.length ? statuses.map(statusBadge).join(' ') : '—']);
        rows.push(['Registrar', registrar ? (extractEntityName(registrar) || registrar.handle || '—') : '—']);
        rows.push(['Registrant', registrant ? (extractEntityName(registrant) || 'Redacted') : '—']);
        rows.push(['Nameservers', ns.length ? ns.map(n => `<span class="vis-ns">${escapeHtml(n)}</span>`).join('') : '—']);
        rows.push(['Registered', formatDate(events['registration'])]);
        rows.push(['Last Changed', formatDate(events['last changed'])]);
        rows.push(['Expires', formatDate(events['expiration'])]);
        rows.push(['DNSSEC', dnssec]);

    } else if (type === 'ip') {
        const org = data.entities
            ? (data.entities.find(e => Array.isArray(e.roles) && (e.roles.includes('registrant') || e.roles.includes('iana'))))
            : null;
        rows.push(['Handle', data.handle || '—']);
        rows.push(['Network Name', data.name || '—']);
        rows.push(['IP Range', data.startAddress && data.endAddress ? `${data.startAddress} → ${data.endAddress}` : '—']);
        rows.push(['Version', data.ipVersion ? `IPv${data.ipVersion}` : '—']);
        rows.push(['Country', data.country || '—']);
        rows.push(['Organization', org ? (extractEntityName(org) || org.handle || '—') : '—']);
        rows.push(['Registered', formatDate(events['registration'])]);
        rows.push(['Last Changed', formatDate(events['last changed'])]);

    } else if (type === 'asn') {
        const org = data.entities
            ? (data.entities.find(e => Array.isArray(e.roles) && e.roles.includes('registrant')))
            : null;
        rows.push(['Handle', data.handle || '—']);
        rows.push(['AS Name', data.name || '—']);
        rows.push(['ASN Range', data.startAutnum != null ? `${data.startAutnum}${data.endAutnum !== data.startAutnum ? ' → ' + data.endAutnum : ''}` : '—']);
        rows.push(['Country', data.country || '—']);
        rows.push(['Organization', org ? (extractEntityName(org) || org.handle || '—') : '—']);
        rows.push(['Type', data.type || '—']);
        rows.push(['Registered', formatDate(events['registration'])]);
        rows.push(['Last Changed', formatDate(events['last changed'])]);

    } else if (type === 'nameserver') {
        const v4 = data.ipAddresses && data.ipAddresses.v4 ? data.ipAddresses.v4 : [];
        const v6 = data.ipAddresses && data.ipAddresses.v6 ? data.ipAddresses.v6 : [];
        const statuses = Array.isArray(data.status) ? data.status : [];
        rows.push(['Nameserver', data.ldhName || data.unicodeName || data.handle || '—']);
        rows.push(['Handle', data.handle || '—']);
        rows.push(['Status', statuses.length ? statuses.map(statusBadge).join(' ') : '—']);
        rows.push(['IPv4 Addresses', v4.length ? v4.map(a => `<span class="vis-ns">${escapeHtml(a)}</span>`).join('') : '—']);
        rows.push(['IPv6 Addresses', v6.length ? v6.map(a => `<span class="vis-ns">${escapeHtml(a)}</span>`).join('') : '—']);
        rows.push(['Registered', formatDate(events['registration'])]);
        rows.push(['Last Changed', formatDate(events['last changed'])]);

    } else if (type === 'entity') {
        const name = extractEntityName(data) || '—';
        const roles = Array.isArray(data.roles) ? data.roles : [];
        const statuses = Array.isArray(data.status) ? data.status : [];
        rows.push(['Handle', data.handle || '—']);
        rows.push(['Name', name]);
        rows.push(['Roles', roles.length ? roles.map(statusBadge).join(' ') : '—']);
        rows.push(['Status', statuses.length ? statuses.map(statusBadge).join(' ') : '—']);
        rows.push(['Registered', formatDate(events['registration'])]);
        rows.push(['Last Changed', formatDate(events['last changed'])]);
    }

    const tableRows = rows.map(([label, value]) => `
        <tr>
          <td class="vis-label">${escapeHtml(label)}</td>
          <td class="vis-value">${value}</td>
        </tr>`).join('');

    return `<table class="vis-table"><tbody>${tableRows}</tbody></table>`;
}

// ============================================
// Display Results (with tabs)
// ============================================

function displayResults(data, queryTime, queryType) {
    state.currentData = data;
    state.currentType = queryType;

    const rawHtml = renderJsonNode(data, true);
    const visualHtml = renderVisualView(data, queryType);

    elements.resultsContainer.innerHTML = `
        <div class="result-tabs fade-in">
          <button class="rtab active" data-tab="visual">Visual</button>
          <button class="rtab" data-tab="raw">Raw JSON</button>
        </div>
        <div class="rtab-content" id="rtab-visual">${visualHtml}</div>
        <div class="rtab-content hidden" id="rtab-raw">
          <div class="jt-root">${rawHtml}</div>
        </div>
    `;

    // Tab switching
    elements.resultsContainer.querySelectorAll('.rtab').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.resultsContainer.querySelectorAll('.rtab').forEach(b => b.classList.remove('active'));
            elements.resultsContainer.querySelectorAll('.rtab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            elements.resultsContainer.querySelector(`#rtab-${btn.dataset.tab}`).classList.remove('hidden');
        });
    });

    // Collapse/Expand JSON sections
    elements.resultsContainer.addEventListener('click', function(e) {
        const toggle = e.target.closest('.jt-toggle');
        if (!toggle) return;
        const row = toggle.closest('.jt-row');
        if (!row) return;
        const children = row.querySelector('.jt-children');
        if (!children) return;
        const collapsed = row.dataset.collapsed === 'true';
        row.dataset.collapsed = collapsed ? 'false' : 'true';
        toggle.textContent = collapsed ? '▼' : '▶';
        children.style.display = collapsed ? 'block' : 'none';
    }, { once: false });

    // Per-section copy buttons
    elements.resultsContainer.addEventListener('click', function(e) {
        const btn = e.target.closest('.jt-copy-btn');
        if (!btn) return;
        e.stopPropagation();
        const text = btn.dataset.copy;
        navigator.clipboard.writeText(text).then(() => {
            const orig = btn.textContent;
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = orig, 1500);
        });
    });

    // Status bar
    elements.statusBar.style.display = 'flex';
    elements.statusText.textContent = '✅ Query successful';
    elements.statusText.style.color = 'var(--success, #10b981)';
    elements.statusTime.textContent = `${queryTime}ms`;
}

// ============================================
// Quota & Error Display
// ============================================

function updateQuotaDisplay() {
    if (!elements.quotaInfo) return;
    if (state.quotaInfo.remainingToday !== null) {
        const resetDate = state.quotaInfo.resetAt ? new Date(state.quotaInfo.resetAt).toLocaleString() : 'Unknown';
        elements.quotaInfo.innerHTML = `
            <span class="quota-remaining">Remaining today: <strong>${state.quotaInfo.remainingToday}</strong></span>
            <span class="quota-reset">Resets at: ${resetDate}</span>
        `;
        elements.quotaInfo.style.display = 'flex';
        if (state.quotaInfo.remainingToday === 0) {
            elements.queryButton.disabled = true;
            elements.queryButton.title = 'Daily limit reached. Install the package to continue.';
        } else {
            elements.queryButton.disabled = false;
            elements.queryButton.title = '';
        }
    }
}

function displayError(error, isQuotaExceeded = false, retryAfter = null) {
    let errorMessage = error;
    if (isQuotaExceeded) {
        let retryHint = '';
        if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds)) {
                const minutes = Math.ceil(seconds / 60);
                retryHint = `<p style="color: var(--gray-600); margin-top: 0.5rem; font-size: 0.9rem;">Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.</p>`;
            }
        }
        errorMessage = `
            <p style="color: var(--error); font-weight: 600;">Daily Limit Reached</p>
            <p style="color: var(--gray-600); margin: 1rem 0;">You've reached the daily limit for playground queries.</p>
            ${retryHint}
            <p style="color: var(--gray-600);">Install RDAPify to continue with unlimited queries:</p>
            <pre style="background: var(--gray-100); padding: 1rem; border-radius: 8px; margin-top: 1rem;">npm install rdapify</pre>
        `;
    }
    elements.resultsContainer.innerHTML = `
        <div class="placeholder fade-in">
            <div class="placeholder-icon">❌</div>
            ${typeof errorMessage === 'string' && !isQuotaExceeded ? `
                <p style="color: var(--error); font-weight: 600;">Error</p>
                <p style="color: var(--gray-600);">${errorMessage}</p>
            ` : errorMessage}
        </div>
    `;
    elements.statusBar.style.display = 'flex';
    elements.statusText.textContent = isQuotaExceeded ? '⚠️ Quota exceeded' : '❌ Query failed';
    elements.statusText.style.color = 'var(--error)';
}

// ============================================
// History
// ============================================

function addToHistory(query, type, success) {
    state.queryHistory.unshift({ query, type, success, timestamp: new Date().toISOString() });
    if (state.queryHistory.length > 10) state.queryHistory = state.queryHistory.slice(0, 10);
    updateHistoryDisplay();
    saveHistoryToLocalStorage();
}

function updateHistoryDisplay() {
    if (state.queryHistory.length === 0) {
        elements.historyContainer.innerHTML = '<p class="history-empty">No queries yet</p>';
        return;
    }
    elements.historyContainer.innerHTML = state.queryHistory.map((item, index) => {
        const time = new Date(item.timestamp).toLocaleTimeString();
        const icon = item.success ? '✅' : '❌';
        return `
            <div class="history-item fade-in" data-index="${index}">
                <div>
                    <span class="history-query">${icon} ${item.query}</span>
                    <span class="history-type">${item.type}</span>
                </div>
                <span class="history-time">${time}</span>
            </div>
        `;
    }).join('');
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            const historyItem = state.queryHistory[index];
            elements.queryInput.value = historyItem.query;
            document.querySelector(`input[name="queryType"][value="${historyItem.type}"]`).checked = true;
        });
    });
}

function saveHistoryToLocalStorage() {
    try { localStorage.setItem('rdapify_history', JSON.stringify(state.queryHistory)); } catch (e) {}
}

function loadHistoryFromLocalStorage() {
    try {
        const saved = localStorage.getItem('rdapify_history');
        if (saved) { state.queryHistory = JSON.parse(saved); updateHistoryDisplay(); }
    } catch (e) {}
}

// ============================================
// RDAP Bootstrap Discovery
// ============================================

const bootstrapCache = {};

async function fetchBootstrap(type) {
    if (bootstrapCache[type]) return bootstrapCache[type];
    const urls = {
        dns: 'https://data.iana.org/rdap/dns.json',
        ipv4: 'https://data.iana.org/rdap/ipv4.json',
        ipv6: 'https://data.iana.org/rdap/ipv6.json',
        asn: 'https://data.iana.org/rdap/asn.json'
    };
    const response = await fetch(urls[type]);
    if (!response.ok) throw new Error('Failed to load RDAP bootstrap registry');
    bootstrapCache[type] = await response.json();
    return bootstrapCache[type];
}

function findBootstrapServer(bootstrap, key) {
    const lowerKey = key.toLowerCase();
    for (const [keys, servers] of bootstrap.services) {
        if (servers.length > 0 && keys.map(k => k.toLowerCase()).includes(lowerKey)) {
            return servers[0];
        }
    }
    return null;
}

// ============================================
// API (direct RDAP calls — no backend needed)
// ============================================

async function performQuery(query, type, options = {}) {
    const startTime = Date.now();
    try {
        let rdapUrl;

        if (type === 'domain') {
            const parts = query.toLowerCase().split('.');
            const tld = parts[parts.length - 1];
            const bootstrap = await fetchBootstrap('dns');
            let server = findBootstrapServer(bootstrap, tld);
            // Try two-label TLD (e.g., co.uk)
            if (!server && parts.length >= 3) {
                const sld = parts.slice(-2).join('.');
                server = findBootstrapServer(bootstrap, sld);
            }
            if (!server) throw new Error(`.${tld} is not supported by RDAP — try a different TLD`);
            rdapUrl = `${server.replace(/\/$/, '')}/domain/${encodeURIComponent(query.toLowerCase())}`;
        } else if (type === 'ip') {
            // ARIN gateway supports CORS and redirects to the correct RIR
            rdapUrl = `https://rdap.arin.net/registry/ip/${encodeURIComponent(query)}`;
        } else if (type === 'asn') {
            const asnNum = query.replace(/^AS/i, '');
            rdapUrl = `https://rdap.arin.net/registry/autnum/${asnNum}`;
        } else if (type === 'nameserver') {
            const parts = query.toLowerCase().split('.');
            const tld = parts[parts.length - 1];
            const bootstrap = await fetchBootstrap('dns');
            let server = findBootstrapServer(bootstrap, tld);
            if (!server && parts.length >= 3) {
                const sld = parts.slice(-2).join('.');
                server = findBootstrapServer(bootstrap, sld);
            }
            if (!server) throw new Error(`.${tld} is not supported by RDAP`);
            rdapUrl = `${server.replace(/\/$/, '')}/nameserver/${encodeURIComponent(query.toLowerCase())}`;
        } else if (type === 'entity') {
            // Entity queries go to ARIN as a public CORS-friendly registry
            rdapUrl = `https://rdap.arin.net/registry/entity/${encodeURIComponent(query)}`;
        } else {
            throw new Error('Unknown query type');
        }

        const response = await fetch(rdapUrl, {
            headers: { 'Accept': 'application/rdap+json, application/json' }
        });

        if (!response.ok) {
            // 404 on domain/nameserver = not registered = available
            if (response.status === 404 && (type === 'domain' || type === 'nameserver')) {
                return { success: true, available: true, query, type, queryTime: Date.now() - startTime };
            }
            if (response.status === 404) throw new Error(`No record found for: ${query}`);
            if (response.status === 429) throw new Error('Rate limit exceeded — please wait a moment and try again');
            throw new Error(`RDAP server returned HTTP ${response.status}`);
        }

        const data = await response.json();
        return { success: true, available: false, data, queryTime: Date.now() - startTime };
    } catch (error) {
        const msg = error.message || 'Network error';
        // Detect CORS failures
        if (error instanceof TypeError && msg.toLowerCase().includes('fetch')) {
            return { success: false, error: 'Network error — the RDAP server may not allow browser requests (CORS). Try a different query.' };
        }
        return { success: false, error: msg };
    }
}

// ============================================
// Availability Display
// ============================================

function displayAvailable(query, type, queryTime) {
    const label = type === 'nameserver' ? 'Nameserver' : 'Domain';
    const hint = type === 'nameserver'
        ? 'No nameserver registration record was found in the RDAP registry.'
        : 'This domain does not appear to be registered. It may be available to register.';

    elements.resultsContainer.innerHTML = `
        <div class="placeholder fade-in" style="border: 2px solid var(--success, #10b981); border-radius: 12px; padding: 2rem;">
            <div class="placeholder-icon" style="font-size: 3rem;">✅</div>
            <p style="font-size: 1.2rem; font-weight: 700; color: var(--success, #10b981); margin: 0.5rem 0;">
                ${label} Available
            </p>
            <p style="font-size: 1rem; color: var(--gray-700, #374151); margin: 0.25rem 0;">
                <strong>${escapeHtml(query)}</strong>
            </p>
            <p style="font-size: 0.875rem; color: var(--gray-500, #6b7280); margin-top: 0.75rem;">
                ${hint}
            </p>
        </div>
    `;
    elements.statusBar.style.display = 'flex';
    elements.statusText.textContent = `✅ ${label} available`;
    elements.statusText.style.color = 'var(--success, #10b981)';
    elements.statusTime.textContent = `${queryTime}ms`;
}

// ============================================
// Event Handlers
// ============================================

async function handleQuery() {
    if (state.isLoading) return;
    const query = elements.queryInput.value;
    const type = getQueryType();
    const validation = validateQuery(query, type);
    if (!validation.valid) { displayError(validation.error); return; }
    const options = {
        cache: elements.optionCache.checked,
        redactPII: elements.optionRedact.checked,
        verbose: elements.optionVerbose.checked
    };
    showLoading();
    const result = await performQuery(validation.query, type, options);
    hideLoading();
    if (result.success) {
        if (result.available) {
            displayAvailable(result.query, result.type, result.queryTime);
        } else {
            displayResults(result.data, result.queryTime, type);
        }
        addToHistory(validation.query, type, true);
    } else {
        displayError(result.error, result.quotaExceeded, result.retryAfter);
        addToHistory(validation.query, type, false);
    }
}

function handleCopy() {
    const data = state.currentData;
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
        const orig = elements.copyButton.textContent;
        elements.copyButton.textContent = '✅ Copied!';
        setTimeout(() => elements.copyButton.textContent = orig, 2000);
    });
}

function handleClear() {
    state.currentData = null;
    state.currentType = null;
    elements.resultsContainer.innerHTML = `
        <div class="placeholder">
            <div class="placeholder-icon">🔍</div>
            <p>Enter a query above to see results</p>
            <p class="placeholder-hint">Try: example.com, 8.8.8.8, or AS15169</p>
        </div>
    `;
    elements.statusBar.style.display = 'none';
}

function handleClearHistory() {
    if (confirm('Clear all query history?')) {
        state.queryHistory = [];
        updateHistoryDisplay();
        saveHistoryToLocalStorage();
    }
}

// ============================================
// Event Listeners
// ============================================

elements.queryButton.addEventListener('click', handleQuery);
elements.queryInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleQuery(); });
elements.copyButton.addEventListener('click', handleCopy);
elements.clearButton.addEventListener('click', handleClear);
elements.clearHistoryButton.addEventListener('click', handleClearHistory);
elements.exampleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.queryInput.value = btn.dataset.query;
        document.querySelector(`input[name="queryType"][value="${btn.dataset.type}"]`).checked = true;
    });
});

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadHistoryFromLocalStorage();
    elements.queryInput.focus();
});

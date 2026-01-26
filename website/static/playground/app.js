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

/**
 * Get selected query type
 */
function getQueryType() {
    const selected = document.querySelector('input[name="queryType"]:checked');
    return selected ? selected.value : 'domain';
}

/**
 * Validate query input
 */
function validateQuery(query, type) {
    if (!query || query.trim() === '') {
        return { valid: false, error: 'Query cannot be empty' };
    }

    query = query.trim();

    switch (type) {
        case 'domain':
            // Basic domain validation
            const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            if (!domainRegex.test(query)) {
                return { valid: false, error: 'Invalid domain format' };
            }
            break;

        case 'ip':
            // IPv4 or IPv6 validation
            const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
            const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
            if (!ipv4Regex.test(query) && !ipv6Regex.test(query)) {
                return { valid: false, error: 'Invalid IP address format' };
            }
            break;

        case 'asn':
            // ASN validation (with or without AS prefix)
            const asnRegex = /^(AS)?(\d+)$/i;
            if (!asnRegex.test(query)) {
                return { valid: false, error: 'Invalid ASN format (use AS12345 or 12345)' };
            }
            break;

        default:
            return { valid: false, error: 'Unknown query type' };
    }

    return { valid: true, query };
}

/**
 * Format JSON with syntax highlighting
 */
function formatJSON(obj) {
    const json = JSON.stringify(obj, null, 2);
    return json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
        .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
        .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
        .replace(/: null/g, ': <span class="json-null">null</span>');
}

/**
 * Show loading state
 */
function showLoading() {
    state.isLoading = true;
    elements.queryButton.disabled = true;
    elements.queryButton.querySelector('.btn-text').style.display = 'none';
    elements.queryButton.querySelector('.btn-loader').style.display = 'inline';
}

/**
 * Hide loading state
 */
function hideLoading() {
    state.isLoading = false;
    elements.queryButton.disabled = false;
    elements.queryButton.querySelector('.btn-text').style.display = 'inline';
    elements.queryButton.querySelector('.btn-loader').style.display = 'none';
}

/**
 * Display results
 */
function displayResults(data, queryTime) {
    elements.resultsContainer.innerHTML = `<pre class="fade-in">${formatJSON(data)}</pre>`;
    
    // Show status bar
    elements.statusBar.style.display = 'flex';
    elements.statusText.textContent = '✅ Query successful';
    elements.statusText.style.color = 'var(--success, #10b981)';
    elements.statusTime.textContent = `${queryTime}ms`;
}

/**
 * Update quota display and disable button if quota is exhausted
 */
function updateQuotaDisplay() {
    if (!elements.quotaInfo) return;
    
    if (state.quotaInfo.remainingToday !== null) {
        const resetDate = state.quotaInfo.resetAt ? new Date(state.quotaInfo.resetAt).toLocaleString() : 'Unknown';
        elements.quotaInfo.innerHTML = `
            <span class="quota-remaining">Remaining today: <strong>${state.quotaInfo.remainingToday}</strong></span>
            <span class="quota-reset">Resets at: ${resetDate}</span>
        `;
        elements.quotaInfo.style.display = 'flex';
        
        // Disable query button if quota is exhausted
        if (state.quotaInfo.remainingToday === 0) {
            elements.queryButton.disabled = true;
            elements.queryButton.title = 'Daily limit reached. Install the package to continue.';
        } else {
            elements.queryButton.disabled = false;
            elements.queryButton.title = '';
        }
    }
}

/**
 * Display error with optional retry-after hint
 */
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
    
    // Show status bar
    elements.statusBar.style.display = 'flex';
    elements.statusText.textContent = isQuotaExceeded ? '⚠️ Quota exceeded' : '❌ Query failed';
    elements.statusText.style.color = 'var(--error)';
}

/**
 * Add to history
 */
function addToHistory(query, type, success) {
    const historyItem = {
        query,
        type,
        success,
        timestamp: new Date().toISOString()
    };

    state.queryHistory.unshift(historyItem);
    
    // Keep only last 10 items
    if (state.queryHistory.length > 10) {
        state.queryHistory = state.queryHistory.slice(0, 10);
    }

    updateHistoryDisplay();
    saveHistoryToLocalStorage();
}

/**
 * Update history display
 */
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

    // Add click handlers
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            const historyItem = state.queryHistory[index];
            elements.queryInput.value = historyItem.query;
            document.querySelector(`input[name="queryType"][value="${historyItem.type}"]`).checked = true;
        });
    });
}

/**
 * Save history to localStorage
 */
function saveHistoryToLocalStorage() {
    try {
        localStorage.setItem('rdapify_history', JSON.stringify(state.queryHistory));
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

/**
 * Load history from localStorage
 */
function loadHistoryFromLocalStorage() {
    try {
        const saved = localStorage.getItem('rdapify_history');
        if (saved) {
            state.queryHistory = JSON.parse(saved);
            updateHistoryDisplay();
        }
    } catch (e) {
        console.error('Failed to load history:', e);
    }
}

// ============================================
// API Functions
// ============================================

/**
 * Perform RDAP query via API proxy
 */
async function performQuery(query, type, options = {}) {
    try {
        const response = await fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Id': clientId
            },
            body: JSON.stringify({
                type,
                query,
                options
            })
        });

        const result = await response.json();
        
        // Update quota information if available
        if (result.remainingToday !== undefined) {
            state.quotaInfo.remainingToday = result.remainingToday;
            state.quotaInfo.resetAt = result.resetAt;
            updateQuotaDisplay();
        }

        // Handle quota exceeded (429)
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            return {
                success: false,
                error: result.error || 'Daily quota exceeded',
                quotaExceeded: true,
                retryAfter: retryAfter
            };
        }

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Query failed');
        }

        return {
            success: true,
            data: result.data,
            queryTime: result.queryTime
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Network error - please check your connection'
        };
    }
}

// ============================================
// Event Handlers
// ============================================

/**
 * Handle query submission
 */
async function handleQuery() {
    if (state.isLoading) return;

    const query = elements.queryInput.value;
    const type = getQueryType();

    // Validate query
    const validation = validateQuery(query, type);
    if (!validation.valid) {
        displayError(validation.error);
        return;
    }

    // Get options
    const options = {
        cache: elements.optionCache.checked,
        redactPII: elements.optionRedact.checked,
        verbose: elements.optionVerbose.checked
    };

    // Show loading
    showLoading();

    // Perform query
    const result = await performQuery(validation.query, type, options);

    // Hide loading
    hideLoading();

    // Display results
    if (result.success) {
        displayResults(result.data, result.queryTime);
        addToHistory(validation.query, type, true);
    } else {
        displayError(result.error, result.quotaExceeded, result.retryAfter);
        addToHistory(validation.query, type, false);
    }
}

/**
 * Handle copy to clipboard
 */
function handleCopy() {
    const pre = elements.resultsContainer.querySelector('pre');
    if (!pre) return;

    const text = pre.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = elements.copyButton.textContent;
        elements.copyButton.textContent = '✅ Copied!';
        setTimeout(() => {
            elements.copyButton.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

/**
 * Handle clear results
 */
function handleClear() {
    elements.resultsContainer.innerHTML = `
        <div class="placeholder">
            <div class="placeholder-icon">🔍</div>
            <p>Enter a query above to see results</p>
            <p class="placeholder-hint">Try: example.com, 8.8.8.8, or AS15169</p>
        </div>
    `;
    elements.statusBar.style.display = 'none';
}

/**
 * Handle clear history
 */
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

// Query button
elements.queryButton.addEventListener('click', handleQuery);

// Enter key in input
elements.queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleQuery();
    }
});

// Copy button
elements.copyButton.addEventListener('click', handleCopy);

// Clear button
elements.clearButton.addEventListener('click', handleClear);

// Clear history button
elements.clearHistoryButton.addEventListener('click', handleClearHistory);

// Example buttons
elements.exampleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const query = btn.dataset.query;
        const type = btn.dataset.type;
        
        elements.queryInput.value = query;
        document.querySelector(`input[name="queryType"][value="${type}"]`).checked = true;
    });
});

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 RDAPify Playground initialized');
    
    // Load history from localStorage
    loadHistoryFromLocalStorage();
    
    // Focus input
    elements.queryInput.focus();
});

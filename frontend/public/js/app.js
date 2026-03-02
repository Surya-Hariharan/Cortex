import api from './api.js';
import { renderSearch, destroySearch } from './search.js';
import { renderNotes, destroyNotes } from './notes.js';
import { renderNetwork, destroyNetwork } from './network.js';
import { renderPerformance, destroyPerformance } from './performance.js';

let activeTab = 'search';
let perfPollId = null;

// ── Toast System ─────────────────────────────────────────────────────────────
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const iconSvg = type === 'success'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#991b1b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
        <span style="flex-shrink:0">${iconSvg}</span>
        <span class="toast-msg">${message}</span>
        <button class="toast-close" onclick="this.parentElement.classList.remove('visible');setTimeout(()=>this.parentElement.remove(),300)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 3500);
}

// ── Tab Switching ────────────────────────────────────────────────────────────
const destroyers = { search: destroySearch, notes: destroyNotes, network: destroyNetwork, performance: destroyPerformance };
const renderers = { search: renderSearch, notes: renderNotes, network: renderNetwork, performance: renderPerformance };

function switchTab(tabId) {
    if (activeTab === tabId) return;
    // Destroy current tab
    destroyers[activeTab]?.();
    // Update nav
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    activeTab = tabId;
    const content = document.getElementById('tab-content');
    content.innerHTML = '';
    content.className = 'page-fade';
    renderers[tabId]?.(content, showToast);
}

// ── Header Stats Polling ─────────────────────────────────────────────────────
async function updateStats() {
    try {
        const stats = await api.getStats();
        const docStats = document.getElementById('doc-stats');
        if (stats.documents > 0) {
            docStats.style.display = 'flex';
            document.getElementById('doc-count').textContent = `${stats.documents} docs`;
            document.getElementById('vec-count').textContent = `${stats.embeddings} vectors`;
        } else {
            docStats.style.display = 'none';
        }
    } catch { }
}

async function updateProvider() {
    try {
        const p = await api.getPerfStats();
        const prov = p?.embedder?.provider || 'cpu';
        const badge = document.getElementById('provider-badge');
        const label = document.getElementById('provider-label');
        badge.classList.toggle('dml', prov === 'dml');
        label.textContent = prov === 'dml' ? 'DirectML' : 'ONNX Runtime';
    } catch { }
}

// ── PDF Upload ───────────────────────────────────────────────────────────────
function setupUpload() {
    const btn = document.getElementById('upload-btn');
    const input = document.getElementById('pdf-input');
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        input.value = '';
        try {
            const result = await api.uploadPdf(file);
            if (result?.success) {
                showToast(`Indexed "${result.title}" · ${result.chunks} chunks`);
                updateStats();
            } else if (result?.error) {
                showToast(result.error, 'error');
            }
        } catch (err) {
            showToast('Upload failed: ' + err.message, 'error');
        }
    });
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Tab nav
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    setupUpload();
    updateStats();
    updateProvider();
    perfPollId = setInterval(updateProvider, 4000);

    // Render initial tab
    const content = document.getElementById('tab-content');
    renderers[activeTab]?.(content, showToast);
});

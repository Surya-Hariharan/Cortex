import api from './api.js';

const MOCK_DOCS = [
    { title: 'Quantum Entanglement Notes', from: "Arjun's Laptop", time: '3m ago', subject: 'Quantum Mechanics', ext: 'PDF' },
    { title: 'BST Implementation Guide', from: 'Study Group Hub', time: '8m ago', subject: 'Data Structures', ext: 'PDF' },
    { title: 'Organic Chemistry Lab Report', from: "Priya's Desktop", time: '15m ago', subject: 'Organic Chemistry', ext: 'PDF' },
    { title: 'Network Protocols Summary', from: 'Lab PC – Room 204', time: '22m ago', subject: 'Computer Networks', ext: 'PDF' },
    { title: 'Statistical Inference Cheatsheet', from: 'Study Group Hub', time: '1h ago', subject: 'Prob & Statistics', ext: 'PDF' },
];
const SUBJ = {
    'Quantum Mechanics': { bg: '#fdf4ff', text: '#7e22ce', border: '#f0abfc' },
    'Data Structures': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    'Organic Chemistry': { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
    'Computer Networks': { bg: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
    'Prob & Statistics': { bg: '#eef2ff', text: '#3730a3', border: '#c7d2fe' },
};
const DSUBJ = { bg: '#f8fafc', text: '#334155', border: '#e2e8f0' };

function emoji(name) {
    if (name.includes('Lab')) return '🖥️';
    if (name.includes('Hub')) return '🔗';
    if (name.includes('Library')) return '📚';
    return '💻';
}
function escHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

let container = null, pollId = null, peers = [], selected = null;

export function renderNetwork(el) {
    container = el;
    el.innerHTML = `<div class="network-layout">
        <div class="network-sidebar">
            <div style="padding:12px 16px;border-bottom:1px solid var(--border-subtle);background:var(--surface-card)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
                    <h2 style="font-size:13px;font-weight:700;color:var(--text-primary);letter-spacing:-0.01em">Mesh Network</h2>
                    <span id="online-badge" style="display:flex;align-items:center;gap:4px;padding:1px 8px;font-size:10px;font-weight:600;border-radius:9999px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0"><div class="status-dot status-online" style="width:6px;height:6px"></div>0 online</span>
                </div>
                <p style="font-size:11px;color:var(--text-muted)">Nearby devices on local network</p>
            </div>
            <div id="peer-list" style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:2px"></div>
            <div style="padding:12px;border-top:1px solid var(--border-subtle)">
                <div style="padding:6px 12px;border-radius:8px;text-align:center;background:var(--surface-recessed)"><p style="font-size:10px;font-weight:500;color:var(--text-muted)">🔒 E2E encrypted · UDP port 41234</p></div>
            </div>
        </div>
        <div class="network-content" id="network-right"></div>
    </div>`;

    fetchPeers();
    pollId = setInterval(fetchPeers, 3000);
}

async function fetchPeers() {
    try {
        const r = await api.getPeers();
        if (r?.peers) { peers = r.peers; renderPeers(); }
    } catch { }
}

function renderPeers() {
    const list = container?.querySelector('#peer-list');
    const badge = container?.querySelector('#online-badge');
    if (!list) return;
    const online = peers.filter(p => p.status === 'online').length;
    if (badge) badge.innerHTML = `<div class="status-dot status-online" style="width:6px;height:6px"></div>${online} online`;

    if (peers.length === 0) {
        list.innerHTML = '<div class="animate-fade-in" style="text-align:center;padding:40px 0"><div style="font-size:30px;margin-bottom:8px">📡</div><p style="font-size:11px;color:var(--text-muted)">Scanning…</p></div>';
        renderRight();
        return;
    }
    list.innerHTML = '';
    peers.forEach((peer, idx) => {
        const isSel = selected?.id === peer.id;
        const btn = document.createElement('button');
        btn.className = `peer-row${isSel ? ' selected' : ''} animate-slide-up stagger-${Math.min(idx + 1, 5)}`;
        const statusClass = peer.status === 'online' ? 'status-online' : peer.status === 'idle' ? 'status-idle' : 'status-offline';
        btn.innerHTML = `
            <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;background:var(--surface-card);border:1px solid var(--border-subtle);box-shadow:var(--shadow-sm)">${emoji(peer.name)}</div>
            <div style="min-width:0;flex:1">
                <div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${isSel ? 'var(--accent)' : 'var(--text-primary)'}">${escHtml(peer.name)}</span><div class="status-dot ${statusClass}" style="flex-shrink:0"></div></div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:1px"><span style="font-size:10.5px;color:var(--text-muted)">${peer.docs} docs</span><span style="color:var(--border-medium)">·</span><span style="font-size:10.5px;color:var(--text-muted)">${peer.lastSeen}</span></div>
            </div>`;
        btn.onclick = () => { selected = (selected?.id === peer.id) ? null : peer; renderPeers(); renderRight(); };
        list.appendChild(btn);
    });
    renderRight();
}

function renderRight() {
    const right = container?.querySelector('#network-right');
    if (!right) return;
    if (selected) {
        const statusClass = selected.status === 'online' ? 'status-online' : selected.status === 'idle' ? 'status-idle' : 'status-offline';
        right.innerHTML = `<div style="padding:24px" class="animate-fade-in">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
                <div style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;background:var(--surface-card);border:1px solid var(--border-subtle);box-shadow:var(--shadow-md)">${emoji(selected.name)}</div>
                <div>
                    <h2 style="font-size:16px;font-weight:700;color:var(--text-primary);letter-spacing:-0.015em">${escHtml(selected.name)}</h2>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                        <div class="status-dot ${statusClass}"></div>
                        <span style="font-size:12px;text-transform:capitalize;color:var(--text-secondary)">${selected.status}</span>
                        <span style="color:var(--border-medium)">·</span>
                        <span style="font-size:12px;color:var(--text-muted)">${selected.lastSeen}</span>
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
                ${[{ l: 'Documents', v: selected.docs, i: '📄' }, { l: 'OS', v: selected.os, i: '💻' }, { l: 'IP', v: selected.ip, i: '🌐' }].map(s => `<div class="card-recessed" style="padding:12px"><div style="font-size:14px;margin-bottom:4px">${s.i}</div><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;color:var(--text-muted)">${s.l}</div><div class="metric-mono" style="font-size:13px;font-weight:600;color:var(--text-primary)">${s.v}</div></div>`).join('')}
            </div>
            <button class="btn-primary" style="width:100%;padding:10px;display:flex;align-items:center;justify-content:center;gap:8px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Sync Documents
            </button>
        </div>`;
    } else {
        right.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;min-height:0">
            <div style="padding:14px 20px;border-bottom:1px solid var(--border-subtle);background:var(--surface-card)">
                <h2 style="font-size:13px;font-weight:700;color:var(--text-primary)">Recent Shared Documents</h2>
                <p style="font-size:11px;margin-top:2px;color:var(--text-muted)">From peers on this network</p>
            </div>
            <div style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px" id="shared-docs"></div>
        </div>`;
        const docsEl = right.querySelector('#shared-docs');
        MOCK_DOCS.forEach((doc, idx) => {
            const c = SUBJ[doc.subject] || DSUBJ;
            const card = document.createElement('div');
            card.className = `result-card animate-slide-up stagger-${Math.min(idx + 1, 5)}`;
            card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px';
            card.innerHTML = `
                <div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--accent-light);border:1px solid var(--accent-border)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color:var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div style="min-width:0;flex:1">
                    <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary);letter-spacing:-0.01em">${escHtml(doc.title)}</div>
                    <div style="display:flex;align-items:center;gap:6px;margin-top:2px"><span style="font-size:10.5px;color:var(--text-muted)">from ${escHtml(doc.from)}</span><span style="color:var(--border-medium)">·</span><span style="font-size:10.5px;color:var(--text-muted)">${doc.time}</span></div>
                </div>
                <span style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid ${c.border};background:${c.bg};color:${c.text};font-weight:600;flex-shrink:0">${doc.subject}</span>`;
            docsEl.appendChild(card);
        });
    }
}

export function destroyNetwork() { if (pollId) { clearInterval(pollId); pollId = null; } container = null; peers = []; selected = null; }

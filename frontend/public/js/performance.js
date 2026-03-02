import api from './api.js';

const CLOUD_MS = 847, CPU_MS = 41;
let container = null, pollId = null;

export function renderPerformance(el) {
    container = el;
    el.innerHTML = '<div class="perf-layout" id="perf-root"><div style="text-align:center;padding:48px;color:var(--text-muted)">Loading performance data…</div></div>';
    fetchAndRender();
    pollId = setInterval(fetchAndRender, 2000);
}

async function fetchAndRender() {
    let perf = null;
    try { perf = await api.getPerfStats(); } catch { }
    render(perf);
}

function render(perf) {
    const root = container?.querySelector('#perf-root') || container;
    if (!root) return;

    const avg = perf?.embedder?.avgEmbedTimeMs ?? perf?.avgEmbedTimeMs ?? 0;
    const last = perf?.embedder?.lastEmbedTimeMs ?? perf?.lastEmbedTimeMs ?? 0;
    const hist = perf?.embedder?.embedHistory ?? perf?.embedHistory ?? [];
    const prov = perf?.embedder?.provider ?? perf?.provider ?? 'cpu';
    const speedup = avg > 0 ? (CPU_MS / avg).toFixed(1) : '—';
    const activeMs = avg > 0 ? avg : CPU_MS;
    const maxMs = CLOUD_MS + 80;
    const count = hist.length;

    root.innerHTML = `
    <!-- Header -->
    <div class="card" style="padding:10px 18px;border-left:3px solid var(--accent);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
            <div style="width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:linear-gradient(135deg,#6366f1 0%,#4338ca 100%);box-shadow:0 2px 8px rgba(99,102,241,0.35)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
                <h2 style="font-size:14px;font-weight:700;color:var(--text-primary);letter-spacing:-0.015em">On-Device AI Performance</h2>
                <p style="font-size:11px;margin-top:2px;color:var(--text-muted)">ONNX Runtime · BGE-small-en-v1.5 · 384-dim embeddings</p>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
            <span style="display:flex;align-items:center;gap:6px;padding:4px 10px;font-size:10.5px;font-weight:600;border-radius:9999px;${prov === 'dml' ? 'background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7' : 'background:var(--accent-light);color:var(--accent);border:1px solid var(--accent-border)'}">
                <div style="width:5px;height:5px;border-radius:50%;background:${prov === 'dml' ? '#10b981' : 'var(--accent)'}"></div>
                ${prov === 'dml' ? 'DirectML Active' : 'ONNX Optimized'}
            </span>
            <span style="display:flex;align-items:center;gap:6px;padding:4px 10px;font-size:10.5px;font-weight:600;border-radius:9999px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0">🔒 Offline</span>
        </div>
    </div>

    <!-- 3-column grid -->
    <div class="perf-grid">
        <!-- LEFT -->
        <div class="perf-col">
            ${renderLatency(activeMs, maxMs, avg, speedup, last)}
            ${renderCompact('⚡', 'Avg Embed Time', avg > 0 ? `${avg}ms` : '—', avg > 0 ? 'per query · live' : 'run a search', true)}
            ${renderCompact('🚀', 'Speedup', avg > 0 ? `${speedup}×` : '—', 'vs CPU baseline', false)}
            ${renderCompact('🔁', 'Searches Run', count || '0', 'this session', false)}
            <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;background:var(--surface-recessed);border:1px solid var(--border-subtle)">
                <span style="font-size:16px">📦</span>
                <div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-muted)">Model on disk</div><div class="metric-mono" style="font-size:18px;font-weight:700;line-height:1.2;color:var(--text-primary)">22 MB</div></div>
                <div style="text-align:right"><div style="font-size:10px;color:var(--text-muted)">BGE-small-en-v1.5</div><div style="font-size:10px;color:var(--text-muted)">384-dim, ONNX fp32</div></div>
            </div>
        </div>
        <!-- CENTER -->
        <div style="display:flex;flex-direction:column;min-height:0;overflow:hidden">
            <div class="card" style="padding:14px 16px;height:130px;min-height:0;overflow:hidden;display:flex;flex-direction:column">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                    <div><h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-secondary)">Embed Time History</h3><p style="font-size:10.5px;margin-top:2px;color:var(--text-muted)">Per-query inference latency this session</p></div>
                    <span style="font-size:10px;color:var(--text-muted)">${hist.length > 0 ? `${hist.length} queries` : 'awaiting data'}</span>
                </div>
                <div style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column">${renderSparkline(hist)}</div>
                ${hist.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-subtle)">${[{ l: 'Min', v: `${Math.min(...hist)}ms` }, { l: 'Average', v: `${avg}ms`, a: true }, { l: 'Max', v: `${Math.max(...hist)}ms` }].map(s => `<div style="text-align:center"><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-muted)">${s.l}</div><div class="metric-mono" style="font-size:15px;font-weight:700;margin-top:2px;color:${s.a ? 'var(--accent)' : 'var(--text-primary)'}">${s.v}</div></div>`).join('')}</div>` : ''}
            </div>
        </div>
        <!-- RIGHT -->
        <div class="perf-col">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:2px;color:var(--text-muted)">System Context</div>
            ${renderInfo('🧠', 'Embedding Model', 'BGE-small-en-v1.5', '384 dimensions · multilingual capable')}
            ${renderInfo('🔍', 'Vector Search', 'Cosine Similarity', 'Brute-force · <1ms for ≤1k docs')}
            <div style="height:1px;background:var(--border-subtle)"></div>
            <div class="card" style="padding:16px;border-left:3px solid #10b981">
                <div style="display:flex;align-items:flex-start;gap:10px">
                    <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:#f0fdf4;border:1px solid #bbf7d0">🔒</div>
                    <div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px;color:#166534">Data Privacy</div><p style="font-size:11.5px;line-height:1.6;color:var(--text-secondary)">All inference runs <span style="font-weight:600;color:var(--text-primary)">locally</span>. No queries, documents, or embeddings leave this device.</p></div>
                </div>
            </div>
            ${perf?.llm ? renderLlm(perf.llm) : ''}
        </div>
    </div>`;
}

function renderLatency(activeMs, maxMs, avg, speedup, last) {
    const bars = [
        { label: 'Cloud API', ms: CLOUD_MS, grad: 'linear-gradient(90deg,#fca5a5,#ef4444)', badge: { label: 'Requires internet', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' } },
        { label: 'CPU Baseline', ms: CPU_MS, grad: 'linear-gradient(90deg,#fde68a,#f59e0b)', badge: { label: 'Unoptimized', bg: '#fffbeb', color: '#92400e', border: '#fde68a' } },
        { label: 'Cortex ONNX', ms: activeMs, grad: 'linear-gradient(90deg,#a5b4fc,#6366f1)', badge: avg > 0 ? { label: 'Live', bg: 'var(--accent-light)', color: 'var(--accent)', border: 'var(--accent-border)' } : { label: 'Est.', bg: 'var(--surface-recessed)', color: 'var(--text-muted)', border: 'var(--border-medium)' } },
    ];
    return `<div class="card" style="padding:14px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px"><h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-secondary)">Inference Latency</h3><span style="font-size:10px;color:var(--text-muted)">lower is better ↓</span></div>
        <div style="display:flex;flex-direction:column;gap:16px">
            ${bars.map(b => `<div style="display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0"><span style="font-size:12px;font-weight:500;color:var(--text-secondary)">${b.label}</span><span style="flex-shrink:0;padding:1px 6px;font-size:9px;font-weight:700;border-radius:4px;border:1px solid ${b.badge.border};text-transform:uppercase;letter-spacing:0.06em;background:${b.badge.bg};color:${b.badge.color}">${b.badge.label}</span></div>
                    <span class="metric-mono" style="flex-shrink:0;font-size:12px;font-weight:600;color:var(--text-primary)">${b.ms}ms</span>
                </div>
                <div style="height:8px;border-radius:9999px;overflow:hidden;background:var(--surface-recessed)"><div class="perf-bar" style="height:100%;border-radius:9999px;width:${Math.min(Math.round(b.ms / maxMs * 100), 100)}%;background:${b.grad}"></div></div>
            </div>`).join('')}
        </div>
        ${avg > 0 ? `<div style="margin-top:16px;padding:10px 14px;border-radius:8px;background:var(--accent-muted);border:1px solid var(--accent-border);display:flex;align-items:center;justify-content:space-between"><span style="font-size:12px;font-weight:700;color:#3730a3">${speedup}× faster than CPU</span><span class="metric-mono" style="font-size:11.5px;font-weight:700;color:var(--accent)">${last}ms last</span></div>` : `<p style="font-size:10.5px;margin-top:12px;color:var(--text-muted)">Run a search to measure live latency.</p>`}
    </div>`;
}

function renderCompact(icon, label, value, sub, accent) {
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:12px;background:${accent ? 'var(--accent-light)' : 'var(--surface-recessed)'};border:1px solid ${accent ? 'var(--accent-border)' : 'var(--border-subtle)'}">
        <div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:${accent ? 'white' : 'var(--surface-card)'};border:1px solid var(--border-subtle)">${icon}</div>
        <div style="min-width:0;flex:1"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${accent ? 'var(--accent)' : 'var(--text-muted)'}">${label}</div><div class="metric-mono" style="font-size:18px;font-weight:700;line-height:1.2;margin-top:2px;color:${accent ? 'var(--accent)' : 'var(--text-primary)'}">${value}</div>${sub ? `<div style="font-size:10px;margin-top:2px;color:${accent ? '#818cf8' : 'var(--text-muted)'}">${sub}</div>` : ''}</div>
    </div>`;
}

function renderInfo(icon, label, value, detail) {
    return `<div class="card" style="padding:10px 16px"><div style="display:flex;align-items:flex-start;gap:10px"><div style="font-size:16px;margin-top:2px;flex-shrink:0">${icon}</div><div style="min-width:0"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px;color:var(--text-muted)">${label}</div><div style="font-size:12.5px;font-weight:600;color:var(--text-primary);letter-spacing:-0.01em">${value}</div><div style="font-size:11px;margin-top:2px;color:var(--text-muted)">${detail}</div></div></div></div>`;
}

function renderSparkline(hist) {
    if (hist.length < 2) {
        return `<div class="shimmer-bg" style="flex:1;min-height:0;border-radius:8px;border:1px solid var(--border-subtle);overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <p style="font-size:11px;font-weight:500;color:var(--text-muted)">Run a search to populate history</p>
        </div>`;
    }
    const max = Math.max(...hist, 1), H = 100;
    const pts = hist.map((v, i) => { const x = (i / (hist.length - 1)) * 100; const y = H - (v / max) * (H - 12) - 6; return `${x},${y}`; }).join(' ');
    const lastY = H - (hist[hist.length - 1] / max) * (H - 12) - 6;
    return `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="flex:1;min-height:0;width:100%;display:block;overflow:hidden">
        <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity="0.20"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0"/></linearGradient></defs>
        <polygon points="0,${H} ${pts} 100,${H}" fill="url(#spk)"/>
        <polyline points="${pts}" fill="none" stroke="#6366f1" stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <circle cx="100" cy="${lastY}" r="2.5" fill="#6366f1" stroke="white" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

function renderLlm(llm) {
    return `<div style="font-size:10px;margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:2px;color:var(--text-muted)">Generative RAG Engine</div>
    <div class="card" style="padding:14px 16px;border-left:3px solid var(--accent);display:flex;flex-direction:column;gap:10px">
        <div><span style="font-size:11px;font-weight:600;color:var(--text-muted)">Model</span><br><span style="font-size:11.5px;font-weight:700;color:var(--text-primary)">Phi-3.5-mini ONNX</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;font-weight:600;color:var(--text-muted)">Status</span><span style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:${llm.ready ? '#10b981' : 'var(--text-muted)'}">${llm.ready ? 'Loaded' : 'Pending First Run'}</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;font-weight:600;color:var(--text-muted)">TTFT</span><span class="metric-mono" style="font-size:12px;font-weight:700;color:var(--accent)">${llm.lastStats?.ttft || 0}ms</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;font-weight:600;color:var(--text-muted)">Speed</span><span class="metric-mono" style="font-size:12px;font-weight:700;color:var(--accent)">${llm.lastStats?.tokensPerSec || 0} t/s</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;font-weight:600;color:var(--text-muted)">Total</span><span class="metric-mono" style="font-size:12px;font-weight:700;color:var(--accent)">${llm.lastStats?.totalTime || 0}ms</span></div>
    </div>`;
}

export function destroyPerformance() { if (pollId) { clearInterval(pollId); pollId = null; } container = null; }

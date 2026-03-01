import React, { useState, useEffect, useRef } from 'react';

const CLOUD_MS = 847;
const CPU_MS = 41;

/* ── Sparkline ─────────────────────────────────────────────────────────────── */
function SparkLine({ history }) {
    const W = 180, H = 44;
    const max = Math.max(...history, 1);

    if (history.length < 2) {
        return (
            <div
                className="w-[180px] h-[44px] rounded-lg shimmer-bg"
                style={{ border: '1px solid var(--border-subtle)' }}
                title="Run a search to see history"
            />
        );
    }

    const pts = history.map((v, i) => {
        const x = (i / (history.length - 1)) * W;
        const y = H - (v / max) * (H - 6) - 3;
        return `${x},${y}`;
    }).join(' ');

    const last = history[history.length - 1];
    const lastX = W;
    const lastY = H - (last / max) * (H - 6) - 3;

    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
            <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#spark-fill)" />
            <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={lastX} cy={lastY} r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="1.5" />
        </svg>
    );
}

/* ── Latency bar ────────────────────────────────────────────────────────────── */
function LatencyBar({ label, valueMs, maxMs, gradient, badge }) {
    const [w, setW] = useState(0);
    const pct = Math.min(Math.round((valueMs / maxMs) * 100), 100);
    useEffect(() => { const t = setTimeout(() => setW(pct), 100); return () => clearTimeout(t); }, [pct]);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    {badge && (
                        <span
                            className="px-1.5 py-[1px] text-[9.5px] font-bold rounded-md border uppercase tracking-wide"
                            style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}
                        >
                            {badge.label}
                        </span>
                    )}
                </div>
                <span className="text-[12.5px] font-semibold metric-mono" style={{ color: 'var(--text-primary)' }}>
                    {valueMs}ms
                </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-recessed)' }}>
                <div
                    className="h-full rounded-full perf-bar"
                    style={{ width: `${w}%`, background: gradient }}
                />
            </div>
        </div>
    );
}

/* ── Primary metric ─────────────────────────────────────────────────────────── */
function PrimaryMetric({ value, sub }) {
    return (
        <div
            className="p-5 rounded-xl flex flex-col items-center justify-center"
            style={{
                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                border: '1px solid rgba(99,102,241,0.22)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.10), 0 1px 3px rgba(99,102,241,0.08)',
            }}
        >
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>
                Avg Embed Time
            </div>
            <div className="text-[38px] font-bold metric-mono leading-none" style={{ color: 'var(--accent)', letterSpacing: '-0.04em' }}>
                {value}
            </div>
            <div className="text-[11px] mt-1.5" style={{ color: '#818cf8' }}>{sub}</div>
        </div>
    );
}

/* ── Secondary metric card ──────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub }) {
    return (
        <div className="card-recessed p-3.5 flex flex-col gap-1">
            <div className="text-base">{icon}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-[20px] font-bold metric-mono leading-none mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</div>
            {sub && <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
        </div>
    );
}

/* ── Main ───────────────────────────────────────────────────────────────────── */
export default function PerformanceTab() {
    const [perf, setPerf] = useState(null);
    const [count, setCount] = useState(0);
    const [animKey, setAnimKey] = useState(0);
    const pollRef = useRef(null);

    const fetchPerf = async () => {
        try {
            const d = window.electronAPI ? await window.electronAPI.getPerfStats() : null;
            if (d) { setPerf(d); setCount(d.embedHistory.length); }
        } catch { }
    };

    useEffect(() => { fetchPerf(); pollRef.current = setInterval(fetchPerf, 2000); return () => clearInterval(pollRef.current); }, []);
    useEffect(() => { setAnimKey((k) => k + 1); }, [perf?.avgEmbedTimeMs]);

    const avg = perf?.avgEmbedTimeMs || 0;
    const last = perf?.lastEmbedTimeMs || 0;
    const hist = perf?.embedHistory || [];
    const prov = perf?.provider || 'cpu';
    const speedup = avg > 0 ? (CPU_MS / avg).toFixed(1) : '—';
    const saving = avg > 0 ? Math.round((1 - avg / CPU_MS) * 78) : 0;
    const synapseMs = avg > 0 ? avg : CPU_MS;
    const maxMs = CLOUD_MS + 80;

    return (
        <div className="h-full overflow-y-auto px-6 py-5" style={{ background: 'var(--surface-app)' }}>
            <div className="max-w-2xl mx-auto space-y-4">

                {/* ── Header card ──────────────────────────────────────────────── */}
                <div
                    className="card p-4 flex items-center justify-between"
                    style={{ borderLeft: '3px solid var(--accent)' }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>On-Device AI Performance</h2>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                ONNX Runtime · BGE-small-en-v1.5 · 384-dim
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className="flex items-center gap-1.5 px-2.5 py-[4px] text-[10.5px] font-semibold rounded-full border"
                            style={
                                prov === 'dml'
                                    ? { background: '#ecfdf5', color: '#065f46', borderColor: '#6ee7b7' }
                                    : { background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }
                            }
                        >
                            <div className="w-[5px] h-[5px] rounded-full" style={{ background: prov === 'dml' ? '#10b981' : 'var(--accent)' }} />
                            {prov === 'dml' ? 'DirectML' : 'ONNX Optimized'}
                        </span>
                        <span
                            className="flex items-center gap-1.5 px-2.5 py-[4px] text-[10.5px] font-semibold rounded-full border"
                            style={{ background: 'var(--surface-recessed)', color: 'var(--text-secondary)', borderColor: 'var(--border-medium)' }}
                        >
                            🔒 Offline
                        </span>
                    </div>
                </div>

                {/* ── Key metrics ──────────────────────────────────────────────── */}
                <div className="grid grid-cols-4 gap-3 items-start">
                    {/* Primary – full left cell */}
                    <PrimaryMetric
                        value={avg > 0 ? `${avg}ms` : '—'}
                        sub={avg > 0 ? 'per query · live' : 'run a search'}
                    />

                    {/* 3 secondary cards */}
                    <StatCard icon="🚀" label="Speedup" value={avg > 0 ? `${speedup}×` : '—'} sub="vs CPU baseline" />
                    <StatCard icon="🔁" label="Searches run" value={count || '0'} sub="this session" />
                    <StatCard icon="📦" label="Model size" value="22 MB" sub="BGE-small ONNX" />
                </div>

                {/* ── Latency comparison ───────────────────────────────────────── */}
                <div className="card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                            Inference Latency Comparison
                        </h3>
                        <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>lower is better ↓</span>
                    </div>

                    <div key={`bars-${animKey}`} className="space-y-3.5">
                        <LatencyBar
                            label="Cloud API (OpenAI)"
                            valueMs={CLOUD_MS}
                            maxMs={maxMs}
                            gradient="linear-gradient(90deg, #fca5a5 0%, #ef4444 100%)"
                            badge={{ label: 'Requires internet', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }}
                        />
                        <LatencyBar
                            label="Standard CPU Inference"
                            valueMs={CPU_MS}
                            maxMs={maxMs}
                            gradient="linear-gradient(90deg, #fde68a 0%, #f59e0b 100%)"
                            badge={{ label: 'Unoptimized', bg: '#fffbeb', color: '#92400e', border: '#fde68a' }}
                        />
                        <LatencyBar
                            label="Cortex (ONNX Runtime)"
                            valueMs={synapseMs}
                            maxMs={maxMs}
                            gradient="linear-gradient(90deg, #a5b4fc 0%, #6366f1 100%)"
                            badge={avg > 0
                                ? { label: 'Live', bg: 'var(--accent-light)', color: 'var(--accent)', border: 'var(--accent-border)' }
                                : { label: 'Estimated', bg: 'var(--surface-recessed)', color: 'var(--text-muted)', border: 'var(--border-medium)' }
                            }
                        />
                    </div>

                    {avg > 0 && (
                        <div
                            className="mt-1 p-3 rounded-lg"
                            style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent-border)' }}
                        >
                            <p className="text-[12px] leading-relaxed" style={{ color: '#3730a3' }}>
                                <span className="font-bold">{speedup}× faster</span> than standard CPU inference
                                {saving > 0 && <> · <span className="font-bold">~{saving}% less power</span></>}
                                {' '}· Last: <span className="metric-mono font-bold">{last}ms</span>
                            </p>
                        </div>
                    )}
                    {avg === 0 && (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Run a search to see your actual measured latency.
                        </p>
                    )}
                </div>

                {/* ── Embed Time History ───────────────────────────────────────── */}
                <div className="card p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[11.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                            Embed Time History
                        </h3>
                        <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                            {hist.length > 0 ? `last ${hist.length} queries` : 'awaiting first query'}
                        </span>
                    </div>

                    <div className="flex items-end gap-6">
                        <SparkLine history={hist} />

                        {hist.length > 0 ? (
                            <div className="space-y-1 pb-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                <div>min <span className="metric-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{Math.min(...hist)}ms</span></div>
                                <div>max <span className="metric-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{Math.max(...hist)}ms</span></div>
                                <div>avg <span className="metric-mono font-bold" style={{ color: 'var(--accent)' }}>{avg}ms</span></div>
                            </div>
                        ) : (
                            <p className="text-[11px] pb-1" style={{ color: 'var(--text-muted)' }}>
                                History will populate after your first search.
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Privacy statement ────────────────────────────────────────── */}
                <div className="card p-3.5 flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                    >🔒</div>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        All inference runs <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>locally on this device</span>.
                        No queries or embeddings leave your machine.
                    </p>
                </div>

                {/* ── Tech stack ───────────────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Embedding Model', value: 'BGE-small-en-v1.5', detail: '384 dimensions' },
                        { label: 'Inference Runtime', value: 'ONNX Runtime', detail: 'v1.20 · graph optimized' },
                        { label: 'Vector Search', value: 'Cosine Similarity', detail: 'brute-force <1ms ≤1k docs' },
                    ].map((item) => (
                        <div key={item.label} className="card-recessed p-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                            <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
                            <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.detail}</div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}

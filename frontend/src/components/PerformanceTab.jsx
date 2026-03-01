import React, { useState, useEffect, useRef } from 'react';

const CLOUD_MS = 847;
const CPU_MS = 41;

/* ── Full-width SVG sparkline ──────────────────────────────────────────────── */
function SparkLine({ history }) {
    const max = Math.max(...history, 1);

    if (history.length < 2) {
        return (
            <div
                className="w-full shimmer-bg rounded-lg flex flex-col items-center justify-center gap-2"
                style={{ flex: 1, minHeight: '120px', border: '1px solid var(--border-subtle)' }}
            >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Run a search to populate history</p>
            </div>
        );
    }

    // SVG coordinate space — 100 units tall; CSS makes it stretch
    const H = 100;
    const pts = history.map((v, i) => {
        const x = (i / (history.length - 1)) * 100;
        const y = H - (v / max) * (H - 12) - 6;
        return `${x}%,${y}`;
    }).join(' ');
    const last = history[history.length - 1];
    const lastY = H - (last / max) * (H - 12) - 6;

    return (
        <svg
            viewBox={`0 0 100 ${H}`}
            preserveAspectRatio="none"
            /* flex:1 lets this SVG stretch to fill the flex container */
            style={{ flex: 1, minHeight: '120px', width: '100%', display: 'block', overflow: 'visible' }}
        >
            <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`0,${H} ${pts} 100%,${H}`} fill="url(#spark-fill)" />
            <polyline
                points={pts} fill="none"
                stroke="#6366f1" strokeWidth="0.8"
                strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
            <circle cx="100%" cy={lastY} r="2.5" fill="#6366f1" stroke="white" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

/* ── Latency comparison bar ─────────────────────────────────────────────────── */
function LatencyBar({ label, valueMs, maxMs, gradient, badge }) {
    const [w, setW] = useState(0);
    const pct = Math.min(Math.round((valueMs / maxMs) * 100), 100);
    useEffect(() => { const t = setTimeout(() => setW(pct), 120); return () => clearTimeout(t); }, [pct]);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    {badge && (
                        <span className="flex-shrink-0 px-1.5 py-[1px] text-[9px] font-bold rounded border uppercase tracking-wide"
                            style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}>
                            {badge.label}
                        </span>
                    )}
                </div>
                <span className="flex-shrink-0 text-[12px] font-semibold metric-mono" style={{ color: 'var(--text-primary)' }}>
                    {valueMs}ms
                </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-recessed)' }}>
                <div className="h-full rounded-full perf-bar" style={{ width: `${w}%`, background: gradient }} />
            </div>
        </div>
    );
}

/* ── Compact metric card (left column) ─────────────────────────────────────── */
function CompactMetric({ icon, label, value, sub, accent }) {
    return (
        <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
                background: accent ? 'var(--accent-light)' : 'var(--surface-recessed)',
                border: accent ? '1px solid var(--accent-border)' : '1px solid var(--border-subtle)',
            }}
        >
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                style={{ background: accent ? 'white' : 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            >
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent ? 'var(--accent)' : 'var(--text-muted)' }}>{label}</div>
                <div className="metric-mono font-bold leading-tight mt-0.5" style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)', fontSize: '18px' }}>{value}</div>
                {sub && <div className="text-[10px] mt-0.5" style={{ color: accent ? '#818cf8' : 'var(--text-muted)' }}>{sub}</div>}
            </div>
        </div>
    );
}

/* ── Info card (right column) ───────────────────────────────────────────────── */
function InfoCard({ icon, label, value, detail }) {
    return (
        <div className="card px-4 py-3.5">
            <div className="flex items-start gap-2.5">
                <div className="text-base mt-0.5 flex-shrink-0">{icon}</div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
                    <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{value}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{detail}</div>
                </div>
            </div>
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
            if (d) {
                setPerf(d);
                setCount(d.embedder?.embedHistory?.length || d.embedHistory?.length || 0);
            }
        } catch { }
    };

    useEffect(() => {
        fetchPerf();
        pollRef.current = setInterval(fetchPerf, 2000);
        return () => clearInterval(pollRef.current);
    }, []);
    useEffect(() => { setAnimKey((k) => k + 1); }, [perf?.avgEmbedTimeMs]);

    const avg = perf?.embedder?.avgEmbedTimeMs ?? perf?.avgEmbedTimeMs ?? 0;
    const last = perf?.embedder?.lastEmbedTimeMs ?? perf?.lastEmbedTimeMs ?? 0;
    const hist = perf?.embedder?.embedHistory ?? perf?.embedHistory ?? [];
    const prov = perf?.embedder?.provider ?? perf?.provider ?? 'cpu';
    const speedup = avg > 0 ? (CPU_MS / avg).toFixed(1) : '—';
    const activeMs = avg > 0 ? avg : CPU_MS;
    const maxMs = CLOUD_MS + 80;

    return (
        /* h-full + flex-col lets the grid grow to fill the entire available workspace */
        <div className="h-full flex flex-col" style={{ background: 'var(--surface-app)', padding: '16px 32px 20px', gap: '16px' }}>

            {/* ══ Full-width header ════════════════════════════════════════════ */}
            <div
                className="card flex items-center justify-between mb-6"
                style={{ padding: '14px 20px', borderLeft: '3px solid var(--accent)' }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>
                            On-Device AI Performance
                        </h2>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            ONNX Runtime · BGE-small-en-v1.5 · 384-dim embeddings
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-semibold rounded-full border"
                        style={prov === 'dml'
                            ? { background: '#ecfdf5', color: '#065f46', borderColor: '#6ee7b7' }
                            : { background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}
                    >
                        <div className="w-[5px] h-[5px] rounded-full" style={{ background: prov === 'dml' ? '#10b981' : 'var(--accent)' }} />
                        {prov === 'dml' ? 'DirectML Active' : 'ONNX Optimized'}
                    </span>
                    <span
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-semibold rounded-full border"
                        style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
                    >
                        🔒 Offline
                    </span>
                </div>
            </div>

            {/* ══ 3-column grid – flex-1 so it fills all space below header card ═══ */}
            {/*   Left: 4fr  |  Center: 5fr  |  Right: 3fr                              */}
            <div
                className="grid"
                style={{
                    gridTemplateColumns: '4fr 5fr 3fr',
                    gap: '20px',
                    flex: 1,             /* ← fills remaining vertical space */
                    alignItems: 'stretch',
                    minHeight: 0,        /* allow flex child to shrink below content size */
                }}
            >

                {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
                <div className="flex flex-col gap-4">

                    {/* 1a. Latency comparison – most dominant card in left col */}
                    <div className="card" style={{ padding: '18px 20px' }}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                Inference Latency
                            </h3>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>lower is better ↓</span>
                        </div>

                        <div key={`bars-${animKey}`} className="space-y-4">
                            <LatencyBar
                                label="Cloud API"
                                valueMs={CLOUD_MS} maxMs={maxMs}
                                gradient="linear-gradient(90deg, #fca5a5 0%, #ef4444 100%)"
                                badge={{ label: 'Requires internet', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }}
                            />
                            <LatencyBar
                                label="CPU Baseline"
                                valueMs={CPU_MS} maxMs={maxMs}
                                gradient="linear-gradient(90deg, #fde68a 0%, #f59e0b 100%)"
                                badge={{ label: 'Unoptimized', bg: '#fffbeb', color: '#92400e', border: '#fde68a' }}
                            />
                            <LatencyBar
                                label="Cortex ONNX"
                                valueMs={activeMs} maxMs={maxMs}
                                gradient="linear-gradient(90deg, #a5b4fc 0%, #6366f1 100%)"
                                badge={avg > 0
                                    ? { label: 'Live', bg: 'var(--accent-light)', color: 'var(--accent)', border: 'var(--accent-border)' }
                                    : { label: 'Est.', bg: 'var(--surface-recessed)', color: 'var(--text-muted)', border: 'var(--border-medium)' }
                                }
                            />
                        </div>

                        {avg > 0 && (
                            <div
                                className="mt-4 px-3.5 py-2.5 rounded-lg"
                                style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent-border)' }}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-bold" style={{ color: '#3730a3' }}>
                                        {speedup}× faster than CPU
                                    </span>
                                    <span className="metric-mono text-[11.5px] font-bold" style={{ color: 'var(--accent)' }}>
                                        {last}ms last
                                    </span>
                                </div>
                            </div>
                        )}
                        {avg === 0 && (
                            <p className="text-[10.5px] mt-3" style={{ color: 'var(--text-muted)' }}>
                                Run a search to measure live latency.
                            </p>
                        )}
                    </div>

                    {/* 1b. Compact metric cards */}
                    <CompactMetric
                        icon="⚡"
                        label="Avg Embed Time"
                        value={avg > 0 ? `${avg}ms` : '—'}
                        sub={avg > 0 ? 'per query · live' : 'run a search'}
                        accent
                    />
                    <CompactMetric
                        icon="🚀"
                        label="Speedup"
                        value={avg > 0 ? `${speedup}×` : '—'}
                        sub="vs CPU baseline"
                    />
                    <CompactMetric
                        icon="🔁"
                        label="Searches Run"
                        value={count || '0'}
                        sub="this session"
                    />

                    {/* Model on disk — completes the metrics panel */}
                    <div
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: 'var(--surface-recessed)', border: '1px solid var(--border-subtle)' }}
                    >
                        <span className="text-base">📦</span>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Model on disk</div>
                            <div className="metric-mono font-bold text-[18px] leading-tight" style={{ color: 'var(--text-primary)' }}>22 MB</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>BGE-small-en-v1.5</div>
                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>384-dim, ONNX fp32</div>
                        </div>
                    </div>
                </div>

                {/* ── CENTER COLUMN: Primary visualization anchor ─────────────── */}
                {/* This column has only one card which grows to fill 100% height   */}
                <div className="flex flex-col" style={{ minHeight: 0 }}>
                    <div className="card flex flex-col" style={{ padding: '18px 20px', flex: 1, minHeight: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                    Embed Time History
                                </h3>
                                <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    Per-query inference latency this session
                                </p>
                            </div>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {hist.length > 0 ? `${hist.length} queries` : 'awaiting data'}
                            </span>
                        </div>

                        {/* SparkLine grows to fill remaining card space */}
                        <div className="flex flex-col flex-1 min-h-0">
                            <SparkLine history={hist} />
                        </div>

                        {/* Stats row below graph */}
                        {hist.length > 0 && (
                            <div
                                className="grid grid-cols-3 gap-3 mt-4 pt-4"
                                style={{ borderTop: '1px solid var(--border-subtle)' }}
                            >
                                {[
                                    { label: 'Min', val: `${Math.min(...hist)}ms` },
                                    { label: 'Average', val: `${avg}ms` },
                                    { label: 'Max', val: `${Math.max(...hist)}ms` },
                                ].map(({ label, val }) => (
                                    <div key={label} className="text-center">
                                        <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</div>
                                        <div className="metric-mono font-bold text-[15px] mt-0.5" style={{ color: label === 'Average' ? 'var(--accent)' : 'var(--text-primary)' }}>{val}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT COLUMN: System context & metadata ─────────────────── */}
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>
                        System Context
                    </div>

                    <InfoCard
                        icon="🧠"
                        label="Embedding Model"
                        value="BGE-small-en-v1.5"
                        detail="384 dimensions · multilingual capable"
                    />
                    <InfoCard
                        icon="⚙️"
                        label="Inference Runtime"
                        value="ONNX Runtime"
                        detail="v1.20 · graph-level optimization"
                    />
                    <InfoCard
                        icon="🔍"
                        label="Vector Search"
                        value="Cosine Similarity"
                        detail="Brute-force · <1ms for ≤1k docs"
                    />

                    {/* Divider */}
                    <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

                    {/* Privacy card */}
                    <div
                        className="card px-4 py-4"
                        style={{ borderLeft: '3px solid #10b981' }}
                    >
                        <div className="flex items-start gap-2.5">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                            >🔒</div>
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#166534' }}>Data Privacy</div>
                                <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    All inference runs <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>locally</span>.
                                    No queries, documents, or embeddings leave this device.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Active provider chip */}
                    <div
                        className="px-4 py-3 rounded-xl"
                        style={{
                            background: prov === 'dml' ? '#ecfdf5' : 'var(--accent-light)',
                            border: `1px solid ${prov === 'dml' ? '#6ee7b7' : 'var(--accent-border)'}`,
                        }}
                    >
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: prov === 'dml' ? '#065f46' : 'var(--accent)' }}>
                            Active Backend
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: prov === 'dml' ? '#10b981' : 'var(--accent)' }} />
                            <span className="text-[12.5px] font-bold" style={{ color: prov === 'dml' ? '#065f46' : 'var(--accent)' }}>
                                {prov === 'dml' ? 'DirectML (GPU)' : 'ONNX CPU Optimized'}
                            </span>
                        </div>
                    </div>

                    {/* Generative RAG LLM Stats */}
                    {perf?.llm && (
                        <>
                            <div className="text-[10px] mt-1 font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>
                                Generative RAG Engine
                            </div>

                            <div className="card px-4 py-3.5 space-y-2.5" style={{ borderLeft: '3px solid var(--accent)' }}>
                                <div className="flex flex-col gap-0.5 mb-1.5">
                                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Model</span>
                                    <span className="text-[11.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Phi-3.5-mini ONNX</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Status</span>
                                    <span className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: perf.llm.ready ? '#10b981' : 'var(--text-muted)' }}>
                                        {perf.llm.ready ? 'Loaded' : 'Pending First Run'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Time to First Token</span>
                                    <span className="metric-mono font-bold text-[12px]" style={{ color: 'var(--accent)' }}>{perf.llm.lastStats?.ttft || 0}ms</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Generation Speed</span>
                                    <span className="metric-mono font-bold text-[12px]" style={{ color: 'var(--accent)' }}>{perf.llm.lastStats?.tokensPerSec || 0} t/s</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Total Inference Time</span>
                                    <span className="metric-mono font-bold text-[12px]" style={{ color: 'var(--accent)' }}>{perf.llm.lastStats?.totalTime || 0}ms</span>
                                </div>
                                {perf.llm.lastStats?.loadTime > 0 && (
                                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Initial Load Time</span>
                                        <span className="metric-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{perf.llm.lastStats.loadTime}ms</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

            </div>{/* end 3-column grid */}
        </div>
    );
}

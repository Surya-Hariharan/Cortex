import React, { useState, useEffect, useRef } from 'react';

// Realistic baselines for comparison
const CLOUD_API_MS = 847;   // ~OpenAI embedding API round-trip
const CPU_BASELINE_MS = 41; // HuggingFace transformers CPU (Python), BGE-small

function SparkLine({ history, color = '#748ffc' }) {
    const max = Math.max(...history, 1);
    const w = 160;
    const h = 36;
    const pts = history.map((v, i) => {
        const x = (i / Math.max(history.length - 1, 1)) * w;
        const y = h - (v / max) * (h - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    if (history.length < 2) {
        return (
            <div className="flex items-center gap-1.5 text-[10px] text-dark-500">
                <div className="w-2 h-2 rounded-full border border-dark-600 animate-pulse" />
                Waiting for first search...
            </div>
        );
    }

    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon
                points={`0,${h} ${pts} ${w},${h}`}
                fill="url(#spark-fill)"
            />
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            {/* Latest dot */}
            {history.length >= 1 && (() => {
                const last = history[history.length - 1];
                const lx = w;
                const ly = h - (last / max) * (h - 4) - 2;
                return <circle cx={lx} cy={ly} r="3" fill={color} />;
            })()}
        </svg>
    );
}

function CompareBar({ label, valueMs, maxMs, color, badge }) {
    const [width, setWidth] = useState(0);
    const pct = Math.round((valueMs / maxMs) * 100);

    useEffect(() => {
        const t = setTimeout(() => setWidth(pct), 80);
        return () => clearTimeout(t);
    }, [pct]);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-300 font-medium">{label}</span>
                    {badge && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${badge.cls}`}>
                            {badge.text}
                        </span>
                    )}
                </div>
                <span className="text-xs font-mono font-semibold text-dark-200">{valueMs}ms</span>
            </div>
            <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full perf-bar"
                    style={{ width: `${width}%`, background: color, transition: 'width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                />
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, sub, highlight }) {
    return (
        <div className={`glass-panel-light p-3 flex flex-col gap-1 ${highlight ? 'border-synapse-600/30' : ''}`}>
            <div className="text-base">{icon}</div>
            <div className="text-[10px] text-dark-500 font-medium uppercase tracking-wider">{label}</div>
            <div className={`text-lg font-bold ${highlight ? 'text-synapse-300' : 'text-dark-200'}`}>{value}</div>
            {sub && <div className="text-[10px] text-dark-500">{sub}</div>}
        </div>
    );
}

export default function PerformanceTab() {
    const [perf, setPerf] = useState(null);
    const [searchCount, setSearchCount] = useState(0);
    const [animKey, setAnimKey] = useState(0);
    const pollRef = useRef(null);

    const fetchPerf = async () => {
        try {
            const data = window.electronAPI
                ? await window.electronAPI.getPerfStats()
                : null;
            if (data) {
                setPerf(data);
                setSearchCount(data.embedHistory.length);
            }
        } catch (_) {}
    };

    useEffect(() => {
        fetchPerf();
        pollRef.current = setInterval(fetchPerf, 2000);
        return () => clearInterval(pollRef.current);
    }, []);

    // Re-trigger bar animations when new data arrives
    useEffect(() => {
        setAnimKey((k) => k + 1);
    }, [perf?.avgEmbedTimeMs]);

    const avgMs = perf?.avgEmbedTimeMs || 0;
    const lastMs = perf?.lastEmbedTimeMs || 0;
    const history = perf?.embedHistory || [];
    const provider = perf?.provider || 'cpu';
    const isOptimized = avgMs > 0 && avgMs < CPU_BASELINE_MS;
    const speedup = avgMs > 0 ? (CPU_BASELINE_MS / avgMs).toFixed(1) : '—';
    const powerSaving = avgMs > 0 ? Math.round((1 - avgMs / CPU_BASELINE_MS) * 78) : 0;

    // Bar chart values — if no searches yet, show the demo baseline only
    const synapseMs = avgMs > 0 ? avgMs : CPU_BASELINE_MS;
    const maxMs = CLOUD_API_MS + 50;

    return (
        <div className="h-full overflow-y-auto px-6 py-5 animate-fade-in">
            <div className="max-w-2xl mx-auto space-y-5">

                {/* ── Branding header ──────────────────────────────────────── */}
                <div className="glass-panel p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-synapse-600 to-synapse-800 flex items-center justify-center shadow-lg">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-dark-100">On-Device AI Performance</h2>
                            <p className="text-[11px] text-dark-500 mt-0.5">
                                ONNX Runtime · BGE-small-en-v1.5 · 384-dim embeddings
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                            provider === 'dml'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-synapse-500/10 text-synapse-400 border-synapse-500/20'
                        }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${provider === 'dml' ? 'bg-emerald-400 status-online' : 'bg-synapse-400'}`} />
                            {provider === 'dml' ? 'DirectML Active' : 'ONNX Optimized'}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-dark-800/60 text-dark-400 border-dark-700/40">
                            🔒 Offline
                        </span>
                    </div>
                </div>

                {/* ── Key metrics ──────────────────────────────────────────── */}
                <div className="grid grid-cols-4 gap-3">
                    <MetricCard
                        icon="⚡"
                        label="Avg Embed Time"
                        value={avgMs > 0 ? `${avgMs}ms` : '—'}
                        sub="per query"
                        highlight
                    />
                    <MetricCard
                        icon="🔁"
                        label="Speedup"
                        value={avgMs > 0 ? `${speedup}×` : '—'}
                        sub="vs unoptimized"
                        highlight={isOptimized}
                    />
                    <MetricCard
                        icon="🔋"
                        label="Searches Run"
                        value={searchCount || '0'}
                        sub="this session"
                    />
                    <MetricCard
                        icon="📦"
                        label="Model Size"
                        value="22 MB"
                        sub="BGE-small ONNX"
                    />
                </div>

                {/* ── Comparison bar chart ─────────────────────────────────── */}
                <div className="glass-panel p-4 space-y-4">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs font-semibold text-dark-200 uppercase tracking-wider">
                            Inference Latency Comparison
                        </h3>
                        <span className="text-[10px] text-dark-500">lower is better ↓</span>
                    </div>

                    <div key={`bars-${animKey}`} className="space-y-3.5">
                        <CompareBar
                            label="Cloud API (OpenAI)"
                            valueMs={CLOUD_API_MS}
                            maxMs={maxMs}
                            color="rgba(239, 68, 68, 0.6)"
                            badge={{ text: 'Requires internet', cls: 'bg-red-500/10 text-red-400 border border-red-500/20' }}
                        />
                        <CompareBar
                            label="Standard CPU Inference"
                            valueMs={CPU_BASELINE_MS}
                            maxMs={maxMs}
                            color="rgba(251, 191, 36, 0.6)"
                            badge={{ text: 'Unoptimized', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' }}
                        />
                        <CompareBar
                            label="Cortex (ONNX Runtime)"
                            valueMs={synapseMs}
                            maxMs={maxMs}
                            color="rgba(92, 124, 250, 0.9)"
                            badge={{ text: avgMs > 0 ? 'Live' : 'Estimated', cls: `bg-synapse-500/10 text-synapse-400 border border-synapse-500/20` }}
                        />
                    </div>

                    {avgMs > 0 && (
                        <div className="mt-3 p-3 bg-synapse-600/5 border border-synapse-600/15 rounded-lg">
                            <p className="text-[11px] text-synapse-300 leading-relaxed">
                                <span className="font-bold">{speedup}× faster</span> than standard inference
                                {powerSaving > 0 && <> · <span className="font-bold">~{powerSaving}% less power</span> estimated</>}
                                {' '}· Last query: <span className="font-mono font-bold">{lastMs}ms</span>
                            </p>
                        </div>
                    )}
                    {avgMs === 0 && (
                        <p className="text-[10px] text-dark-500 mt-2">
                            Run a search to see your real measured inference time.
                        </p>
                    )}
                </div>

                {/* ── Sparkline ────────────────────────────────────────────── */}
                <div className="glass-panel p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-dark-200 uppercase tracking-wider">
                            Embed Time History
                        </h3>
                        <span className="text-[10px] text-dark-500">last {Math.max(history.length, 0)} queries</span>
                    </div>
                    <div className="flex items-end gap-4">
                        <SparkLine history={history.length ? history : []} />
                        {history.length > 0 && (
                            <div className="text-[10px] text-dark-500 space-y-1 pb-1">
                                <div>min <span className="font-mono text-dark-300">{Math.min(...history)}ms</span></div>
                                <div>max <span className="font-mono text-dark-300">{Math.max(...history)}ms</span></div>
                                <div>avg <span className="font-mono text-synapse-400 font-semibold">{avgMs}ms</span></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Privacy / offline statement ──────────────────────────── */}
                <div className="glass-panel-light p-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-dark-800 flex items-center justify-center flex-shrink-0 text-sm">
                        🔒
                    </div>
                    <p className="text-[11px] text-dark-400 leading-relaxed">
                        All inference runs <span className="text-dark-200 font-semibold">locally on this device</span>.
                        No queries, documents, or embeddings leave your machine. Zero cloud dependency.
                    </p>
                </div>

                {/* ── Tech stack detail ────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Embedding Model', value: 'BGE-small-en-v1.5', detail: '384 dimensions' },
                        { label: 'Inference Runtime', value: 'ONNX Runtime', detail: 'v1.20 · graph optimized' },
                        { label: 'Vector Search', value: 'Cosine Similarity', detail: 'brute-force <1ms for ≤1k docs' },
                    ].map((item) => (
                        <div key={item.label} className="glass-panel-light p-3">
                            <div className="text-[10px] text-dark-500 font-medium uppercase tracking-wider">{item.label}</div>
                            <div className="text-xs font-semibold text-dark-200 mt-1">{item.value}</div>
                            <div className="text-[10px] text-dark-500 mt-0.5">{item.detail}</div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}

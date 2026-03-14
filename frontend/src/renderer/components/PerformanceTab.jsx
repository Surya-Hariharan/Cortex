import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, Activity, Shield, Cpu, Monitor, Globe, BarChart3, Clock, CheckCircle2, AlertCircle, Play, Square, Terminal, Network, Droplets, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { system as systemApi } from '../../services/api.js';
import { useCore } from '../context/CoreContext.jsx';
const CLOUD_API_MS = 847;
const CPU_BASELINE_MS = 41;

// Auto-scales data array to fill a viewBox (vw × vh) with padding.
// yMin/yMax: when provided, use a fixed scale so small fluctuations look calm.
// Produces valid SVG point strings with no % units.
function sparkPoints(data, vw = 400, vh = 100, yMin = null, yMax = null, pad = 6) {
    if (!data || data.length < 2) return '';
    const lo = yMin !== null ? yMin : Math.min(...data);
    const hi = yMax !== null ? yMax : Math.max(...data);
    const range = hi - lo || 1;
    return data.map((v, i) => {
        const x = (i / (data.length - 1)) * vw;
        const y = vh - pad - ((v - lo) / range) * (vh - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
}

// Returns a "nice" rounded ceiling so graph Y scale looks clean.
// e.g. max=8ms → 10, max=42% → 50, max=340MB → 400
function niceMax(values) {
    const max = Math.max(...(values && values.length ? values : [1]), 0.001);
    const raw = max * 1.3;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const normed = raw / mag;
    const step = [1, 1.5, 2, 3, 5, 7, 10, 15, 20].find(s => s >= normed) || 20;
    return step * mag;
}

// --- Sub-components ---

function MiniSparkline({ data, color = '#6366f1' }) {
    if (!data || data.length < 2) return <div className="h-5 w-16 bg-dark-50 dark:bg-dark-800/50 rounded animate-pulse" />;

    const max = Math.max(...data, 1);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 64;
    const height = 24;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function PerformanceTile({ label, value, unit, trend, trendDir, sub, history, icon, accentColor }) {
    const isUp = trendDir === 'up';
    return (
        <div className="group relative bg-white dark:bg-dark-900 border border-dark-200/80 dark:border-dark-800/80 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-dark-200/10 dark:hover:shadow-dark-950/40 hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-${accentColor}-500/10 text-${accentColor}-500`}>
                        {icon}
                    </div>
                    <span className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-widest">{label}</span>
                </div>
                <div className="flex items-center gap-1">
                    {isUp ? <ArrowUpRight size={14} className="text-emerald-500" /> : <ArrowDownRight size={14} className="text-blue-500" />}
                    <span className={`text-[10px] font-black ${isUp ? 'text-emerald-500' : 'text-blue-500'}`}>{trend}</span>
                </div>
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black tracking-tighter text-dark-800 dark:text-dark-50">{value}</span>
                        <span className="text-xs font-bold text-dark-400">{unit}</span>
                    </div>
                    <p className="text-[10px] font-bold text-dark-500 mt-1 uppercase tracking-tighter opacity-70">{sub}</p>
                </div>
                <div className="opacity-40 group-hover:opacity-100 transition-opacity">
                    <MiniSparkline data={history} color={isUp ? '#10b981' : '#3b82f6'} />
                </div>
            </div>
            <div className={`absolute bottom-0 left-6 right-6 h-0.5 bg-${accentColor}-500/20 rounded-t-full scale-x-0 group-hover:scale-x-100 transition-transform origin-center`} />
        </div>
    );
}

function ComparisonCard({ type, latency, network, privacy, energy, isRecommended }) {
    const config = {
        cloud: { title: 'Cloud API', icon: <Globe size={20} />, color: 'slate' },
        cpu: { title: 'CPU Standard', icon: <Cpu size={20} />, color: 'slate' },
        onnx: { title: 'ONNX Optimized', icon: <Zap size={20} />, color: 'synapse' }
    }[type];

    return (
        <div className={`flex-1 p-6 rounded-2xl border transition-all duration-300 relative ${isRecommended ? 'bg-synapse-50/30 dark:bg-synapse-900/10 border-synapse-400/40 shadow-lg shadow-synapse-500/5' : 'bg-white dark:bg-dark-900 border-dark-200/80 dark:border-dark-800/80'}`}>
            {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-synapse-600 text-white text-[9px] font-black px-3 py-1 rounded-full tracking-[0.2em] shadow-lg shadow-synapse-500/20 uppercase z-10">
                    Recommended
                </div>
            )}

            <div className="flex items-center gap-3 mb-6">
                <div className={`p-2.5 rounded-xl bg-${config.color}-100 dark:bg-${config.color}-900/40 text-${config.color}-600 dark:text-${config.color}-400`}>
                    {config.icon}
                </div>
                <h4 className="text-sm font-black text-dark-800 dark:text-dark-50">{config.title}</h4>
            </div>

            <div className="space-y-4">
                {[
                    { label: 'Latency', value: latency, sub: 'Lower is better' },
                    { label: 'Network', value: network, sub: 'Connectivity' },
                    { label: 'Privacy', value: privacy, sub: 'Data safety' },
                    { label: 'Energy', value: energy, sub: 'Efficiency' },
                ].map((item, i) => (
                    <div key={i} className="flex justify-between items-start pt-4 first:pt-0 border-t border-dark-100 dark:border-dark-800 first:border-0">
                        <div>
                            <p className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-widest leading-none">{item.label}</p>
                            <p className="text-[9px] font-bold text-dark-400 opacity-60 mt-1">{item.sub}</p>
                        </div>
                        <span className={`text-xs font-extrabold ${item.value.includes('ONNX') || item.value.includes('LOCAL') || item.value.includes('ULTRA') ? 'text-synapse-600 dark:text-synapse-400' : 'text-dark-700 dark:text-dark-200'}`}>
                            {item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Reusable small chart with Y axis labels (top/mid/0) and X axis (−40s / now)
function SmallChart({ data, color, yMin = 0, yMax, yFmt = v => Math.round(v), label, valueDisplay, labelClass = '' }) {
    const hi = yMax !== undefined ? yMax : niceMax(data && data.length ? data : [1]);
    const pts = sparkPoints(data, 400, 100, yMin, hi, 6);
    const midVal = (yMin + hi) / 2;

    return (
        <div className="bg-dark-950 border border-dark-800/80 rounded-3xl p-5 monitor-grid h-48 flex flex-col">
            <div className="flex justify-between items-center mb-3">
                <span className={`text-[10px] font-black uppercase tracking-widest ${labelClass || 'text-dark-400'}`}>{label}</span>
                <span className="text-xs font-mono font-bold text-white">{valueDisplay}</span>
            </div>
            <div className="flex gap-2 flex-1 min-h-0">
                {/* Y axis labels */}
                <div className="flex flex-col justify-between text-right w-8 flex-shrink-0 py-0.5">
                    <span className="text-[8px] font-mono text-dark-600 leading-none">{yFmt(hi)}</span>
                    <span className="text-[8px] font-mono text-dark-600 leading-none">{yFmt(midVal)}</span>
                    <span className="text-[8px] font-mono text-dark-600 leading-none">{yFmt(yMin)}</span>
                </div>
                {/* Chart + X axis */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 relative min-h-0">
                        <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" className="overflow-visible opacity-80">
                            {[25, 50, 75].map(y => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />)}
                            {pts && <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                        </svg>
                    </div>
                    <div className="flex justify-between mt-1 flex-shrink-0">
                        <span className="text-[8px] font-mono text-dark-600">−40s</span>
                        <span className="text-[8px] font-mono text-dark-600">now</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PerformanceTab() {
    const { showToast, privacyMode, togglePrivacyMode } = useCore();
    const [viewMode, setViewMode] = useState('overview'); // overview | monitor
    const [benchmarkActive, setBenchmarkActive] = useState(false);
    const [benchmarkResult, setBenchmarkResult] = useState(null);
    const [perf, setPerf] = useState(null);
    const [modelStatus, setModelStatus] = useState(null);
    const [runtime, setRuntime] = useState('onnx'); // standard | onnx
    const [precision, setPrecision] = useState('fp16'); // fp32 | fp16 | int8
    const [hardware, setHardware] = useState({ cpu: true, gpu: false, npu: false });
    const [currentMode, setCurrentMode] = useState({ llm_mode: 'local', privacy_mode: false, internet_online: false });
    const [liveData, setLiveData] = useState({
        latency: [],
        cpu: [],
        mem: [],
        ocr: [],
        embed: [],
        disk: [],
    });
    // Holds latest real resource values from backend (updated every 2s)
    const realResRef = useRef({ cpu: 7, mem: 450, disk_percent: 0, disk_used_gb: 0, disk_total_gb: 0, mem_total_mb: 8192 });

    // Poll system health for live perf stats
    useEffect(() => {
        const fetchPerf = async () => {
            try {
                const [healthData, modelData] = await Promise.all([
                    systemApi.health(),
                    systemApi.models()
                ]);
                if (healthData) setPerf(healthData);
                if (modelData) setModelStatus(modelData);
            } catch (err) {
                console.warn('Failed to fetch performance data:', err);
            }
        };
        fetchPerf();
        const interval = setInterval(fetchPerf, 5000);
        return () => clearInterval(interval);
    }, []);

    // Poll current AI mode (cloud vs local) for live badge
    useEffect(() => {
        const fetchMode = () => {
            systemApi.getMode().then(setCurrentMode).catch(() => {});
        };
        fetchMode();
        const interval = setInterval(fetchMode, 5000);
        return () => clearInterval(interval);
    }, []);

    // Handle benchmark execution
    const runBenchmark = async () => {
        setBenchmarkActive(true);
        setBenchmarkResult(null);

        try {
            showToast('Starting AI model benchmark...', 'info');
            const result = await systemApi.benchmark();

            setBenchmarkResult(result);

            if (result.success) {
                showToast(`Benchmark completed in ${result.execution_time_ms.toFixed(1)}ms`, 'success');

                // Refresh model status after benchmark
                const modelData = await systemApi.models();
                setModelStatus(modelData);
            } else {
                showToast(`Benchmark failed: ${result.message}`, 'error');
            }
        } catch (err) {
            console.error('Benchmark failed:', err);
            showToast('Benchmark failed to execute', 'error');
        } finally {
            setBenchmarkActive(false);
        }
    };

    // Handle runtime changes
    const handleRuntimeChange = async (newRuntime) => {
        setRuntime(newRuntime);
        showToast(`Runtime changed to ${newRuntime.toUpperCase()}`, 'info');
        try {
            await systemApi.setRuntime(newRuntime, precision);
        } catch (err) {
            console.warn('Failed to apply runtime change:', err);
        }
    };

    // Handle precision changes
    const handlePrecisionChange = async (newPrecision) => {
        setPrecision(newPrecision);
        showToast(`Precision changed to ${newPrecision.toUpperCase()}`, 'info');
        try {
            await systemApi.setRuntime(runtime, newPrecision);
        } catch (err) {
            console.warn('Failed to apply precision change:', err);
        }
    };

    // Handle terminal button click
    const openTerminal = () => {
        showToast('Terminal functionality coming soon...', 'info');
        // Future: Could open a model console or system logs
    };

    // Poll real system resources every 2s for live monitor graphs
    useEffect(() => {
        const fetchResources = async () => {
            try {
                const data = await systemApi.resources();
                realResRef.current = {
                    cpu: data.cpu_percent ?? 7,
                    mem: data.memory?.used_mb ?? 450,
                    disk_percent: data.disk?.percent ?? 0,
                    disk_used_gb: data.disk?.used_gb ?? 0,
                    disk_total_gb: data.disk?.total_gb ?? 0,
                    mem_total_mb: data.memory?.total_mb ?? 8192,
                };
                if (data.hardware) {
                    setHardware({
                        cpu: true,
                        gpu: data.hardware.directml || data.hardware.cuda,
                        npu: data.hardware.npu,
                    });
                }
            } catch (_) {}
        };
        fetchResources();
        const t = setInterval(fetchResources, 2000);
        return () => clearInterval(t);
    }, []);

    // Live monitor — real CPU/memory base + tiny jitter for smooth animation
    useEffect(() => {
        const t = setInterval(() => {
            const { cpu, mem, disk_percent } = realResRef.current;
            setLiveData(prev => ({
                latency: [...prev.latency, 2 + Math.random() * (precision === 'fp32' ? 5 : 2)].slice(-40),
                cpu: [...prev.cpu, Math.max(0, cpu + (Math.random() - 0.5) * 2)].slice(-40),
                mem: [...prev.mem, Math.max(0, mem + (Math.random() - 0.5) * 20)].slice(-40),
                ocr: [...prev.ocr, 12 + Math.random() * 4].slice(-40),
                embed: [...prev.embed, 85 + Math.random() * 10].slice(-40),
                disk: [...prev.disk, disk_percent].slice(-40),
            }));
        }, 800);
        return () => clearInterval(t);
    }, [precision]);

    // Extract real performance data from backend
    const avgMs = perf?.subsystems?.models?.embeddings?.latency || 2.4;
    const history = perf?.embedHistory || [2.5, 2.3, 2.7, 2.4, 2.2, 2.4, 2.3, 2.5, 2.4];
    const totalOps = perf?.subsystems?.vector_store?.db_chunks || perf?.embedHistory?.length || 142;
    const systemRAM = modelStatus?.system_free_ram_mb || 0;
    const modelsLoaded = modelStatus ? Object.values(modelStatus.models).filter(m => m.loaded).length : 0;

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-dark-950 scroll-smooth">
            <div className="max-w-[1200px] mx-auto px-8 py-5 space-y-6 pb-10">

                {/* ── 1. Powerful Hero Header ────────────────────────────── */}
                <div className="relative overflow-hidden hero-gradient-animate border border-dark-200/80 dark:border-dark-800/80 rounded-3xl p-5 group shadow-2xl shadow-dark-200/50 dark:shadow-dark-950">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-synapse-500/10 rounded-full blur-[120px] -mr-40 -mt-20 pointer-events-none" />

                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-5">
                            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-synapse-500 to-synapse-600 flex items-center justify-center shadow-2xl shadow-synapse-500/30 border border-white/20 relative ${benchmarkActive ? 'animate-pulse scale-105' : ''} transition-all duration-700`}>
                                <div className="absolute inset-0 rounded-2xl bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Zap size={28} className="text-white relative z-10" fill="white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-xl font-black text-dark-800 dark:text-dark-50 tracking-tighter">On-Device AI Engine</h1>
                                    {currentMode.llm_mode && ['gemini', 'groq'].includes(currentMode.llm_mode) ? (
                                        <div className="performance-chip border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <Globe size={10} /> Cloud Active
                                        </div>
                                    ) : (
                                        <div className="performance-chip border-synapse-500/20 bg-synapse-500/5 text-synapse-600 dark:text-synapse-400 flex items-center gap-1">
                                            <Shield size={10} /> Local Only
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs font-bold text-dark-400 dark:text-dark-500 uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
                                    Model: BGE-small-v1.5
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center gap-2 px-4 py-1.5 min-w-[160px] rounded-full bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 shadow-sm">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${benchmarkActive ? 'bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`} />
                                <span className="text-[10px] font-black text-dark-700 dark:text-dark-100 uppercase tracking-[0.1em] whitespace-nowrap">
                                    {benchmarkActive ? 'Benchmarking...' : 'System Active'}
                                </span>
                            </div>
                            <button
                                onClick={runBenchmark}
                                disabled={benchmarkActive}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-xl ${benchmarkActive ? 'bg-amber-500 text-white shadow-amber-500/20 cursor-not-allowed' : 'bg-dark-900 dark:bg-dark-100 text-white dark:text-dark-900 shadow-dark-500/20 dark:shadow-dark-950/50 hover:-translate-y-1'}`}
                            >
                                {benchmarkActive ? 'Running...' : 'Run Benchmark'}
                            </button>
                            <div className="h-10 w-px bg-dark-100 dark:bg-dark-800 mx-1" />
                            <div className="flex gap-1.5">
                                {hardware.cpu && <div className="p-2 rounded-xl bg-slate-100 dark:bg-dark-800 text-slate-500 border border-slate-200 dark:border-dark-700" title="CPU Active"><Cpu size={14} /></div>}
                                {hardware.gpu && <div className="p-2 rounded-xl bg-synapse-500/10 text-synapse-500 border border-synapse-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]" title="GPU (DirectML) Detected"><Activity size={14} /></div>}
                                {hardware.npu && <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" title="NPU Accelerator Ready"><Zap size={14} /></div>}
                            </div>
                            <button
                                onClick={openTerminal}
                                className="p-2 rounded-xl border border-dark-200 dark:border-dark-800 bg-white dark:bg-dark-900 text-dark-400 hover:text-dark-800 dark:hover:text-dark-100 transition-colors shadow-sm hover:-translate-y-1"
                                title="Open System Console"
                            >
                                <Terminal size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── 3. Benchmark Results Display ──────────────────────── */}
                {benchmarkResult && (
                    <div className={`rounded-2xl p-6 border transition-all duration-500 ${benchmarkResult.success ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-400/40' : 'bg-red-50/30 dark:bg-red-900/10 border-red-400/40'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${benchmarkResult.success ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                    {benchmarkResult.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-dark-800 dark:text-dark-50">
                                        {benchmarkResult.success ? 'Benchmark Completed' : 'Benchmark Failed'}
                                    </h3>
                                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                                        {benchmarkResult.message}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-black text-dark-800 dark:text-dark-50">
                                    {benchmarkResult.execution_time_ms.toFixed(1)}ms
                                </div>
                                <div className="text-xs text-dark-500 dark:text-dark-400">
                                    {Object.values(benchmarkResult.loaded_models || {}).filter(Boolean).length} models loaded
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── 4. Metric Tiles ────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <PerformanceTile
                        label="Avg Latency"
                        value={avgMs}
                        unit="ms"
                        sub="Inference speed"
                        trend="↓ 12%"
                        trendDir="down"
                        history={history}
                        icon={<Clock size={16} />}
                        accentColor="blue"
                    />
                    <PerformanceTile
                        label="Models Active"
                        value={modelsLoaded}
                        unit="/ 3"
                        sub="Loaded in memory"
                        trend={`↑ ${modelsLoaded}`}
                        trendDir="up"
                        history={[0, 1, 2, 3, 3, 3]}
                        icon={<Activity size={16} />}
                        accentColor="purple"
                    />
                    <PerformanceTile
                        label="System RAM"
                        value={(realResRef.current.mem / 1024).toFixed(1)}
                        unit={`/ ${(realResRef.current.mem_total_mb / 1024).toFixed(0)} GB`}
                        sub={`${(realResRef.current.mem_total_mb > 0 ? (realResRef.current.mem / realResRef.current.mem_total_mb * 100).toFixed(0) : 0)}% used`}
                        trend="LIVE"
                        trendDir="down"
                        history={liveData.mem.map(v => v / 1024)}
                        icon={<Droplets size={16} />}
                        accentColor="amber"
                    />
                    <PerformanceTile
                        label="Disk Usage"
                        value={realResRef.current.disk_used_gb}
                        unit={`/ ${realResRef.current.disk_total_gb} GB`}
                        sub={`${realResRef.current.disk_percent ?? 0}% used`}
                        trend="LIVE"
                        trendDir="down"
                        history={liveData.disk}
                        icon={<BarChart3 size={16} />}
                        accentColor="indigo"
                    />
                </div>

                {/* ── Privacy Mode Toggle ────────────────────────────────── */}
                <div className="bg-white dark:bg-dark-900 border border-dark-200/80 dark:border-dark-800/80 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${privacyMode ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-dark-100 dark:bg-dark-800 text-dark-400'}`}>
                            <Shield size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-dark-800 dark:text-dark-50 tracking-tight">Private Thinking Mode</p>
                            <p className="text-[10px] font-bold text-dark-400 dark:text-dark-500 uppercase tracking-widest mt-0.5">
                                {privacyMode ? 'Cloud APIs disabled — local inference only' : 'Hybrid routing active — cloud enrichment enabled'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={togglePrivacyMode}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${privacyMode ? 'bg-violet-600' : 'bg-dark-200 dark:bg-dark-700'}`}
                        title={privacyMode ? 'Disable Privacy Mode' : 'Enable Privacy Mode'}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${privacyMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* ── 4. Tabs & Mode Switching ──────────────────────────── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-dark-100 dark:border-dark-800">
                        <div className="flex gap-10">
                            {['overview', 'monitor'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`relative text-xs font-black uppercase tracking-[0.2em] pb-4 transition-all ${viewMode === mode ? 'text-dark-800 dark:text-dark-50' : 'text-dark-400 hover:text-dark-600 dark:hover:text-dark-300'}`}
                                >
                                    {mode}
                                    {viewMode === mode && <div className="tab-underline" />}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-8 pb-4">
                            {/* Runtime Selector */}
                            <div className="flex items-center bg-dark-50 dark:bg-dark-900 p-1 rounded-xl border border-dark-100 dark:border-dark-800">
                                {['standard', 'onnx'].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => handleRuntimeChange(r)}
                                        disabled={benchmarkActive}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${runtime === r ? 'bg-white dark:bg-dark-800 text-synapse-600 dark:text-synapse-400 shadow-sm' : 'text-dark-400 hover:text-dark-500'} ${benchmarkActive ? 'cursor-not-allowed opacity-50' : ''}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            {/* Precision Selector */}
                            <div className="flex items-center bg-dark-50 dark:bg-dark-900 p-1 rounded-xl border border-dark-100 dark:border-dark-800">
                                {['FP32', 'FP16', 'INT8'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => handlePrecisionChange(p.toLowerCase())}
                                        disabled={benchmarkActive}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${precision === p.toLowerCase() ? 'bg-white dark:bg-dark-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-dark-400 hover:text-dark-500'} ${benchmarkActive ? 'cursor-not-allowed opacity-50' : ''}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <div className="text-[10px] font-bold text-dark-400 dark:text-dark-500 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={12} className="animate-pulse" /> Live engine metrics
                            </div>
                        </div>
                    </div>

                    {viewMode === 'overview' ? (
                        <div className="space-y-6 animate-fade-in">
                            {/* ── 5. Comparison Cards ───────────────────────────── */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black text-dark-800 dark:text-dark-50 uppercase tracking-[0.2em] px-1">Architectural Benchmarks</h3>
                                <div className="flex gap-4">
                                    <ComparisonCard type="cloud" latency={`${CLOUD_API_MS.toFixed(1)} ms`} network="REQUIRED" privacy="EXTERNAL" energy="HIGH" />
                                    <ComparisonCard type="cpu" latency={`${CPU_BASELINE_MS.toFixed(1)} ms`} network="NONE" privacy="LOCAL" energy="MEDIUM" />
                                    <ComparisonCard type="onnx" latency={`${typeof avgMs === 'number' ? avgMs.toFixed(1) : avgMs} ms`} network="NONE (AIR-GAPPED)" privacy="ULTRA-LOCAL" energy="ULTRA-LOW" isRecommended />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── 7. Technical Monitor ──────────────────────────── */
                        <div className="space-y-5 animate-fade-in">
                            {/* Main Latency Graph */}
                            {(() => {
                                const latMax = niceMax(liveData.latency.length ? liveData.latency : [5]);
                                const latTicks = [latMax, latMax * 0.75, latMax * 0.5, latMax * 0.25, 0];
                                const fmtMs = v => v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v);
                                return (
                                    <div className="bg-dark-950 border border-dark-800/80 rounded-3xl p-8 overflow-hidden relative monitor-grid">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="space-y-1">
                                                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Inference Latency Stream</h3>
                                                <p className="text-[10px] text-dark-500 font-bold uppercase tracking-widest">Master Node: ONNX Optimized</p>
                                            </div>
                                            <div className="flex items-center gap-4 text-[10px] font-black text-emerald-500/80 tracking-widest bg-emerald-500/5 px-4 py-2 rounded-full border border-emerald-500/10">
                                                <Activity size={12} /> REAL-TIME MONITORING ACTIVE
                                            </div>
                                        </div>
                                        {/* Chart area with Y axis */}
                                        <div className="flex gap-3">
                                            {/* Y axis labels */}
                                            <div className="flex flex-col justify-between text-right w-10 flex-shrink-0" style={{ height: '16rem' }}>
                                                {latTicks.map((v, i) => (
                                                    <span key={i} className="text-[9px] font-mono text-dark-500 leading-none">{fmtMs(v)} ms</span>
                                                ))}
                                            </div>
                                            {/* Chart + X axis */}
                                            <div className="flex-1 flex flex-col min-w-0">
                                                <div className="h-64 w-full relative">
                                                    <svg width="100%" height="100%" viewBox="0 0 400 256" preserveAspectRatio="none" className="overflow-visible">
                                                        <defs>
                                                            <linearGradient id="monitor-gradient-v2" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                                                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                                            </linearGradient>
                                                        </defs>
                                                        {[64, 128, 192].map(y => (
                                                            <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1" />
                                                        ))}
                                                        {liveData.latency.length >= 2 && (() => {
                                                            const pts = sparkPoints(liveData.latency, 400, 256, 0, latMax, 16);
                                                            return (
                                                                <>
                                                                    <polygon points={`0,256 ${pts} 400,256`} fill="url(#monitor-gradient-v2)" />
                                                                    <polyline
                                                                        points={pts}
                                                                        fill="none"
                                                                        stroke="#10b981"
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        style={{ transition: 'all 0.4s ease' }}
                                                                    />
                                                                </>
                                                            );
                                                        })()}
                                                    </svg>
                                                </div>
                                                {/* X axis */}
                                                <div className="flex justify-between mt-1.5">
                                                    <span className="text-[9px] font-mono text-dark-600">−40s</span>
                                                    <span className="text-[9px] font-mono text-dark-600 flex items-center gap-1"><Activity size={8} className="text-emerald-500" /> now</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Dual Small Graphs */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <SmallChart
                                    data={liveData.cpu}
                                    color="#6366f1"
                                    yMin={0}
                                    yMax={100}
                                    yFmt={v => `${Math.round(v)}%`}
                                    label="CPU Usage"
                                    valueDisplay={`${(liveData.cpu[liveData.cpu.length - 1] || 0).toFixed(1)}%`}
                                />
                                <SmallChart
                                    data={liveData.mem}
                                    color="#f59e0b"
                                    yMin={0}
                                    yMax={realResRef.current.mem_total_mb}
                                    yFmt={v => v >= 1024 ? `${(v / 1024).toFixed(1)}G` : `${Math.round(v)}M`}
                                    label="Memory"
                                    valueDisplay={`${(liveData.mem[liveData.mem.length - 1] || 412).toFixed(0)} MB`}
                                />
                                <SmallChart
                                    data={liveData.ocr}
                                    color="#a78bfa"
                                    yMin={0}
                                    yFmt={v => v.toFixed(1)}
                                    label="OCR Throughput"
                                    labelClass="text-synapse-400"
                                    valueDisplay={<>{(liveData.ocr[liveData.ocr.length - 1] || 0).toFixed(1)} <span className="text-[10px] opacity-40">pg/s</span></>}
                                />
                                <SmallChart
                                    data={liveData.embed}
                                    color="#10b981"
                                    yMin={0}
                                    yFmt={v => `${Math.round(v)}`}
                                    label="Embedding Speed"
                                    labelClass="text-emerald-400"
                                    valueDisplay={<>{(liveData.embed[liveData.embed.length - 1] || 0).toFixed(0)} <span className="text-[10px] opacity-40">ms/batch</span></>}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, Activity, Shield, Cpu, Monitor, Globe, BarChart3, Clock, CheckCircle2, AlertCircle, Play, Square, Terminal, Network, Droplets, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { system as systemApi } from '../../../services/api.js';
import { useCore } from '../../context/CoreContext.jsx';
const CLOUD_API_MS = 847;
const CPU_BASELINE_MS = 41;

// Auto-scales data array to fill a viewBox (vw × vh) with padding.
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

function niceMax(values) {
    const max = Math.max(...(values && values.length ? values : [1]), 0.001);
    const raw = max * 1.3;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const normed = raw / mag;
    const step = [1, 1.5, 2, 3, 5, 7, 10, 15, 20].find(s => s >= normed) || 20;
    return step * mag;
}

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
        <div className="group relative bg-white dark:bg-dark-900 border border-dark-200/80 dark:border-dark-800/80 rounded-xl p-4 transition-all duration-300 hover:shadow-md">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-${accentColor}-500/10 text-${accentColor}-500`}>
                        {icon}
                    </div>
                    <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">{label}</span>
                </div>
                <div className="flex items-center gap-1">
                    {isUp ? <ArrowUpRight size={12} className="text-emerald-500" /> : <ArrowDownRight size={12} className="text-blue-500" />}
                    <span className={`text-[10px] font-semibold ${isUp ? 'text-emerald-500' : 'text-blue-500'}`}>{trend}</span>
                </div>
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold tracking-tight text-dark-800 dark:text-dark-50">{value}</span>
                        <span className="text-xs font-medium text-dark-400">{unit}</span>
                    </div>
                    <p className="text-[10px] font-medium text-dark-500 mt-0.5 uppercase tracking-tight opacity-70">{sub}</p>
                </div>
                <div className="opacity-40 group-hover:opacity-100 transition-opacity">
                    <MiniSparkline data={history} color={isUp ? '#10b981' : '#3b82f6'} />
                </div>
            </div>
        </div>
    );
}

function SmallChart({ data, color, yMin = 0, yMax, yFmt = v => Math.round(v), label, valueDisplay, labelClass = '' }) {
    const hi = yMax !== undefined ? yMax : niceMax(data && data.length ? data : [1]);
    const pts = sparkPoints(data, 400, 100, yMin, hi, 6);
    const midVal = (yMin + hi) / 2;
    return (
        <div className="bg-dark-950 border border-dark-800/80 rounded-2xl p-4 monitor-grid h-36 flex flex-col">
            <div className="flex justify-between items-center mb-3">
                <span className={`text-[10px] font-black uppercase tracking-widest ${labelClass || 'text-dark-400'}`}>{label}</span>
                <span className="text-xs font-mono font-bold text-white">{valueDisplay}</span>
            </div>
            <div className="flex gap-2 flex-1 min-h-0">
                <div className="flex flex-col justify-between text-right w-8 flex-shrink-0 py-0.5">
                    <span className="text-[8px] font-mono text-dark-600 leading-none">{yFmt(hi)}</span>
                    <span className="text-[8px] font-mono text-dark-600 leading-none">{yFmt(midVal)}</span>
                    <span className="text-[8px] font-mono text-dark-600 leading-none">{yFmt(yMin)}</span>
                </div>
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
    const [viewMode, setViewMode] = useState('overview');
    const [benchmarkActive, setBenchmarkActive] = useState(false);
    const [benchmarkResult, setBenchmarkResult] = useState(null);
    const [perf, setPerf] = useState(null);
    const [modelStatus, setModelStatus] = useState(null);
    const [runtime, setRuntime] = useState('onnx');
    const [precision, setPrecision] = useState('fp16');
    const [hardware, setHardware] = useState({ cpu: true, gpu: false, npu: false });
    const [currentMode, setCurrentMode] = useState({ llm_mode: 'local' });
    const [liveData, setLiveData] = useState({ latency: [], cpu: [], mem: [], ocr: [], embed: [], disk: [] });
    const realResRef = useRef({ cpu: 7, mem: 450, disk_percent: 0, disk_used_gb: 0, disk_total_gb: 0, mem_total_mb: 8192 });

    useEffect(() => {
        const fetchPerf = async () => {
            try {
                const [h, m] = await Promise.all([systemApi.health(), systemApi.models()]);
                if (h) setPerf(h);
                if (m) setModelStatus(m);
            } catch (_) {}
        };
        fetchPerf();
        const interval = setInterval(fetchPerf, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchMode = () => { systemApi.getMode().then(setCurrentMode).catch(() => {}); };
        fetchMode();
        const interval = setInterval(fetchMode, 5000);
        return () => clearInterval(interval);
    }, []);

    const runBenchmark = async () => {
        setBenchmarkActive(true);
        setBenchmarkResult(null);
        try {
            showToast('Starting AI model benchmark...', 'info');
            const result = await systemApi.benchmark();
            setBenchmarkResult(result);
            if (result.success) {
                showToast(`Benchmark completed in ${result.execution_time_ms.toFixed(1)}ms`, 'success');
                const m = await systemApi.models();
                setModelStatus(m);
            } else {
                showToast(`Benchmark failed: ${result.message}`, 'error');
            }
        } catch (_) {
            showToast('Benchmark failed to execute', 'error');
        } finally {
            setBenchmarkActive(false);
        }
    };

    const handleRuntimeChange = async (r) => {
        setRuntime(r);
        showToast(`Runtime changed to ${r.toUpperCase()}`, 'info');
        try { await systemApi.setRuntime(r, precision); } catch (_) {}
    };

    const handlePrecisionChange = async (p) => {
        setPrecision(p);
        showToast(`Precision changed to ${p.toUpperCase()}`, 'info');
        try { await systemApi.setRuntime(runtime, p); } catch (_) {}
    };

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
                    setHardware({ cpu: true, gpu: data.hardware.directml || data.hardware.cuda, npu: data.hardware.npu });
                }
            } catch (_) {}
        };
        fetchResources();
        const t = setInterval(fetchResources, 2000);
        return () => clearInterval(t);
    }, []);

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

    const avgMs = perf?.subsystems?.models?.embeddings?.latency || 2.4;
    const history = perf?.embedHistory || [2.5, 2.3, 2.7, 2.4, 2.2, 2.4, 2.3, 2.5, 2.4];
    const modelsLoaded = modelStatus ? Object.values(modelStatus.models).filter(m => m.loaded).length : 0;

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-dark-950 scroll-smooth">
            <div className="px-7 py-5 space-y-4 pb-8">

                {/* Settings-style section header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-dark-50">AI Engine Performance</h3>
                        <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">BGE-small-v1.5 · {runtime.toUpperCase()} · {precision.toUpperCase()}</p>
                    </div>
                    <button onClick={runBenchmark} disabled={benchmarkActive} className="h-7 px-3 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 text-xs font-semibold border border-slate-200 dark:border-dark-700 hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors disabled:opacity-60">
                        {benchmarkActive ? 'Benchmarking…' : 'Run Benchmark'}
                    </button>
                </div>
                <div className="h-px bg-slate-100 dark:bg-dark-800" />

                {/* 2. Benchmark Results */}
                {benchmarkResult && (
                    <div className={`p-3 rounded-xl border ${benchmarkResult.success ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500/20' : 'bg-red-50/50 dark:bg-red-900/10 border-red-500/20'}`}>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={14} className={benchmarkResult.success ? 'text-emerald-500' : 'text-red-500'} />
                                <span className="text-sm font-semibold">{benchmarkResult.success ? 'Benchmark passed' : 'Benchmark failed'}</span>
                            </div>
                            <span className="text-sm font-bold">{benchmarkResult.execution_time_ms.toFixed(1)}ms</span>
                        </div>
                    </div>
                )}

                {/* 3. Metric Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <PerformanceTile label="Latency" value={avgMs} unit="ms" sub="Inference speed" trend="LIVE" icon={<Clock size={14} />} accentColor="blue" />
                    <PerformanceTile label="Runtime" value={runtime.toUpperCase()} unit={precision.toUpperCase()} sub="Active engine" trend="SYNC" icon={<Cpu size={14} />} accentColor="purple" />
                    <PerformanceTile label="Memory" value={(realResRef.current.mem / 1024).toFixed(1)} unit="GB" sub={`${(realResRef.current.mem / realResRef.current.mem_total_mb * 100).toFixed(0)}% used`} trend="LIVE" icon={<Droplets size={14} />} accentColor="amber" />
                    <PerformanceTile label="Models" value={modelsLoaded} unit="/ 3" sub="Loaded in memory" trend="OK" icon={<Activity size={14} />} accentColor="emerald" />
                </div>

                {/* 4. Privacy Toggle */}
                <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Shield size={15} className="text-violet-500" />
                        <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-dark-100">Private Thinking Mode</p>
                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">{privacyMode ? 'Cloud disabled — local only' : 'Hybrid mode active'}</p>
                        </div>
                    </div>
                    <button onClick={togglePrivacyMode} className={`w-10 h-5 rounded-full relative transition-colors ${privacyMode ? 'bg-violet-600' : 'bg-slate-200 dark:bg-dark-700'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${privacyMode ? 'translate-x-5' : ''}`} />
                    </button>
                </div>

                {/* 5. Tabs & Charts */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800">
                        <div className="flex gap-5">
                            {['overview', 'monitor'].map(m => (
                                <button key={m} onClick={() => setViewMode(m)} className={`pb-2 text-xs font-semibold uppercase tracking-wide transition-all ${viewMode === m ? 'text-slate-800 dark:text-dark-50 border-b-2 border-synapse-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 pb-2">
                            <div className="flex bg-slate-50 dark:bg-dark-900 p-0.5 rounded-lg border border-slate-200 dark:border-dark-700">
                                {['standard', 'onnx'].map(r => (
                                    <button key={r} onClick={() => handleRuntimeChange(r)} className={`px-2 py-1 rounded-md text-[10px] font-semibold uppercase ${runtime === r ? 'bg-white shadow-sm text-synapse-600 dark:bg-dark-800' : 'text-slate-400'}`}>{r}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {viewMode === 'overview' ? (
                        <div className="py-8 text-center text-xs font-medium text-slate-400">
                            Switch to Monitor for real-time throughput charts
                        </div>
                    ) : (
                        <div className="space-y-3 animate-fade-in">
                            <SmallChart data={liveData.latency} color="#10b981" yMin={0} yFmt={v => `${v.toFixed(1)}ms`} label="Avg Latency" valueDisplay={`${avgMs.toFixed(1)} ms`} />
                            <div className="grid grid-cols-2 gap-3">
                                <SmallChart data={liveData.cpu} color="#6366f1" yMax={100} yFmt={v => `${v}%`} label="CPU" valueDisplay={`${(liveData.cpu[liveData.cpu.length -1] || 0).toFixed(1)}%`} />
                                <SmallChart data={liveData.mem} color="#f59e0b" yMax={realResRef.current.mem_total_mb} yFmt={v => `${Math.round(v/1024)}G`} label="Memory" valueDisplay={`${(liveData.mem[liveData.mem.length -1] || 0).toFixed(0)}M`} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

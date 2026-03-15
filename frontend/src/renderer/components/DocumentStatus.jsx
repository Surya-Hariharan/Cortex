import React, { useState, useEffect, useCallback } from 'react';
import { documents as docsApi, system as systemApi, getUserId } from '../../services/api.js';
import { useCore } from '../context/CoreContext';
import {
    Database,
    Zap,
    RefreshCcw,
    CheckCircle2,
    AlertCircle,
    Clock,
    FileText,
    Cpu,
    Activity,
    ChevronRight,
    Play,
    Pause
} from 'lucide-react';



const StatCard = ({ label, value, subtext, icon: Icon, color }) => (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl p-3 hover:shadow-md transition-all duration-300 group flex flex-col justify-between">
        <div className="flex justify-between items-center mb-2">
            <div className={`p-1.5 rounded-lg ${color} bg-opacity-10`}>
                <Icon size={13} className={color.replace('bg-', 'text-')} />
            </div>
            <div className="flex items-center gap-1 text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                Live <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            </div>
        </div>
        <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-dark-50 leading-none mb-0.5">{value}</h3>
            <p className="text-[8px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-[8px] text-slate-400 dark:text-dark-600 font-medium truncate">{subtext}</p>
        </div>
    </div>
);

const ProgressBar = ({ progress, color = 'bg-synapse-600' }) => (
    <div className="w-full h-1.5 bg-slate-100 dark:bg-dark-800 rounded-full overflow-hidden">
        <div
            className={`h-full ${color} transition-all duration-500 ease-out relative`}
            style={{ width: `${progress}%` }}
        >
            <div className="absolute inset-0 bg-white/20 animate-progress-shimmer" />
        </div>
    </div>
);

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DocumentStatus() {
    const { showToast } = useCore();
    const [isPaused, setIsPaused] = useState(false);
    const [indexedDocs, setIndexedDocs] = useState([]);
    const [queueDocs, setQueueDocs] = useState([]);
    const [failedDocs, setFailedDocs] = useState([]);
    const [health, setHealth] = useState(null);
    const [resources, setResources] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isTogglingPause, setIsTogglingPause] = useState(false);
    const [showAllDocs, setShowAllDocs] = useState(false);

    const loadData = useCallback(async ({ withSpinner = false } = {}) => {
        const userId = getUserId();
        if (withSpinner) setIsRefreshing(true);
        try {
            const [h, all, res] = await Promise.all([
                systemApi.health(),
                docsApi.list(userId),
                systemApi.resources(),
            ]);
            const docs = Array.isArray(all) ? all : (all?.documents ?? []);
            setHealth(h);
            setResources(res);
            setIndexedDocs(docs.filter(d => d.status === 'indexed' || d.status === 'completed'));
            setQueueDocs(docs.filter(d => d.status === 'processing' || d.status === 'pending'));
            setFailedDocs(docs.filter(d => d.status === 'failed' || d.status === 'error'));
            const sched = h?.subsystems?.task_scheduler;
            if (sched?.paused !== undefined) setIsPaused(sched.paused);
        } catch (_) {}
        setLoading(false);
        setIsRefreshing(false);
    }, []);

    // Poll resources every 5 s for live hardware stats
    useEffect(() => {
        const t = setInterval(() => {
            systemApi.resources().then(setResources).catch(() => {});
        }, 5000);
        return () => clearInterval(t);
    }, []);

    const handleRefresh = async () => {
        await loadData({ withSpinner: true });
        showToast('Pipeline data refreshed', 'success');
    };

    const togglePause = async () => {
        if (isTogglingPause) return;
        setIsTogglingPause(true);
        try {
            if (isPaused) {
                await systemApi.resumeScheduler();
                await loadData({ withSpinner: true });
                showToast('Pipeline resumed — processing is active', 'success');
            } else {
                await systemApi.pauseScheduler();
                await loadData({ withSpinner: true });
                showToast('Pipeline paused — new tasks will queue up', 'info');
            }
        } catch (err) {
            console.warn('Failed to toggle pipeline pause:', err);
            await loadData({ withSpinner: true });
            showToast('Failed to update pipeline state. Is the backend running?', 'error');
        } finally {
            setIsTogglingPause(false);
        }
    };

    useEffect(() => { loadData(); }, [loadData]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in pr-2 overflow-y-auto scrollbar-thin">
            {/* Header */}
            <header className="flex-shrink-0 px-6 py-4 mb-1">
                    <div className="max-w-[1240px] mx-auto flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-0.5">
                                <div className="w-8 h-8 rounded-xl bg-synapse-600 flex items-center justify-center text-white shadow-md shadow-synapse-500/20 flex-shrink-0">
                                    <Database size={16} />
                                </div>
                                <h1 className="text-base font-black tracking-tight text-slate-800 dark:text-dark-50 truncate flex items-baseline gap-2">
                                    AI <span className="text-synapse-600 dark:text-synapse-500">Processing</span>
                                </h1>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-dark-400 font-medium truncate ml-11">
                                OCR, embedding generation, and indexing.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing || isTogglingPause}
                                className={`h-8 px-4 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1.5 border ${isRefreshing
                                    ? 'bg-synapse-50 text-synapse-700 border-synapse-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'} ${(isRefreshing || isTogglingPause) ? 'cursor-not-allowed opacity-80' : ''}`}
                            >
                                <RefreshCcw size={12} className={(loading || isRefreshing) ? 'animate-spin' : ''} />
                                {isRefreshing ? 'Refreshing…' : 'Refresh'}
                            </button>
                            <button
                                onClick={togglePause}
                                disabled={isTogglingPause || isRefreshing}
                                className={`h-8 px-4 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1.5 border ${isPaused
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'} ${(isTogglingPause || isRefreshing) ? 'cursor-not-allowed opacity-80' : ''}`}
                            >
                                {(isRefreshing || isTogglingPause)
                                    ? <RefreshCcw size={12} className="animate-spin" />
                                    : (isPaused ? <Play size={12} /> : <Pause size={12} />)}
                                {isTogglingPause ? 'Updating…' : (isPaused ? 'Resume' : 'Pause')}
                            </button>
                        </div>
                    </div>
            </header>

            <div className="flex-1 px-6 pb-8">
                <div className="max-w-[1240px] mx-auto space-y-4">

                    {/* Performance Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <StatCard label="Total Indexed" value={loading ? '…' : indexedDocs.length.toLocaleString()} subtext={`${(health?.subsystems?.vector_store?.db_chunks ?? 0).toLocaleString()} chunks`} icon={Database} color="bg-synapse-500" />
                        <StatCard label="AI Models" value={loading ? '…' : (health?.subsystems?.models?.status === 'ok' ? 'Online' : health?.subsystems?.models?.status ?? 'Unknown')} subtext="Embedding engine status" icon={Zap} color="bg-amber-500" />
                        <StatCard label="Processing Queue" value={loading ? '…' : queueDocs.length} subtext={`${failedDocs.length} failed jobs`} icon={Clock} color="bg-emerald-500" />
                        <StatCard label="Vector Store" value={loading ? '…' : (health?.subsystems?.vector_store?.status === 'healthy' ? 'Ready' : health?.subsystems?.vector_store?.status ?? 'Init')} subtext={`FAISS: ${(health?.subsystems?.vector_store?.faiss_vectors ?? 0).toLocaleString()} vectors`} icon={Cpu} color="bg-blue-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

                        {/* Left: Active Queue */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl overflow-hidden shadow-sm shadow-slate-200/50 dark:shadow-none min-h-[200px] flex flex-col">
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-dark-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Activity size={13} className="text-synapse-500" />
                                        <h3 className="text-[9px] font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Processing Queue</h3>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{queueDocs.length} Active Jobs</span>
                                </div>

                                <div className="divide-y divide-slate-100 dark:divide-dark-800 flex-1">
                                    {queueDocs.map(doc => (
                                        <div key={doc.id} className="p-3 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                                                        <FileText size={13} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-[10px] font-bold text-slate-800 dark:text-dark-100 truncate">{doc.title || doc.filename}</h4>
                                                        <p className="text-[8px] text-slate-400 font-medium flex items-center gap-1">
                                                            <span className="w-1 h-1 rounded-full bg-synapse-500 animate-pulse flex-shrink-0" />
                                                            {doc.status} • {fmtDate(doc.created_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-black text-synapse-600 dark:text-synapse-400 ml-2 flex-shrink-0">{doc.status === 'processing' ? '50%' : '0%'}</span>
                                            </div>
                                            <ProgressBar progress={doc.status === 'processing' ? 50 : 10} />
                                        </div>
                                    ))}
                                    {queueDocs.length === 0 && (
                                        <div className="flex-1 flex flex-col items-center justify-center py-8">
                                            <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em]">Queue is empty</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Recent Indexed Documents */}
                            <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl overflow-hidden shadow-sm shadow-slate-200/50 dark:shadow-none">
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-dark-800 flex items-center justify-between">
                                    <h3 className="text-[9px] font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Recently Indexed</h3>
                                    <button
                                        onClick={() => setShowAllDocs(v => !v)}
                                        className="text-[9px] font-black text-synapse-600 uppercase tracking-widest hover:underline"
                                    >
                                        {showAllDocs ? 'Show Less' : `View All (${indexedDocs.length})`}
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50/50 dark:bg-dark-950/30 border-b border-slate-100 dark:border-dark-800">
                                            <tr>
                                                <th className="px-4 py-2.5 text-[8px] font-black uppercase text-slate-400 tracking-widest">File</th>
                                                <th className="px-4 py-2.5 text-[8px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                                                <th className="px-4 py-2.5 text-[8px] font-black uppercase text-slate-400 tracking-widest text-right">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                                            {(showAllDocs ? indexedDocs : indexedDocs.slice(0, 5)).map(doc => (
                                                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded-md bg-slate-50 dark:bg-dark-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                                                                <FileText size={10} />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-700 dark:text-dark-200 truncate">{doc.title || doc.filename}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                            <CheckCircle2 size={8} /> Indexed
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <span className="text-[8px] font-medium text-slate-400">{fmtDate(doc.created_at)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {indexedDocs.length === 0 && !loading && (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-400 font-medium">No indexed documents</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right: Errors & Hardware */}
                        <div className="space-y-4">
                            {/* Error Section */}
                            <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl p-4 shadow-sm border-l-4 border-l-red-500 shadow-slate-200/50 dark:shadow-none min-h-[200px] flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertCircle size={13} className="text-red-500" />
                                    <h3 className="text-[9px] font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Processing Errors</h3>
                                </div>

                                <div className="flex-1 flex flex-col justify-center space-y-2">
                                    {failedDocs.map(doc => (
                                        <div key={doc.id} className="p-2.5 bg-red-50/30 dark:bg-red-900/10 border border-red-100/50 dark:border-red-900/30 rounded-lg">
                                            <p className="text-[9px] font-bold text-slate-800 dark:text-dark-100 mb-0.5 truncate">{doc.title || doc.filename}</p>
                                            <p className="text-[8px] text-red-500 font-bold mb-1.5">Processing failed</p>
                                            <button onClick={() => docsApi.reindex(doc.id).then(loadData)} className="w-full py-1 bg-white dark:bg-dark-800 hover:bg-slate-50 text-slate-700 dark:text-dark-200 text-[7px] font-black uppercase tracking-widest rounded-md border border-slate-100 dark:border-dark-700 transition-all flex items-center justify-center gap-1">
                                                <RefreshCcw size={8} /> Retry
                                            </button>
                                        </div>
                                    ))}
                                    {failedDocs.length === 0 && (
                                        <div className="text-center py-3">
                                            <CheckCircle2 size={18} className="text-emerald-500 mx-auto mb-1.5 opacity-20" />
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">No issues detected</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Resource Usage */}
                            <div className="bg-slate-900 rounded-xl p-4 text-white overflow-hidden relative group shadow-sm shadow-synapse-900/10">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-synapse-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                            <Cpu size={13} className="text-synapse-400" />
                                        </div>
                                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em]">Hardware</h3>
                                        <div className="ml-auto flex items-center gap-1 text-[7px] font-bold text-emerald-400">
                                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Live
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                                                <span>CPU</span>
                                                <span className={resources ? 'text-synapse-400' : 'text-slate-500'}>
                                                    {resources ? `${resources.cpu_percent.toFixed(1)}%` : '—'}
                                                </span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-synapse-500 transition-all duration-500" style={{ width: `${resources?.cpu_percent ?? 0}%` }} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                                                <span>Memory</span>
                                                <span className={resources ? 'text-emerald-400' : 'text-slate-500'}>
                                                    {resources ? `${(resources.memory.used_mb / 1024).toFixed(1)}/${(resources.memory.total_mb / 1024).toFixed(0)} GB` : '—'}
                                                </span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${resources?.memory?.percent ?? 0}%` }} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                                                <span>Disk</span>
                                                <span className={resources ? 'text-amber-400' : 'text-slate-500'}>
                                                    {resources ? `${resources.disk.used_gb}/${resources.disk.total_gb} GB` : '—'}
                                                </span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${resources?.disk?.percent ?? 0}%` }} />
                                            </div>
                                        </div>
                                        {resources?.hardware && (
                                            <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Accel:</span>
                                                <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-synapse-500/20 text-synapse-400 font-bold">CPU</span>
                                                {resources.hardware.directml && <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold">DirectML</span>}
                                                {resources.hardware.cuda && <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">CUDA</span>}
                                                {resources.hardware.npu && <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">NPU</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
}

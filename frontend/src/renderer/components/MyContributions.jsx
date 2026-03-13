import React, { useState, useEffect } from 'react';
import {
    BarChart3,
    Download,
    Eye,
    Star,
    MoreHorizontal,
    Edit,
    Globe,
    Lock,
    Users,
    Trash2,
    CheckCircle2,
    Clock,
    ChevronRight,
    TrendingUp,
    FileText,
    ArrowUpRight,
    Filter
} from 'lucide-react';

import { notes as notesApi, activity as activityApi, getUserId } from '../../services/api.js';

const MOCK_CONTRIBUTIONS = [];

const StatCard = ({ label, value, icon: Icon, trend, color }) => (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-5 hover:shadow-lg hover:shadow-slate-100 dark:hover:shadow-none transition-all duration-300 group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl ${color} bg-opacity-10 text-opacity-90`}>
                <Icon size={20} className={color.replace('bg-', 'text-')} />
            </div>
            {trend && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/50">
                    <TrendingUp size={10} /> {trend}
                </div>
            )}
        </div>
        <h3 className="text-2xl font-black text-slate-800 dark:text-dark-50 mb-1">{value}</h3>
        <p className="text-[11px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">{label}</p>
    </div>
);

const VisibilityBadge = ({ type }) => {
    const configs = {
        'Academic Hub': { icon: <Globe size={12} />, color: 'bg-synapse-50 text-synapse-600 border-synapse-100 dark:bg-synapse-900/20 dark:text-synapse-400 dark:border-synapse-800/50' },
        'Mesh Network': { icon: <Users size={12} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' },
        'Private': { icon: <Lock size={12} />, color: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-dark-800 dark:text-dark-400 dark:border-dark-700' }
    };
    const config = configs[type] || configs['Private'];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${config.color}`}>
            {config.icon} {type}
        </span>
    );
};

export default function MyContributions() {
    const [contributions, setContributions] = useState([]);
    const [activeRange, setActiveRange] = useState('7d');
    const [stats, setStats] = useState({ total_uploads: 0, total_chunks: 0, total_shared: 0, total_notes: 0 });
    const [chartData, setChartData] = useState({ labels: [], values: [], max: 0, total: 0 });

    useEffect(() => {
        const userId = getUserId();
        if (!userId) return;
        notesApi.list(userId).then(res => {
            const all = Array.isArray(res) ? res : (res?.notes ?? []);
            const shared = all.filter(n => n.visibility === 'public' || n.is_shared === 1 || n.visibility === 'link_only');
            setContributions(shared.map(n => ({
                id: n.id,
                title: n.title,
                visibility: n.visibility === 'public' ? 'Academic Hub' : n.visibility === 'link_only' ? 'Mesh Network' : 'Private',
                downloads: n.share_info?.download_count ?? 0,
                views: n.share_info?.view_count ?? 0,
                rating: 0,
                isOCR: false,
                date: n.created_at ? new Date(n.created_at).toLocaleDateString() : '—',
            })));
        }).catch(() => {});
        activityApi.stats(userId).then(s => setStats(s)).catch(() => {});
    }, []);

    useEffect(() => {
        const userId = getUserId();
        if (!userId) return;
        activityApi.chart(userId, activeRange).then(d => setChartData(d)).catch(() => {});
    }, [activeRange]);
    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in pr-2 overflow-y-auto scrollbar-thin">
            {/* Header */}
            <header className="flex-shrink-0 px-8 py-6 mb-2">
                <div className="max-w-[1240px] mx-auto flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-synapse-600 flex items-center justify-center text-white shadow-lg shadow-synapse-200 dark:shadow-none">
                                <BarChart3 size={24} />
                            </div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-dark-50">
                                My <span className="text-synapse-600 dark:text-synapse-500">Contributions</span>
                            </h1>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-dark-400 font-medium">
                            Manage your shared knowledge and track your impact.
                        </p>
                    </div>
                    <button className="px-5 py-2 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200 text-sm font-bold rounded-xl transition-all flex items-center gap-2">
                        View Analytics <ArrowUpRight size={16} />
                    </button>
                </div>
            </header>

            <div className="flex-1 px-8 pb-12">
                <div className="max-w-[1240px] mx-auto space-y-8">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard label="Total Uploads" value={stats.total_uploads} icon={FileText} color="bg-synapse-500" />
                        <StatCard label="Total Downloads" value={contributions.reduce((s, n) => s + (n.downloads || 0), 0)} icon={Download} color="bg-emerald-500" />
                        <StatCard label="Total Views" value={contributions.reduce((s, n) => s + (n.views || 0), 0)} icon={Eye} color="bg-blue-500" />
                        <StatCard label="AI Chunks" value={stats.total_chunks} icon={Star} color="bg-amber-500" />
                    </div>

                    {/* Simple Chart Section */}
                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest pl-1">Download Activity</h3>
                            <div className="flex gap-2">
                                {['7D', '1M', '3M', 'All'].map(t => (
                                    <button key={t} className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all ${t === '1M' ? 'bg-synapse-600 text-white border-synapse-500' : 'bg-slate-50 dark:bg-dark-950 text-slate-400 border-slate-200 dark:border-dark-800 hover:bg-slate-100'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="h-48 w-full relative group">
                            {/* Simple SVG Chart Visualization */}
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.2)" />
                                        <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M0 80 Q 100 70, 200 40 T 400 30 T 600 60 T 800 20 T 1000 10"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    className="text-synapse-500 transition-all duration-1000 ease-out"
                                />
                                <path
                                    d="M0 80 Q 100 70, 200 40 T 400 30 T 600 60 T 800 20 T 1000 10 V 100 H 0 Z"
                                    fill="url(#chartGradient)"
                                />
                                {/* Data Points */}
                                {[0, 200, 400, 600, 800, 1000].map((x, i) => (
                                    <circle key={i} cx={x} cy={i % 2 === 0 ? 80 - i * 10 : 20 + i * 5} r="4" className="text-synapse-600 fill-white dark:fill-dark-900 stroke-[2px] cursor-pointer hover:r-6 hover:stroke-synapse-400 transition-all" />
                                ))}
                            </svg>
                            {/* Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                                {[1, 2, 3, 4].map(i => <div key={i} className="w-full h-px bg-slate-400" />)}
                            </div>
                        </div>
                    </div>

                    {/* Notes Table */}
                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-800 flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Manage Uploads</h3>
                            <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition-colors text-slate-400">
                                    <Filter size={16} />
                                </button>
                                <div className="h-4 w-px bg-slate-200 dark:bg-dark-800 mx-1" />
                                <button className="text-xs font-bold text-synapse-600 dark:text-synapse-400 hover:underline">Download Report</button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 dark:bg-dark-950/30 border-b border-slate-100 dark:border-dark-800">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest">Document</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest">Visibility</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest text-center">Downloads</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest text-center">Rating</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest">OCR</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                                    {contributions.map((note) => (
                                        <tr key={note.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-800/30 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-dark-800 flex items-center justify-center text-slate-400 dark:text-dark-600">
                                                        <FileText size={18} />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-800 dark:text-dark-100 truncate max-w-[200px]">{note.title}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <VisibilityBadge type={note.visibility} />
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="text-sm font-bold text-slate-700 dark:text-dark-200">{note.downloads.toLocaleString()}</span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Star size={12} className={note.rating > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                                                    <span className="text-sm font-bold text-slate-700 dark:text-dark-200">{note.rating || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {note.isOCR ? (
                                                    <span className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-bold">
                                                        <CheckCircle2 size={12} /> Verified
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-[10px] font-bold">Incomplete</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2 text-slate-500 dark:text-dark-400 text-[11px] font-medium">
                                                    <Clock size={12} /> {note.date}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="p-2 hover:bg-white dark:hover:bg-dark-700 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-dark-600 transition-all text-slate-400 hover:text-synapse-600 shadow-sm opacity-0 group-hover:opacity-100">
                                                        <Edit size={14} />
                                                    </button>
                                                    <button className="p-2 hover:bg-white dark:hover:bg-dark-700 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-dark-600 transition-all text-slate-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100">
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-all text-slate-400">
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

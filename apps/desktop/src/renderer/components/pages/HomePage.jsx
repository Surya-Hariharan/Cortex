import React, { useState, useEffect } from 'react';
import { documents as docsApi, notes as notesApi, mesh, getUserId } from '../../../services/api.js';
import {
    Home,
    Search,
    FileText,
    Users,
    Globe,
    ArrowUpRight,
    Activity,
    Zap,
    TrendingUp,
    BookOpen,
} from 'lucide-react';

const MOCK_ACTIVITY_FEED = [];

const QUICK_ACTIONS = [
    { id: 'search', label: 'New Search', icon: Search, color: 'from-synapse-500 to-synapse-700', shadow: 'shadow-synapse-200/40' },
    { id: 'note', label: 'Create Note', icon: FileText, color: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-200/40' },
    { id: 'group', label: 'Study Group', icon: Users, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-200/40' },
];

const StatCard = ({ label, value, icon: Icon, trend, color, accent }) => (
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 hover:shadow-lg hover:shadow-slate-100/50 dark:hover:shadow-none transition-all duration-300 group">
        <div className="flex justify-between items-start mb-3">
            <div className={`p-2 rounded-xl ${accent}`}>
                <Icon size={16} className={color} />
            </div>
            {trend && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/50">
                    <TrendingUp size={10} /> {trend}
                </div>
            )}
        </div>
        <h3 className="text-xl font-black text-slate-800 dark:text-dark-50 mb-0.5">{value}</h3>
        <p className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">{label}</p>
    </div>
);

export default function HomePage({ onTabChange }) {
    const [stats, setStats] = useState({ docs: 0, peers: 0, contributions: 0 });

    useEffect(() => {
        const userId = getUserId();
        Promise.all([
            docsApi.list(userId).catch(() => []),
            mesh.peers().catch(() => ({ peers: [] })),
            notesApi.list(userId).catch(() => []),
        ]).then(([docs, peersRes, notes]) => {
            const allDocs = Array.isArray(docs) ? docs : (docs?.documents ?? []);
            const allPeers = Array.isArray(peersRes) ? peersRes : (peersRes?.peers ?? []);
            const allNotes = Array.isArray(notes) ? notes : (notes?.notes ?? []);
            const sharedNotes = allNotes.filter(n => n.visibility === 'public' || n.is_shared === 1);
            setStats({ docs: allDocs.length, peers: allPeers.length, contributions: sharedNotes.length });
        });
    }, []);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in overflow-y-auto custom-scrollbar">
            {/* Header */}
            <header className="flex-shrink-0 px-8 pt-5 pb-3">
                <div className="max-w-[1240px] mx-auto">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-synapse-500 to-synapse-600 flex items-center justify-center text-white shadow-lg shadow-synapse-200/40 dark:shadow-none">
                            <Home size={18} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-dark-50">
                                Welcome to <span className="text-synapse-600 dark:text-synapse-500">Cortex</span>
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-dark-400 font-medium">
                                Your AI-powered second brain — fully offline, fully yours.
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 px-8 pb-8">
                <div className="max-w-[1240px] mx-auto space-y-5">

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {QUICK_ACTIONS.map(action => (
                            <button
                                key={action.id}
                                onClick={() => {
                                    if (action.id === 'search') onTabChange?.('knowledge');
                                    else if (action.id === 'note') onTabChange?.('workspace');
                                    else if (action.id === 'group') onTabChange?.('campus');
                                }}
                                className="relative overflow-hidden group flex items-center gap-4 p-4 rounded-[20px] bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 hover:border-synapse-500/50 dark:hover:border-synapse-500/50 hover:bg-slate-50 dark:hover:bg-dark-800/50 transition-all duration-300 hover:shadow-xl hover:shadow-synapse-500/10 dark:hover:shadow-none"
                            >
                                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${action.color} flex items-center justify-center text-white shadow-lg ${action.shadow} dark:shadow-none flex-shrink-0 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}>
                                    <action.icon size={18} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-dark-200 group-hover:text-synapse-600 dark:group-hover:text-synapse-400 transition-colors">{action.label}</span>
                                <div className="ml-auto w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 dark:bg-dark-950 group-hover:bg-synapse-50 dark:group-hover:bg-synapse-900/30 transition-colors transform scale-90 group-hover:scale-100">
                                    <ArrowUpRight size={14} className="text-slate-400 dark:text-dark-500 group-hover:text-synapse-600 dark:group-hover:text-synapse-400 transition-colors" />
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label="Documents" value={stats.docs} icon={FileText} color="text-synapse-500" accent="bg-synapse-50 dark:bg-synapse-900/20" />
                        <StatCard label="Active Peers" value={stats.peers} icon={Globe} color="text-emerald-500" accent="bg-emerald-50 dark:bg-emerald-900/20" />
                        <StatCard label="Contributions" value={stats.contributions} icon={BookOpen} color="text-blue-500" accent="bg-blue-50 dark:bg-blue-900/20" />
                        <StatCard label="AI Queries" value="0" icon={Zap} color="text-amber-500" accent="bg-amber-50 dark:bg-amber-900/20" />
                    </div>

                    {/* Trending on Campus */}
                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-[24px] p-5 shadow-sm shadow-slate-100/50 dark:shadow-none">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <TrendingUp size={16} className="text-amber-500" />
                                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Trending on Campus</h3>
                            </div>
                            <button onClick={() => onTabChange?.('knowledge')} className="px-4 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-dark-950 text-slate-600 dark:text-dark-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors border border-slate-200/60 dark:border-dark-700/60">View All</button>
                        </div>
                        <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 dark:bg-dark-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-dark-800">
                            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-900 flex items-center justify-center text-slate-300 dark:text-dark-600 mb-3 shadow-sm border border-slate-100 dark:border-dark-800">
                                <TrendingUp size={24} />
                            </div>
                            <h4 className="text-sm font-bold text-slate-700 dark:text-dark-200 mb-1">No trending notes</h4>
                            <p className="text-xs font-medium text-slate-500 dark:text-dark-400">Start sharing to see what's popular on campus.</p>
                        </div>
                    </div>

                    {/* Two-Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                        {/* Campus Activity Feed */}
                        <div className="lg:col-span-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-[24px] overflow-hidden flex flex-col shadow-sm shadow-slate-100/50 dark:shadow-none">
                            <div className="px-5 py-5 border-b border-slate-100 dark:border-dark-800 flex items-center justify-between bg-slate-50/50 dark:bg-dark-950/30">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex items-center justify-center w-2 h-2">
                                        <div className="absolute w-full h-full rounded-full bg-emerald-400 opacity-40 animate-ping" />
                                        <div className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    </div>
                                    <h3 className="text-xs font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Campus Activity</h3>
                                </div>
                                <button className="px-4 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-dark-900 text-slate-600 dark:text-dark-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition-colors border border-slate-200/60 dark:border-dark-700/60 shadow-sm">View All</button>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-dark-800 flex-1 flex flex-col">
                                {MOCK_ACTIVITY_FEED.length > 0 ? MOCK_ACTIVITY_FEED.map(item => (
                                    <div key={item.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50/80 dark:hover:bg-dark-800/50 transition-colors group cursor-pointer">
                                        <div className={`w-9 h-9 rounded-2xl ${item.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-dark-200 leading-snug mb-1.5">{item.message}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-widest">{item.user}</span>
                                                <span className="text-[10px] text-slate-300 dark:text-dark-600">•</span>
                                                <span className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-widest">{item.time}</span>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-dark-900 border border-slate-100 dark:border-dark-800 opacity-0 group-hover:opacity-100 transition-all shadow-sm transform scale-90 group-hover:scale-100 mt-1">
                                            <ArrowUpRight size={14} className="text-synapse-500" />
                                        </div>
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-dark-950 flex items-center justify-center text-slate-300 dark:text-dark-600 mb-3 border border-slate-100 dark:border-dark-800">
                                            <Activity size={24} />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-dark-200 mb-1">It's quiet here</h4>
                                        <p className="text-xs font-medium text-slate-500 dark:text-dark-400">Activity from your peers will appear here.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Peers Nearby */}
                            <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-[24px] p-5 shadow-sm shadow-slate-100/50 dark:shadow-none flex flex-col h-full">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-xs font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider flex items-center gap-2">
                                        <Activity size={14} className="text-emerald-500" /> Peers Nearby
                                    </h3>
                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        {stats.peers} ONLINE
                                    </span>
                                </div>
                                {stats.peers > 0 ? (
                                    <div className="flex flex-col gap-2 flex-1">
                                        <div className="text-sm font-medium text-slate-600 dark:text-dark-300 bg-slate-50 dark:bg-dark-950 p-3 rounded-xl border border-slate-100 dark:border-dark-800 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                <Globe size={14} />
                                            </div>
                                            <span className="flex-1 text-xs font-bold">Connected to campus mesh</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-center bg-slate-50/50 dark:bg-dark-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-dark-800 flex-1 min-h-[120px]">
                                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-dark-900 flex items-center justify-center text-slate-300 dark:text-dark-600 mb-2 shadow-sm border border-slate-100 dark:border-dark-800">
                                            <Globe size={20} />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-dark-200 mb-0.5">No peers nearby</h4>
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-dark-400">Waiting for others to join.</p>
                                    </div>
                                )}
                            </div>

                            {/* AI Engine Status */}
                            <div className="bg-gradient-to-br from-synapse-600 to-synapse-800 rounded-[24px] p-5 text-white relative overflow-hidden shadow-lg shadow-synapse-500/20">
                                <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/10 rounded-full blur-2xl pointer-events-none" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                                                <Zap size={14} className="text-white" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">AI Engine</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-full backdrop-blur-sm border border-white/10">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Ready</span>
                                        </div>
                                    </div>
                                    <h4 className="text-xl font-black mb-1">Local Embeddings</h4>
                                    <p className="text-xs font-medium text-white/70 mb-5 leading-relaxed">BGE embeddings running locally on CPU. Your data never leaves your device.</p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-black/20 rounded-full overflow-hidden relative">
                                            <div className="absolute top-0 left-0 h-full w-3/4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" />
                                        </div>
                                        <span className="text-[11px] font-black tracking-wider text-white/90">384-DIM</span>
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

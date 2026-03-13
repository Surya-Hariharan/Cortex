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
    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-5 hover:shadow-lg hover:shadow-slate-100/50 dark:hover:shadow-none transition-all duration-300 group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl ${accent}`}>
                <Icon size={20} className={color} />
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
            <header className="flex-shrink-0 px-8 pt-8 pb-4">
                <div className="max-w-[1240px] mx-auto">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-synapse-500 to-synapse-600 flex items-center justify-center text-white shadow-lg shadow-synapse-200/40 dark:shadow-none">
                            <Home size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-dark-50">
                                Welcome to <span className="text-synapse-600 dark:text-synapse-500">Cortex</span>
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-dark-400 font-medium">
                                Your AI-powered second brain — fully offline, fully yours.
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 px-8 pb-12">
                <div className="max-w-[1240px] mx-auto space-y-8">

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {QUICK_ACTIONS.map(action => (
                            <button
                                key={action.id}
                                onClick={() => {
                                    if (action.id === 'search') onTabChange?.('knowledge');
                                    else if (action.id === 'note') onTabChange?.('workspace');
                                    else if (action.id === 'group') onTabChange?.('campus');
                                }}
                                className="relative overflow-hidden group flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-dark-700 transition-all duration-300 hover:shadow-lg dark:hover:shadow-none"
                            >
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${action.color} flex items-center justify-center text-white shadow-lg ${action.shadow} dark:shadow-none flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                                    <action.icon size={22} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-dark-200 group-hover:text-slate-900 dark:group-hover:text-dark-50 transition-colors">{action.label}</span>
                                <ArrowUpRight size={14} className="ml-auto text-slate-300 dark:text-dark-600 group-hover:text-synapse-500 transition-colors" />
                            </button>
                        ))}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Documents" value={stats.docs} icon={FileText} color="text-synapse-500" accent="bg-synapse-50 dark:bg-synapse-900/20" />
                        <StatCard label="Active Peers" value={stats.peers} icon={Globe} color="text-emerald-500" accent="bg-emerald-50 dark:bg-emerald-900/20" />
                        <StatCard label="Contributions" value={stats.contributions} icon={BookOpen} color="text-blue-500" accent="bg-blue-50 dark:bg-blue-900/20" />
                        <StatCard label="AI Queries" value="0" icon={Zap} color="text-amber-500" accent="bg-amber-50 dark:bg-amber-900/20" />
                    </div>

                    {/* Trending on Campus */}
                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-amber-500" />
                                <h3 className="text-sm font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Trending on Campus</h3>
                            </div>
                            <button onClick={() => onTabChange?.('knowledge')} className="text-xs font-bold text-synapse-600 dark:text-synapse-400 hover:underline">View All</button>
                        </div>
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <p className="text-sm text-slate-400 dark:text-dark-500">No trending notes yet. Start sharing to see what's popular.</p>
                        </div>
                    </div>

                    {/* Two-Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                        {/* Campus Activity Feed */}
                        <div className="lg:col-span-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 dark:border-dark-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <h3 className="text-sm font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Campus Activity</h3>
                                </div>
                                <button className="text-xs font-bold text-synapse-600 dark:text-synapse-400 hover:underline">View All</button>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-dark-800">
                                {MOCK_ACTIVITY_FEED.map(item => (
                                    <div key={item.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-dark-800/30 transition-colors group cursor-pointer">
                                        <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-slate-700 dark:text-dark-200 leading-snug mb-1">{item.message}</p>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">{item.user}</span>
                                                <span className="text-[10px] text-slate-300 dark:text-dark-600">•</span>
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">{item.time}</span>
                                            </div>
                                        </div>
                                        <ArrowUpRight size={14} className="text-slate-300 dark:text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Peers Nearby */}
                            <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-[0.2em] flex items-center gap-2">
                                        <Activity size={12} /> Peers Nearby
                                    </h3>
                                    <span className="text-[10px] font-black text-slate-400 dark:text-dark-500 bg-slate-100 dark:bg-dark-800 px-3 py-1 rounded-full border border-slate-200 dark:border-dark-700">0 ONLINE</span>
                                </div>
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <p className="text-xs text-slate-400 dark:text-dark-500">No peers nearby yet</p>
                                </div>
                            </div>

                            {/* AI Engine Status */}
                            <div className="bg-gradient-to-br from-synapse-600 to-synapse-800 rounded-3xl p-6 text-white relative overflow-hidden">
                                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Zap size={18} />
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">AI Engine</span>
                                    </div>
                                    <h4 className="text-xl font-black mb-1">Ready</h4>
                                    <p className="text-sm font-medium opacity-80 mb-6">BGE embeddings active on CPU</p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                            <div className="h-full w-3/4 bg-white rounded-full" />
                                        </div>
                                        <span className="text-[10px] font-bold">384-dim</span>
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

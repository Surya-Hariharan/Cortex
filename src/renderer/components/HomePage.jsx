import React from 'react';
import {
    Home,
    Search,
    FileText,
    Upload,
    Users,
    Globe,
    Download,
    Star,
    ArrowUpRight,
    Activity,
    Zap,
    Plus,
    TrendingUp,
    BookOpen,
    MessageSquare,
    Bell
} from 'lucide-react';

const MOCK_ACTIVITY_FEED = [
    { id: 1, type: 'upload', icon: <Upload size={16} />, color: 'text-synapse-500 bg-synapse-50 dark:bg-synapse-900/20', message: 'Deep Learning Notes uploaded to Academic Hub', user: 'Aditya Raj', time: '2 min ago' },
    { id: 2, type: 'download', icon: <Download size={16} />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', message: 'Operating Systems Lab Manual downloaded by 3 peers', user: 'Network', time: '15 min ago' },
    { id: 3, type: 'peer', icon: <Users size={16} />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', message: '4 students nearby sharing resources', user: 'Mesh Network', time: '28 min ago' },
    { id: 4, type: 'rating', icon: <Star size={16} />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', message: 'Your TOC Cheatsheet received a 5-star rating', user: 'Priya S.', time: '1h ago' },
    { id: 5, type: 'ai', icon: <Zap size={16} />, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20', message: 'AI indexed 12 new document chunks from your uploads', user: 'System', time: '2h ago' },
    { id: 6, type: 'group', icon: <MessageSquare size={16} />, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20', message: 'New message in ML Study Group', user: 'Rohan K.', time: '3h ago' },
];

const QUICK_ACTIONS = [
    { id: 'search', label: 'New Search', icon: Search, color: 'from-synapse-500 to-indigo-500', shadow: 'shadow-synapse-200/40' },
    { id: 'upload', label: 'Upload PDF', icon: Upload, color: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-200/40' },
    { id: 'note', label: 'Create Note', icon: FileText, color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-200/40' },
    { id: 'group', label: 'Study Group', icon: Users, color: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-200/40' },
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

export default function HomePage({ onTabChange, onUploadPdf }) {
    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in overflow-y-auto custom-scrollbar">
            {/* Header */}
            <header className="flex-shrink-0 px-8 pt-8 pb-4">
                <div className="max-w-[1240px] mx-auto">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-synapse-500 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-synapse-200/40 dark:shadow-none">
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
                                    if (action.id === 'upload') onUploadPdf?.();
                                    else if (action.id === 'search') onTabChange?.('knowledge');
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
                        <StatCard label="Documents" value="42" icon={FileText} trend="+3 this week" color="text-synapse-500" accent="bg-synapse-50 dark:bg-synapse-900/20" />
                        <StatCard label="Active Peers" value="7" icon={Globe} trend="2 nearby" color="text-emerald-500" accent="bg-emerald-50 dark:bg-emerald-900/20" />
                        <StatCard label="Contributions" value="12" icon={BookOpen} trend="+2 uploads" color="text-blue-500" accent="bg-blue-50 dark:bg-blue-900/20" />
                        <StatCard label="AI Queries" value="156" icon={Zap} trend="+28 today" color="text-amber-500" accent="bg-amber-50 dark:bg-amber-900/20" />
                    </div>

                    {/* Trending on Campus */}
                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-rose-500" />
                                <h3 className="text-sm font-black uppercase text-slate-800 dark:text-dark-50 tracking-wider">Trending on Campus</h3>
                            </div>
                            <button onClick={() => onTabChange?.('knowledge')} className="text-xs font-bold text-synapse-600 dark:text-synapse-400 hover:underline">View All</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { title: 'Operating Systems Cheatsheet', subject: 'Computer Science', downloads: 1240, rating: 4.9, trend: '🔥', color: 'from-orange-500 to-red-500' },
                                { title: 'ML Midterm Revision Notes', subject: 'Machine Learning', downloads: 980, rating: 4.8, trend: '📈', color: 'from-synapse-500 to-indigo-500' },
                                { title: 'Computer Networks Quick Guide', subject: 'Networking', downloads: 670, rating: 4.6, trend: '⭐', color: 'from-emerald-500 to-teal-500' },
                            ].map((note, i) => (
                                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-dark-950/50 border border-slate-100 dark:border-dark-800/60 hover:shadow-md hover:shadow-slate-100/50 dark:hover:shadow-none transition-all cursor-pointer group">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${note.color} flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0`}>
                                        {note.trend}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[13px] font-bold text-slate-800 dark:text-dark-100 truncate group-hover:text-synapse-600 transition-colors">{note.title}</h4>
                                        <p className="text-[11px] text-slate-400 dark:text-dark-500 font-medium mb-2">{note.subject}</p>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 dark:text-dark-500">
                                            <span className="flex items-center gap-1"><Download size={10} /> {note.downloads.toLocaleString()}</span>
                                            <span className="flex items-center gap-1"><Star size={10} className="text-amber-400" /> {note.rating}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/50">4 ONLINE</span>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { name: 'Aditya R.', docs: 12, status: 'online' },
                                        { name: 'Priya S.', docs: 8, status: 'online' },
                                        { name: 'Rohan K.', docs: 15, status: 'online' },
                                        { name: 'Maya D.', docs: 6, status: 'idle' },
                                    ].map((peer, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-dark-800/50 transition-colors cursor-pointer">
                                            <div className="relative">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-[11px] font-bold text-slate-500 dark:text-dark-300">
                                                    {peer.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-dark-900 ${peer.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold text-slate-700 dark:text-dark-200 truncate">{peer.name}</p>
                                                <p className="text-[10px] text-slate-400 dark:text-dark-500 font-bold">{peer.docs} docs shared</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AI Engine Status */}
                            <div className="bg-gradient-to-br from-synapse-600 to-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden">
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

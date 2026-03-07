import React, { useState } from 'react';
import {
    Bell,
    Download,
    Star,
    Users,
    Upload,
    CheckCheck,
    Zap,
    MessageSquare,
    Filter,
    Settings,
    Check,
    Trash2,
    ArrowUpRight
} from 'lucide-react';

const MOCK_NOTIFICATIONS = [
    { id: 1, type: 'download', icon: <Download size={16} />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', title: 'Your notes were downloaded', description: 'Neural Networks & Deep Learning was downloaded by 3 students', time: '2 min ago', read: false },
    { id: 2, type: 'rating', icon: <Star size={16} />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', title: 'New rating received', description: 'Priya S. rated your TOC Cheatsheet ★★★★★', time: '15 min ago', read: false },
    { id: 3, type: 'peer', icon: <Users size={16} />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', title: 'Peer nearby sharing files', description: 'Aditya R. is sharing 12 documents on the mesh network', time: '28 min ago', read: false },
    { id: 4, type: 'group', icon: <MessageSquare size={16} />, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20', title: 'New message in ML Study Group', description: 'Rohan K.: "Can we schedule a study session this weekend?"', time: '1h ago', read: true },
    { id: 5, type: 'system', icon: <Zap size={16} />, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20', title: 'AI indexing complete', description: '12 new document chunks have been indexed and are searchable', time: '2h ago', read: true },
    { id: 6, type: 'upload', icon: <Upload size={16} />, color: 'text-synapse-500 bg-synapse-50 dark:bg-synapse-900/20', title: 'New notes in Machine Learning', description: 'Deep Learning lecture slides uploaded to Academic Hub', time: '3h ago', read: true },
    { id: 7, type: 'download', icon: <Download size={16} />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', title: 'Download milestone reached', description: 'Your Operating Systems notes crossed 1,000 downloads!', time: '5h ago', read: true },
    { id: 8, type: 'peer', icon: <Users size={16} />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', title: 'New peer connected', description: 'Maya D. joined the campus mesh network', time: '8h ago', read: true },
    { id: 9, type: 'rating', icon: <Star size={16} />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', title: 'Positive feedback', description: 'Vikram P. left a comment: "Best OS notes ever!"', time: '1d ago', read: true },
    { id: 10, type: 'system', icon: <Zap size={16} />, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20', title: 'System update', description: 'BGE embeddings model updated to latest version', time: '2d ago', read: true },
];

const FILTER_TYPES = ['All', 'Downloads', 'Ratings', 'Peers', 'Groups', 'System'];

export default function Notifications() {
    const [activeFilter, setActiveFilter] = useState('All');
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

    const unreadCount = notifications.filter(n => !n.read).length;

    const filtered = notifications.filter(n => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Downloads') return n.type === 'download';
        if (activeFilter === 'Ratings') return n.type === 'rating';
        if (activeFilter === 'Peers') return n.type === 'peer';
        if (activeFilter === 'Groups') return n.type === 'group';
        if (activeFilter === 'System') return n.type === 'system' || n.type === 'upload';
        return true;
    });

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const markRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in overflow-y-auto custom-scrollbar">
            {/* Header */}
            <header className="flex-shrink-0 px-8 pt-8 pb-4">
                <div className="max-w-[800px] mx-auto">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-200/40 dark:shadow-none">
                                        <Bell size={24} />
                                    </div>
                                    {unreadCount > 0 && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-dark-950">
                                            {unreadCount}
                                        </div>
                                    )}
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-dark-50">
                                    Noti<span className="text-rose-500">fications</span>
                                </h1>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-dark-400 font-medium">
                                Stay updated with downloads, ratings, and peer activity.
                            </p>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-synapse-600 dark:text-synapse-400 hover:bg-synapse-50 dark:hover:bg-synapse-900/10 rounded-xl transition-colors"
                            >
                                <CheckCheck size={16} /> Mark all read
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex-1 px-8 pb-12">
                <div className="max-w-[800px] mx-auto space-y-4">

                    {/* Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {FILTER_TYPES.map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`px-4 py-2 text-[11px] font-bold rounded-xl transition-all whitespace-nowrap ${activeFilter === f ? 'bg-synapse-600 text-white shadow-sm' : 'bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-slate-500 dark:text-dark-400 hover:bg-slate-50 dark:hover:bg-dark-800'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {/* Notification List */}
                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-dark-800">
                            {filtered.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => markRead(n.id)}
                                    className={`px-6 py-5 flex items-start gap-4 transition-colors cursor-pointer group ${!n.read ? 'bg-synapse-50/30 dark:bg-synapse-900/5 hover:bg-synapse-50/50 dark:hover:bg-synapse-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-dark-800/30'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl ${n.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                        {n.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            {!n.read && <div className="w-2 h-2 rounded-full bg-synapse-500 flex-shrink-0" />}
                                            <h4 className={`text-[13px] font-bold truncate ${!n.read ? 'text-slate-900 dark:text-dark-50' : 'text-slate-700 dark:text-dark-200'}`}>{n.title}</h4>
                                        </div>
                                        <p className="text-[12px] text-slate-500 dark:text-dark-400 font-medium leading-relaxed">{n.description}</p>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest mt-1 inline-block">{n.time}</span>
                                    </div>
                                    <ArrowUpRight size={14} className="text-slate-300 dark:text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {filtered.length === 0 && (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-dark-600">
                                <Bell size={32} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-dark-50 mb-2">No notifications</h3>
                            <p className="text-sm text-slate-500 dark:text-dark-400">You're all caught up!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

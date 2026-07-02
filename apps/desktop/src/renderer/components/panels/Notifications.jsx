import React, { useState, useEffect } from 'react';
import {
    Bell, Download, Star, Users, Upload, CheckCheck, Zap,
    MessageSquare, Trash2, Check, AlertCircle, Award, X
} from 'lucide-react';
import { notifications as notifApi, getUserId } from '../../../services/api.js';

const TYPE_CONFIG = {
    download:  { icon: <Download size={18} />,      color: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
    milestone: { icon: <Award size={18} />,          color: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    rating:    { icon: <Star size={18} />,            color: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' },
    peer:      { icon: <Users size={18} />,           color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
    group:     { icon: <MessageSquare size={18} />,  color: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' },
    system:    { icon: <AlertCircle size={18} />,    color: 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-dark-300' },
    upload:    { icon: <Upload size={18} />,          color: 'bg-synapse-100 dark:bg-synapse-900/20 text-synapse-600 dark:text-synapse-400' },
};

const FILTER_TYPES = ['All', 'Downloads', 'Ratings', 'Peers', 'Groups', 'System'];

function relativeTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
}

function filterMatches(n, activeFilter) {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Downloads') return n.type === 'download' || n.type === 'milestone';
    if (activeFilter === 'Ratings')   return n.type === 'rating';
    if (activeFilter === 'Peers')     return n.type === 'peer';
    if (activeFilter === 'Groups')    return n.type === 'group';
    if (activeFilter === 'System')    return n.type === 'system' || n.type === 'upload';
    return true;
}

export default function Notifications() {
    const [activeFilter, setActiveFilter] = useState('All');
    const [notifications, setNotifications] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const userId = getUserId();

    const load = async () => {
        if (!userId) { setLoading(false); return; }
        try {
            const res = await notifApi.list(userId);
            setNotifications(res?.notifications ?? []);
        } catch (_) {}
        setLoading(false);
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;
    const filtered = notifications.filter(n => filterMatches(n, activeFilter));

    const markRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        if (userId) notifApi.markRead(id, userId).catch(() => {});
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        if (userId) notifApi.markAllRead(userId).catch(() => {});
    };

    const deleteOne = (e, id) => {
        e.stopPropagation();
        setNotifications(prev => prev.filter(n => n.id !== id));
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
        if (userId) notifApi.deleteOne(id, userId).catch(() => {});
    };

    const deleteSelected = () => {
        const ids = [...selected];
        setNotifications(prev => prev.filter(n => !selected.has(n.id)));
        setSelected(new Set());
        if (userId) ids.forEach(id => notifApi.deleteOne(id, userId).catch(() => {}));
    };

    const deleteAll = () => {
        setNotifications([]);
        setSelected(new Set());
        if (userId) notifApi.deleteAll(userId).catch(() => {});
    };

    const toggleSelect = (e, id) => {
        e.stopPropagation();
        setSelected(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };

    const allFilteredSelected = filtered.length > 0 && filtered.every(n => selected.has(n.id));
    const toggleSelectAll = () => {
        setSelected(prev => {
            const s = new Set(prev);
            if (allFilteredSelected) {
                filtered.forEach(n => s.delete(n.id));
            } else {
                filtered.forEach(n => s.add(n.id));
            }
            return s;
        });
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
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-synapse-500 to-synapse-600 flex items-center justify-center text-white shadow-lg shadow-synapse-200/40 dark:shadow-none">
                                        <Bell size={24} />
                                    </div>
                                    {unreadCount > 0 && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-dark-950">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </div>
                                    )}
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-dark-50">
                                    Noti<span className="text-synapse-500">fications</span>
                                </h1>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-dark-400 font-medium">
                                Stay updated with downloads, ratings, and peer activity.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-synapse-600 dark:text-synapse-400 hover:bg-synapse-50 dark:hover:bg-synapse-900/10 rounded-xl transition-colors"
                                >
                                    <CheckCheck size={16} /> Mark all read
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={deleteAll}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors"
                                >
                                    <Trash2 size={16} /> Clear all
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 px-8 pb-12">
                <div className="max-w-[800px] mx-auto space-y-4">

                    {/* Filters + bulk toolbar */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-1 overflow-x-auto pb-1">
                            {FILTER_TYPES.map(f => (
                                <button
                                    key={f}
                                    onClick={() => { setActiveFilter(f); setSelected(new Set()); }}
                                    className={`px-4 py-2 text-[11px] font-bold rounded-xl transition-all whitespace-nowrap ${activeFilter === f ? 'bg-synapse-600 text-white shadow-sm' : 'bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-slate-500 dark:text-dark-400 hover:bg-slate-50 dark:hover:bg-dark-800'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        {selected.size > 0 && (
                            <button
                                onClick={deleteSelected}
                                className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl transition-all whitespace-nowrap"
                            >
                                <Trash2 size={13} /> Delete {selected.size}
                            </button>
                        )}
                    </div>

                    {/* Notification list */}
                    {loading ? (
                        <div className="py-16 text-center">
                            <div className="w-8 h-8 border-2 border-synapse-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-dark-600">
                                <Bell size={32} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-dark-50 mb-2">No notifications</h3>
                            <p className="text-sm text-slate-500 dark:text-dark-400">You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden">
                            {/* Select-all row */}
                            {filtered.length > 1 && (
                                <div className="px-6 py-3 border-b border-slate-100 dark:border-dark-800 flex items-center gap-3 bg-slate-50/50 dark:bg-dark-950/30">
                                    <button
                                        onClick={toggleSelectAll}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${allFilteredSelected ? 'bg-synapse-600 border-synapse-600 text-white' : 'border-slate-300 dark:border-dark-600 hover:border-synapse-400 bg-white dark:bg-dark-900'}`}
                                    >
                                        {allFilteredSelected && <Check size={11} strokeWidth={3} />}
                                    </button>
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-dark-400">
                                        {selected.size > 0 ? `${selected.size} of ${filtered.length} selected` : `Select all (${filtered.length})`}
                                    </span>
                                </div>
                            )}

                            <div className="divide-y divide-slate-100 dark:divide-dark-800">
                                {filtered.map(n => {
                                    const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system;
                                    const isSelected = selected.has(n.id);
                                    return (
                                        <div
                                            key={n.id}
                                            onClick={() => markRead(n.id)}
                                            className={`px-6 py-5 flex items-start gap-4 transition-colors cursor-pointer group ${isSelected ? 'bg-synapse-50/60 dark:bg-synapse-900/10' : !n.read ? 'bg-synapse-50/30 dark:bg-synapse-900/5 hover:bg-synapse-50/60 dark:hover:bg-synapse-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-dark-800/30'}`}
                                        >
                                            {/* Checkbox */}
                                            <button
                                                onClick={(e) => toggleSelect(e, n.id)}
                                                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? '!opacity-100 bg-synapse-600 border-synapse-600 text-white' : 'opacity-0 group-hover:opacity-100 border-slate-300 dark:border-dark-600 hover:border-synapse-400 bg-white dark:bg-dark-900'}`}
                                            >
                                                {isSelected && <Check size={11} strokeWidth={3} />}
                                            </button>

                                            {/* Type icon */}
                                            <div className={`w-10 h-10 rounded-xl ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                                                {cfg.icon}
                                            </div>

                                            {/* Body */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {!n.read && <div className="w-2 h-2 rounded-full bg-synapse-500 flex-shrink-0" />}
                                                    <h4 className={`text-[13px] font-bold truncate ${!n.read ? 'text-slate-900 dark:text-dark-50' : 'text-slate-700 dark:text-dark-200'}`}>
                                                        {n.title}
                                                    </h4>
                                                </div>
                                                {n.description && (
                                                    <p className="text-[12px] text-slate-500 dark:text-dark-400 font-medium leading-relaxed">{n.description}</p>
                                                )}
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest mt-1 inline-block">
                                                    {relativeTime(n.created_at)}
                                                </span>
                                            </div>

                                            {/* Delete button */}
                                            <button
                                                onClick={(e) => deleteOne(e, n.id)}
                                                className="mt-0.5 p-2 rounded-lg text-slate-300 dark:text-dark-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                                title="Delete"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

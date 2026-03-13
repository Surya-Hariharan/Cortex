import React, { useState, useEffect, useRef } from 'react';
import { Share2 } from 'lucide-react';
import { notes as notesApi, mesh, getUserId } from '../../services/api.js';

// Encode/decode note type and due_date as tags on the backend
function encodeNoteTags(type, dueDate, extraTags = []) {
    const tags = [`type:${type}`, ...extraTags];
    if (dueDate) tags.push(`due:${dueDate}`);
    return tags;
}

function decodeNoteTags(tags) {
    const list = Array.isArray(tags) ? tags : (typeof tags === 'string' ? JSON.parse(tags || '[]') : []);
    let type = 'note', dueDate = null;
    const other = [];
    for (const t of list) {
        if (t.startsWith('type:')) type = t.slice(5);
        else if (t.startsWith('due:')) dueDate = t.slice(4);
        else other.push(t);
    }
    return { type, dueDate, tags: other };
}

function toUINote(n) {
    const { type, dueDate, tags } = decodeNoteTags(n.tags);
    return {
        id: n.id,
        title: n.title,
        content: n.content || '',
        type,
        dueDate,
        tags,
        completed: n.is_completed === 1 || n.is_completed === true,
        createdAt: n.created_at,
        _raw: n,
    };
}

const TYPE_CONFIG = {
    note: { icon: '📝', label: 'Note', color: 'bg-synapse-50 dark:bg-synapse-900/20 text-synapse-600 dark:text-synapse-400 border-synapse-200 dark:border-synapse-800' },
    deadline: { icon: '⏰', label: 'Deadline', color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' },
    task: { icon: '✅', label: 'Task', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
    idea: { icon: '💡', label: 'Idea', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-800' },
};

function getDueStatus(dueDate) {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, cls: 'text-red-600 font-bold', urgent: true };
    if (diffDays === 0) return { label: 'Due today', cls: 'text-amber-600 font-bold', urgent: true };
    if (diffDays === 1) return { label: 'Due tomorrow', cls: 'text-amber-600 font-bold', urgent: false };
    if (diffDays <= 7) return { label: `Due in ${diffDays}d`, cls: 'text-synapse-600', urgent: false };
    return { label: `Due in ${diffDays}d`, cls: 'text-dark-500', urgent: false };
}

export default function NotesTab({ onToast }) {
    const [notes, setNotes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState('all'); // all | note | deadline | task | idea
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('note');
    const [dueDate, setDueDate] = useState('');
    const titleRef = useRef(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest'); // newest | oldest | deadline
    const [meshPeers, setMeshPeers] = useState([]);
    const [shareNoteMenu, setShareNoteMenu] = useState(null); // noteId or null

    const loadNotes = async () => {
        try {
            const userId = getUserId();
            const res = await notesApi.list(userId);
            const list = Array.isArray(res) ? res : (res?.notes ?? []);
            const uiNotes = list.map(toUINote);
            setNotes(uiNotes);
            // Cache for offline reads
            try { localStorage.setItem('cortex-notes-cache', JSON.stringify(uiNotes)); } catch { }
        } catch (err) {
            // Offline fallback: load from cache
            const cached = localStorage.getItem('cortex-notes-cache');
            if (cached) {
                try { setNotes(JSON.parse(cached)); } catch { }
            }
            const isOffline = err.message?.includes('offline') || err.message?.includes('timed out');
            if (!isOffline) {
                onToast?.(`Failed to load notes: ${err.message}`, 'error');
            }
        }
    };

    useEffect(() => {
        loadNotes();
    }, []);

    useEffect(() => {
        if (showForm && titleRef.current) titleRef.current.focus();
    }, [showForm]);

    // Keyboard shortcut 'n'
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                setShowForm(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Load mesh peers for sharing
    useEffect(() => {
        mesh.peers().then(res => {
            const list = Array.isArray(res) ? res : (res?.peers ?? []);
            setMeshPeers(list);
        }).catch(() => { });
    }, []);

    // Close share menu on outside click
    useEffect(() => {
        const close = () => setShareNoteMenu(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        try {
            const userId = getUserId();
            await notesApi.create({
                user_id: userId,
                title: title.trim(),
                content: content.trim() || null,
                tags: encodeNoteTags(type, dueDate || null),
            });
            onToast?.(`Added ${TYPE_CONFIG[type]?.label || 'Note'}: "${title.trim()}"`);
            setTitle('');
            setContent('');
            setType('note');
            setDueDate('');
            setShowForm(false);
            loadNotes();
        } catch (err) {
            const isOffline = err.message?.includes('offline') || err.message?.includes('timed out');
            if (isOffline) {
                // Save offline
                const offlineNote = { id: 'offline-' + Date.now(), title: title.trim(), content: content.trim(), type, dueDate, completed: false, tags: [], createdAt: new Date().toISOString(), offline: true };
                setNotes(prev => [offlineNote, ...prev]);
                try {
                    const q = JSON.parse(localStorage.getItem('cortex-notes-offline-queue') || '[]');
                    q.push(offlineNote);
                    localStorage.setItem('cortex-notes-offline-queue', JSON.stringify(q));
                } catch { }
                onToast?.('Saved offline — will sync when backend restarts.');
                setTitle(''); setContent(''); setType('note'); setDueDate(''); setShowForm(false);
            } else {
                onToast?.(`Failed to save note: ${err.message}`, 'error');
            }
        }
    };

    const handleDelete = async (id) => {        try {
            await notesApi.delete(id);
            setNotes(prev => prev.filter(n => n.id !== id));
        } catch {
            // Optimistic delete even if backend is offline
            setNotes(prev => prev.filter(n => n.id !== id));
        }
    };

    const handleToggle = async (id) => {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        // Optimistic update
        setNotes(prev => prev.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
        try {
            await notesApi.update(id, { is_completed: note.completed ? 0 : 1 });
        } catch {
            // Keep optimistic update even if backend is offline
        }
    };

    const handleShareNote = async (peerId) => {
        setShareNoteMenu(null);
        try {
            await mesh.sync(peerId);
            onToast?.('Synced to peer');
        } catch {
            onToast?.('Sync failed', 'error');
        }
    };

    let filtered = notes.filter((n) => filter === 'all' || n.type === filter);
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }

    filtered.sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortBy === 'deadline') {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        return 0;
    });

    const pendingDeadlines = notes.filter((n) => n.type === 'deadline' && !n.completed && n.dueDate).length;
    const completedCount = notes.filter((n) => n.completed).length;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 overflow-hidden">
            {/* ── Redesigned Header (3 Layers) ───────────────────────── */}
            <div className="w-full max-w-[1100px] mx-auto px-8 pt-8 pb-4 space-y-6">

                {/* Layer 1: Title & Primary CTA */}
                <div className="flex items-end justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-black tracking-tight text-dark-800 dark:text-dark-50">Notes & Deadlines</h1>
                        <p className="text-[13px] text-dark-500/80 dark:text-dark-400/60 font-medium flex items-center gap-2">
                            <span>{notes.length} items</span>
                            <span className="w-1 h-1 rounded-full bg-dark-300 dark:bg-dark-700" />
                            <span>{completedCount} completed</span>
                            {pendingDeadlines > 0 && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-dark-300 dark:bg-dark-700" />
                                    <span className="text-amber-600 dark:text-amber-500/80 font-bold">
                                        {pendingDeadlines} upcoming
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn-primary group flex items-center gap-2 pr-5 pl-4 py-2.5 rounded-xl transition-all duration-300 transform active:scale-95"
                        >
                            <svg className="transition-transform group-hover:rotate-90" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span className="text-sm font-bold">Add Note</span>
                        </button>
                    )}
                </div>

                {/* Layer 2: Segmented Filter Control */}
                <div className="segmented-control w-fit">
                    {[
                        { id: 'all', label: 'All', icon: '📋' },
                        ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, label: c.label, icon: c.icon })),
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`segmented-item ${filter === f.id ? 'segmented-item-active' : 'segmented-item-inactive'}`}
                        >
                            <span className="text-sm">{f.icon}</span>
                            <span>{f.label}</span>
                        </button>
                    ))}
                </div>

                {/* Layer 3: Search & Sorting */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 dark:text-dark-500 pointer-events-none group-focus-within:text-synapse-500 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search through notes..."
                            className="w-full bg-dark-50/50 dark:bg-dark-900 border border-dark-200/50 dark:border-dark-800/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-dark-800 dark:text-dark-50 font-medium placeholder-dark-400 dark:placeholder-dark-600 outline-none focus:ring-2 focus:ring-synapse-500/10 focus:border-synapse-500/40 focus:bg-white dark:focus:bg-dark-900 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-dark-50/50 dark:bg-dark-900 border border-dark-200/50 dark:border-dark-800/50 px-3 py-1.5 rounded-xl shadow-sm">
                        <span className="text-[10px] font-bold text-dark-400 dark:text-dark-500 uppercase tracking-widest pl-1">Sort</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-transparent border-none text-[13px] font-bold text-dark-700 dark:text-dark-200 outline-none focus:ring-0 cursor-pointer pr-1"
                        >
                            <option value="newest">Recent</option>
                            <option value="oldest">Oldest</option>
                            <option value="deadline">By Date</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Dynamic Form (Integrated) ────────────────────────── */}
            {showForm && (
                <div className="w-full max-w-[1100px] mx-auto px-8 pb-6 animate-slide-down">
                    <form onSubmit={handleAdd} className="glass-panel dark:bg-dark-900/40 p-6 space-y-4 shadow-xl border-synapse-200/40 dark:border-synapse-800/40 bg-white/50 dark:bg-dark-900/20 backdrop-blur-md">
                        <div className="flex gap-4">
                            <input
                                ref={titleRef}
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="What's the topic?"
                                className="flex-1 bg-white dark:bg-dark-950 border border-dark-200 dark:border-dark-800 shadow-sm rounded-xl px-4 py-3 text-sm text-dark-800 dark:text-dark-50 font-bold placeholder-dark-400 focus:ring-2 focus:ring-synapse-500/10 focus:border-synapse-500 transition-all outline-none"
                            />
                            <div className="flex items-center gap-2 p-1 bg-dark-100/50 dark:bg-dark-950 rounded-xl border border-dark-200 dark:border-dark-800">
                                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setType(key)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${type === key
                                            ? 'bg-white dark:bg-dark-800 shadow-sm border border-dark-200 dark:border-dark-700 text-dark-800 dark:text-dark-50'
                                            : 'text-dark-400 hover:text-dark-600 dark:hover:text-dark-200'}`}
                                    >
                                        <span>{cfg.icon}</span>
                                        <span className="hidden lg:inline">{cfg.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Add more context or details here..."
                            rows={3}
                            className="w-full bg-white dark:bg-dark-950 border border-dark-200 dark:border-dark-800 shadow-sm rounded-xl px-4 py-3 text-sm text-dark-700 dark:text-dark-200 font-medium placeholder-dark-400 focus:ring-2 focus:ring-synapse-500/10 focus:border-synapse-500 transition-all outline-none resize-none"
                        />
                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-widest ml-1 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="bg-white dark:bg-dark-950 border border-dark-200 dark:border-dark-800 shadow-sm rounded-xl px-3 py-2 text-xs font-bold text-dark-700 dark:text-dark-200 outline-none focus:border-synapse-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={!title.trim()} className="btn-primary px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-synapse-500/20 active:scale-95 transition-transform">
                                    Create Note
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Redesigned List ───────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto w-full max-w-[1100px] mx-auto px-8 pb-12 space-y-4">
                {filtered.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-24 text-center animate-fade-in group">
                        <div className="relative mb-8 transform transition-transform group-hover:scale-110 duration-500">
                            <div className="text-8xl filter drop-shadow-2xl">
                                {filter === 'all' ? '✨' : TYPE_CONFIG[filter]?.icon || '📝'}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-synapse-500 text-white rounded-full p-2 shadow-lg animate-pulse-slow">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-dark-800 dark:text-dark-50 mb-2">
                            {notes.length === 0 ? "Your mind is a blank canvas" : `No ${filter} found`}
                        </h3>
                        <p className="text-dark-500 dark:text-dark-400 font-medium text-sm max-w-[320px] leading-relaxed mb-8">
                            {notes.length === 0
                                ? "Cortex is ready to capture your brilliance. Start by adding your first note, deadline, or task."
                                : `Try adjusting your search query or filter to find what you're looking for.`}
                        </p>
                        {notes.length === 0 && !showForm && (
                            <button
                                onClick={() => setShowForm(true)}
                                className="px-8 py-3 bg-dark-50 dark:bg-dark-900 hover:bg-synapse-500 hover:text-white dark:hover:bg-synapse-600 border-2 border-dashed border-dark-200 dark:border-dark-800 hover:border-synapse-400 text-dark-600 dark:text-dark-200 font-black rounded-2xl transition-all duration-300 transform active:scale-95 shadow-sm"
                            >
                                Create First Note
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map((note, idx) => {
                            const cfg = TYPE_CONFIG[note.type] || TYPE_CONFIG.note;
                            const due = getDueStatus(note.dueDate);
                            const delay = `stagger-${Math.min(idx + 1, 5)}`;

                            return (
                                <div
                                    key={note.id}
                                    className={`group flex flex-col bg-white dark:bg-dark-900 border border-dark-200/50 dark:border-dark-800/50 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-synapse-300 dark:hover:border-synapse-800 transition-all duration-300 animate-slide-up ${delay} relative overflow-hidden ${note.completed ? 'opacity-60' : ''}`}
                                >
                                    {/* Sidebar Status Line */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${note.completed ? 'bg-emerald-500/40' : (due?.urgent ? 'bg-red-500' : (note.dueDate ? 'bg-amber-500/50' : 'bg-synapse-500/30'))}`} />

                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggle(note.id)}
                                                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${note.completed
                                                    ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/20'
                                                    : 'bg-transparent border-dark-200 dark:border-dark-700 hover:border-synapse-500'}`}
                                            >
                                                {note.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                            </button>
                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border flex items-center gap-1.5 ${cfg.color}`}>
                                                <span>{cfg.icon}</span>
                                                <span>{cfg.label}</span>
                                            </span>
                                        </div>

                                        {/* Hover Actions */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                            {meshPeers.filter(p => !p.isMe).length > 0 && (
                                                <div className="relative" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => setShareNoteMenu(shareNoteMenu === note.id ? null : note.id)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-400 hover:text-synapse-500 hover:bg-synapse-50 dark:hover:bg-synapse-500/10 transition-all"
                                                        title="Share to peer"
                                                    >
                                                        <Share2 size={15} />
                                                    </button>
                                                    {shareNoteMenu === note.id && (
                                                        <div className="absolute right-0 top-9 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 rounded-xl shadow-xl z-50 min-w-[160px] py-1">
                                                            {meshPeers.filter(p => !p.isMe).map(peer => (
                                                                <button
                                                                    key={peer.device_id || peer.peer_id}
                                                                    onClick={() => handleShareNote(peer.device_id || peer.peer_id)}
                                                                    className="w-full text-left px-3 py-2 text-xs font-bold text-dark-700 dark:text-dark-200 hover:bg-dark-50 dark:hover:bg-dark-800 truncate"
                                                                >
                                                                    {peer.display_name || peer.name || peer.device_id}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <button
                                                onClick={() => handleDelete(note.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                                title="Delete"
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <h3 className={`text-base font-black leading-tight mb-2 ${note.completed ? 'line-through text-dark-400 dark:text-dark-500' : 'text-dark-800 dark:text-dark-50'}`}>
                                            {note.title}
                                        </h3>
                                        {note.content && (
                                            <p className="text-sm text-dark-600 dark:text-dark-300 font-medium leading-relaxed line-clamp-3">
                                                {note.content}
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-auto flex items-center justify-between border-t border-dark-100 dark:border-dark-800 pt-3">
                                        <div className="flex items-center gap-3">
                                            {due && (
                                                <div className={`flex items-center gap-1.5 text-[11px] font-bold ${due.cls}`}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                    <span>{due.label}</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-bold text-dark-400 dark:text-dark-600">
                                            {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

import React, { useState, useEffect, useRef } from 'react';

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

    const loadNotes = async () => {
        if (window.electronAPI) {
            const res = await window.electronAPI.getNotes();
            setNotes(res.notes || []);
        }
    };

    useEffect(() => {
        loadNotes();
    }, []);

    useEffect(() => {
        if (showForm && titleRef.current) titleRef.current.focus();
    }, [showForm]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        if (window.electronAPI) {
            const result = await window.electronAPI.addNote({
                title: title.trim(),
                content: content.trim(),
                type,
                dueDate: dueDate || null,
            });
            if (result.success) {
                onToast?.(`Added ${TYPE_CONFIG[type]?.label || 'Note'}: "${title.trim()}"`);
                setTitle('');
                setContent('');
                setType('note');
                setDueDate('');
                setShowForm(false);
                loadNotes();
            }
        }
    };

    const handleDelete = async (id) => {
        if (window.electronAPI) {
            await window.electronAPI.deleteNote(id);
            loadNotes();
        }
    };

    const handleToggle = async (id) => {
        if (window.electronAPI) {
            await window.electronAPI.toggleNoteComplete(id);
            loadNotes();
        }
    };

    const filtered = notes.filter((n) => filter === 'all' || n.type === filter);
    const pendingDeadlines = notes.filter((n) => n.type === 'deadline' && !n.completed && n.dueDate).length;
    const completedCount = notes.filter((n) => n.completed).length;

    return (
        <div className="h-full flex flex-col">
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="px-6 pt-5 pb-3">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-dark-800 dark:text-dark-50">Notes & Deadlines</h2>
                        <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5 font-medium">
                            {notes.length} items · {completedCount} completed
                            {pendingDeadlines > 0 && (
                                <span className="text-amber-600 dark:text-amber-500 ml-2 font-bold">· {pendingDeadlines} upcoming deadline{pendingDeadlines > 1 ? 's' : ''}</span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm((v) => !v)}
                        className="btn-primary flex items-center gap-1.5 text-sm"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add
                    </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2">
                    {[
                        { id: 'all', label: 'All', icon: '📋' },
                        ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, label: c.label, icon: c.icon })),
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${filter === f.id
                                ? 'bg-synapse-50 dark:bg-synapse-900/20 text-synapse-700 dark:text-synapse-400 border-synapse-300 dark:border-synapse-700 shadow-sm'
                                : 'bg-white dark:bg-dark-950 text-dark-500 dark:text-dark-400 hover:text-dark-800 dark:hover:text-dark-50 hover:bg-dark-50 dark:hover:bg-dark-900 border-dark-200 dark:border-dark-800'
                                }`}
                        >
                            <span>{f.icon}</span>
                            <span>{f.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Add Form ──────────────────────────────────────────── */}
            {showForm && (
                <div className="px-6 pb-3 animate-slide-down">
                    <form onSubmit={handleAdd} className="glass-panel dark:bg-dark-900/80 p-4 space-y-3 shadow-md border-synapse-200 dark:border-synapse-800 bg-white dark:bg-dark-900">
                        <div className="flex gap-3">
                            <input
                                ref={titleRef}
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Title..."
                                className="flex-1 bg-white dark:bg-dark-950 border border-dark-200 dark:border-dark-700 shadow-sm rounded-lg px-3 py-2 text-sm text-dark-800 dark:text-dark-50 font-medium placeholder-dark-400 dark:placeholder-dark-500 outline-none focus:border-synapse-400 focus:ring-2 focus:ring-synapse-100 dark:focus:ring-synapse-900/20 transition-all"
                            />
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="bg-white dark:bg-dark-950 border border-dark-200 dark:border-dark-700 shadow-sm rounded-lg px-3 py-2 text-sm text-dark-700 dark:text-dark-200 font-medium outline-none focus:border-synapse-400 focus:ring-2 focus:ring-synapse-100 dark:focus:ring-synapse-900/20 transition-all cursor-pointer"
                            >
                                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                                ))}
                            </select>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Details (optional)..."
                            rows={2}
                            className="w-full bg-white dark:bg-dark-950 border border-dark-200 dark:border-dark-700 shadow-sm rounded-lg px-3 py-2 text-sm text-dark-700 dark:text-dark-200 font-medium placeholder-dark-400 dark:placeholder-dark-500 outline-none focus:border-synapse-400 focus:ring-2 focus:ring-synapse-100 dark:focus:ring-synapse-900/20 transition-all resize-none"
                        />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-dark-500 dark:text-dark-400 font-semibold">Due date:</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="bg-white dark:bg-dark-950 border border-dark-200 dark:border-dark-700 shadow-sm rounded-lg px-2 py-1.5 text-xs font-medium text-dark-700 dark:text-dark-200 outline-none focus:border-synapse-400 focus:ring-1 focus:ring-synapse-100 dark:focus:ring-synapse-900/20"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-xs">
                                    Cancel
                                </button>
                                <button type="submit" disabled={!title.trim()} className="btn-primary text-xs py-1.5 px-4">
                                    Save
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Notes List ────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
                {filtered.length === 0 && (
                    <div className="text-center py-16 animate-fade-in">
                        <div className="text-4xl mb-3">{filter === 'all' ? '📝' : TYPE_CONFIG[filter]?.icon || '📝'}</div>
                        <p className="text-dark-500 dark:text-dark-400 font-medium text-sm">
                            {notes.length === 0
                                ? 'No notes yet. Click "Add" to create your first note or deadline.'
                                : `No ${filter} items.`}
                        </p>
                    </div>
                )}

                {filtered.map((note, idx) => {
                    const cfg = TYPE_CONFIG[note.type] || TYPE_CONFIG.note;
                    const due = getDueStatus(note.dueDate);
                    const delay = `stagger-${Math.min(idx + 1, 5)}`;

                    return (
                        <div
                            key={note.id}
                            className={`glass-panel dark:bg-dark-900/80 dark:border-dark-700 p-4 animate-slide-up ${delay} transition-all duration-200 ${note.completed ? 'opacity-50' : ''
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Checkbox */}
                                <button
                                    onClick={() => handleToggle(note.id)}
                                    className={`mt-0.5 w-5 h-5 rounded-md border-2 shadow-sm flex items-center justify-center flex-shrink-0 transition-all duration-200 ${note.completed
                                        ? 'bg-emerald-500 border-emerald-600 dark:border-emerald-400'
                                        : 'bg-white dark:bg-dark-950 border-dark-300 dark:border-dark-600 hover:border-synapse-400 dark:hover:border-synapse-500'
                                        }`}
                                >
                                    {note.completed && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`text-sm font-bold ${note.completed ? 'line-through text-dark-400 dark:text-dark-500' : 'text-dark-800 dark:text-dark-50'}`}>
                                            {note.title}
                                        </h3>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${cfg.color}`}>
                                            {cfg.icon} {cfg.label}
                                        </span>
                                    </div>
                                    {note.content && (
                                        <p className="text-xs text-dark-600 dark:text-dark-300 font-medium leading-relaxed mb-1.5 line-clamp-2">
                                            {note.content}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 text-[10px]">
                                        {due && (
                                            <span className={`font-medium ${due.cls}`}>
                                                {due.urgent && '⚠ '}{due.label}
                                            </span>
                                        )}
                                        <span className="text-dark-400 dark:text-dark-500 font-medium">
                                            {new Date(note.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={() => handleDelete(note.id)}
                                    className="text-dark-400 dark:text-dark-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                                    title="Delete"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Footer: encrypted badge ────────────────────────── */}
            <div className="px-6 pb-3">
                <div className="glass-panel-light dark:bg-dark-900/50 p-2.5 flex items-center justify-center gap-2 border border-dark-200 dark:border-dark-800 rounded-lg">
                    <span className="text-[10px] text-dark-500 dark:text-dark-400 font-semibold uppercase tracking-wider">🔒 All notes encrypted at rest with AES-256-GCM</span>
                </div>
            </div>
        </div>
    );
}

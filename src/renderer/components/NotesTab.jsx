import React, { useState, useEffect, useRef } from 'react';

const TYPE_CONFIG = {
    note: { icon: '📝', label: 'Note', bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    deadline: { icon: '⏰', label: 'Deadline', bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    task: { icon: '✅', label: 'Task', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    idea: { icon: '💡', label: 'Idea', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
};

function getDueStatus(dueDate) {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: '#b91c1c', urgent: true };
    if (diffDays === 0) return { label: 'Due today', color: '#b45309', urgent: true };
    if (diffDays === 1) return { label: 'Due tomorrow', color: '#b45309', urgent: false };
    if (diffDays <= 7) return { label: `Due in ${diffDays}d`, color: '#4338ca', urgent: false };
    return { label: `Due in ${diffDays}d`, color: '#94a3b8', urgent: false };
}

export default function NotesTab({ onToast }) {
    const [notes, setNotes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState('all');
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

    useEffect(() => { loadNotes(); }, []);
    useEffect(() => { if (showForm && titleRef.current) titleRef.current.focus(); }, [showForm]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        if (window.electronAPI) {
            const result = await window.electronAPI.addNote({
                title: title.trim(), content: content.trim(), type, dueDate: dueDate || null,
            });
            if (result.success) {
                onToast?.(`Added ${TYPE_CONFIG[type]?.label || 'Note'}: "${title.trim()}"`);
                setTitle(''); setContent(''); setType('note'); setDueDate('');
                setShowForm(false);
                loadNotes();
            }
        }
    };

    const handleDelete = async (id) => {
        if (window.electronAPI) { await window.electronAPI.deleteNote(id); loadNotes(); }
    };
    const handleToggle = async (id) => {
        if (window.electronAPI) { await window.electronAPI.toggleNoteComplete(id); loadNotes(); }
    };

    const filtered = notes.filter((n) => filter === 'all' || n.type === filter);
    const pendingDeadlines = notes.filter((n) => n.type === 'deadline' && !n.completed && n.dueDate).length;
    const completedCount = notes.filter((n) => n.completed).length;

    const filterItems = [
        { id: 'all', label: 'All', icon: '📋', count: notes.length },
        ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({
            id, label: c.label, icon: c.icon,
            count: notes.filter((n) => n.type === id).length,
        })),
    ];

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--surface-app)' }}>

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="px-6 pt-5 pb-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            Notes &amp; Deadlines
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {notes.length} items · {completedCount} completed
                            {pendingDeadlines > 0 && (
                                <span style={{ color: '#b45309' }}> · {pendingDeadlines} upcoming deadline{pendingDeadlines > 1 ? 's' : ''}</span>
                            )}
                        </p>
                    </div>

                    <button
                        onClick={() => setShowForm((v) => !v)}
                        className="btn-primary flex items-center gap-1.5"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add
                    </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {filterItems.map((f) => {
                        const isActive = filter === f.id;
                        return (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border"
                                style={
                                    isActive
                                        ? { background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'rgba(99,102,241,0.25)' }
                                        : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'transparent' }
                                }
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'var(--surface-hover)';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                    }
                                }}
                            >
                                <span>{f.icon}</span>
                                <span>{f.label}</span>
                                {f.count > 0 && (
                                    <span
                                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                                        style={
                                            isActive
                                                ? { background: 'var(--accent)', color: '#fff' }
                                                : { background: 'var(--surface-recessed)', color: 'var(--text-muted)' }
                                        }
                                    >
                                        {f.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Add Form ─────────────────────────────────────────────────────── */}
            {showForm && (
                <div className="px-6 pt-3 pb-1 animate-slide-down">
                    <form
                        onSubmit={handleAdd}
                        className="card p-4 space-y-3"
                    >
                        <div className="flex gap-3">
                            <input
                                ref={titleRef}
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Title…"
                                className="input-base flex-1"
                            />
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="input-base"
                                style={{ width: 'auto' }}
                            >
                                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                                ))}
                            </select>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Details (optional)…"
                            rows={2}
                            className="input-base resize-none"
                        />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Due date:</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="input-base text-xs py-1 px-2"
                                    style={{ width: 'auto' }}
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

            {/* ── Notes List ───────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">

                {/* Empty state */}
                {filtered.length === 0 && (
                    <div className="text-center py-16 animate-fade-in">
                        <div className="text-5xl mb-4">
                            {filter === 'all' ? '📋' : TYPE_CONFIG[filter]?.icon || '📝'}
                        </div>
                        <p className="text-base font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                            {notes.length === 0 ? 'No notes yet' : `No ${filter} items`}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {notes.length === 0
                                ? 'Click "Add" above to create your first note, task, or deadline.'
                                : `Switch to "All" or add a new ${filter}.`}
                        </p>
                    </div>
                )}

                {filtered.map((note, idx) => {
                    const cfg = TYPE_CONFIG[note.type] || TYPE_CONFIG.note;
                    const due = getDueStatus(note.dueDate);
                    const delay = `stagger-${Math.min(idx + 1, 5)}`;

                    return (
                        <NoteCard
                            key={note.id}
                            note={note}
                            cfg={cfg}
                            due={due}
                            delay={delay}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                        />
                    );
                })}
            </div>

            {/* ── Footer ───────────────────────────────────────────────────────── */}
            <div className="px-6 pb-3">
                <div className="card-recessed py-2 px-3 flex items-center justify-center gap-2">
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        🔒 All notes encrypted at rest with AES-256-GCM
                    </span>
                </div>
            </div>
        </div>
    );
}

function NoteCard({ note, cfg, due, delay, onToggle, onDelete }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={`animate-slide-up ${delay} transition-all duration-200`}
            style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '14px 16px',
                opacity: note.completed ? 0.55 : 1,
                boxShadow: isHovered
                    ? '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)'
                    : '0 1px 2px rgba(15,23,42,0.05)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                    onClick={() => onToggle(note.id)}
                    className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-150"
                    style={{
                        border: note.completed ? '2px solid #10b981' : '2px solid #cbd5e1',
                        background: note.completed ? '#10b981' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                        if (!note.completed) e.currentTarget.style.borderColor = '#6366f1';
                    }}
                    onMouseLeave={(e) => {
                        if (!note.completed) e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                >
                    {note.completed && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3
                            className="text-sm font-semibold"
                            style={{
                                color: note.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                textDecoration: note.completed ? 'line-through' : 'none',
                            }}
                        >
                            {note.title}
                        </h3>
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md border"
                            style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
                        >
                            {cfg.icon} {cfg.label}
                        </span>
                    </div>

                    {note.content && (
                        <p className="text-xs leading-relaxed mb-1.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {note.content}
                        </p>
                    )}

                    <div className="flex items-center gap-3 text-[10px]">
                        {due && (
                            <span className="font-semibold flex items-center gap-1" style={{ color: due.color }}>
                                {due.urgent && <span>⚠</span>} {due.label}
                            </span>
                        )}
                        <span style={{ color: 'var(--text-muted)' }}>
                            {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                {/* Delete */}
                <button
                    onClick={() => onDelete(note.id)}
                    className="p-1 rounded transition-colors duration-150"
                    title="Delete"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

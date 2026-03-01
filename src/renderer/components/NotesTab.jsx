import React, { useState, useEffect, useRef } from 'react';

const TYPE_CONFIG = {
    note: { icon: '📝', label: 'Note', bg: '#eef2ff', text: '#3730a3', border: '#c7d2fe' },
    deadline: { icon: '⏰', label: 'Deadline', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
    task: { icon: '✅', label: 'Task', bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    idea: { icon: '💡', label: 'Idea', bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
};

function getDueStatus(dueDate) {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: '#991b1b', urgent: true };
    if (diff === 0) return { label: 'Due today', color: '#92400e', urgent: true };
    if (diff === 1) return { label: 'Due tomorrow', color: '#92400e', urgent: false };
    if (diff <= 7) return { label: `Due in ${diff}d`, color: '#3730a3', urgent: false };
    return { label: `Due ${new Date(dueDate).toLocaleDateString()}`, color: 'var(--text-muted)', urgent: false };
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

    const load = async () => {
        if (window.electronAPI) {
            const res = await window.electronAPI.getNotes();
            setNotes(res.notes || []);
        }
    };

    useEffect(() => { load(); }, []);
    useEffect(() => { if (showForm) titleRef.current?.focus(); }, [showForm]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        if (window.electronAPI) {
            const r = await window.electronAPI.addNote({ title: title.trim(), content: content.trim(), type, dueDate: dueDate || null });
            if (r.success) {
                onToast?.(`Added: "${title.trim()}"`);
                setTitle(''); setContent(''); setType('note'); setDueDate('');
                setShowForm(false);
                load();
            }
        }
    };

    const handleDelete = async (id) => { if (window.electronAPI) { await window.electronAPI.deleteNote(id); load(); } };
    const handleToggle = async (id) => { if (window.electronAPI) { await window.electronAPI.toggleNoteComplete(id); load(); } };

    const filtered = notes.filter((n) => filter === 'all' || n.type === filter);
    const completed = notes.filter((n) => n.completed).length;
    const urgent = notes.filter((n) => n.type === 'deadline' && !n.completed && n.dueDate && Math.ceil((new Date(n.dueDate) - new Date()) / 86400000) <= 1).length;

    const FILTERS = [
        { id: 'all', icon: '📋', label: 'All', count: notes.length },
        ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, icon: c.icon, label: c.label, count: notes.filter((n) => n.type === id).length })),
    ];

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--surface-app)' }}>

            {/* ── Header — single flex bar ─────────────────────────────────── */}
            <div
                className="flex items-center justify-between gap-4 px-5 flex-shrink-0"
                style={{
                    background: 'var(--surface-card)',
                    borderBottom: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                    minHeight: '52px',
                    flexWrap: 'nowrap',
                    overflow: 'hidden',
                }}
            >
                {/* Left: title + count + filter tabs — all inline */}
                <div className="flex items-center gap-4 min-w-0 overflow-x-auto" style={{ flexShrink: 1 }}>
                    {/* Title + count */}
                    <div className="flex-shrink-0">
                        <h2 className="text-[15px] font-bold tracking-tight leading-none" style={{ color: 'var(--text-hero)', letterSpacing: '-0.02em' }}>
                            Notes &amp; Deadlines
                        </h2>
                        <p className="text-[10.5px] mt-0.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            {notes.length} items · {completed} completed
                            {urgent > 0 && <span style={{ color: '#991b1b' }}> · {urgent} urgent</span>}
                        </p>
                    </div>

                    {/* Thin divider */}
                    <div className="w-px h-6 flex-shrink-0" style={{ background: 'var(--border-subtle)' }} />

                    {/* Filter tabs — inline, no wrapping */}
                    <div className="flex items-center gap-0.5 flex-shrink-0" style={{ flexWrap: 'nowrap' }}>
                        {FILTERS.map((f) => {
                            const active = filter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-medium rounded-lg transition-all duration-150 whitespace-nowrap flex-shrink-0"
                                    style={
                                        active
                                            ? { background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }
                                            : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' }
                                    }
                                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--surface-recessed)'; } }}
                                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; } }}
                                >
                                    {f.icon}
                                    <span>{f.label}</span>
                                    {f.count > 0 && (
                                        <span
                                            className="text-[9px] font-bold px-1 py-[1px] rounded-full min-w-[14px] text-center"
                                            style={
                                                active
                                                    ? { background: 'var(--accent)', color: '#fff' }
                                                    : { background: 'var(--surface-recessed)', color: 'var(--text-muted)' }
                                            }
                                        >{f.count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Add button */}
                <button
                    onClick={() => setShowForm((v) => !v)}
                    className="btn-primary flex items-center gap-1.5 text-[12px] flex-shrink-0"
                    style={{ padding: '6px 14px' }}
                >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add
                </button>
            </div>

            {/* ── Add Form ─────────────────────────────────────────────────────── */}
            {
                showForm && (
                    <div className="px-5 pt-3 pb-1 animate-slide-down" style={{ background: 'var(--surface-sidebar)' }}>
                        <form onSubmit={handleAdd} className="card p-4 space-y-3">
                            <div className="flex gap-2.5">
                                <input
                                    ref={titleRef}
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Title…"
                                    className="input-base flex-1 text-[13.5px]"
                                />
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="input-base text-[13px]"
                                    style={{ width: 'auto', paddingRight: '28px' }}
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
                                className="input-base resize-none text-[13px]"
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-muted)' }}>Due:</span>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="input-base text-[12.5px] py-1 px-2"
                                        style={{ width: 'auto' }}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-[12px] py-1.5 px-3">Cancel</button>
                                    <button type="submit" disabled={!title.trim()} className="btn-primary text-[12px] py-1.5 px-4">Save</button>
                                </div>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* ── List ─────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                {filtered.length === 0 && (
                    <div className="flex items-center justify-center h-full animate-fade-in">
                        <div
                            className="text-center py-10 px-8 rounded-2xl max-w-xs w-full"
                            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)' }}
                        >
                            <div className="text-4xl mb-3">
                                {filter === 'all' ? '📋' : TYPE_CONFIG[filter]?.icon || '📝'}
                            </div>
                            <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                {notes.length === 0 ? 'Nothing here yet' : `No ${filter} items`}
                            </p>
                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                {notes.length === 0
                                    ? 'Click "Add" to create a note, task, or deadline.'
                                    : `Switch to "All" or add a new ${filter}.`}
                            </p>
                        </div>
                    </div>
                )}

                {filtered.map((note, idx) => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        cfg={TYPE_CONFIG[note.type] || TYPE_CONFIG.note}
                        due={getDueStatus(note.dueDate)}
                        delay={`stagger-${Math.min(idx + 1, 5)}`}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                    />
                ))}
            </div>

            {/* ── Footer ───────────────────────────────────────────────────────── */}
            <div className="px-5 pb-3">
                <div
                    className="py-1.5 px-3 rounded-lg text-center"
                    style={{ background: 'var(--surface-sidebar)', border: '1px solid var(--border-subtle)' }}
                >
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        🔒 Encrypted at rest · AES-256-GCM
                    </p>
                </div>
            </div>
        </div >
    );
}

function NoteCard({ note, cfg, due, delay, onToggle, onDelete }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            className={`animate-slide-up ${delay} transition-all duration-150`}
            style={{
                background: 'var(--surface-card)',
                border: '1px solid',
                borderColor: hovered ? 'var(--border-medium)' : 'var(--border-subtle)',
                borderRadius: '10px',
                padding: '12px 14px',
                opacity: note.completed ? 0.5 : 1,
                boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow-md)',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                    onClick={() => onToggle(note.id)}
                    className="mt-[1px] w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition-all duration-150"
                    style={{
                        border: note.completed ? '2px solid #10b981' : '2px solid var(--border-medium)',
                        background: note.completed ? '#10b981' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (!note.completed) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={(e) => { if (!note.completed) e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
                >
                    {note.completed && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-0.5">
                        <h3
                            className="text-[13px] font-semibold"
                            style={{
                                color: 'var(--text-primary)',
                                textDecoration: note.completed ? 'line-through' : 'none',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            {note.title}
                        </h3>
                        <span
                            className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px] font-semibold rounded border"
                            style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
                        >
                            {cfg.icon} {cfg.label}
                        </span>
                    </div>

                    {note.content && (
                        <p className="text-[12px] leading-relaxed mb-1.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {note.content}
                        </p>
                    )}

                    <div className="flex items-center gap-3 text-[10.5px]">
                        {due && (
                            <span className="font-semibold" style={{ color: due.color }}>
                                {due.urgent && '⚠ '}{due.label}
                            </span>
                        )}
                        <span style={{ color: 'var(--text-muted)' }}>
                            {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => onDelete(note.id)}
                    className="w-5 h-5 flex items-center justify-center rounded transition-colors duration-100"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

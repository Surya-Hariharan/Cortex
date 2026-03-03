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
    const [selectedId, setSelectedId] = useState(null);
    const [filter, setFilter] = useState('all');

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('note');
    const [dueDate, setDueDate] = useState('');
    const titleRef = useRef(null);

    const load = async () => {
        if (window.electronAPI) {
            const res = await window.electronAPI.getNotes();
            setNotes(res.notes || []);

            // If the selected note is no longer present (e.g., deleted elsewhere), clear it
            if (res.notes) {
                setSelectedId(currentId => {
                    if (currentId && !res.notes.some(n => n.id === currentId)) return null;
                    return currentId;
                });
            }
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
                setSelectedId(r.note?.id || null);
                load();
            }
        }
    };

    const handleDelete = async (id) => {
        if (window.electronAPI) {
            await window.electronAPI.deleteNote(id);
            if (selectedId === id) setSelectedId(null);
            load();
        }
    };

    const handleToggle = async (id) => {
        if (window.electronAPI) {
            await window.electronAPI.toggleNoteComplete(id);
            load();
        }
    };

    const filtered = notes.filter((n) => filter === 'all' || n.type === filter);

    const FILTERS = [
        { id: 'all', label: 'All', count: notes.length },
        ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, label: c.label, count: notes.filter((n) => n.type === id).length })),
    ];

    const selectedNote = notes.find(n => n.id === selectedId);

    return (
        <div className="flex w-full h-full overflow-hidden" style={{ background: 'var(--surface-app)' }}>

            {/* ── Left Pane: Note List ────────────────────────────────────────────── */}
            <div className="w-[320px] flex-shrink-0 flex flex-col h-full" style={{ borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-sidebar)' }}>
                {/* Header */}
                <div className="h-[60px] flex items-center justify-between px-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                        </svg>
                        <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Notes</h2>
                    </div>
                    <button
                        onClick={() => { setShowForm(true); setSelectedId(null); setTitle(''); setContent(''); setDueDate(''); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-1.5 px-3 py-2.5 overflow-x-auto hide-scrollbar" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {FILTERS.map((f) => {
                        const active = filter === f.id;
                        return (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className="px-3 py-1 text-[12px] font-medium rounded-full flex-shrink-0 transition-all duration-150"
                                style={{
                                    background: active ? 'var(--text-primary)' : 'transparent',
                                    color: active ? 'var(--surface-app)' : 'var(--text-muted)',
                                }}
                                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
                                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {f.label} {f.count > 0 && <span className="opacity-60 ml-0.5">{f.count}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* List Body */}
                <div className="flex-1 overflow-y-auto p-2 space-y-[2px]">
                    {filtered.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No {filter !== 'all' ? filter : ''} notes</p>
                            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Click + to add a new item.</p>
                        </div>
                    )}

                    {filtered.map((note) => {
                        const isSelected = selectedId === note.id;
                        const cfg = TYPE_CONFIG[note.type] || TYPE_CONFIG.note;
                        const due = getDueStatus(note.dueDate);

                        return (
                            <div
                                key={note.id}
                                onClick={() => { setSelectedId(note.id); setShowForm(false); }}
                                className={`px-3 py-2.5 rounded-lg cursor-pointer flex gap-3 transition-colors duration-150 group`}
                                style={{
                                    background: isSelected ? 'rgba(0,0,0,0.05)' : 'transparent',
                                    opacity: note.completed ? 0.6 : 1,
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggle(note.id); }}
                                    className="mt-0.5 w-[16px] h-[16px] rounded-[4px] flex items-center justify-center flex-shrink-0 transition-all duration-150"
                                    style={{
                                        border: note.completed ? 'none' : '1.5px solid var(--border-medium)',
                                        background: note.completed ? 'var(--text-primary)' : 'transparent',
                                    }}
                                >
                                    {note.completed && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--surface-app)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <h3 className="text-[13px] font-medium truncate pr-2" style={{ color: 'var(--text-primary)', textDecoration: note.completed ? 'line-through' : 'none' }}>
                                            {note.title}
                                        </h3>
                                        <div className="flex-shrink-0 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                            {cfg.icon}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                        {due ? (
                                            <span style={{ color: due.urgent ? '#ef4444' : 'inherit' }}>
                                                {due.urgent && '⚠ '}{due.label}
                                            </span>
                                        ) : (
                                            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Right Pane: Editor / View ─────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col h-full bg-[var(--surface-app)]">

                {!showForm && !selectedNote && (
                    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
                        <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'var(--surface-recessed)', color: 'var(--text-muted)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                            </svg>
                        </div>
                        <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>No note selected</p>
                        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Select a note from the list, or add a new one.</p>
                    </div>
                )}

                {showForm && (
                     <div className="flex-1 overflow-y-auto align-center px-10 py-12 animate-fade-in max-w-3xl mx-auto w-full">
                        <form onSubmit={handleAdd} className="flex flex-col gap-6">
                            <input
                                ref={titleRef}
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Note title"
                                className="w-full bg-transparent text-[24px] font-semibold outline-none"
                                style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
                            />

                            <div className="flex flex-wrap gap-4 items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>Type</span>
                                    <div className="flex items-center p-1 rounded-lg" style={{ background: 'var(--surface-recessed)' }}>
                                        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setType(key)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                                                style={{
                                                    background: type === key ? 'var(--surface-card)' : 'transparent',
                                                    color: type === key ? 'var(--text-primary)' : 'var(--text-muted)',
                                                    boxShadow: type === key ? 'var(--shadow-sm)' : 'none',
                                                }}
                                            >
                                                {cfg.icon} {cfg.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>Due Date</span>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="text-[13px] px-3 py-1.5 rounded-lg outline-none"
                                        style={{ background: 'var(--surface-recessed)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>

                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Start typing details..."
                                className="w-full h-64 bg-transparent outline-none text-[15px] resize-none leading-relaxed"
                                style={{ color: 'var(--text-secondary)' }}
                            />

                            <div className="flex items-center gap-3 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                <button type="submit" disabled={!title.trim()} className="btn-primary text-[13px] py-1.5 px-5">Save Note</button>
                                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-[13px] py-1.5 px-4 font-medium" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                            </div>
                        </form>
                     </div>
                )}

                {selectedNote && !showForm && (() => {
                    const cfg = TYPE_CONFIG[selectedNote.type] || TYPE_CONFIG.note;
                    const due = getDueStatus(selectedNote.dueDate);

                    return (
                        <div className="flex-1 overflow-y-auto px-10 py-12 animate-fade-in max-w-3xl mx-auto w-full">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-full" style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
                                    {cfg.icon} {cfg.label}
                                </span>
                                {due && (
                                    <span className="text-[12px] font-medium" style={{ color: due.urgent ? '#ef4444' : 'var(--text-muted)' }}>
                                        {due.urgent && '⚠ '} {due.label}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-[24px] font-semibold mb-6" style={{ color: 'var(--text-primary)', textDecoration: selectedNote.completed ? 'line-through' : 'none' }}>
                                {selectedNote.title}
                            </h1>

                            {selectedNote.content && (
                                <div className="text-[15px] leading-relaxed whitespace-pre-wrap mb-10" style={{ color: 'var(--text-secondary)' }}>
                                    {selectedNote.content}
                                </div>
                            )}

                            <div className="flex items-center gap-3 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                <button
                                    onClick={() => handleToggle(selectedNote.id)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                                    style={{
                                        background: selectedNote.completed ? 'transparent' : 'var(--text-primary)',
                                        color: selectedNote.completed ? 'var(--text-primary)' : 'var(--surface-app)',
                                        border: selectedNote.completed ? '1px solid var(--border-medium)' : '1px solid transparent',
                                    }}
                                >
                                    {selectedNote.completed ? (
                                        <>
                                            Unmark Completed
                                        </>
                                    ) : (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Complete
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => handleDelete(selectedNote.id)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                                    style={{ background: 'transparent', color: '#ef4444', border: '1px solid currentColor' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                                    </svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                    );
                })()}

            </div>
        </div>
    );
}

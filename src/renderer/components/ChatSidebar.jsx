import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function relativeTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

/* ── icons ───────────────────────────────────────────────────────────────── */
const IconPlus = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
const IconSearch = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);
const IconChevron = ({ open }) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
const IconFolder = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);
const IconChat = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);
const IconTrash = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
    </svg>
);
const IconEdit = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

/* ── Context menu ────────────────────────────────────────────────────────── */
function CtxMenu({ x, y, items, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [onClose]);

    return (
        <div
            ref={ref}
            style={{
                position: 'fixed', left: x, top: y, zIndex: 9999,
                background: '#fff', border: '1px solid var(--border-subtle)',
                borderRadius: '10px', boxShadow: 'var(--shadow-lg)',
                padding: '4px', minWidth: '160px',
            }}
        >
            {items.map((item) => (
                <button
                    key={item.label}
                    onClick={() => { item.action(); onClose(); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] rounded-lg"
                    style={{
                        color: item.danger ? '#dc2626' : 'var(--text-secondary)',
                        background: 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = item.danger ? '#fef2f2' : 'var(--surface-recessed)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                    {item.icon}
                    {item.label}
                </button>
            ))}
        </div>
    );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function ChatSidebar({ activeChatId, onSelectChat, onNewChat }) {
    const [projects, setProjects] = useState([]);
    const [chats, setChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null = not searching
    const [projectsOpen, setProjectsOpen] = useState(true);
    const [ctx, setCtx] = useState(null); // { x, y, items }
    const [editingProject, setEditingProject] = useState(null); // { id, name }
    const searchRef = useRef(null);
    const editRef = useRef(null);

    const load = useCallback(async () => {
        if (!window.electronAPI) return;
        const [pr, ch] = await Promise.all([
            window.electronAPI.getProjects(),
            window.electronAPI.getChats(undefined),
        ]);
        setProjects(pr.projects || []);
        setChats(ch.chats || []);
    }, []);

    useEffect(() => { load(); }, [load]);

    /* Live search */
    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults(null); return; }
        const timer = setTimeout(async () => {
            if (!window.electronAPI) return;
            const res = await window.electronAPI.searchChats(searchQuery);
            setSearchResults(res.chats || []);
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    /* Focus rename input */
    useEffect(() => {
        if (editingProject) editRef.current?.focus();
    }, [editingProject]);

    /* ── Actions ── */
    const handleNewChat = async (projectId = null) => {
        if (!window.electronAPI) {
            // offline fallback — generate local temp chat
            const tempId = `temp-${Date.now()}`;
            onNewChat?.({ id: tempId, title: 'New Chat', projectId: null });
            return;
        }
        const res = await window.electronAPI.createChat(projectId);
        if (res.success) {
            await load();
            onNewChat?.(res.chat);
            onSelectChat?.(res.chat.id);
        }
    };

    const handleDeleteChat = async (id) => {
        if (window.electronAPI) await window.electronAPI.deleteChat(id);
        setChats((c) => c.filter((x) => x.id !== id));
        if (activeChatId === id) onSelectChat?.(null);
    };

    const handleCreateProject = async () => {
        const name = prompt('Project name:');
        if (!name?.trim()) return;
        if (window.electronAPI) await window.electronAPI.createProject(name.trim());
        load();
    };

    const handleDeleteProject = async (id) => {
        if (!window.confirm('Delete project and all its chats?')) return;
        if (window.electronAPI) await window.electronAPI.deleteProject(id);
        load();
    };

    const handleRenameProject = async (id, name) => {
        if (!name?.trim()) return;
        if (window.electronAPI) await window.electronAPI.renameProject(id, name.trim());
        setEditingProject(null);
        load();
    };

    const openCtx = (e, items) => {
        e.preventDefault();
        e.stopPropagation();
        setCtx({ x: e.clientX, y: e.clientY, items });
    };

    /* ── Render helpers ── */
    const displayChats = searchResults !== null ? searchResults : chats;

    const SectionLabel = ({ label, action, actionLabel }) => (
        <div className="flex items-center justify-between px-3 mb-1">
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
            {action && (
                <button onClick={action} className="flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                    <IconPlus /> {actionLabel}
                </button>
            )}
        </div>
    );

    const ChatRow = ({ chat }) => {
        const isActive = chat.id === activeChatId;
        return (
            <button
                onClick={() => onSelectChat?.(chat.id)}
                onContextMenu={(e) => openCtx(e, [
                    { label: 'Delete', icon: <IconTrash />, action: () => handleDeleteChat(chat.id), danger: true },
                ])}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left"
                style={{
                    background: isActive ? 'var(--accent-light)' : 'transparent',
                    border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '12.5px', cursor: 'pointer', transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--surface-recessed)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
            >
                <span style={{ flexShrink: 0, opacity: 0.6 }}><IconChat /></span>
                <span className="flex-1 min-w-0 truncate" style={{ fontWeight: isActive ? 600 : 400 }}>{chat.title}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{relativeTime(chat.lastUpdated)}</span>
            </button>
        );
    };

    return (
        <aside
            style={{
                width: '268px',
                minWidth: '268px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface-sidebar)',
                borderRight: '1px solid var(--border-subtle)',
                overflow: 'hidden',
            }}
        >
            {/* ── New Chat button ── */}
            <div style={{ padding: '14px 12px 10px', flexShrink: 0 }}>
                <button
                    onClick={() => handleNewChat(null)}
                    className="flex items-center justify-center gap-2 w-full rounded-xl"
                    style={{
                        padding: '9px 16px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.30)',
                        transition: 'box-shadow 150ms ease, opacity 150ms ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.92'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <IconPlus />
                    New Chat
                </button>
            </div>

            {/* ── Search ── */}
            <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
                <div className="flex items-center gap-2" style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '7px 10px',
                }}>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}><IconSearch /></span>
                    <input
                        ref={searchRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search chats…"
                        style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            fontSize: '12.5px', color: 'var(--text-primary)',
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>✕</button>
                    )}
                </div>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Search results override */}
                {searchResults !== null ? (
                    <div>
                        <SectionLabel label={`Results (${searchResults.length})`} />
                        {searchResults.length === 0
                            ? <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 12px' }}>No matches found.</p>
                            : searchResults.map((c) => <ChatRow key={c.id} chat={c} />)
                        }
                    </div>
                ) : (
                    <>
                        {/* Projects */}
                        <div>
                            <div
                                className="flex items-center justify-between px-3 mb-1 cursor-pointer"
                                onClick={() => setProjectsOpen((v) => !v)}
                                style={{ userSelect: 'none' }}
                            >
                                <div className="flex items-center gap-1.5">
                                    <IconChevron open={projectsOpen} />
                                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Projects</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCreateProject(); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <IconPlus /> New
                                </button>
                            </div>

                            {projectsOpen && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    {projects.length === 0 && (
                                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '4px 12px' }}>No projects yet.</p>
                                    )}
                                    {projects.map((p) => (
                                        <div key={p.id}>
                                            {editingProject?.id === p.id ? (
                                                <input
                                                    ref={editRef}
                                                    defaultValue={p.name}
                                                    className="w-full rounded-lg"
                                                    style={{ padding: '5px 10px', fontSize: '12.5px', border: '1px solid var(--accent-border)', background: 'var(--accent-light)', outline: 'none', color: 'var(--accent)' }}
                                                    onBlur={(e) => handleRenameProject(p.id, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameProject(p.id, e.target.value);
                                                        if (e.key === 'Escape') setEditingProject(null);
                                                    }}
                                                />
                                            ) : (
                                                <button
                                                    className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg"
                                                    style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', fontSize: '12.5px', cursor: 'pointer', textAlign: 'left', transition: 'all 120ms' }}
                                                    onContextMenu={(e) => openCtx(e, [
                                                        { label: 'New chat here', icon: <IconPlus />, action: () => handleNewChat(p.id) },
                                                        { label: 'Rename', icon: <IconEdit />, action: () => setEditingProject(p) },
                                                        { label: 'Delete', icon: <IconTrash />, action: () => handleDeleteProject(p.id), danger: true },
                                                    ])}
                                                    onClick={() => handleNewChat(p.id)}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-recessed)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                >
                                                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}><IconFolder /></span>
                                                    <span className="flex-1 min-w-0 truncate">{p.name}</span>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.chatCount}</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Your Chats */}
                        <div style={{ flex: 1 }}>
                            <SectionLabel label="Your Chats" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                {chats.length === 0 && (
                                    <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '4px 12px' }}>No chats yet. Click New Chat to begin.</p>
                                )}
                                {chats.filter((c) => !c.projectId).map((c) => (
                                    <ChatRow key={c.id} chat={c} />
                                ))}
                                {projects.map((p) => {
                                    const pChats = chats.filter((c) => c.projectId === p.id);
                                    if (pChats.length === 0) return null;
                                    return (
                                        <div key={p.id}>
                                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', padding: '6px 12px 2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                                {p.name}
                                            </div>
                                            {pChats.map((c) => <ChatRow key={c.id} chat={c} />)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Context menu */}
            {ctx && <CtxMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}
        </aside>
    );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   ICONS  (pure inline SVG – no external deps)
───────────────────────────────────────────────────────────────────────────── */
const Ic = {
    Plus: ({ s = 15 }) => (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    Search: () => (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    ),
    Chevron: ({ open }) => (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-in-out' }}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    ),
    Chat: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    ),
    Folder: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    ),
    Trash: () => (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
        </svg>
    ),
    Edit: () => (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    Close: () => (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Camera: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
        </svg>
    ),
};

/* ─────────────────────────────────────────────────────────────────────────────
   CONTEXT MENU
───────────────────────────────────────────────────────────────────────────── */
function CtxMenu({ x, y, items, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [onClose]);
    return (
        <div ref={ref} style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
            className="bg-white border border-[#E5E7EB] rounded-xl p-1 shadow-xl min-w-[172px]">
            {items.map((item) => (
                <button key={item.label}
                    onClick={() => { item.action(); onClose(); }}
                    className="flex items-center gap-2.5 w-full px-3 py-[9px] rounded-lg text-[13px] font-medium transition-colors duration-100"
                    style={{ color: item.danger ? '#DC2626' : '#374151' }}
                    onMouseEnter={e => { e.currentTarget.style.background = item.danger ? '#FEF2F2' : '#F3F4F6'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <span style={{ opacity: 0.7 }}>{item.icon}</span>
                    {item.label}
                </button>
            ))}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROFILE MODAL
───────────────────────────────────────────────────────────────────────────── */
function ProfileModal({ onClose }) {
    const [username, setUsername] = useState('Local User');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setMounted(true));
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{
                background: 'rgba(0,0,0,0.18)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                opacity: mounted ? 1 : 0,
                transition: 'opacity 150ms ease-in-out',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden flex flex-col relative"
                style={{
                    transform: mounted ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
                    opacity: mounted ? 1 : 0,
                    transition: 'all 180ms cubic-bezier(0.16,1,0.3,1)',
                }}
            >
                {/* Close — top right */}
                <button
                    onClick={onClose}
                    className="absolute top-3.5 right-3.5 p-1.5 rounded-lg transition-colors duration-150 text-[#9CA3AF]"
                    onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                >
                    <Ic.Close />
                </button>

                {/* Body */}
                <div className="pt-10 pb-6 px-8 flex flex-col items-center gap-6">

                    {/* Avatar */}
                    <div className="relative group cursor-pointer">
                        <div className="w-[88px] h-[88px] rounded-full bg-[#111827] text-white flex items-center justify-center shadow-sm border border-[#2D3748] select-none">
                            <span className="text-[34px] font-semibold leading-none">
                                {username.charAt(0).toUpperCase() || 'L'}
                            </span>
                        </div>
                        <div
                            className="absolute inset-0 rounded-full flex items-center justify-center transition-opacity duration-150"
                            style={{ background: 'rgba(0,0,0,0.45)', opacity: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                        >
                            <Ic.Camera />
                        </div>
                    </div>

                    {/* Fields */}
                    <div className="w-full flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest pl-0.5">
                                Display Name
                            </label>
                            <input
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 text-[14px] text-[#111827] bg-white outline-none transition-all duration-150"
                                onFocus={e => { e.target.style.borderColor = '#111827'; e.target.style.boxShadow = '0 0 0 3px rgba(17,24,39,0.06)'; }}
                                onBlur={e => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>

                        <button
                            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-[14px] text-[#374151] font-medium transition-colors duration-150"
                            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <span>Theme</span>
                            <span className="text-[#9CA3AF] text-[13px]">System</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-[#FAFAFA] border-t border-[#F0F0F0] flex items-center justify-between">
                    <button
                        className="text-[13px] font-semibold text-[#DC2626] px-2 py-1 rounded-lg transition-colors duration-150"
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        Sign out
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-[#111827] text-white text-[13px] font-semibold rounded-lg transition-colors duration-150 shadow-sm"
                        onMouseEnter={e => { e.currentTarget.style.background = '#1F2937'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CHAT ITEM
───────────────────────────────────────────────────────────────────────────── */
function ChatItem({ chat, isNested, activeChatId, onSelect, onDelete }) {
    const isActive = activeChatId === chat.id;
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={() => onSelect(chat.id)}
            onContextMenu={(e) => { e.preventDefault(); onDelete(chat.id); }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                width: '100%',
                padding: `7px 10px 7px ${isNested ? 28 : 10}px`,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#111827' : '#4B5563',
                background: isActive
                    ? '#F0F0F0'
                    : hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
                textAlign: 'left',
                position: 'relative',
                transition: 'background 120ms ease, color 120ms ease',
                border: 'none',
                cursor: 'pointer',
                overflow: 'hidden',
            }}
        >
            {/* Active left bar */}
            <span style={{
                position: 'absolute',
                left: 0,
                top: '20%',
                height: '60%',
                width: '3px',
                borderRadius: '0 3px 3px 0',
                background: '#111827',
                opacity: isActive ? 1 : 0,
                transition: 'opacity 120ms ease',
            }} />

            <span style={{ color: isActive ? '#374151' : '#9CA3AF', flexShrink: 0, transition: 'color 120ms ease' }}>
                <Ic.Chat />
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {chat.title || 'New Chat'}
            </span>
        </button>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   COLLAPSIBLE CHAT LIST (animated)
───────────────────────────────────────────────────────────────────────────── */
function CollapsibleChats({ open, children }) {
    const ref = useRef(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (ref.current) setHeight(ref.current.scrollHeight);
    }, [children]);

    return (
        <div style={{
            overflow: 'hidden',
            maxHeight: open ? height + 4 : 0,
            opacity: open ? 1 : 0,
            transition: 'max-height 180ms cubic-bezier(0.4,0,0.2,1), opacity 150ms ease',
        }}>
            <div ref={ref} style={{ paddingBottom: '2px' }}>
                {children}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION LABEL
───────────────────────────────────────────────────────────────────────────── */
function SectionLabel({ children }) {
    return (
        <div style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#9CA3AF',
            padding: '0 12px',
            marginBottom: '4px',
            marginTop: '8px',
            userSelect: 'none',
        }}>
            {children}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN SIDEBAR
───────────────────────────────────────────────────────────────────────────── */
export default function ChatSidebar({ activeChatId, onSelectChat, onNewChat }) {
    const [projects, setProjects] = useState([]);
    const [chats, setChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [expandedProjects, setExpandedProjects] = useState({});
    const [ctx, setCtx] = useState(null);
    const [editingProject, setEditingProject] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const editRef = useRef(null);

    /* ── Load data ── */
    const load = useCallback(async () => {
        if (!window.electronAPI) return;
        const [pr, ch] = await Promise.all([
            window.electronAPI.getProjects(),
            window.electronAPI.getChats(undefined),
        ]);
        setProjects(pr.projects || []);
        setChats(ch.chats || []);
        if (activeChatId && ch.chats) {
            const active = ch.chats.find(c => c.id === activeChatId);
            if (active?.projectId) {
                setExpandedProjects(prev => ({ ...prev, [active.projectId]: true }));
            }
        }
    }, [activeChatId]);

    useEffect(() => { load(); }, [load]);

    /* ── Live search ── */
    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults(null); return; }
        const t = setTimeout(async () => {
            if (!window.electronAPI) return;
            const res = await window.electronAPI.searchChats(searchQuery);
            setSearchResults(res.chats || []);
        }, 220);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => { if (editingProject) editRef.current?.focus(); }, [editingProject]);

    /* ── Actions ── */
    const newChat = async (projectId = null) => {
        if (!window.electronAPI) {
            const tempId = `temp-${Date.now()}`;
            onNewChat?.({ id: tempId });
            onSelectChat?.(tempId);
            return;
        }
        const res = await window.electronAPI.createChat(projectId);
        if (res.success) {
            if (projectId) setExpandedProjects(prev => ({ ...prev, [projectId]: true }));
            await load();
            onNewChat?.(res.chat);
            onSelectChat?.(res.chat.id);
        }
    };

    const deleteChat = async (id) => {
        if (window.electronAPI) await window.electronAPI.deleteChat(id);
        setChats(c => c.filter(x => x.id !== id));
        if (activeChatId === id) onSelectChat?.(null);
    };

    const newProject = async () => {
        const name = prompt('Workspace name:');
        if (!name?.trim()) return;
        if (window.electronAPI) await window.electronAPI.createProject(name.trim());
        load();
    };

    const deleteProject = async (id) => {
        if (!window.confirm('Delete this workspace and all its chats?')) return;
        if (window.electronAPI) await window.electronAPI.deleteProject(id);
        load();
    };

    const renameProject = async (id, name) => {
        if (!name?.trim()) return;
        if (window.electronAPI) await window.electronAPI.renameProject(id, name.trim());
        setEditingProject(null);
        load();
    };

    const openCtx = (e, items) => {
        e.preventDefault(); e.stopPropagation();
        setCtx({ x: e.clientX, y: e.clientY, items });
    };

    const toggleProject = (id) => {
        setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
    };

    /* ── Independent chats (no project) ── */
    const freeChats = chats.filter(c => !c.projectId);

    /* ─────────────────────────────────────────────────────────────────── */
    return (
        <>
            <aside style={{
                width: '272px',
                minWidth: '272px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                background: '#F7F7F7',
                borderRight: '1px solid #E5E7EB',
                position: 'relative',
                overflow: 'hidden',
            }}>

                {/* ── ① Top: primary actions ─────────────────────────────── */}
                <div style={{ padding: '14px 12px 10px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* New Chat – filled primary */}
                    <button
                        onClick={() => newChat(null)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            width: '100%', height: '40px', padding: '0 14px',
                            background: '#111827', color: 'white',
                            fontSize: '13.5px', fontWeight: 600,
                            border: 'none', borderRadius: '10px',
                            cursor: 'pointer', transition: 'background 150ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#1F2937'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
                    >
                        <Ic.Plus s={15} />
                        New Chat
                    </button>

                    {/* New Workspace – ghost */}
                    <button
                        onClick={newProject}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            width: '100%', height: '36px', padding: '0 14px',
                            background: 'transparent', color: '#6B7280',
                            fontSize: '13px', fontWeight: 500,
                            border: '1px solid transparent', borderRadius: '10px',
                            cursor: 'pointer', transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#EFEFEF';
                            e.currentTarget.style.color = '#374151';
                            e.currentTarget.style.borderColor = '#E5E7EB';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#6B7280';
                            e.currentTarget.style.borderColor = 'transparent';
                        }}
                    >
                        <Ic.Plus s={13} />
                        New Workspace
                    </button>
                </div>

                {/* ── ② Search bar ────────────────────────────────────────── */}
                <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'white', border: '1px solid #E5E7EB',
                        borderRadius: '8px', padding: '0 10px', height: '32px',
                        transition: 'border-color 150ms ease, box-shadow 150ms ease',
                    }}
                        onFocusWithin={e => { /* handled per-input */ }}
                    >
                        <span style={{ color: '#9CA3AF', flexShrink: 0, lineHeight: 0 }}><Ic.Search /></span>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search chats…"
                            style={{
                                background: 'none', border: 'none', outline: 'none',
                                fontSize: '13px', color: '#111827', width: '100%',
                            }}
                            onFocus={e => {
                                e.target.parentElement.style.borderColor = '#9CA3AF';
                                e.target.parentElement.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.05)';
                            }}
                            onBlur={e => {
                                e.target.parentElement.style.borderColor = '#E5E7EB';
                                e.target.parentElement.style.boxShadow = 'none';
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', lineHeight: 0, padding: 0 }}
                            >
                                <Ic.Close />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── ③ Scrollable library ────────────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>

                    {searchResults !== null ? (
                        /* ── Search results ── */
                        <div>
                            <SectionLabel>Results</SectionLabel>
                            {searchResults.length === 0 ? (
                                <div style={{ fontSize: '13px', color: '#9CA3AF', padding: '8px 12px' }}>No matches found.</div>
                            ) : (
                                searchResults.map(c => (
                                    <ChatItem key={c.id} chat={c} isNested={false}
                                        activeChatId={activeChatId} onSelect={onSelectChat} onDelete={deleteChat} />
                                ))
                            )}
                        </div>
                    ) : (
                        /* ── Default view ── */
                        <div>
                            {/* Free chats */}
                            {freeChats.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <SectionLabel>Recent</SectionLabel>
                                    {freeChats.map(c => (
                                        <ChatItem key={c.id} chat={c} isNested={false}
                                            activeChatId={activeChatId} onSelect={onSelectChat} onDelete={deleteChat} />
                                    ))}
                                </div>
                            )}

                            {/* Workspaces */}
                            {projects.length > 0 && (
                                <div>
                                    <SectionLabel>Workspaces</SectionLabel>

                                    {projects.map(p => {
                                        const pChats = chats.filter(c => c.projectId === p.id);
                                        const isOpen = !!expandedProjects[p.id];

                                        return (
                                            <div key={p.id} style={{ marginBottom: '2px' }}>

                                                {/* Project row */}
                                                {editingProject?.id === p.id ? (
                                                    <input
                                                        ref={editRef}
                                                        defaultValue={p.name}
                                                        style={{
                                                            width: 'calc(100% - 8px)', margin: '2px 4px',
                                                            background: 'white', border: '1.5px solid #111827',
                                                            borderRadius: '8px', padding: '6px 10px',
                                                            fontSize: '13.5px', fontWeight: 500,
                                                            outline: 'none', color: '#111827',
                                                        }}
                                                        onBlur={e => renameProject(p.id, e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') renameProject(p.id, e.target.value);
                                                            if (e.key === 'Escape') setEditingProject(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => toggleProject(p.id)}
                                                        onContextMenu={e => openCtx(e, [
                                                            { label: 'New chat here', icon: <Ic.Plus s={13} />, action: () => newChat(p.id) },
                                                            { label: 'Rename workspace', icon: <Ic.Edit />, action: () => setEditingProject(p) },
                                                            { label: 'Delete workspace', icon: <Ic.Trash />, action: () => deleteProject(p.id), danger: true },
                                                        ])}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '8px',
                                                            width: '100%', padding: '7px 10px',
                                                            background: 'transparent', border: 'none',
                                                            borderRadius: '8px', cursor: 'pointer',
                                                            fontSize: '13.5px', fontWeight: 600,
                                                            color: '#374151',
                                                            transition: 'background 120ms ease, color 120ms ease',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <span style={{ color: '#9CA3AF', flexShrink: 0 }}>
                                                            <Ic.Chevron open={isOpen} />
                                                        </span>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                                                            {p.name}
                                                        </span>
                                                        <span style={{ color: '#9CA3AF', flexShrink: 0 }}>
                                                            <Ic.Folder />
                                                        </span>
                                                    </button>
                                                )}

                                                {/* Animated child chats */}
                                                <CollapsibleChats open={isOpen}>
                                                    {pChats.map(c => (
                                                        <ChatItem key={c.id} chat={c} isNested={true}
                                                            activeChatId={activeChatId} onSelect={onSelectChat} onDelete={deleteChat} />
                                                    ))}
                                                    {pChats.length === 0 && (
                                                        <div style={{ fontSize: '12.5px', color: '#9CA3AF', padding: '6px 12px 6px 28px', fontStyle: 'italic' }}>
                                                            No chats yet
                                                        </div>
                                                    )}
                                                </CollapsibleChats>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {freeChats.length === 0 && projects.length === 0 && (
                                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px', lineHeight: 1.6 }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.5 }}>💬</div>
                                    Start a new chat to begin
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── ④ Bottom profile ──────────────────────────────────────── */}
                <div style={{ borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
                    <button
                        onClick={() => setIsProfileOpen(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            width: '100%', padding: '12px 16px',
                            background: 'transparent', border: 'none',
                            cursor: 'pointer', textAlign: 'left',
                            transition: 'background 150ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#EFEFEF'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        {/* Avatar circle */}
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: '#111827', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontSize: '14px', fontWeight: 700,
                            border: '1.5px solid #374151',
                            userSelect: 'none',
                        }}>
                            L
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Local User
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                                <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontWeight: 500 }}>Online</span>
                            </div>
                        </div>
                    </button>
                </div>

            </aside>

            {/* ── Context menu portal ─────────────────────────────────────── */}
            {ctx && <CtxMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}

            {/* ── Profile modal portal ────────────────────────────────────── */}
            {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
        </>
    );
}

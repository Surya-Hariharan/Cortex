import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function relativeTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

/* ── icons ───────────────────────────────────────────────────────────────── */
const IconPlus = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
const IconSearch = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);
const IconChevron = ({ open }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
const IconFolder = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);
const IconChat = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);
const IconTrash = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
    </svg>
);
const IconEdit = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);
const IconUser = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
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
        <div ref={ref} className="fixed z-50 bg-white border border-[#E5E7EB] rounded-xl p-1.5 shadow-lg min-w-[160px]" style={{ left: x, top: y }}>
            {items.map((item) => (
                <button key={item.label}
                    onClick={() => { item.action(); onClose(); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
                    style={{
                        color: item.danger ? '#dc2626' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = item.danger ? '#fef2f2' : 'var(--surface-recessed)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                    {item.icon}{item.label}
                </button>
            ))}
        </div>
    );
}

/* ── Profile Modal ───────────────────────────────────────────────────────── */
function ProfileModal({ onClose }) {
    const [username, setUsername] = useState('Local User');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm bg-black/10 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl border border-[#E5E7EB] w-[420px] max-w-[90vw] overflow-hidden flex flex-col relative">

                {/* Close Button top-right */}
                <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#F3F4F6] transition-colors text-[#9CA3AF]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>

                <div className="p-8 flex flex-col items-center">
                    {/* Large Avatar */}
                    <div className="w-[88px] h-[88px] rounded-full bg-[#111827] text-white flex items-center justify-center mb-6 shadow-sm relative group cursor-pointer">
                        <span className="text-[32px] font-medium">L</span>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconEdit />
                        </div>
                    </div>

                    <div className="w-full space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">Display Name</label>
                            <input
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 text-[14px] text-[#111827] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] outline-none transition-all"
                            />
                        </div>

                        <div className="pt-2">
                            <button className="w-full flex items-center justify-between px-3.5 py-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors text-[14px] text-[#374151] font-medium">
                                <span>Theme Preference</span>
                                <span className="text-[#6B7280]">System</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex justify-between items-center">
                    <button className="text-[14px] font-medium text-[#DC2626] hover:text-[#B91C1C] transition-colors px-2 py-1">
                        Sign Out
                    </button>
                    <button onClick={onClose} className="px-5 py-2.5 bg-[#111827] text-white text-[14px] font-medium rounded-lg hover:bg-[#1F2937] transition-colors shadow-sm">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}


/* ── Main component ──────────────────────────────────────────────────────── */
export default function ChatSidebar({ activeChatId, onSelectChat, onNewChat }) {
    const [projects, setProjects] = useState([]);
    const [chats, setChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [expandedProjects, setExpandedProjects] = useState({});

    // UI State
    const [ctx, setCtx] = useState(null);
    const [editingProject, setEditingProject] = useState(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const editRef = useRef(null);

    const load = useCallback(async () => {
        if (!window.electronAPI) return;
        const [pr, ch] = await Promise.all([
            window.electronAPI.getProjects(),
            window.electronAPI.getChats(undefined),
        ]);
        setProjects(pr.projects || []);
        setChats(ch.chats || []);

        // Auto-expand projects that contain the active chat
        if (activeChatId && ch.chats) {
            const activeChat = ch.chats.find(c => c.id === activeChatId);
            if (activeChat?.projectId) {
                setExpandedProjects(prev => ({ ...prev, [activeChat.projectId]: true }));
            }
        }
    }, [activeChatId]);

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

    useEffect(() => { if (editingProject) editRef.current?.focus(); }, [editingProject]);

    /* ── Actions ── */
    const handleNewChat = async (projectId = null) => {
        if (!window.electronAPI) {
            const tempId = `temp-${Date.now()}`;
            onNewChat?.({ id: tempId, title: 'New Chat', projectId: null });
            onSelectChat?.(tempId);
            return;
        }
        const res = await window.electronAPI.createChat(projectId);
        if (res.success) {
            if (projectId) {
                setExpandedProjects(prev => ({ ...prev, [projectId]: true }));
            }
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
        const name = prompt('Workspace Name:');
        if (!name?.trim()) return;
        if (window.electronAPI) await window.electronAPI.createProject(name.trim());
        load();
    };
    const handleDeleteProject = async (id) => {
        if (!window.confirm('Delete workspace and all its chats?')) return;
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
        e.preventDefault(); e.stopPropagation();
        setCtx({ x: e.clientX, y: e.clientY, items });
    };

    const toggleProject = (id, e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
    };

    /* ── Render Chat Item ── */
    const ChatItem = ({ chat, isNested = false }) => {
        const isActive = activeChatId === chat.id;

        return (
            <button
                onClick={() => onSelectChat?.(chat.id)}
                onContextMenu={(e) => openCtx(e, [
                    { label: 'Delete chat', icon: <IconTrash />, action: () => handleDeleteChat(chat.id), danger: true },
                ])}
                className="w-full flex items-center justify-between text-left group transition-all duration-150"
                style={{
                    padding: '8px 12px',
                    paddingLeft: isNested ? '32px' : '12px',
                    borderRadius: '8px',
                    background: isActive ? 'var(--surface-recessed)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
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
                <div className="flex items-center gap-2.5 min-w-0 flex-1 relative">
                    {/* Active Indicator Bar */}
                    {isActive && (
                        <div className="absolute -left-[12px] top-0 bottom-0 w-[3px] bg-black rounded-r-sm" />
                    )}

                    <span className="flex-shrink-0" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        <IconChat />
                    </span>
                    <span className="text-[14px] truncate font-medium relative top-[1px]">
                        {chat.title}
                    </span>
                </div>
            </button>
        );
    };

    return (
        <aside className="w-[280px] h-full flex flex-col flex-shrink-0 relative bg-[#F9F9F9] border-r border-[#E5E7EB]">

            {/* 1. Header (Primary Actions) */}
            <div className="p-4 flex flex-col gap-2 flex-shrink-0">
                <button
                    onClick={() => handleNewChat(null)}
                    className="w-full h-[44px] bg-white border border-[#E5E7EB] shadow-sm flex items-center gap-3 px-4 rounded-[12px] text-[#111827] text-[14px] font-medium hover:bg-[#F3F4F6] transition-colors"
                >
                    <IconPlus />
                    <span>New Chat</span>
                </button>
                <button
                    onClick={handleCreateProject}
                    className="w-full h-[40px] bg-transparent border-none flex items-center gap-3 px-4 rounded-[12px] text-[#4B5563] text-[14px] font-medium hover:bg-[#E5E7EB] transition-colors"
                >
                    <IconPlus size={14} />
                    <span>New Workspace</span>
                </button>
            </div>

            {/* 2. Scrollable Library */}
            <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-6 align-start pb-4">

                {/* Search / Filter (optional cleanup based on preference, but good to have) */}
                <div className="px-2 pb-2">
                    <div className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-2 shadow-sm focus-within:border-[#111827] focus-within:ring-1 focus-within:ring-[#111827] transition-all">
                        <span className="text-[#9CA3AF]"><IconSearch /></span>
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search library..."
                            className="bg-transparent border-none outline-none text-[13px] text-[#111827] w-full placeholder-[#9CA3AF]"
                        />
                    </div>
                </div>

                {searchResults !== null ? (
                    /* Render Search Results */
                    <div className="flex flex-col gap-0.5 px-2">
                        <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider px-2 mb-2">Results</div>
                        {searchResults.length === 0 ? (
                            <div className="text-[13px] text-[#6B7280] px-3">No matches found.</div>
                        ) : (
                            searchResults.map(c => <ChatItem key={c.id} chat={c} />)
                        )}
                    </div>
                ) : (
                    /* Default Library View */
                    <div className="flex flex-col gap-6 px-1">

                        {/* Independent Chats */}
                        {chats.filter(c => !c.projectId).length > 0 && (
                            <div className="flex flex-col gap-0.5">
                                <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider px-3 mb-1.5 mt-2">
                                    Recent Chats
                                </div>
                                {chats.filter(c => !c.projectId).map(c => (
                                    <ChatItem key={c.id} chat={c} />
                                ))}
                            </div>
                        )}

                        {/* Workspaces (Projects) */}
                        {projects.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider px-3 mb-1.5">
                                    Workspaces
                                </div>

                                {projects.map((p) => {
                                    const pChats = chats.filter(c => c.projectId === p.id);
                                    const isOpen = expandedProjects[p.id];

                                    return (
                                        <div key={p.id} className="flex flex-col mb-1">
                                            {editingProject?.id === p.id ? (
                                                <input
                                                    ref={editRef}
                                                    defaultValue={p.name}
                                                    className="w-full bg-white border border-[#111827] rounded-lg px-3 py-2 text-[14px] font-medium outline-none mx-2 w-[calc(100%-16px)]"
                                                    onBlur={(e) => handleRenameProject(p.id, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameProject(p.id, e.target.value);
                                                        if (e.key === 'Escape') setEditingProject(null);
                                                    }}
                                                />
                                            ) : (
                                                <button
                                                    onClick={(e) => toggleProject(p.id, e)}
                                                    onContextMenu={(e) => openCtx(e, [
                                                        { label: 'New chat in workspace', icon: <IconPlus size={14} />, action: () => handleNewChat(p.id) },
                                                        { label: 'Rename workspace', icon: <IconEdit />, action: () => setEditingProject(p) },
                                                        { label: 'Delete workspace', icon: <IconTrash />, action: () => handleDeleteProject(p.id), danger: true },
                                                    ])}
                                                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[14px] font-semibold text-[#374151] hover:bg-[#E5E7EB] transition-colors"
                                                >
                                                    <span className="text-[#9CA3AF]">
                                                        <IconChevron open={isOpen} />
                                                    </span>
                                                    <span className="truncate flex-1 text-left relative top-[1px]">{p.name}</span>
                                                </button>
                                            )}

                                            {/* Child Chats */}
                                            {isOpen && pChats.length > 0 && (
                                                <div className="flex flex-col mt-0.5 mb-1 pb-1">
                                                    {pChats.map(c => <ChatItem key={c.id} chat={c} isNested={true} />)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                    </div>
                )}
            </div>

            {/* 3. Bottom Account Profile */}
            <div className="mt-auto border-t border-[#E5E7EB] flex-shrink-0">
                <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="w-full h-[64px] px-4 flex items-center justify-between hover:bg-[#E5E7EB] transition-colors cursor-pointer text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#111827] flex items-center justify-center text-white flex-shrink-0 shadow-sm border border-[#374151]">
                            <span className="text-[14px] font-medium">L</span>
                        </div>
                        <div className="flex flex-col text-left max-w-[160px]">
                            <span className="text-[14px] font-semibold text-[#111827] truncate">Local User</span>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                                <span className="text-[12px] text-[#6B7280] font-medium">Online</span>
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* Context Menu Portals */}
            {ctx && <CtxMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}

            {/* Profile Modal */}
            {isProfileModalOpen && (
                <ProfileModal onClose={() => setIsProfileModalOpen(false)} />
            )}

        </aside>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import SearchTab from './components/SearchTab';
import NetworkTab from './components/NetworkTab';
import PerformanceTab from './components/PerformanceTab';
import NotesTab from './components/NotesTab';
import Toast from './components/Toast';
import { Search, FileText, Globe, Zap, Plus, Settings, User, LogOut, PanelLeftClose, PanelLeft, Monitor, MoreHorizontal, Trash2, Edit, Copy } from 'lucide-react';

const TABS = [
    { id: 'search', label: 'Search', icon: <Search size={18} /> },
    { id: 'notes', label: 'Notes', icon: <FileText size={18} /> },
    { id: 'network', label: 'Network', icon: <Globe size={18} /> },
    { id: 'performance', label: 'Performance', icon: <Zap size={18} /> },
];

const MOCK_PROJECTS = [
    {
        id: 'w1', title: 'AI Research', chats: [
            { id: 'c1', title: 'RAG Pipeline' },
            { id: 'c2', title: 'OCR Integration' }
        ]
    },
    {
        id: 'w2', title: 'AMD Hackathon', chats: [
            { id: 'c3', title: 'UI System Fix' },
            { id: 'c4', title: 'Mesh Protocol' }
        ]
    }
];

const MOCK_INDEPENDENT_CHATS = [
    { id: 'ic1', title: 'General Inquiry' },
    { id: 'ic2', title: 'Bug Report Log' },
];

export default function App() {
    const [activeTab, setActiveTab] = useState('search');
    const [stats, setStats] = useState({ documents: 0, embeddings: 0, subjects: [] });
    const [toast, setToast] = useState(null);
    const [perfProvider, setPerfProvider] = useState('cpu');
    const [wsExpanded, setWsExpanded] = useState({ w1: true, w2: true });

    // New UI states
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('cortex-theme') || 'system';
    });
    const [activeChatId, setActiveChatId] = useState('c1');
    const [username, setUsername] = useState('Surya Hariharan');

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetId: null, type: null });
    const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, targetId: null, title: '' });

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu]);

    const perfPollRef = useRef(null);

    useEffect(() => {
        console.log('[App] Mounting...');
        if (window.electronAPI) {
            console.log('[App] electronAPI found, fetching stats...');
            window.electronAPI.getStats().then((res) => {
                console.log('[App] Stats received:', res);
                setStats(res);
            }).catch((err) => {
                console.error('[App] Failed to fetch stats:', err);
            });
        } else {
            console.error('[App] window.electronAPI is undefined!');
        }
    }, []);

    // Theme toggling logic
    useEffect(() => {
        const root = window.document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const updateTheme = () => {
            const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
            if (isDark) {
                root.classList.add('dark');
                if (window.electronAPI?.updateTitleBarOverlay) {
                    window.electronAPI.updateTitleBarOverlay({
                        color: '#171717',
                        symbolColor: '#ececec',
                        height: 32
                    });
                }
            } else {
                root.classList.remove('dark');
                if (window.electronAPI?.updateTitleBarOverlay) {
                    window.electronAPI.updateTitleBarOverlay({
                        color: '#FFFFFF',
                        symbolColor: '#475569',
                        height: 32
                    });
                }
            }
        };

        updateTheme();
        localStorage.setItem('cortex-theme', theme);

        const handleChange = () => { if (theme === 'system') updateTheme(); };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    useEffect(() => {
        const poll = () => {
            if (window.electronAPI) {
                window.electronAPI.getPerfStats()
                    .then((p) => { if (p) setPerfProvider(p.provider); })
                    .catch(() => { });
            }
        };
        poll();
        perfPollRef.current = setInterval(poll, 4000);
        return () => clearInterval(perfPollRef.current);
    }, []);

    const showToast = (message, type = 'success') => {
        setToast({ message, type, id: Date.now() });
    };

    const toggleWs = (id) => {
        setWsExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const uploadPdf = async () => {
        if (window.electronAPI) {
            const result = await window.electronAPI.uploadPdf();
            if (result && result.success) {
                showToast(`Indexed "${result.title}" (${result.chunks} chunks)`);
                const newStats = await window.electronAPI.getStats();
                setStats(newStats);
            } else if (result && result.error) {
                showToast(result.error, 'error');
            }
        }
    };

    return (
        <div className="h-screen flex bg-white dark:bg-dark-950 text-dark-800 dark:text-dark-100 overflow-hidden font-sans pt-0">
            {/* ── Sidebar ──────────────────────────────────────────────────────── */}
            <div className={`bg-dark-50 dark:bg-dark-900 flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out relative ${isSidebarCollapsed ? 'w-[68px]' : 'w-[260px] border-r border-dark-200 dark:border-dark-800'}`}>
                {/* Drag Handle & Collapse Button */}
                <div className={`flex items-center p-3 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`} style={{ WebkitAppRegion: 'drag' }}>
                    {!isSidebarCollapsed && (
                        <div className="flex items-center gap-2 px-1" style={{ WebkitAppRegion: 'no-drag' }}>
                            <span className="text-lg font-black tracking-tight text-dark-800 dark:text-dark-50">
                                Cor<span className="text-synapse-600 dark:text-synapse-500">tex</span>
                            </span>
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-dark-400 dark:hover:text-dark-200 hover:bg-slate-200/50 dark:hover:bg-dark-800/50 transition-colors"
                        style={{ WebkitAppRegion: 'no-drag' }}
                        title={isSidebarCollapsed ? "Expand sidebar" : "Close sidebar"}
                    >
                        {isSidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                    </button>
                </div>

                {/* Primary Actions */}
                <div className="px-3 pb-3" style={{ WebkitAppRegion: 'no-drag' }}>
                    {isSidebarCollapsed ? (
                        <button
                            onClick={() => setActiveTab('search')}
                            className="w-full flex justify-center items-center py-2.5 bg-synapse-600 hover:bg-synapse-700 text-white rounded-xl transition-all duration-200 shadow-sm border border-synapse-700 dark:border-synapse-500 mt-1"
                            title="New Chat"
                        >
                            <Plus size={20} />
                        </button>
                    ) : (
                        <div className="flex gap-2.5 mt-1">
                            <button
                                onClick={() => setActiveTab('search')}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-700/50 text-slate-700 dark:text-dark-100 font-bold rounded-xl transition-all duration-200 shadow-sm border border-slate-200 dark:border-dark-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-dark-700 text-[13px]"
                            >
                                <span className="text-synapse-600 dark:text-synapse-500"><Plus size={18} /></span>
                                New Chat
                            </button>
                            <button
                                className="px-3 py-2 bg-white dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-700/50 text-slate-400 dark:text-dark-400 hover:text-slate-600 dark:hover:text-dark-200 font-bold rounded-xl transition-all duration-200 shadow-sm border border-slate-200 dark:border-dark-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-dark-700"
                                title="New Project"
                            >
                                <Monitor size={18} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-3 space-y-6 mt-2 pb-4" style={{ WebkitAppRegion: 'no-drag' }}>
                    {/* Tools Section (Moved up) */}
                    <div>
                        {!isSidebarCollapsed && (
                            <div className="sidebar-header">
                                <span>Pages</span>
                            </div>
                        )}
                        <div className="space-y-0.5 relative">
                            {TABS.slice(1).map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`${isActive ? 'sidebar-nav-item-active' : 'sidebar-nav-item text-slate-600 dark:text-dark-400'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
                                        title={isSidebarCollapsed ? tab.label : ''}
                                    >
                                        {!isSidebarCollapsed && (
                                            <div className="sidebar-accent-container">
                                                <div className={`sidebar-active-accent ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                                            </div>
                                        )}
                                        <div className="sidebar-icon-container">
                                            <span className={`${isActive ? 'text-synapse-600 dark:text-synapse-400' : 'text-slate-400 dark:text-dark-500'}`}>
                                                {tab.icon}
                                            </span>
                                        </div>
                                        {!isSidebarCollapsed && (
                                            <span className="truncate flex-1 text-left">
                                                {tab.label}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Projects Section */}
                    <div>
                        {!isSidebarCollapsed && (
                            <div className="sidebar-header group">
                                <span>Projects</span>
                                <Plus size={14} className="opacity-0 group-hover:opacity-100 cursor-pointer hover:text-synapse-500 transition-all" />
                            </div>
                        )}
                        {isSidebarCollapsed ? (
                            <div className="flex flex-col gap-2.5 items-center mt-4 border-b border-dark-100/50 dark:border-dark-800/50 pb-4">
                                {MOCK_PROJECTS.map((ws) => (
                                    <div key={ws.id} className="w-8 h-8 rounded border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-sm flex items-center justify-center text-[10px] uppercase font-bold text-slate-500 dark:text-dark-400 hover:text-synapse-600 dark:hover:text-synapse-400 hover:border-synapse-200 dark:hover:border-synapse-500 cursor-pointer transition-colors" title={ws.title}>
                                        {ws.title.substring(0, 2)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-0.5 border-b border-dark-100/50 dark:border-dark-800/50 pb-4">
                                {MOCK_PROJECTS.map(ws => (
                                    <div key={ws.id} className="space-y-0.5">
                                        <button
                                            onClick={() => toggleWs(ws.id)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: ws.id, type: 'project', title: ws.title });
                                            }}
                                            className="sidebar-nav-item text-slate-600 dark:text-dark-400 group"
                                        >
                                            <div className="sidebar-accent-container" />
                                            <div className="sidebar-icon-container opacity-40">
                                                <Monitor size={16} />
                                            </div>
                                            <span className="truncate flex-1 text-left font-bold text-slate-500 dark:text-dark-400 group-hover:text-slate-800 dark:group-hover:text-dark-100 transition-colors uppercase text-[11px] tracking-wide">
                                                {ws.title}
                                            </span>
                                            <div
                                                className="sidebar-menu-trigger"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: ws.id, type: 'project', title: ws.title });
                                                }}
                                            >
                                                <MoreHorizontal size={14} />
                                            </div>
                                        </button>

                                        {wsExpanded[ws.id] && (
                                            <div className="space-y-0.5 relative">
                                                {ws.chats.map((chat) => {
                                                    const isActive = activeTab === 'search' && activeChatId === chat.id;
                                                    return (
                                                        <button
                                                            key={chat.id}
                                                            onClick={() => { setActiveTab('search'); setActiveChatId(chat.id); }}
                                                            onContextMenu={(e) => {
                                                                e.preventDefault();
                                                                setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: chat.id, type: 'chat', title: chat.title });
                                                            }}
                                                            className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : 'text-slate-600 dark:text-dark-400'}`}
                                                        >
                                                            <div className="sidebar-accent-container">
                                                                <div className={`sidebar-active-accent ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                                                            </div>
                                                            <div className="sidebar-icon-container opacity-40">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                            </div>
                                                            <span className="truncate flex-1 text-left">{chat.title}</span>
                                                            <div
                                                                className="sidebar-menu-trigger"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: chat.id, type: 'chat', title: chat.title });
                                                                }}
                                                            >
                                                                <MoreHorizontal size={14} />
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Your Chats Section */}
                        {!isSidebarCollapsed && (
                            <div className="sidebar-header mt-4">
                                <span>Your Chats</span>
                            </div>
                        )}
                        <div className={`space-y-0.5 ${isSidebarCollapsed ? 'mt-4' : ''}`}>
                            {MOCK_INDEPENDENT_CHATS.map((chat) => {
                                const isActive = activeTab === 'search' && activeChatId === chat.id;
                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => { setActiveTab('search'); setActiveChatId(chat.id); }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: chat.id, type: 'chat', title: chat.title });
                                        }}
                                        className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : 'text-slate-600 dark:text-dark-400'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
                                        title={isSidebarCollapsed ? chat.title : ''}
                                    >
                                        <div className="sidebar-accent-container">
                                            <div className={`sidebar-active-accent ${isActive && !isSidebarCollapsed ? 'opacity-100' : 'opacity-0'}`} />
                                        </div>
                                        {isSidebarCollapsed ? (
                                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-synapse-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300 dark:bg-dark-700'}`} />
                                        ) : (
                                            <>
                                                <div className="sidebar-icon-container opacity-40">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                </div>
                                                <span className="truncate flex-1 text-left">{chat.title}</span>
                                                <div
                                                    className="sidebar-menu-trigger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: chat.id, type: 'chat', title: chat.title });
                                                    }}
                                                >
                                                    <MoreHorizontal size={14} />
                                                </div>
                                            </>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Profile Panel (Footer) */}
                <div className="p-3 mt-auto border-t border-dark-200/50 dark:border-dark-800/50 bg-dark-50/50 dark:bg-dark-900/50" style={{ WebkitAppRegion: 'no-drag' }}>
                    <button
                        onClick={() => setShowProfileModal(true)}
                        className={`w-full flex items-center p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-dark-800/60 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-dark-700 hover:shadow-sm ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-synapse-500 to-indigo-400 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm border border-synapse-200 dark:border-synapse-800">
                            SH
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="flex-1 text-left min-w-0 flex flex-col justify-center">
                                <span className="text-sm font-semibold text-slate-800 dark:text-dark-50 truncate leading-tight">{username}</span>
                                <span className="text-[10px] text-slate-500 dark:text-dark-400 font-medium capitalize mt-0.5">Free Plan</span>
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Main Content Area ────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-dark-950 relative">
                <div className="h-4 w-full absolute top-0 left-0 bg-transparent z-50 pointer-events-none" style={{ WebkitAppRegion: 'drag' }} />

                <main className="flex-1 overflow-hidden h-full" style={{ WebkitAppRegion: 'no-drag' }}>
                    {activeTab === 'search' && <SearchTab onToast={showToast} onUploadPdf={uploadPdf} />}
                    {activeTab === 'notes' && <NotesTab onToast={showToast} />}
                    {activeTab === 'network' && <NetworkTab />}
                    {activeTab === 'performance' && <PerformanceTab />}
                </main>

                {/* ── Context Menu ────────────────────────────────────────────── */}
                {contextMenu.visible && (
                    <div
                        className="context-menu"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className="context-menu-item">
                            <Edit size={14} /> Rename
                        </button>
                        <button className="context-menu-item">
                            <Copy size={14} /> Duplicate
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-dark-800 my-1" />
                        <button
                            className="context-menu-item context-menu-item-destructive"
                            onClick={() => {
                                setContextMenu({ ...contextMenu, visible: false });
                                setDeleteConfirm({ visible: true, targetId: contextMenu.targetId, title: contextMenu.title });
                            }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                )}

                {/* ── Delete Confirmation Modal ───────────────────────────────── */}
                {deleteConfirm.visible && (
                    <div className="modal-overlay" onClick={() => setDeleteConfirm({ ...deleteConfirm, visible: false })}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-2">Delete {deleteConfirm.title}?</h3>
                            <p className="text-sm text-slate-500 dark:text-dark-400 mb-6 leading-relaxed">
                                This action cannot be undone. All data associated with this {deleteConfirm.targetId?.startsWith('w') ? 'project' : 'chat'} will be permanently removed.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setDeleteConfirm({ ...deleteConfirm, visible: false })}
                                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        showToast(`Deleted ${deleteConfirm.title}`, 'success');
                                        setDeleteConfirm({ ...deleteConfirm, visible: false });
                                    }}
                                    className="px-6 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors shadow-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Toast ────────────────────────────────────────────────────────── */}
                {toast && (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </div>

            {/* ── Profile Modal ────────────────────────────────────────────────── */}
            {showProfileModal && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" style={{ WebkitAppRegion: 'no-drag' }}>
                    <div className="bg-white dark:bg-dark-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200/60 dark:border-dark-700/60 animate-scale-in">
                        <div className="p-6 border-b border-slate-100 dark:border-dark-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-dark-50">Settings</h2>
                            <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600 dark:text-dark-400 dark:hover:text-dark-200 transition-colors">
                                <Plus size={20} className="rotate-45" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Account Section */}
                            <div className="flex items-center gap-4">
                                <div className="relative group w-16 h-16 rounded-full bg-gradient-to-tr from-synapse-500 to-indigo-400 flex items-center justify-center text-white font-bold text-xl shadow-inner cursor-pointer">
                                    SH
                                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <User size={20} />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-dark-400 mb-1">Display Name</label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 transition-all text-slate-800 dark:text-dark-50"
                                    />
                                </div>
                            </div>

                            <hr className="border-slate-100 dark:border-dark-800" />

                            {/* Preferences Section */}
                            <div className="space-y-3">
                                <label className="block text-xs font-semibold text-slate-500 dark:text-dark-400 mb-1">App Theme</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setTheme('light')} className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-synapse-500 bg-synapse-50/50 dark:bg-synapse-900/20' : 'border-slate-100 dark:border-dark-800 hover:border-slate-200 dark:hover:border-dark-700 bg-white dark:bg-dark-950'}`}>
                                        <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-300" />
                                        <span className={`text-xs font-semibold ${theme === 'light' ? 'text-synapse-700 dark:text-synapse-400' : 'text-slate-600 dark:text-dark-400'}`}>Light</span>
                                    </button>
                                    <button onClick={() => setTheme('dark')} className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-synapse-500 bg-synapse-50/50 dark:bg-synapse-900/20' : 'border-slate-100 dark:border-dark-800 hover:border-slate-200 dark:hover:border-dark-700 bg-white dark:bg-dark-950'}`}>
                                        <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700" />
                                        <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-synapse-700 dark:text-synapse-400' : 'text-slate-600 dark:text-dark-400'}`}>Dark</span>
                                    </button>
                                    <button onClick={() => setTheme('system')} className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-synapse-500 bg-synapse-50/50 dark:bg-synapse-900/20' : 'border-slate-100 dark:border-dark-800 hover:border-slate-200 dark:hover:border-dark-700 bg-white dark:bg-dark-950'}`}>
                                        <Monitor size={16} className={theme === 'system' ? 'text-synapse-600 dark:text-synapse-400' : 'text-slate-400 dark:text-dark-500'} />
                                        <span className={`text-xs font-semibold ${theme === 'system' ? 'text-synapse-700 dark:text-synapse-400' : 'text-slate-600 dark:text-dark-400'}`}>System</span>
                                    </button>
                                </div>
                            </div>

                            {/* Engine Section */}
                            <div className="bg-slate-50 dark:bg-dark-950/50 rounded-xl p-3 border border-slate-100 dark:border-dark-800/60 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-dark-50">Hardware Acceleration</p>
                                    <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">Currently running on <span className="font-bold text-slate-700 dark:text-dark-200">{perfProvider.toUpperCase()}</span></p>
                                </div>
                                <Settings size={18} className="text-slate-400 dark:text-dark-500" />
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-dark-950 border-t border-slate-100 dark:border-dark-800 flex items-center justify-between">
                            <button className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-sm font-semibold transition-colors">
                                <LogOut size={16} />
                                Log Out
                            </button>
                            <button onClick={() => setShowProfileModal(false)} className="px-5 py-2 bg-slate-800 dark:bg-dark-100 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-dark-900 rounded-lg text-sm font-bold transition-colors shadow-sm">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import HomePage from './components/pages/HomePage';
import Knowledge from './components/pages/Knowledge';
import Workspace from './components/pages/Workspace';
import Campus from './components/pages/Campus';
import Activity from './components/pages/Activity';
import AIEngine from './components/pages/AIEngine';
import StreamSelectorModal from './components/layout/StreamSelectorModal';
import CommandPalette from './components/layout/CommandPalette';
import Toast from './components/layout/Toast';
import { Search, FileText, Globe, Zap, Plus, Settings, User, LogOut, PanelLeftClose, PanelLeft, Monitor, MoreHorizontal, Trash2, Edit, Copy, ChevronRight, Folder, FolderOpen, Home, BookOpen, Users, Activity as ActivityIcon, Cpu, Bell, Palette, Database, ShieldCheck, X } from 'lucide-react';

const TABS = [
    { id: 'knowledge', label: 'Home', icon: <Home size={18} /> },
    { id: 'home', label: 'Knowledge', icon: <BookOpen size={18} /> },
    { id: 'workspace', label: 'Workspace', icon: <FileText size={18} /> },
    { id: 'campus', label: 'Campus', icon: <Users size={18} /> },
    { id: 'activity', label: 'Activity', icon: <ActivityIcon size={18} /> },
    { id: 'ai-engine', label: 'AI Engine', icon: <Cpu size={18} /> },
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
    const [activeTab, setActiveTab] = useState('knowledge');
    const [stats, setStats] = useState({ documents: 0, embeddings: 0, subjects: [] });
    const [toast, setToast] = useState(null);
    const [perfProvider, setPerfProvider] = useState('cpu');
    const [wsExpanded, setWsExpanded] = useState({ w1: true, w2: true });

    // New UI states
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [userStream, setUserStream] = useState(localStorage.getItem('cortex-user-stream'));
    const [showStreamSelector, setShowStreamSelector] = useState(!localStorage.getItem('cortex-user-stream'));
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('cortex-theme') || 'system';
    });
    const [activeChatId, setActiveChatId] = useState('c1');
    const [username, setUsername] = useState('Surya Hariharan');

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetId: null, type: null });
    const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, targetId: null, title: '' });
    const [settingsTab, setSettingsTab] = useState('general');
    const [improveModel, setImproveModel] = useState(true);
    const [showDeleteAllChats, setShowDeleteAllChats] = useState(false);

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = () => {
            if (contextMenu.visible) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu.visible]);

    // Ctrl+K / Ctrl+F / Ctrl+Up / Ctrl+Down
    useEffect(() => {
        function getScrollTarget() {
            let el = document.activeElement;
            while (el && el !== document.body) {
                const s = window.getComputedStyle(el);
                if (['auto', 'scroll'].includes(s.overflowY) && el.scrollHeight > el.clientHeight) return el;
                el = el.parentElement;
            }
            const main = document.querySelector('main');
            if (main) {
                for (const node of main.querySelectorAll('*')) {
                    const s = window.getComputedStyle(node);
                    if (['auto', 'scroll'].includes(s.overflowY) && node.scrollHeight > node.clientHeight) return node;
                }
            }
            return document.documentElement;
        }

        const handleKeyDown = (e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            if (e.key === 'k') {
                e.preventDefault();
                setShowCommandPalette(prev => !prev);
            } else if (e.key === 'f') {
                e.preventDefault();
                setShowCommandPalette(true);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                getScrollTarget().scrollBy({ top: -120, behavior: 'smooth' });
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                getScrollTarget().scrollBy({ top: 120, behavior: 'smooth' });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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

    const handleStreamSelect = (streamId) => {
        localStorage.setItem('cortex-user-stream', streamId);
        setUserStream(streamId);
        setShowStreamSelector(false);
        showToast(`Experience personalized for ${streamId.toUpperCase().replace('-', ' ')}`, 'success');
    };

    const handleStreamSkip = () => {
        localStorage.setItem('cortex-user-stream', 'general');
        setUserStream('general');
        setShowStreamSelector(false);
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
                        <div className="relative">
                            {TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : 'text-slate-600 dark:text-dark-400'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
                                        title={isSidebarCollapsed ? tab.label : ''}
                                    >
                                        <div className="sidebar-accent-container">
                                            {!isSidebarCollapsed && <div className={`sidebar-active-accent ${isActive ? 'opacity-100' : 'opacity-0'}`} />}
                                        </div>
                                        <div className="sidebar-icon-container">
                                            <span className={`${isActive ? 'text-synapse-600 dark:text-synapse-400' : 'text-slate-400 dark:text-dark-500'}`}>
                                                {tab.icon}
                                            </span>
                                        </div>
                                        {!isSidebarCollapsed && (
                                            <span className="sidebar-label">
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
                                <span>Workspaces</span>
                                <Plus size={14} className="opacity-0 group-hover:opacity-100 cursor-pointer hover:text-synapse-500 transition-all" />
                            </div>
                        )}
                        {isSidebarCollapsed ? (
                            <div className="flex flex-col gap-1 items-center mt-2 border-b border-dark-100/50 dark:border-dark-800/50 pb-4">
                                {MOCK_PROJECTS.map((ws) => (
                                    <div key={ws.id} className="w-8 h-8 rounded border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-sm flex items-center justify-center text-[10px] uppercase font-bold text-slate-500 dark:text-dark-400 hover:text-synapse-600 dark:hover:text-synapse-400 hover:border-synapse-200 dark:hover:border-synapse-500 cursor-pointer transition-colors" title={ws.title}>
                                        {ws.title.substring(0, 2)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="border-b border-dark-100/50 dark:border-dark-800/50 pb-4">
                                {MOCK_PROJECTS.map(ws => {
                                    const isExpanded = wsExpanded[ws.id];
                                    return (
                                        <div key={ws.id}>
                                            <button
                                                onClick={() => toggleWs(ws.id)}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: ws.id, type: 'project', title: ws.title });
                                                }}
                                                className="sidebar-nav-item text-slate-600 dark:text-dark-400 group"
                                            >
                                                <div className="sidebar-accent-container">
                                                    <ChevronRight size={14} className={`sidebar-chevron ${isExpanded ? 'sidebar-chevron-expanded' : ''}`} />
                                                </div>
                                                <div className="sidebar-icon-container">
                                                    {isExpanded ? <FolderOpen size={18} className="text-synapse-500" /> : <Folder size={18} className="text-slate-400 dark:text-dark-500" />}
                                                </div>
                                                <span className="sidebar-label font-bold text-slate-500 dark:text-dark-400 group-hover:text-slate-800 dark:group-hover:text-dark-100 transition-colors uppercase text-[11px] tracking-wide">
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

                                            {isExpanded && (
                                                <div className="relative">
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
                                                                className={`sidebar-nav-item sidebar-child-item ${isActive ? 'sidebar-nav-item-active' : 'text-slate-600 dark:text-dark-400'}`}
                                                            >
                                                                <div className="sidebar-accent-container">
                                                                    <div className={`sidebar-active-accent ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                                                                </div>
                                                                <div className="sidebar-icon-container">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-synapse-500' : 'bg-slate-400 dark:bg-dark-600'}`} />
                                                                </div>
                                                                <span className="sidebar-label">{chat.title}</span>
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
                                    );
                                })}
                            </div>
                        )}

                        {/* Your Chats Section */}
                        {!isSidebarCollapsed && (
                            <div className="sidebar-header">
                                <span>Your Chats</span>
                            </div>
                        )}
                        <div className="relative">
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
                                            {!isSidebarCollapsed && <div className={`sidebar-active-accent ${isActive ? 'opacity-100' : 'opacity-0'}`} />}
                                        </div>
                                        {isSidebarCollapsed ? (
                                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-synapse-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300 dark:bg-dark-700'}`} />
                                        ) : (
                                            <>
                                                <div className="sidebar-icon-container">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-synapse-500' : 'bg-slate-400 dark:bg-dark-600'}`} />
                                                </div>
                                                <span className="sidebar-label">{chat.title}</span>
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
                    {activeTab === 'home' && <HomePage onTabChange={setActiveTab} onUploadPdf={uploadPdf} />}
                    {activeTab === 'knowledge' && <Knowledge onToast={showToast} onUploadPdf={uploadPdf} userStream={userStream} />}
                    {activeTab === 'workspace' && <Workspace onToast={showToast} />}
                    {activeTab === 'campus' && <Campus />}
                    {activeTab === 'activity' && <Activity />}
                    {activeTab === 'ai-engine' && <AIEngine />}
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

                {toast && (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </div>

            {showStreamSelector && (
                <StreamSelectorModal
                    onSelect={handleStreamSelect}
                    onSkip={handleStreamSkip}
                />
            )}

            {/* ── Settings Modal (ChatGPT-style) ──────────────────────────────── */}
            {showProfileModal && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                    style={{ WebkitAppRegion: 'no-drag' }}
                    onClick={() => setShowProfileModal(false)}
                >
                    <div
                        className="bg-white dark:bg-dark-900 rounded-2xl w-full max-w-3xl h-[580px] shadow-2xl overflow-hidden border border-slate-200/60 dark:border-dark-700/60 flex animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ── Left nav ── */}
                        <div className="w-52 flex-shrink-0 bg-slate-50 dark:bg-dark-950/70 border-r border-slate-100 dark:border-dark-800 flex flex-col p-3">
                            <div className="flex items-center justify-between px-2 py-2 mb-2">
                                <h2 className="text-base font-bold text-slate-800 dark:text-dark-50">Settings</h2>
                                <button
                                    onClick={() => setShowProfileModal(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:text-dark-500 dark:hover:text-dark-200 hover:bg-slate-200 dark:hover:bg-dark-800 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <nav className="flex flex-col gap-0.5">
                                {[
                                    { id: 'general',         label: 'General',         Icon: Settings    },
                                    { id: 'notifications',   label: 'Notifications',   Icon: Bell        },
                                    { id: 'personalization', label: 'Personalization', Icon: Palette     },
                                    { id: 'data-controls',   label: 'Data controls',   Icon: Database    },
                                    { id: 'security',        label: 'Security',        Icon: ShieldCheck },
                                    { id: 'account',         label: 'Account',         Icon: User        },
                                ].map(({ id, label, Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => setSettingsTab(id)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full ${
                                            settingsTab === id
                                                ? 'bg-white dark:bg-dark-800 text-slate-900 dark:text-dark-50 shadow-sm border border-slate-100 dark:border-dark-700'
                                                : 'text-slate-600 dark:text-dark-400 hover:bg-white/70 dark:hover:bg-dark-800/60 hover:text-slate-900 dark:hover:text-dark-100'
                                        }`}
                                    >
                                        <Icon size={16} />
                                        {label}
                                    </button>
                                ))}
                            </nav>
                            <div className="mt-auto pt-3 border-t border-slate-100 dark:border-dark-800">
                                <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors w-full">
                                    <LogOut size={16} />
                                    Log out
                                </button>
                            </div>
                        </div>

                        {/* ── Right content ── */}
                        <div className="flex-1 overflow-y-auto">

                            {/* General */}
                            {settingsTab === 'general' && (
                                <div className="p-7 space-y-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-dark-50 mb-3">General</h3>
                                        <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Theme</span>
                                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-dark-800 rounded-xl p-1">
                                            {['light', 'dark', 'system'].map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setTheme(t)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                                                        theme === t
                                                            ? 'bg-white dark:bg-dark-700 text-slate-900 dark:text-dark-50 shadow-sm'
                                                            : 'text-slate-500 dark:text-dark-400 hover:text-slate-700 dark:hover:text-dark-200'
                                                    }`}
                                                >{t}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Language</span>
                                        <span className="text-sm text-slate-500 dark:text-dark-400 flex items-center gap-1">English <ChevronRight size={14} /></span>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-dark-200">Hardware acceleration</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Currently running on <span className="font-bold">{perfProvider.toUpperCase()}</span></p>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-500 dark:text-dark-300 bg-slate-100 dark:bg-dark-800 px-3 py-1 rounded-full">{perfProvider.toUpperCase()}</span>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Archive all chats</span>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors">Archive all</button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Delete all chats</span>
                                        <button onClick={() => setShowDeleteAllChats(true)} className="px-4 py-1.5 text-xs font-semibold border border-red-300 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors">Delete all</button>
                                    </div>
                                </div>
                            )}

                            {/* Notifications */}
                            {settingsTab === 'notifications' && (
                                <div className="p-7 space-y-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-dark-50 mb-3">Notifications</h3>
                                        <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    </div>
                                    {[
                                        { label: 'Push notifications', desc: 'Alerts for new messages and AI responses' },
                                        { label: 'Email digest',        desc: 'Weekly summary of your study activity'   },
                                        { label: 'Study reminders',     desc: 'Daily reminders for your learning goals' },
                                    ].map(({ label, desc }) => (
                                        <React.Fragment key={label}>
                                            <div className="flex items-center justify-between py-1">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-dark-200">{label}</p>
                                                    <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">{desc}</p>
                                                </div>
                                                <div className="w-10 h-6 rounded-full bg-slate-200 dark:bg-dark-700 relative cursor-pointer flex-shrink-0">
                                                    <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-all" />
                                                </div>
                                            </div>
                                            <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}

                            {/* Personalization */}
                            {settingsTab === 'personalization' && (
                                <div className="p-7 space-y-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-dark-50 mb-3">Personalization</h3>
                                        <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Display name</span>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            className="w-44 px-3 py-1.5 text-sm bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 transition-all text-slate-800 dark:text-dark-50 text-right"
                                        />
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-dark-200">Academic stream</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Personalises content recommendations</p>
                                        </div>
                                        <span className="text-sm text-slate-500 dark:text-dark-400 flex items-center gap-1">{userStream || 'Not set'} <ChevronRight size={14} /></span>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-start justify-between gap-4 py-1">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-dark-200">Memory</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5 max-w-xs leading-relaxed">Cortex remembers details from your sessions for smarter, personalised responses.</p>
                                        </div>
                                        <div className="w-10 h-6 rounded-full bg-synapse-500 relative cursor-pointer flex-shrink-0 mt-0.5">
                                            <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white shadow" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Data controls */}
                            {settingsTab === 'data-controls' && (
                                <div className="p-7 space-y-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-dark-50 mb-3">Data controls</h3>
                                        <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    </div>
                                    <div className="flex items-start justify-between gap-6 py-1">
                                        <div className="max-w-xs">
                                            <p className="text-sm font-medium text-slate-700 dark:text-dark-200">Improve Cortex for everyone</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-1 leading-relaxed">Allow your interactions to help train and improve Cortex's AI models. You can opt out at any time.</p>
                                        </div>
                                        <button
                                            onClick={() => setImproveModel(p => !p)}
                                            className={`w-10 h-6 rounded-full relative flex-shrink-0 transition-colors mt-0.5 ${improveModel ? 'bg-synapse-500' : 'bg-slate-200 dark:bg-dark-700'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${improveModel ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Shared links</span>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors">Manage</button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Archived chats</span>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors">Manage</button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Archive all chats</span>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors">Archive all</button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Delete all chats</span>
                                        <button
                                            onClick={() => setShowDeleteAllChats(true)}
                                            className="px-4 py-1.5 text-xs font-semibold border border-red-300 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors"
                                        >Delete all</button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Export data</span>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors">Export</button>
                                    </div>
                                </div>
                            )}

                            {/* Security */}
                            {settingsTab === 'security' && (
                                <div className="p-7 space-y-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-dark-50 mb-3">Security</h3>
                                        <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-dark-200">Password</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Last changed over 30 days ago</p>
                                        </div>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors">Change</button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-dark-200">Two-factor authentication</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Add an extra layer of security to your account</p>
                                        </div>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors">Enable</button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-dark-200">Active sessions</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">1 active session on this device</p>
                                        </div>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors flex items-center gap-1">View <ChevronRight size={12} /></button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Log out of all devices</span>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-red-300 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors">Log out all</button>
                                    </div>
                                </div>
                            )}

                            {/* Account */}
                            {settingsTab === 'account' && (
                                <div className="p-7 space-y-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-dark-50 mb-3">Account</h3>
                                        <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Name</span>
                                        <span className="text-sm text-slate-500 dark:text-dark-400 flex items-center gap-1">{username} <ChevronRight size={14} /></span>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm font-medium text-slate-700 dark:text-dark-200">Email</span>
                                        <span className="text-sm text-slate-500 dark:text-dark-400 flex items-center gap-1">suryahariharan2006@gmail.com <ChevronRight size={14} /></span>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="rounded-xl border border-slate-200 dark:border-dark-700 overflow-hidden">
                                        <div className="p-4 bg-gradient-to-r from-synapse-500/10 to-indigo-500/10 dark:from-synapse-900/30 dark:to-indigo-900/30 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-dark-50">Cortex Free</p>
                                                <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">Your current plan</p>
                                            </div>
                                            <button className="px-4 py-1.5 bg-synapse-500 hover:bg-synapse-600 text-white text-xs font-bold rounded-full transition-colors shadow-sm">Upgrade</button>
                                        </div>
                                        <div className="p-4 space-y-2.5 bg-white dark:bg-dark-900">
                                            <p className="text-xs font-bold text-slate-700 dark:text-dark-200 mb-3">Your plan includes:</p>
                                            {[
                                                'Offline AI document search',
                                                'Up to 50 documents',
                                                'Basic RAG pipeline',
                                                'Peer mesh network access',
                                            ].map(f => (
                                                <div key={f} className="flex items-center gap-2.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-synapse-400 flex-shrink-0" />
                                                    <span className="text-xs text-slate-600 dark:text-dark-300">{f}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-dark-200">Payment</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Manage billing and invoices</p>
                                        </div>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-full transition-colors">Manage</button>
                                    </div>
                                    <div className="h-px bg-slate-100 dark:bg-dark-800" />
                                    <div className="flex items-center justify-between py-1">
                                        <div>
                                            <p className="text-sm font-medium text-red-500">Delete account</p>
                                            <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Permanently remove your account and all data</p>
                                        </div>
                                        <button className="px-4 py-1.5 text-xs font-semibold border border-red-300 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors">Delete</button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Delete all chats confirmation */}
            {showDeleteAllChats && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" style={{ WebkitAppRegion: 'no-drag' }}>
                    <div className="bg-white dark:bg-dark-900 rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-slate-200/60 dark:border-dark-700/60 animate-scale-in">
                        <h3 className="text-base font-bold text-slate-800 dark:text-dark-50 mb-2">Delete all chats?</h3>
                        <p className="text-sm text-slate-500 dark:text-dark-400 mb-6 leading-relaxed">All of your chat history will be permanently deleted and cannot be recovered.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowDeleteAllChats(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition-colors">Cancel</button>
                            <button
                                onClick={() => { showToast('All chats deleted', 'success'); setShowDeleteAllChats(false); }}
                                className="px-5 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors shadow-sm"
                            >Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Command Palette */}
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                onNavigate={(tab) => setActiveTab(tab)}
                onUploadPdf={uploadPdf}
                onToast={showToast}
            />
        </div>
    );
}

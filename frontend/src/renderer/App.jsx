import React, { useState, useEffect, useRef } from 'react';
import HomePage from './components/pages/HomePage';
import Knowledge from './components/pages/Knowledge';
import Workspace from './components/pages/Workspace';
import Campus from './components/pages/Campus';
import Activity from './components/pages/Activity';
import AIEngine from './components/pages/AIEngine';
import ProjectView from './components/pages/ProjectView';
import AuthPortal from './components/pages/AuthPortal';
import Settings from './components/layout/Settings';
import CommandPalette from './components/layout/CommandPalette';
import StreamSelectorModal from './components/layout/StreamSelectorModal';
import WindowControls from './components/layout/WindowControls';
import Toast from './components/layout/Toast';
import { backendStatus } from '../services/api.js';
import { Search, FileText, Globe, Zap, Plus, User, LogOut, PanelLeftClose, PanelLeft, Monitor, MoreHorizontal, Trash2, Edit, Copy, ChevronRight, Folder, FolderOpen, Home, BookOpen, Users, Activity as ActivityIcon, Cpu, X, WifiOff } from 'lucide-react';

const TABS = [
    { id: 'knowledge', label: 'Home', icon: <Home size={18} /> },
    { id: 'home', label: 'Knowledge', icon: <BookOpen size={18} /> },
    { id: 'workspace', label: 'Workspace', icon: <FileText size={18} /> },
    { id: 'campus', label: 'Campus', icon: <Users size={18} /> },
    { id: 'activity', label: 'Activity', icon: <ActivityIcon size={18} /> },
    { id: 'ai-engine', label: 'AI Engine', icon: <Cpu size={18} /> },
];

const MOCK_PROJECTS = [];

const MOCK_INDEPENDENT_CHATS = [];

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
    const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('cortex-auth-session') === 'active');
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('cortex-theme') || 'system';
    });
    const [activeChatId, setActiveChatId] = useState('c1');
    const [username, setUsername] = useState(() => {
        try {
            const savedProfile = localStorage.getItem('cortex-auth-profile');
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                return parsed.name || 'Surya Hariharan';
            }
        } catch {
            // Ignore malformed local profile payloads.
        }
        return 'Surya Hariharan';
    });

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetId: null, type: null, title: '' });
    const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, targetId: null, title: '' });
    const [showDeleteAllChats, setShowDeleteAllChats] = useState(false);

    // ── Zoom bar ─────────────────────────────────────────────────────────────
    const [zoom, setZoom] = useState(100);
    const [showZoomBar, setShowZoomBar] = useState(false);
    const zoomHideTimer = useRef(null);
    const [isOnline, setIsOnline] = useState(true);

    // On mount, sync with the main-process session file so a returning user
    // who arrives directly (session file exists) is immediately authenticated
    // even if their localStorage was somehow cleared.
    useEffect(() => {
        if (isAuthenticated) return; // already authenticated via localStorage
        window.electronAPI?.getSession?.().then((profile) => {
            if (profile) {
                localStorage.setItem('cortex-auth-session', 'active');
                localStorage.setItem('cortex-auth-profile', JSON.stringify(profile));
                if (profile.name) setUsername(profile.name);
                setIsAuthenticated(true);
            }
        }).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {

        const unsub = window.electronAPI?.onZoomChanged?.(pct => {
            setZoom(pct);
            setShowZoomBar(true);
            clearTimeout(zoomHideTimer.current);
            zoomHideTimer.current = setTimeout(() => setShowZoomBar(false), 2500);
        });
        return () => {
            unsub?.();
            clearTimeout(zoomHideTimer.current);
        };
    }, []);

    function zoomIn() { window.electronAPI?.zoomIn?.(); }
    function zoomOut() { window.electronAPI?.zoomOut?.(); }
    function zoomReset() { window.electronAPI?.zoomReset?.(); }

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
                console.warn('[App] Stats unavailable (offline?):', err.message);
            });
        } else {
            console.error('[App] window.electronAPI is undefined!');
        }

        // Subscribe to backend status changes
        const unsub = backendStatus.subscribe(v => setIsOnline(v));
        // Initial check + periodic health poll (every 30s)
        backendStatus.check().then(v => setIsOnline(v));
        const healthPoll = setInterval(() => backendStatus.check(), 30000);
        return () => { unsub(); clearInterval(healthPoll); };
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
        if (!isOnline) {
            showToast('Upload requires the backend to be running.', 'error');
            return;
        }
        if (window.electronAPI) {
            try {
                const result = await window.electronAPI.uploadPdf();
                if (result && result.success) {
                    showToast(`Indexed "${result.title}" (${result.chunks} chunks)`);
                    const newStats = await window.electronAPI.getStats();
                    setStats(newStats);
                } else if (result && result.error) {
                    showToast(result.error, 'error');
                }
            } catch {
                showToast('Upload failed. Backend may be offline.', 'error');
            }
        }
    };

    const handleAuthSuccess = (profile) => {
        if (profile?.name) {
            setUsername(profile.name);
        }
        localStorage.setItem('cortex-auth-session', 'active');
        // Persist session to the main-process file so the landing page is
        // skipped on the next app launch.
        window.electronAPI?.saveSession?.(profile ?? {});
        setIsAuthenticated(true);
        setTimeout(() => showToast('Login successful!', 'success'), 100);
    };

    const handleLogout = () => {
        localStorage.removeItem('cortex-auth-session');
        localStorage.removeItem('cortex-auth-profile');
        // Tell main process to delete the session file and reload landing page.
        window.electronAPI?.logout?.();
    };

    if (!isAuthenticated) {
        return <AuthPortal onAuthSuccess={handleAuthSuccess} />;
    }

    return (
        <div className="h-screen flex flex-col bg-white dark:bg-dark-950 text-dark-800 dark:text-dark-100 overflow-hidden font-sans pt-0">
            {/* Offline Banner */}
            {!isOnline && (
                <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/90 dark:bg-amber-600/90 text-white text-xs font-semibold tracking-wide flex-shrink-0 z-[9999]" style={{ WebkitAppRegion: 'no-drag' }}>
                    <WifiOff size={13} />
                    <span>Offline mode — some features may be limited</span>
                </div>
            )}
            <div className="flex flex-1 overflow-hidden">
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
                                                    onClick={() => { setActiveProjectId(ws.id); setActiveTab('project'); setWsExpanded(prev => ({ ...prev, [ws.id]: true })); }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: ws.id, type: 'project', title: ws.title });
                                                    }}
                                                    className="sidebar-nav-item text-slate-600 dark:text-dark-400 group"
                                                >
                                                    <div className="sidebar-accent-container">
                                                        <ChevronRight size={14} className={`sidebar-chevron ${wsExpanded[ws.id] ? 'sidebar-chevron-expanded' : ''}`} />
                                                    </div>
                                                    <div className="sidebar-icon-container">
                                                        {wsExpanded[ws.id] ? <FolderOpen size={18} className="text-synapse-500" /> : <Folder size={18} className="text-slate-400 dark:text-dark-500" />}
                                                    </div>
                                                    <span className={`sidebar-label font-bold transition-colors uppercase text-[11px] tracking-wide ${activeTab === 'project' && activeProjectId === ws.id
                                                        ? 'text-synapse-600 dark:text-synapse-400'
                                                        : 'text-slate-500 dark:text-dark-400 group-hover:text-slate-800 dark:group-hover:text-dark-100'
                                                        }`}>
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
                    {/* Drag strip across top of main area */}
                    <div className="h-8 w-full absolute top-0 left-0 bg-transparent z-50 pointer-events-none" style={{ WebkitAppRegion: 'drag' }} />

                    <main className="flex-1 overflow-hidden h-full" style={{ WebkitAppRegion: 'no-drag' }}>
                        {activeTab === 'home' && <HomePage onTabChange={setActiveTab} onUploadPdf={uploadPdf} />}
                        {activeTab === 'knowledge' && <Knowledge onToast={showToast} onUploadPdf={uploadPdf} userStream={userStream} />}
                        {activeTab === 'workspace' && <Workspace onToast={showToast} />}
                        {activeTab === 'campus' && <Campus />}
                        {activeTab === 'activity' && <Activity />}
                        {activeTab === 'ai-engine' && <AIEngine />}
                        {activeTab === 'project' && (() => {
                            const proj = projects.find(p => p.id === activeProjectId);
                            return proj ? (
                                <ProjectView
                                    project={proj}
                                    onToast={showToast}
                                    onNewChat={(projectId, text) => {
                                        showToast(`New chat started in ${proj.title}`, 'success');
                                    }}
                                />
                            ) : null;
                        })()}
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

                {/* ── Window Controls (fixed top-right) ──────────────────────── */}
                <div className="fixed top-0 right-0 z-[9999]">
                    <WindowControls />
                </div>

                {/* ── Settings Modal ──────────────────────────────── */}
                <Settings
                    open={showProfileModal}
                    onClose={() => setShowProfileModal(false)}
                    theme={theme}
                    setTheme={setTheme}
                    username={username}
                    setUsername={setUsername}
                    userStream={userStream}
                    setShowStreamSelector={setShowStreamSelector}
                    perfProvider={perfProvider}
                    setPerfProvider={setPerfProvider}
                    onToast={showToast}
                    onLogout={handleLogout}
                />
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

                {/* ── Zoom Bar ──────────────────────────────────────────────────── */}
                <div
                    style={{ WebkitAppRegion: 'no-drag' }}
                    className={`fixed bottom-6 right-6 z-[70] flex items-center gap-1 px-1.5 py-1.5 rounded-2xl
                    bg-white/95 dark:bg-dark-900/95 shadow-xl border border-slate-200/80 dark:border-dark-700/80
                    backdrop-blur-md transition-all duration-300
                    ${showZoomBar ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}
                >
                    <button
                        onClick={zoomOut}
                        title="Zoom out (Ctrl -)"
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-dark-300
                        hover:bg-slate-100 dark:hover:bg-dark-800 hover:text-slate-900 dark:hover:text-dark-50
                        transition-colors text-base font-bold select-none"
                    >−</button>
                    <button
                        onClick={zoomReset}
                        title="Reset zoom (Ctrl 0)"
                        className={`min-w-[3.5rem] h-8 px-2 rounded-xl text-xs font-bold tabular-nums transition-colors select-none
                        ${zoom === 100
                                ? 'text-slate-500 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
                                : 'text-synapse-600 dark:text-synapse-400 hover:bg-synapse-50 dark:hover:bg-synapse-900/30'
                            }`}
                    >{zoom}%</button>
                    <button
                        onClick={zoomIn}
                        title="Zoom in (Ctrl +)"
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-dark-300
                        hover:bg-slate-100 dark:hover:bg-dark-800 hover:text-slate-900 dark:hover:text-dark-50
                        transition-colors text-base font-bold select-none"
                    >+</button>
                </div>

                {/* Command Palette */}
                <CommandPalette
                    isOpen={showCommandPalette}
                    onClose={() => setShowCommandPalette(false)}
                    onNavigate={(tab) => setActiveTab(tab)}
                    onUploadPdf={uploadPdf}
                    onToast={showToast}
                />
            </div>
        </div>
        </div>
    );
}

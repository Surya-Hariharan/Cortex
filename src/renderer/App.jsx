import React, { useState, useEffect, useRef } from 'react';
import SearchTab from './components/SearchTab';
import NetworkTab from './components/NetworkTab';
import PerformanceTab from './components/PerformanceTab';
import NotesTab from './components/NotesTab';
import Toast from './components/Toast';
import ChatSidebar from './components/ChatSidebar';
import ChatPane from './components/ChatPane';

const TABS = [
    { id: 'search', label: 'Search', icon: SearchIcon },
    { id: 'notes', label: 'Notes', icon: NotesIcon },
    { id: 'network', label: 'Network', icon: NetworkIcon },
    { id: 'performance', label: 'Performance', icon: PerfIcon },
];

function SearchIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
    );
}
function NotesIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    );
}
function NetworkIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3" /><circle cx="4" cy="19" r="3" /><circle cx="20" cy="19" r="3" />
            <line x1="12" y1="8" x2="4" y2="16" /><line x1="12" y1="8" x2="20" y2="16" />
        </svg>
    );
}
function PerfIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    );
}
function UploadIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    );
}

export default function App() {
    const [activeTab, setActiveTab] = useState('search');
    const [activeChatId, setActiveChatId] = useState(null);
    const [stats, setStats] = useState({ documents: 0, embeddings: 0, subjects: [] });
    const [toast, setToast] = useState(null);
    const [perfProvider, setPerfProvider] = useState('cpu');
    const perfPollRef = useRef(null);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getStats().then(setStats).catch(() => { });
        }
    }, []);

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

    const renderTab = () => {
        switch (activeTab) {
            case 'search': return <SearchTab onToast={showToast} />;
            case 'notes': return <NotesTab onToast={showToast} />;
            case 'network': return <NetworkTab />;
            case 'performance': return <PerformanceTab />;
            default: return null;
        }
    };

    return (
        <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--surface-app)' }}>

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header
                className="flex items-center justify-between flex-shrink-0"
                style={{
                    height: '64px',
                    minHeight: '64px',
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
                    borderBottom: '1px solid rgba(0,0,0,0.07)',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 3px 12px rgba(0,0,0,0.06)',
                    WebkitAppRegion: 'drag',
                    paddingLeft: 0,
                    paddingRight: 0,
                }}
            >
                {/* ── Left group: Logo + Tab nav + Upload PDF ─────────────────── */}
                <div className="flex items-stretch h-full" style={{ WebkitAppRegion: 'no-drag' }}>

                    {/* Logo */}
                    <div
                        className="flex items-center gap-3"
                        style={{
                            padding: '0 22px 0 28px',
                            borderRight: '1px solid rgba(0,0,0,0.06)',
                            flexShrink: 0,
                        }}
                    >
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                                boxShadow: '0 3px 10px rgba(99,102,241,0.35)',
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                            </svg>
                        </div>
                        <div>
                            <div
                                className="text-[14px] font-bold tracking-tight leading-none"
                                style={{ color: '#1e293b', letterSpacing: '-0.025em' }}
                            >Cortex</div>
                            <div
                                className="text-[9px] font-semibold uppercase tracking-[0.12em] mt-[3px]"
                                style={{ color: '#94a3b8' }}
                            >Offline AI</div>
                        </div>
                    </div>

                    {/* Tab nav — underline style, full navbar height */}
                    <nav className="flex items-stretch h-full" style={{ padding: '0 8px' }}>
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className="relative flex items-center gap-1.5 transition-all duration-150 select-none flex-shrink-0"
                                    style={{
                                        padding: '0 16px',
                                        fontSize: '12.5px',
                                        fontWeight: isActive ? 600 : 500,
                                        color: isActive ? '#6366f1' : '#64748b',
                                        borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                                        borderTop: '2px solid transparent',
                                        background: 'transparent',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        borderRadius: 0,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.color = '#334155';
                                            e.currentTarget.style.background = 'rgba(99,102,241,0.05)';
                                        }
                                        const icon = e.currentTarget.querySelector('svg');
                                        if (icon) icon.style.transform = 'scale(1.08)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.color = '#64748b';
                                            e.currentTarget.style.background = 'transparent';
                                        }
                                        const icon = e.currentTarget.querySelector('svg');
                                        if (icon) icon.style.transform = 'scale(1)';
                                    }}
                                >
                                    <Icon />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Upload PDF — action adjacent to navigation */}
                    <div className="flex items-center" style={{ padding: '0 8px 0 4px', borderLeft: '1px solid rgba(0,0,0,0.06)' }}>
                        <button
                            onClick={async () => {
                                if (window.electronAPI) {
                                    const result = await window.electronAPI.uploadPdf();
                                    if (result?.success) {
                                        showToast(`Indexed "${result.title}" · ${result.chunks} chunks`);
                                        const newStats = await window.electronAPI.getStats();
                                        setStats(newStats);
                                    } else if (result?.error) {
                                        showToast(result.error, 'error');
                                    }
                                }
                            }}
                            className="btn-ghost flex items-center gap-1.5 text-[11.5px]"
                            style={{ padding: '5px 12px' }}
                        >
                            <UploadIcon />
                            Upload PDF
                        </button>
                    </div>
                </div>

                {/* ── Right group: ONNX status + doc count only ────────────────── */}
                {/* paddingRight: 148px = 3 native Win32 controls × ≈46px + buffer    */}
                <div
                    className="flex items-center gap-2"
                    style={{
                        WebkitAppRegion: 'no-drag',
                        paddingLeft: '16px',
                        paddingRight: '148px',
                    }}
                >
                    {/* ONNX provider badge */}
                    <span
                        className="flex items-center gap-1.5 text-[10.5px] font-semibold rounded-full border"
                        style={{
                            padding: '4px 12px',
                            ...(perfProvider === 'dml'
                                ? { background: '#ecfdf5', color: '#065f46', borderColor: '#6ee7b7' }
                                : { background: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' }),
                        }}
                    >
                        <div className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                            style={{ background: perfProvider === 'dml' ? '#10b981' : '#6366f1' }} />
                        {perfProvider === 'dml' ? 'DirectML' : 'ONNX Runtime'}
                    </span>

                    {/* Doc count — shown only when > 0 */}
                    {stats.documents > 0 && (
                        <>
                            <div className="w-px h-3.5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />
                            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#94a3b8' }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
                                <span>{stats.documents} docs</span>
                                <span style={{ color: '#e2e8f0' }}>·</span>
                                <span>{stats.embeddings} vectors</span>
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* ── Body: sidebar + content ──────────────────────────────────────── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <ChatSidebar
                    activeChatId={activeChatId}
                    onSelectChat={setActiveChatId}
                    onNewChat={(chat) => setActiveChatId(chat?.id ?? null)}
                />
                <main
                    key={activeChatId ?? activeTab}
                    className="flex-1 overflow-hidden page-fade"
                    style={{ display: 'flex', minWidth: 0 }}
                >
                    {activeChatId
                        ? <ChatPane chatId={activeChatId} onTitleUpdate={() => { }} />
                        : renderTab()
                    }
                </main>
            </div>

            {/* ── Toast ─────────────────────────────────────────────────────── */}
            {toast && (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}

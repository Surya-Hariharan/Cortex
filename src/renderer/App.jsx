import React, { useState, useEffect, useRef } from 'react';
import SearchTab from './components/SearchTab';
import NetworkTab from './components/NetworkTab';
import PerformanceTab from './components/PerformanceTab';
import NotesTab from './components/NotesTab';
import Toast from './components/Toast';

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
                className="flex items-center justify-between px-4 flex-shrink-0"
                style={{
                    height: '44px',
                    background: 'var(--surface-card)',
                    borderBottom: '1px solid var(--border-subtle)',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.04)',
                    WebkitAppRegion: 'drag',
                }}
            >
                {/* Left: Logo + Tabs */}
                <div className="flex items-center gap-0" style={{ WebkitAppRegion: 'no-drag' }}>
                    {/* Logo mark */}
                    <div className="flex items-center gap-2 pr-4 mr-1" style={{ borderRight: '1px solid var(--border-subtle)' }}>
                        <div
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                            </svg>
                        </div>
                        <span className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Cortex</span>
                    </div>

                    {/* Tab Navigation */}
                    <nav
                        className="flex items-center gap-0.5 mx-2 rounded-lg p-0.5"
                        style={{ background: 'var(--surface-recessed)' }}
                    >
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`tab-btn flex items-center gap-1.5 ${isActive ? 'tab-btn-active' : 'tab-btn-inactive'}`}
                                >
                                    <Icon />
                                    <span className="text-[12.5px]">{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: Badges + Upload */}
                <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: 'no-drag' }}>
                    {/* Provider badge */}
                    <span
                        className="flex items-center gap-1.5 px-2.5 py-[3px] text-[10px] font-semibold rounded-full border"
                        style={
                            perfProvider === 'dml'
                                ? { background: '#ecfdf5', color: '#065f46', borderColor: '#6ee7b7' }
                                : { background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }
                        }
                    >
                        <div
                            className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                            style={{ background: perfProvider === 'dml' ? '#10b981' : 'var(--accent)' }}
                        />
                        {perfProvider === 'dml' ? 'DirectML' : 'ONNX Runtime'}
                    </span>

                    {/* Separator + stats */}
                    {stats.documents > 0 && (
                        <>
                            <div className="w-px h-3.5" style={{ background: 'var(--border-subtle)' }} />
                            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                    {stats.documents} docs
                                </span>
                                <span style={{ color: 'var(--border-medium)' }}>·</span>
                                <span>{stats.embeddings} vectors</span>
                            </div>
                        </>
                    )}

                    {/* Separator + Upload */}
                    <div className="w-px h-3.5" style={{ background: 'var(--border-subtle)' }} />
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
                        className="btn-ghost flex items-center gap-1.5 text-[11.5px] py-1 px-2.5"
                    >
                        <UploadIcon />
                        Upload PDF
                    </button>
                </div>
            </header>

            {/* ── Main Content with page fade ─────────────────────────────────── */}
            <main key={activeTab} className="flex-1 overflow-hidden page-fade">
                {renderTab()}
            </main>

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

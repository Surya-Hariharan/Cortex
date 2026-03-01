import React, { useState, useEffect, useRef } from 'react';
import SearchTab from './components/SearchTab';
import NetworkTab from './components/NetworkTab';
import PerformanceTab from './components/PerformanceTab';
import NotesTab from './components/NotesTab';
import Toast from './components/Toast';

const TABS = [
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'network', label: 'Network', icon: '🌐' },
    { id: 'performance', label: 'Performance', icon: '⚡' },
];

export default function App() {
    const [activeTab, setActiveTab] = useState('search');
    const [stats, setStats] = useState({ documents: 0, embeddings: 0, subjects: [] });
    const [toast, setToast] = useState(null);
    const [perfProvider, setPerfProvider] = useState('cpu');
    const perfPollRef = useRef(null);

    useEffect(() => {
        // Load stats on mount
        if (window.electronAPI) {
            window.electronAPI.getStats().then(setStats).catch(() => { });
        }
    }, []);

    useEffect(() => {
        // Poll provider status for header badge
        const poll = () => {
            if (window.electronAPI) {
                window.electronAPI.getPerfStats()
                    .then((p) => { if (p) setPerfProvider(p.provider); })
                    .catch(() => {});
            }
        };
        poll();
        perfPollRef.current = setInterval(poll, 4000);
        return () => clearInterval(perfPollRef.current);
    }, []);

    const showToast = (message, type = 'success') => {
        setToast({ message, type, id: Date.now() });
    };

    return (
        <div className="h-screen flex flex-col bg-dark-950 overflow-hidden">
            {/* ── Title Bar / Header ───────────────────────────────────────────── */}
            <header
                className="flex items-center justify-between px-5 h-14 border-b border-dark-800/60 bg-dark-950/80 backdrop-blur-xl"
                style={{ WebkitAppRegion: 'drag' }}
            >
                <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-synapse-500 to-synapse-700 flex items-center justify-center shadow-lg">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-wide">
                                <span className="gradient-text">Cortex</span>
                            </h1>
                            <p className="text-[10px] text-dark-500 font-medium tracking-wider uppercase">Offline AI for Students</p>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <nav className="flex items-center gap-1 ml-8 bg-dark-900/50 rounded-xl p-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`tab-btn flex items-center gap-2 ${activeTab === tab.id ? 'tab-btn-active' : 'tab-btn-inactive'
                                    }`}
                            >
                                <span className="text-base">{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Right side: stats */}
                <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
                    {/* Provider badge - always visible */}
                    <span className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                        perfProvider === 'dml'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-synapse-500/10 text-synapse-400 border-synapse-500/20'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${perfProvider === 'dml' ? 'bg-emerald-400 status-online' : 'bg-synapse-400 animate-pulse-slow'}`} />
                        {perfProvider === 'dml' ? '⚡ DirectML' : '⚡ ONNX Runtime'}
                    </span>
                    {stats.documents > 0 && (
                        <div className="flex items-center gap-3 text-xs text-dark-400">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" />
                                <span>{stats.documents} docs</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-synapse-400 shadow-sm" />
                                <span>{stats.embeddings} vectors</span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={async () => {
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
                        }}
                        className="btn-ghost flex items-center gap-1.5"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Upload PDF
                    </button>
                </div>
            </header>

            {/* ── Main Content ─────────────────────────────────────────────────── */}
            <main className="flex-1 overflow-hidden">
                {activeTab === 'search' && <SearchTab onToast={showToast} />}
                {activeTab === 'notes' && <NotesTab onToast={showToast} />}
                {activeTab === 'network' && <NetworkTab />}
                {activeTab === 'performance' && <PerformanceTab />}
            </main>

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
    );
}

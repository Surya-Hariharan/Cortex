import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import SearchTab from './components/SearchTab';
import NetworkTab from './components/NetworkTab';
import PerformanceTab from './components/PerformanceTab';
import NotesTab from './components/NotesTab';
import Toast from './components/Toast';
import ChatSidebar from './components/ChatSidebar';

const TABS = [
    { id: 'search', label: 'Search' },
    { id: 'notes', label: 'Notes' },
    { id: 'network', label: 'Network' },
    { id: 'performance', label: 'Performance' },
];

function UploadIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
    const fileInputRef = useRef(null);

    useEffect(() => {
        api.getStats().then(setStats).catch(() => { });
    }, []);

    useEffect(() => {
        const poll = () => {
            api.getPerfStats()
                .then((p) => { if (p) setPerfProvider(p.embedder?.provider || 'cpu'); })
                .catch(() => { });
        };
        poll();
        perfPollRef.current = setInterval(poll, 4000);
        return () => clearInterval(perfPollRef.current);
    }, []);

    useEffect(() => {
        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.deltaY < 0) {
                    window.electronAPI?.zoomIn();
                } else if (e.deltaY > 0) {
                    window.electronAPI?.zoomOut();
                }
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);

    const showToast = (message, type = 'success') => {
        setToast({ message, type, id: Date.now() });
    };

    const handleDocumentUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        try {
            const result = await api.uploadDocument(file);
            if (result?.success) {
                showToast(`Indexed "${result.title}" · ${result.chunks} chunks`);
                const newStats = await api.getStats();
                setStats(newStats);
            } else if (result?.error) {
                showToast(result.error, 'error');
            }
        } catch (err) {
            showToast('Upload failed: ' + err.message, 'error');
        }
    };

    const handleChatSelect = (chatId) => {
        setActiveChatId(chatId);
        if (activeTab !== 'search') setActiveTab('search');
    };

    const renderTab = () => {
        switch (activeTab) {
            case 'search': return <SearchTab onToast={showToast} activeChatId={activeChatId} setActiveChatId={setActiveChatId} />;
            case 'notes': return <NotesTab onToast={showToast} />;
            case 'network': return <NetworkTab />;
            case 'performance': return <PerformanceTab />;
            default: return null;
        }
    };

    return (
        <div className="h-screen flex bg-[var(--surface-app)] text-[var(--text-primary)] overflow-hidden font-sans">

            {/* ── Global Left Sidebar (Chat Projects) ────────────────────────────────────────────────── */}
            <ChatSidebar
                activeChatId={activeChatId}
                onSelectChat={handleChatSelect}
                onNewChat={(chat) => handleChatSelect(chat?.id ?? null)}
            />

            {/* ── Main Content Area ──────────────────────────────────────────────────── */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[var(--surface-app)]">

                {/* ── Top Navbar ──────────────────────────────────────────────────────── */}
                <header className="h-[60px] flex items-center justify-between px-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-app)' }}>

                    {/* Navigation Tabs */}
                    <nav className="flex items-center gap-1.5">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className="px-3 py-1.5 text-[14px] font-medium rounded-lg transition-colors duration-150"
                                    style={{
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        background: isActive ? 'var(--surface-recessed)' : 'transparent',
                                    }}
                                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; } }}
                                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; } }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Actions and Status */}
                    <div className="flex items-center gap-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.png,.jpg,.jpeg"
                            onChange={handleDocumentUpload}
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors border shadow-sm"
                            style={{
                                color: 'var(--text-primary)',
                                background: 'white',
                                borderColor: 'var(--border-subtle)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-recessed)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                            <UploadIcon />
                            Upload
                        </button>

                        <div className="w-px h-6 bg-[var(--border-subtle)]" />

                        {/* Status Pill */}
                        <div className="flex items-center gap-2 px-2.5 py-1 text-[12px] font-medium rounded-full cursor-help transition-colors"
                             style={{ background: 'var(--surface-recessed)', color: 'var(--text-secondary)' }}
                             title={perfProvider === 'dml' ? 'DirectML Active (GPU)' : 'ONNX Engine CPU'}
                        >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: perfProvider === 'dml' ? '#10B981' : 'var(--text-primary)' }} />
                            Offline
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative">
                    {renderTab()}
                </div>
            </main>

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

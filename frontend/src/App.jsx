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
                <header style={{
                    height: '56px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '0 24px',
                    borderBottom: '1px solid #E5E7EB', flexShrink: 0,
                    background: '#FFFFFF',
                }}>

                    {/* Navigation Tabs */}
                    <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '13.5px',
                                        fontWeight: isActive ? 600 : 500,
                                        borderRadius: '8px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: isActive ? '#111827' : '#6B7280',
                                        background: isActive ? '#F0F0F0' : 'transparent',
                                        transition: 'background 150ms ease, color 150ms ease',
                                    }}
                                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#374151'; } }}
                                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280'; } }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Actions Right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.png,.jpg,.jpeg"
                            onChange={handleDocumentUpload}
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '7px',
                                padding: '6px 12px', fontSize: '13px', fontWeight: 500,
                                borderRadius: '8px', cursor: 'pointer',
                                color: '#374151', background: 'white',
                                border: '1px solid #E5E7EB',
                                transition: 'background 150ms ease, border-color 150ms ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                        >
                            <UploadIcon />
                            Upload
                        </button>

                        <div style={{ width: '1px', height: '20px', background: '#E5E7EB' }} />

                        {/* Status pill */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '5px 10px', borderRadius: '20px',
                            background: '#F3F4F6', fontSize: '12px', fontWeight: 500,
                            color: '#6B7280', cursor: 'default', userSelect: 'none',
                        }}
                            title={perfProvider === 'dml' ? 'DirectML GPU active' : 'ONNX CPU mode'}
                        >
                            <span style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: perfProvider === 'dml' ? '#10B981' : '#111827',
                                display: 'inline-block',
                            }} />
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

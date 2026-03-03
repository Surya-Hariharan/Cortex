import React, { useState, useEffect, useRef } from 'react';
import api from './api';
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
        <div className="h-screen flex bg-[#FFFFFF] text-[#111827] overflow-hidden font-sans">
            {/* ── Global Left Sidebar ────────────────────────────────────────────────── */}
            <aside
                className="w-[260px] flex-shrink-0 flex flex-col border-r border-[#E5E7EB]"
                style={{ background: '#F9F9F9' }}
            >
                {/* Logo & Upload Area */}
                <div className="p-4 flex flex-col gap-4 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-3 px-2">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#111827] text-white"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-[15px] font-bold tracking-tight leading-none text-[#111827]">Cortex</div>
                            <div className="text-[10px] font-semibold uppercase tracking-widest mt-1 text-[#6B7280]">Offline AI</div>
                        </div>
                    </div>

                    {/* Quick Action: Upload */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.png,.jpg,.jpeg"
                        onChange={handleDocumentUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[14px] font-medium rounded-lg text-[#111827] bg-white border border-[#E5E7EB] hover:bg-[#F4F4F5] transition-colors"
                    >
                        <UploadIcon />
                        Upload Document
                    </button>

                    {/* Tiny stats */}
                    {stats.documents > 0 && (
                        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#6B7280]">
                            <span>{stats.documents} docs</span>
                            <span>·</span>
                            <span>{stats.embeddings} vectors</span>
                        </div>
                    )}
                </div>

                {/* Navigation Tabs */}
                <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] px-3 mb-2 mt-2">
                        Menu
                    </div>
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-150 ${
                                    isActive
                                        ? 'bg-[#E5E7EB] text-[#111827]'
                                        : 'text-[#374151] hover:bg-[#F4F4F5]'
                                }`}
                            >
                                <Icon />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer status */}
                <div className="p-4 border-t border-[#E5E7EB] flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                        <span className="text-[12px] font-medium text-[#374151]">
                            {perfProvider === 'dml' ? 'DirectML Active' : 'ONNX Engine'}
                        </span>
                    </div>
                </div>
            </aside>

            {/* ── Main Content Area ──────────────────────────────────────────────────── */}
            <main className="flex-1 overflow-hidden relative page-fade">
                {renderTab()}
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

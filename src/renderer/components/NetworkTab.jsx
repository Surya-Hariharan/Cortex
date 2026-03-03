import React, { useState, useEffect, useMemo } from 'react';

const MOCK_SHARED_DOCS = [
    { id: 1, title: 'Quantum Entanglement Notes.pdf', from: "Arjun's Laptop", time: '3m ago', size: '2.4 MB', type: 'pdf', encrypted: true },
    { id: 2, title: 'BST Implementation.cpp', from: 'Study Group Hub', time: '8m ago', size: '12 KB', type: 'code', encrypted: true },
    { id: 3, title: 'Organic Chem Lab.docx', from: "Priya's Desktop", time: '15m ago', size: '1.1 MB', type: 'doc', encrypted: true },
];

const FILE_TYPE_CONFIG = {
    pdf: { icon: '📄', color: 'bg-red-500', label: 'PDF' },
    code: { icon: '💻', color: 'bg-synapse-500', label: 'CODE' },
    doc: { icon: '📝', color: 'bg-blue-500', label: 'DOC' },
};

export default function NetworkTab() {
    const [peers, setPeers] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // list | graph
    const [isAutoDiscovery, setIsAutoDiscovery] = useState(true);
    const [recentDocs, setRecentDocs] = useState(MOCK_SHARED_DOCS);
    const [simulatedEvent, setSimulatedEvent] = useState(null);

    // Poll peers and Simulation Logic
    useEffect(() => {
        const fetchPeers = async () => {
            if (window.electronAPI && isAutoDiscovery) {
                try {
                    const res = await window.electronAPI.getPeers();
                    if (res?.peers) {
                        // Ensure 'You' is always present for visualization
                        const updatedPeers = [
                            { id: 'me', name: 'This Device (You)', status: 'online', isMe: true, ip: '127.0.0.1', docs: 'Local' },
                            ...res.peers.filter(p => p.id !== 'me')
                        ];
                        setPeers(updatedPeers);
                    }
                } catch (_) { }
            }
        };

        fetchPeers();
        const interval = setInterval(fetchPeers, 3000);
        return () => clearInterval(interval);
    }, [isAutoDiscovery]);

    // Real-time Simulation: Randomly "receive" a file or change peer status
    useEffect(() => {
        const timer = setInterval(() => {
            if (Math.random() > 0.7) {
                const eventType = Math.random() > 0.5 ? 'new_file' : 'status_change';
                if (eventType === 'new_file') {
                    const newDoc = {
                        id: Date.now(),
                        title: `Shared_Update_${Math.floor(Math.random() * 100)}.txt`,
                        from: peers[Math.floor(Math.random() * peers.length)]?.name || 'Unknown Peer',
                        time: 'Just now',
                        size: '45 KB',
                        type: 'doc',
                        encrypted: true
                    };
                    setRecentDocs(prev => [newDoc, ...prev.slice(0, 4)]);
                    setSimulatedEvent({ type: 'pulse', peerId: 'me' });
                }
            }
        }, 8000);
        return () => clearInterval(timer);
    }, [peers]);

    const onlineCount = peers.filter(p => p.status === 'online' && !p.isMe).length;
    const statusColor = onlineCount > 0 ? 'bg-emerald-500' : (isAutoDiscovery ? 'bg-amber-500' : 'bg-slate-400');
    const statusLabel = onlineCount > 0 ? `${onlineCount} Online` : (isAutoDiscovery ? 'Searching...' : 'Mesh Off');

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 overflow-hidden select-none">
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-dark-100 dark:border-dark-900 bg-white/50 dark:bg-dark-950/50 backdrop-blur-md">
                <div className="space-y-0.5">
                    <h1 className="text-xl font-black tracking-tight text-dark-800 dark:text-dark-50">Mesh Network</h1>
                    <p className="text-[11px] text-dark-400 dark:text-dark-500 font-bold uppercase tracking-widest">Secure local peer-to-peer sharing</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-800">
                        <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]`} />
                        <span className="text-[11px] font-black text-dark-700 dark:text-dark-200 uppercase tracking-tighter">{statusLabel}</span>
                    </div>
                    <button className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black shadow-lg shadow-synapse-500/20 active:scale-95 transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                        Share File
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">

                {/* ── Left Panel: Live Status ───────────────────────────── */}
                <div className="w-80 border-r border-dark-100 dark:border-dark-900 flex flex-col bg-dark-50/30 dark:bg-dark-900/20">
                    <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-widest">Live Status</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-dark-400">Discovery</span>
                                <button
                                    onClick={() => setIsAutoDiscovery(!isAutoDiscovery)}
                                    className={`w-8 h-4 rounded-full relative transition-colors ${isAutoDiscovery ? 'bg-synapse-500' : 'bg-dark-300 dark:bg-dark-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isAutoDiscovery ? 'left-4.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>

                        {/* This Device */}
                        <div className="p-4 bg-white dark:bg-dark-900 border border-synapse-200 dark:border-synapse-800 shadow-sm rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                            </div>
                            <h3 className="text-xs font-black text-dark-800 dark:text-dark-50 mb-1">This Device (You)</h3>
                            <p className="text-[10px] text-synapse-600 dark:text-synapse-400 font-bold tracking-tight">127.0.0.1 • Localhost</p>
                            <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-dark-400">
                                <span>Signal Strength</span>
                                <span className="text-emerald-500">100%</span>
                            </div>
                            <div className="mt-1 h-1 bg-dark-100 dark:bg-dark-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-full" />
                            </div>
                        </div>

                        <div className="pt-2 px-1">
                            <span className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-widest">Nearby Devices</span>
                        </div>

                        {/* Peer List */}
                        <div className="space-y-2">
                            {peers.filter(p => !p.isMe).length === 0 ? (
                                <div className="py-8 text-center space-y-3">
                                    <div className="relative w-16 h-16 mx-auto">
                                        <div className="radar-ripple w-16 h-16 top-0 left-0" />
                                        <div className="radar-ripple w-16 h-16 top-0 left-0" style={{ animationDelay: '2s' }} />
                                        <div className="absolute inset-0 flex items-center justify-center text-2xl">📡</div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-dark-700 dark:text-dark-200">Your mesh is quiet.</p>
                                        <p className="text-[10px] text-dark-400 dark:text-dark-500 px-4">Searching for peers on local network...</p>
                                    </div>
                                </div>
                            ) : (
                                peers.filter(p => !p.isMe).map((peer, idx) => (
                                    <div key={peer.id} className="p-3 bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-xl flex items-center gap-3 animate-slide-up hover:border-synapse-300 dark:hover:border-synapse-800 transition-all cursor-pointer group">
                                        <div className="w-10 h-10 rounded-lg bg-dark-50 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 flex items-center justify-center relative">
                                            <span className="text-lg opacity-80">{peer.name.includes('Lab') ? '🖥️' : '💻'}</span>
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-white dark:bg-dark-900 rounded-full flex items-center justify-center">
                                                <div className={`w-2 h-2 rounded-full ${peer.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-dark-800 dark:text-dark-50 truncate">{peer.name}</span>
                                                <span className="text-[9px] font-bold text-dark-400">12ms</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-[9px] font-bold text-dark-400 dark:text-dark-500">
                                                <span className="truncate">{peer.ip}</span>
                                                <span>•</span>
                                                <span>{peer.docs} items</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Bottom Security Strip */}
                    <div className="p-4 bg-white/80 dark:bg-dark-950/80 border-t border-dark-100 dark:border-dark-900 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-[9px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-widest">
                            <div className="flex items-center gap-1.5">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                E2E Encrypted
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-synapse-500" />
                                UDP Discovery
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right Panel: Feed / Graph ──────────────────────────── */}
                <div className="flex-1 flex flex-col bg-white dark:bg-dark-950">
                    {/* View Toggle */}
                    <div className="p-4 flex items-center justify-end">
                        <div className="segmented-control w-fit scale-90">
                            {[
                                { id: 'list', label: 'Activity Feed', icon: '📝' },
                                { id: 'graph', label: 'Graph View', icon: '🕸️' },
                            ].map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => setViewMode(v.id)}
                                    className={`segmented-item ${viewMode === v.id ? 'segmented-item-active' : 'segmented-item-inactive'}`}
                                >
                                    <span className="text-xs">{v.icon}</span>
                                    <span className="text-[11px] font-bold">{v.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 relative overflow-hidden">
                        {viewMode === 'list' ? (
                            <div className="h-full overflow-y-auto px-8 pb-12 space-y-3">
                                <span className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-widest pl-1 block mb-2">Recent Shared Documents</span>
                                {recentDocs.map((doc, idx) => (
                                    <div key={doc.id} className="group flex items-center gap-4 bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-synapse-300 dark:hover:border-synapse-800 transition-all duration-300 animate-slide-up relative overflow-hidden">
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${FILE_TYPE_CONFIG[doc.type]?.color || 'bg-synapse-500'}`} />

                                        <div className="w-12 h-12 rounded-xl bg-dark-50 dark:bg-dark-800 flex items-center justify-center text-2xl relative shadow-inner">
                                            {FILE_TYPE_CONFIG[doc.type]?.icon || '📄'}
                                            {doc.encrypted && (
                                                <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white dark:border-dark-900 shadow-sm" title="End-to-end encrypted">
                                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-black text-dark-800 dark:text-dark-50 truncate">{doc.title}</h3>
                                                <span className="px-2 py-0.5 text-[9px] font-black bg-dark-100 dark:bg-dark-800 text-dark-500 dark:text-dark-400 rounded-md tracking-wider">RECEIVED</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[11px] font-bold text-dark-400 dark:text-dark-500">
                                                <div className="flex items-center gap-1.5 text-synapse-600 dark:text-synapse-400">
                                                    <div className="w-4 h-4 rounded-full bg-synapse-100 dark:bg-synapse-900/30 flex items-center justify-center text-[8px]">👤</div>
                                                    {doc.from}
                                                </div>
                                                <span>•</span>
                                                <span>{doc.size}</span>
                                                <span>•</span>
                                                <span>{doc.time}</span>
                                            </div>
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                            <button className="p-2.5 bg-synapse-50 dark:bg-synapse-900/20 text-synapse-600 dark:text-synapse-400 rounded-xl hover:bg-synapse-100 dark:hover:bg-synapse-800 transition-colors shadow-sm">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                            </button>
                                            <button className="p-2.5 bg-dark-800 text-white rounded-xl hover:bg-black transition-colors shadow-lg">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Graph Visualization (Simulation) */
                            <div className="h-full bg-dark-50 dark:bg-dark-950 relative flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)]" />

                                {/* Center Node: You */}
                                <div className={`z-10 w-24 h-24 rounded-full bg-white dark:bg-dark-900 border-4 border-synapse-500 shadow-2xl flex flex-col items-center justify-center relative ${simulatedEvent?.type === 'pulse' ? 'pulse-glow' : ''}`}>
                                    <span className="text-3xl">🏠</span>
                                    <span className="text-[10px] font-black text-dark-800 dark:text-dark-50 mt-1">YOU</span>
                                    {simulatedEvent?.type === 'pulse' && <div className="radar-ripple w-24 h-24 top-0 left-0 border-synapse-500" />}
                                </div>

                                {/* Surrounding Nodes */}
                                {peers.filter(p => !p.isMe).map((peer, i) => {
                                    const angle = (i * (360 / Math.max(peers.length - 1, 1))) * (Math.PI / 180);
                                    const radius = 180;
                                    const x = Math.cos(angle) * radius;
                                    const y = Math.sin(angle) * radius;

                                    return (
                                        <React.Fragment key={peer.id}>
                                            {/* Line to Center */}
                                            <div
                                                className="network-line h-[1px]"
                                                style={{
                                                    width: `${radius}px`,
                                                    left: '50%',
                                                    top: '50%',
                                                    transform: `rotate(${angle}rad)`
                                                }}
                                            />

                                            {/* Peer Node */}
                                            <div
                                                className="absolute network-node w-16 h-16 rounded-2xl bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 shadow-xl flex flex-col items-center justify-center p-2"
                                                style={{
                                                    transform: `translate(${x}px, ${y}px)`,
                                                    transitionDelay: `${i * 100}ms`
                                                }}
                                            >
                                                <span className="text-xl">{peer.name.includes('Lab') ? '🖥️' : '💻'}</span>
                                                <span className="text-[8px] font-black text-dark-500 dark:text-dark-400 mt-1 text-center truncate w-full">{peer.name.toUpperCase()}</span>

                                                {/* Data Pulse Simulation */}
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-dark-900 shadow-sm animate-bounce" style={{ animationDelay: `${i * 1.5}s` }} />
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-dark-400 dark:text-dark-500 bg-white/50 dark:bg-dark-900/50 px-4 py-2 rounded-full border border-dark-200 dark:border-dark-800 backdrop-blur-md">
                                    SPATIAL INTELLIGENCE ACTIVE • NODE STATUS: STABLE
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

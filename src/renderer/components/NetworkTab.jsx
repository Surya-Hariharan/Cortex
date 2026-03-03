import React, { useState, useEffect } from 'react';

const MOCK_SHARED_DOCS = [
    { title: 'Quantum Entanglement Notes', from: "Arjun's Laptop", time: '3m ago', subject: 'Quantum Mechanics' },
    { title: 'BST Implementation Guide', from: 'Study Group Hub', time: '8m ago', subject: 'Data Structures' },
    { title: 'Organic Chemistry Lab Report', from: "Priya's Desktop", time: '15m ago', subject: 'Organic Chemistry' },
    { title: 'Network Protocols Summary', from: 'Lab PC - Room 204', time: '22m ago', subject: 'Computer Networks' },
    { title: 'Statistical Inference Cheatsheet', from: 'Study Group Hub', time: '1h ago', subject: 'Probability & Statistics' },
];

export default function NetworkTab() {
    const [peers, setPeers] = useState([]);
    const [selectedPeer, setSelectedPeer] = useState(null);

    // Poll peers from real discovery service
    useEffect(() => {
        const fetchPeers = async () => {
            if (window.electronAPI) {
                try {
                    const res = await window.electronAPI.getPeers();
                    if (res?.peers) setPeers(res.peers);
                } catch (_) { }
            }
        };
        fetchPeers();
        const interval = setInterval(fetchPeers, 3000);
        return () => clearInterval(interval);
    }, []);

    const onlinePeers = peers.filter((p) => p.status === 'online').length;

    return (
        <div className="h-full flex text-slate-800 bg-slate-50">
            {/* ── Left: Peer List ─────────────────────────────────────────────── */}
            <div className="w-80 border-r border-slate-200 flex flex-col bg-white/50">
                {/* Header */}
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-slate-800">Mesh Network</h2>
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200 shadow-sm">
                            <div className="status-dot status-online w-1.5 h-1.5" />
                            {onlinePeers} online
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">Nearby devices on your local network</p>
                </div>

                {/* Peer list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {peers.map((peer, idx) => (
                        <button
                            key={peer.id}
                            onClick={() => setSelectedPeer(selectedPeer?.id === peer.id ? null : peer)}
                            className={`w-full text-left p-3 rounded-lg transition-all duration-200 animate-slide-up stagger-${Math.min(idx + 1, 5)} ${selectedPeer?.id === peer.id
                                ? 'bg-synapse-50 border border-synapse-200 shadow-sm'
                                : 'hover:bg-slate-100 hover:shadow-sm border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sm flex-shrink-0">
                                    {peer.name.includes('Lab') ? '🖥️' : peer.name.includes('Hub') ? '🔗' : peer.name.includes('Library') ? '📚' : '💻'}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800 truncate">{peer.name}</span>
                                        <div className={`status-dot flex-shrink-0 ${peer.status === 'online' ? 'status-online' :
                                            peer.status === 'idle' ? 'status-idle' : 'status-offline'
                                            }`} />
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-500 font-medium">{peer.docs} docs</span>
                                        <span className="text-[10px] text-slate-300">•</span>
                                        <span className="text-[10px] text-slate-500 font-medium">{peer.lastSeen}</span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Network info */}
                <div className="p-3 border-t border-slate-200">
                    <div className="glass-panel-light p-3 text-center border border-slate-200">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                            🔒 End-to-end encrypted · UDP LAN discovery on port 41234
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Right: Detail / Activity Feed ──────────────────────────────── */}
            <div className="flex-1 flex flex-col">
                {selectedPeer ? (
                    /* Peer Detail */
                    <div className="p-6 animate-fade-in flex flex-col items-center">
                        <div className="flex flex-col items-center gap-3 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center text-3xl">
                                {selectedPeer.name.includes('Lab') ? '🖥️' : selectedPeer.name.includes('Hub') ? '🔗' : selectedPeer.name.includes('Library') ? '📚' : '💻'}
                            </div>
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-slate-800 mb-1">{selectedPeer.name}</h2>
                                <div className="flex items-center justify-center gap-2 mt-1">
                                    <div className={`status-dot ${selectedPeer.status === 'online' ? 'status-online' :
                                        selectedPeer.status === 'idle' ? 'status-idle' : 'status-offline'
                                        }`} />
                                    <span className="text-xs text-slate-500 font-medium capitalize">{selectedPeer.status}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-xs text-slate-500 font-medium">{selectedPeer.lastSeen}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-lg mx-auto">
                            {[
                                { label: 'Documents', value: selectedPeer.docs, icon: '📄' },
                                { label: 'OS', value: selectedPeer.os, icon: '💻' },
                                { label: 'IP Address', value: selectedPeer.ip, icon: '🌐' },
                            ].map((stat) => (
                                <div key={stat.label} className="glass-panel-light p-4 text-center border-slate-200">
                                    <div className="text-xl mb-2">{stat.icon}</div>
                                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{stat.label}</div>
                                    <div className="text-base font-bold text-slate-800 mt-1">{stat.value}</div>
                                </div>
                            ))}
                        </div>

                        <button className="btn-primary w-full max-w-xs flex items-center justify-center gap-2 mx-auto">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                            Sync Documents
                        </button>
                    </div>
                ) : (
                    /* Activity Feed */
                    <div className="flex-1 flex flex-col bg-slate-50">
                        <div className="p-4 border-b border-slate-200">
                            <h2 className="text-sm font-bold text-slate-800">Recent Shared Documents</h2>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Documents shared across the mesh network</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {MOCK_SHARED_DOCS.map((doc, idx) => (
                                <div
                                    key={idx}
                                    className={`bg-white border border-slate-200 shadow-sm p-3 rounded-xl flex items-center gap-3 animate-slide-up stagger-${Math.min(idx + 1, 5)}`}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-synapse-50 border border-synapse-100 flex items-center justify-center flex-shrink-0">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-synapse-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-slate-800 truncate">{doc.title}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-slate-500 font-medium">from {doc.from}</span>
                                            <span className="text-[10px] text-slate-300">•</span>
                                            <span className="text-[10px] text-slate-500 font-medium">{doc.time}</span>
                                        </div>
                                    </div>

                                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 flex-shrink-0">
                                        {doc.subject}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

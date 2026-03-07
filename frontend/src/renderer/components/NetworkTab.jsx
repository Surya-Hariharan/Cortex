import React, { useState, useEffect, useMemo } from 'react';
import { Share, Shield, Globe, Cpu, Zap, Activity, Monitor, ChevronRight, MoreHorizontal, FileText, Code, File, Search } from 'lucide-react';

const MOCK_SHARED_DOCS = [];

const FILE_TYPE_CONFIG = {
    pdf: { icon: <FileText size={18} />, color: 'accent-pdf', label: 'PDF' },
    code: { icon: <Code size={18} />, color: 'accent-code', label: 'CODE' },
    doc: { icon: <File size={18} />, color: 'accent-doc', label: 'DOC' },
    default: { icon: <File size={18} />, color: 'accent-default', label: 'FILE' }
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
                        const updatedPeers = [
                            { id: 'me', name: 'This Device (You)', status: 'online', isMe: true, ip: '192.168.1.42', strength: 100 },
                            ...res.peers.filter(p => p.id !== 'me').map(p => ({ ...p, strength: Math.floor(Math.random() * 40) + 60, ip: `192.168.1.${Math.floor(Math.random() * 254)}` }))
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



    const onlineCount = peers.filter(p => p.status === 'online' && !p.isMe).length;
    const statusLabel = onlineCount > 0 ? 'Active Mesh' : (isAutoDiscovery ? 'Searching...' : 'Idle');
    const statusColor = onlineCount > 0 ? 'bg-emerald-500' : (isAutoDiscovery ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-slate-400');

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 select-none">
            {/* ── Hero Header ────────────────────────────────────────── */}
            <div className="w-full border-b border-dark-100 dark:border-dark-900 bg-white/50 dark:bg-dark-950/50 backdrop-blur-md z-20">
                <div className="page-container-safe max-w-[1200px] py-8 flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black tracking-tight text-dark-800 dark:text-dark-50">Mesh Network</h1>
                            <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                Secure P2P
                            </div>
                        </div>
                        <p className="text-xs text-dark-400 dark:text-dark-500 font-medium">Secure local peer-to-peer document sharing</p>
                    </div>

                    <div className="flex items-center gap-4 pr-10">
                        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 shadow-sm">
                            <div className={`w-2 h-2 rounded-full ${statusColor} ${isAutoDiscovery ? 'animate-pulse' : ''}`} />
                            <span className="text-[11px] font-bold text-dark-700 dark:text-dark-200 uppercase tracking-tight">{statusLabel}</span>
                        </div>

                        <button className="flex items-center gap-2.5 px-6 py-2.5 bg-synapse-600 hover:bg-synapse-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-synapse-500/20 active:scale-95 transition-all group relative overflow-hidden">
                            <Share size={18} className="group-hover:translate-y-[-1px] transition-transform" />
                            <span>Share File</span>
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity animate-glow-pulse" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main Content Grid ──────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto page-container-safe max-w-[1240px] px-8 py-10">
                <div className="flex gap-12">

                    {/* Left: Network Control Panel */}
                    <div className="w-[400px] flex-shrink-0 space-y-10">

                        {/* A. This Device Card */}
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-[0.2em] px-1">This Device</span>
                            <div className="p-5 bg-white dark:bg-dark-900 border border-synapse-200 dark:border-synapse-800/50 shadow-sm rounded-2xl relative overflow-hidden group">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-black text-dark-800 dark:text-dark-50">Localhost-Node</h3>
                                            <span className="px-1.5 py-0.5 rounded bg-synapse-100 dark:bg-synapse-900/40 text-[9px] font-black text-synapse-600 dark:text-synapse-400">YOU</span>
                                        </div>
                                        <p className="text-[11px] text-dark-400 dark:text-dark-500 font-mono">192.168.1.42 • Active</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-dark-50 dark:bg-dark-800 flex items-center justify-center text-synapse-500">
                                        <Monitor size={20} />
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-[10px] font-bold">
                                        <span className="text-dark-400">Signal Strength</span>
                                        <span className="text-emerald-500">Stable</span>
                                    </div>
                                    <div className="h-1 bg-dark-100 dark:bg-dark-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-[100%] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* B. Discovery Control */}
                        <div className="p-4 bg-dark-50/50 dark:bg-dark-900/30 border border-dark-100 dark:border-dark-800 rounded-2xl flex items-center justify-between">
                            <div className="space-y-0.5">
                                <span className="text-xs font-black text-dark-700 dark:text-dark-200">Auto Discovery</span>
                                <p className="text-[10px] text-dark-400 font-medium">Detect peers on local network</p>
                            </div>
                            <button
                                onClick={() => setIsAutoDiscovery(!isAutoDiscovery)}
                                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${isAutoDiscovery ? 'bg-synapse-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]' : 'bg-dark-300 dark:bg-dark-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${isAutoDiscovery ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>

                        {/* C. Nearby Devices Radar */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-[0.2em] px-1">Nearby Discovery</span>
                            <div className="aspect-square bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-3xl flex flex-col items-center justify-center p-6 relative overflow-hidden">
                                <div className="radar-container scale-90">
                                    {isAutoDiscovery && <div className="radar-sweep" />}
                                    <div className="radar-ring w-[240px] h-[240px]" />
                                    <div className="radar-ring w-[160px] h-[160px]" />
                                    <div className="radar-ring w-[80px] h-[80px]" />

                                    {isAutoDiscovery && (
                                        <>
                                            <div className="radar-ping w-[120px] h-[120px]" />
                                            <div className="radar-ping w-[120px] h-[120px]" style={{ animationDelay: '1s' }} />
                                        </>
                                    )}

                                    {/* Center: You */}
                                    <div className="z-10 w-16 h-16 rounded-full bg-white dark:bg-dark-900 border-2 border-synapse-500 shadow-xl flex items-center justify-center relative">
                                        <div className={`absolute inset-0 rounded-full border border-synapse-500/30 ${simulatedEvent ? 'animate-ping' : ''}`} />
                                        <Cpu size={24} className="text-synapse-600 dark:text-synapse-400" />
                                    </div>

                                    {/* Orbiting Peers */}
                                    {peers.filter(p => !p.isMe).map((peer, i) => {
                                        const angle = (i * (360 / Math.max(peers.length - 1, 1)) - 60) * (Math.PI / 180);
                                        const radius = 90;
                                        const x = Math.cos(angle) * radius;
                                        const y = Math.sin(angle) * radius;
                                        return (
                                            <div
                                                key={peer.id}
                                                className="absolute z-20 transition-all duration-500 group"
                                                style={{ transform: `translate(${x}px, ${y}px)` }}
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 shadow-lg flex items-center justify-center cursor-pointer hover:border-synapse-500 hover:scale-110 transition-all">
                                                    <span className="text-lg">💻</span>
                                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-dark-800" />
                                                </div>
                                                {/* Tooltip */}
                                                <div className="absolute top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-dark-900 text-white text-[9px] font-black py-1 px-2 rounded tracking-widest pointer-events-none uppercase">
                                                    {peer.name}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {peers.filter(p => !p.isMe).length === 0 && (
                                    <div className="text-center mt-4 space-y-1 relative z-10">
                                        <p className="text-xs font-black text-dark-700 dark:text-dark-300 uppercase">Your mesh is quiet.</p>
                                        <p className="text-[10px] text-dark-400 italic">Searching for peers...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Activity Feed */}
                    <div className="flex-1 space-y-6">

                        {/* Header & Toggle */}
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black text-dark-400 dark:text-dark-500 uppercase tracking-[0.2em]">Network Activity</span>
                            <div className="segmented-control p-1">
                                {[
                                    { id: 'list', label: 'Feed', icon: <Activity size={14} /> },
                                    { id: 'graph', label: 'Topology', icon: <Globe size={14} /> },
                                ].map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => setViewMode(v.id)}
                                        className={`segmented-item px-4 py-1.5 flex items-center gap-2 rounded-lg text-[11px] font-bold transition-all ${viewMode === v.id ? 'bg-white dark:bg-dark-800 text-synapse-600 dark:text-synapse-400 shadow-sm border border-dark-200/50 dark:border-dark-700/50' : 'text-dark-400 hover:text-dark-700'}`}
                                    >
                                        {v.icon}
                                        {v.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {viewMode === 'list' ? (
                            <div className="space-y-4 max-w-[950px]">
                                {recentDocs.map((doc, idx) => (
                                    <div
                                        key={doc.id}
                                        className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-synapse-300/50 dark:hover:border-synapse-800/50 transition-all duration-300 flex items-center gap-5 group relative overflow-hidden animate-slide-up"
                                        style={{ animationDelay: `${idx * 0.1}s` }}
                                    >
                                        {/* Left Accent */}
                                        <div className={`activity-card-accent ${FILE_TYPE_CONFIG[doc.type]?.color || 'accent-default'}`} />

                                        <div className="w-14 h-14 rounded-2xl bg-dark-50 dark:bg-dark-800 flex items-center justify-center text-synapse-600 dark:text-synapse-400 relative shadow-inner flex-shrink-0">
                                            {FILE_TYPE_CONFIG[doc.type]?.icon || <File size={18} />}
                                            {doc.encrypted && (
                                                <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-1 border-4 border-white dark:border-dark-900 shadow-sm">
                                                    <Shield size={10} fill="currentColor" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <h3 className="text-sm font-black text-dark-800 dark:text-dark-50 truncate">{doc.title}</h3>
                                                <div className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase border border-emerald-500/10">
                                                    Received
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-[11px] font-bold text-dark-400 dark:text-dark-500">
                                                <div className="flex items-center gap-1.5 text-synapse-600 dark:text-synapse-400">
                                                    <div className="w-4 h-4 rounded-full bg-synapse-100 dark:bg-synapse-900/30 flex items-center justify-center text-[8px] font-black">
                                                        {doc.from[0]}
                                                    </div>
                                                    {doc.from}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Zap size={12} className="opacity-50" />
                                                    {doc.size}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Activity size={12} className="opacity-50" />
                                                    {doc.time}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            <button className="p-3 bg-dark-50 dark:bg-dark-800 text-dark-600 dark:text-dark-300 rounded-xl hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors">
                                                <Search size={18} />
                                            </button>
                                            <button className="p-3 bg-synapse-600 text-white rounded-xl hover:bg-synapse-700 shadow-lg shadow-synapse-500/20 transition-colors">
                                                <Zap size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Topology View (Enchanced) */
                            <div className="h-[600px] bg-dark-50/50 dark:bg-dark-900/20 border border-dark-100 dark:border-dark-800 rounded-3xl relative flex items-center justify-center overflow-hidden animate-fade-in">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)]" />

                                {/* Center Node */}
                                <div className="z-10 w-28 h-28 rounded-full bg-white dark:bg-dark-900 border-4 border-synapse-500 shadow-[0_0_40px_rgba(99,102,241,0.2)] flex flex-col items-center justify-center relative">
                                    <div className="absolute inset-0 rounded-full animate-pulse border-2 border-synapse-400/20" />
                                    <Activity size={32} className="text-synapse-500 mb-1" />
                                    <span className="text-[10px] font-black text-dark-800 dark:text-dark-50 uppercase tracking-widest">Master</span>
                                </div>

                                {/* Radial Grid */}
                                <div className="absolute w-[440px] h-[440px] border border-dark-200/20 dark:border-dark-800/20 rounded-full" />
                                <div className="absolute w-[300px] h-[300px] border border-dark-200/20 dark:border-dark-800/20 rounded-full" />

                                {peers.filter(p => !p.isMe).map((peer, i) => {
                                    const angle = (i * (360 / Math.max(peers.length - 1, 1))) * (Math.PI / 180);
                                    const radius = 220;
                                    const x = Math.cos(angle) * radius;
                                    const y = Math.sin(angle) * radius;

                                    return (
                                        <React.Fragment key={peer.id}>
                                            <div
                                                className="network-line h-[1px]"
                                                style={{ width: `${radius}px`, left: '50%', top: '50%', transform: `rotate(${angle}rad)` }}
                                            />
                                            <div
                                                className="absolute network-node w-20 h-20 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 rounded-2xl shadow-xl flex flex-col items-center justify-center p-3 animate-slide-up"
                                                style={{ transform: `translate(${x}px, ${y}px)`, transitionDelay: `${i * 150}ms` }}
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-dark-50 dark:bg-dark-800 flex items-center justify-center mb-1 text-synapse-500">
                                                    <Cpu size={20} />
                                                </div>
                                                <span className="text-[8px] font-black text-dark-500 dark:text-dark-400 text-center truncate w-full uppercase">{peer.name}</span>
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-dark-900 shadow-sm animate-bounce" style={{ animationDelay: `${i * 0.8}s` }} />
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                <div className="absolute bottom-8 text-[10px] font-black text-dark-400 dark:text-dark-500 bg-white/50 dark:bg-dark-900/50 px-5 py-2 rounded-full border border-dark-200 dark:border-dark-800 backdrop-blur-md uppercase tracking-[0.2em]">
                                    Spatial Topology System v2.0
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

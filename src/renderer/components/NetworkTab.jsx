import React, { useState, useEffect } from 'react';

const MOCK_SHARED_DOCS = [
    { title: 'Quantum Entanglement Notes', from: "Arjun's Laptop", time: '3m ago', subject: 'Quantum Mechanics', ext: 'PDF' },
    { title: 'BST Implementation Guide', from: 'Study Group Hub', time: '8m ago', subject: 'Data Structures', ext: 'PDF' },
    { title: 'Organic Chemistry Lab Report', from: "Priya's Desktop", time: '15m ago', subject: 'Organic Chemistry', ext: 'PDF' },
    { title: 'Network Protocols Summary', from: 'Lab PC – Room 204', time: '22m ago', subject: 'Computer Networks', ext: 'PDF' },
    { title: 'Statistical Inference Cheatsheet', from: 'Study Group Hub', time: '1h ago', subject: 'Probability & Statistics', ext: 'PDF' },
];

const SUBJECT_COLORS = {
    'Quantum Mechanics': { bg: '#fdf4ff', text: '#86198f', border: '#f0abfc' },
    'Data Structures': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    'Organic Chemistry': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    'Computer Networks': { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
    'Probability & Statistics': { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
};
const DEFAULT_SUBJECT = { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };

function getPeerEmoji(name) {
    if (name.includes('Lab')) return '🖥️';
    if (name.includes('Hub')) return '🔗';
    if (name.includes('Library')) return '📚';
    return '💻';
}

export default function NetworkTab() {
    const [peers, setPeers] = useState([]);
    const [selectedPeer, setSelectedPeer] = useState(null);

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
        <div className="h-full flex" style={{ background: 'var(--surface-app)' }}>

            {/* ── Left: Peer List ──────────────────────────────────────────────── */}
            <div
                className="w-72 flex flex-col flex-shrink-0"
                style={{ borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
            >
                {/* Header */}
                <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Mesh Network</h2>
                        <span
                            className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full border"
                            style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                        >
                            <div className="w-1.5 h-1.5 rounded-full status-online" />
                            {onlinePeers} online
                        </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Nearby devices on your local network
                    </p>
                </div>

                {/* Peer list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {peers.map((peer, idx) => {
                        const isSelected = selectedPeer?.id === peer.id;
                        return (
                            <PeerRow
                                key={peer.id}
                                peer={peer}
                                isSelected={isSelected}
                                delay={`stagger-${Math.min(idx + 1, 5)}`}
                                onClick={() => setSelectedPeer(isSelected ? null : peer)}
                            />
                        );
                    })}
                    {peers.length === 0 && (
                        <div className="text-center py-12 animate-fade-in">
                            <div className="text-3xl mb-2">📡</div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Scanning for peers…</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div
                        className="py-2 px-3 rounded-lg text-center"
                        style={{ background: 'var(--surface-recessed)' }}
                    >
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            🔒 End-to-end encrypted · UDP port 41234
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Right: Detail / Feed ─────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {selectedPeer ? (
                    /* Peer Detail */
                    <div className="p-6 animate-fade-in">
                        {/* Peer hero */}
                        <div className="flex items-center gap-4 mb-6">
                            <div
                                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                                style={{ background: 'var(--surface-recessed)', border: '1px solid var(--border-subtle)' }}
                            >
                                {getPeerEmoji(selectedPeer.name)}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{selectedPeer.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`status-dot ${selectedPeer.status === 'online' ? 'status-online' : selectedPeer.status === 'idle' ? 'status-idle' : 'status-offline'}`} />
                                    <span className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{selectedPeer.status}</span>
                                    <span style={{ color: 'var(--border-medium)' }}>·</span>
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedPeer.lastSeen}</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-3 gap-3 mb-5">
                            {[
                                { label: 'Documents', value: selectedPeer.docs, icon: '📄' },
                                { label: 'OS', value: selectedPeer.os, icon: '💻' },
                                { label: 'IP', value: selectedPeer.ip, icon: '🌐' },
                            ].map((s) => (
                                <div key={s.label} className="card-recessed p-3">
                                    <div className="text-base mb-1">{s.icon}</div>
                                    <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                                    <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        <button className="btn-primary w-full flex items-center justify-center gap-2">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                            Sync Documents
                        </button>
                    </div>
                ) : (
                    /* Activity Feed */
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Recent Shared Documents</h2>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Documents shared across the mesh network</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {MOCK_SHARED_DOCS.map((doc, idx) => {
                                const subjectColor = SUBJECT_COLORS[doc.subject] || DEFAULT_SUBJECT;
                                return (
                                    <SharedDocRow key={idx} doc={doc} subjectColor={subjectColor} delay={`stagger-${Math.min(idx + 1, 5)}`} />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PeerRow({ peer, isSelected, delay, onClick }) {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 rounded-lg transition-all duration-150 animate-slide-up ${delay}`}
            style={{
                background: isSelected ? 'var(--accent-light)' : isHovered ? 'var(--surface-hover)' : 'transparent',
                border: isSelected ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center gap-3">
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: 'var(--surface-recessed)', border: '1px solid var(--border-subtle)' }}
                >
                    {getPeerEmoji(peer.name)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {peer.name}
                        </span>
                        <div className={`status-dot flex-shrink-0 ${peer.status === 'online' ? 'status-online' : peer.status === 'idle' ? 'status-idle' : 'status-offline'}`} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{peer.docs} docs</span>
                        <span style={{ color: 'var(--border-medium)' }}>·</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{peer.lastSeen}</span>
                    </div>
                </div>
            </div>
        </button>
    );
}

function SharedDocRow({ doc, subjectColor, delay }) {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-150 animate-slide-up ${delay}`}
            style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                boxShadow: isHovered
                    ? '0 4px 10px rgba(15,23,42,0.08)'
                    : '0 1px 2px rgba(15,23,42,0.04)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* File icon */}
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--accent)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
            </div>

            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>from {doc.from}</span>
                    <span style={{ color: 'var(--border-medium)' }}>·</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{doc.time}</span>
                </div>
            </div>

            <span
                className="text-[10px] px-2 py-0.5 rounded-md border font-medium flex-shrink-0"
                style={{ background: subjectColor.bg, color: subjectColor.text, borderColor: subjectColor.border }}
            >
                {doc.subject}
            </span>
        </div>
    );
}

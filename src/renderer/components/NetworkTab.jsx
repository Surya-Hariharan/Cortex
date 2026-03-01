import React, { useState, useEffect } from 'react';

const MOCK_DOCS = [
    { title: 'Quantum Entanglement Notes', from: "Arjun's Laptop", time: '3m ago', subject: 'Quantum Mechanics', ext: 'PDF' },
    { title: 'BST Implementation Guide', from: 'Study Group Hub', time: '8m ago', subject: 'Data Structures', ext: 'PDF' },
    { title: 'Organic Chemistry Lab Report', from: "Priya's Desktop", time: '15m ago', subject: 'Organic Chemistry', ext: 'PDF' },
    { title: 'Network Protocols Summary', from: 'Lab PC – Room 204', time: '22m ago', subject: 'Computer Networks', ext: 'PDF' },
    { title: 'Statistical Inference Cheatsheet', from: 'Study Group Hub', time: '1h ago', subject: 'Prob & Statistics', ext: 'PDF' },
];

const SUBJ = {
    'Quantum Mechanics': { bg: '#fdf4ff', text: '#7e22ce', border: '#f0abfc' },
    'Data Structures': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    'Organic Chemistry': { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
    'Computer Networks': { bg: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
    'Prob & Statistics': { bg: '#eef2ff', text: '#3730a3', border: '#c7d2fe' },
};
const DSUBJ = { bg: '#f8fafc', text: '#334155', border: '#e2e8f0' };

function emoji(name) {
    if (name.includes('Lab')) return '🖥️';
    if (name.includes('Hub')) return '🔗';
    if (name.includes('Library')) return '📚';
    return '💻';
}

export default function NetworkTab() {
    const [peers, setPeers] = useState([]);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const get = async () => {
            if (window.electronAPI) {
                try { const r = await window.electronAPI.getPeers(); if (r?.peers) setPeers(r.peers); } catch { }
            }
        };
        get();
        const id = setInterval(get, 3000);
        return () => clearInterval(id);
    }, []);

    const online = peers.filter((p) => p.status === 'online').length;

    return (
        <div className="h-full flex" style={{ background: 'var(--surface-app)' }}>

            {/* ── Left sidebar ─────────────────────────────────────────────────── */}
            <div
                className="w-[268px] flex flex-col flex-shrink-0"
                style={{
                    background: 'var(--surface-sidebar)',
                    borderRight: '1px solid var(--border-subtle)',
                }}
            >
                {/* Sidebar header */}
                <div
                    className="px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
                >
                    <div className="flex items-center justify-between mb-0.5">
                        <h2 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Mesh Network</h2>
                        <span
                            className="flex items-center gap-1 px-2 py-[2px] text-[10px] font-semibold rounded-full border"
                            style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
                        >
                            <div className="w-1.5 h-1.5 rounded-full status-online" />
                            {online} online
                        </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Nearby devices on local network</p>
                </div>

                {/* Peer list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {peers.map((peer, idx) => (
                        <PeerRow
                            key={peer.id}
                            peer={peer}
                            selected={selected?.id === peer.id}
                            delay={`stagger-${Math.min(idx + 1, 5)}`}
                            onClick={() => setSelected(selected?.id === peer.id ? null : peer)}
                        />
                    ))}
                    {peers.length === 0 && (
                        <div className="text-center py-10 animate-fade-in">
                            <div className="text-3xl mb-2">📡</div>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Scanning…</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="py-1.5 px-3 rounded-lg text-center" style={{ background: 'var(--surface-recessed)' }}>
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            🔒 E2E encrypted · UDP port 41234
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Right panel ──────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {selected ? (
                    /* Peer detail */
                    <div className="p-6 animate-fade-in">
                        <div className="flex items-center gap-4 mb-5">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)' }}
                            >
                                {emoji(selected.name)}
                            </div>
                            <div>
                                <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{selected.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`status-dot ${selected.status === 'online' ? 'status-online' : selected.status === 'idle' ? 'status-idle' : 'status-offline'}`} />
                                    <span className="text-[12px] capitalize" style={{ color: 'var(--text-secondary)' }}>{selected.status}</span>
                                    <span style={{ color: 'var(--border-medium)' }}>·</span>
                                    <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{selected.lastSeen}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-5">
                            {[
                                { label: 'Documents', value: selected.docs, icon: '📄' },
                                { label: 'OS', value: selected.os, icon: '💻' },
                                { label: 'IP', value: selected.ip, icon: '🌐' },
                            ].map((s) => (
                                <div key={s.label} className="card-recessed p-3">
                                    <div className="text-sm mb-1">{s.icon}</div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                                    <div className="text-[13px] font-semibold metric-mono" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        <button className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                            Sync Documents
                        </button>
                    </div>
                ) : (
                    /* Activity feed */
                    <div className="flex-1 flex flex-col min-h-0">
                        <div
                            className="px-5 py-3.5"
                            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}
                        >
                            <h2 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Recent Shared Documents</h2>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>From peers on this network</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {MOCK_DOCS.map((doc, idx) => (
                                <DocCard key={idx} doc={doc} colors={SUBJ[doc.subject] || DSUBJ} delay={`stagger-${Math.min(idx + 1, 5)}`} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PeerRow({ peer, selected, delay, onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-2.5 rounded-lg transition-all duration-150 animate-slide-up ${delay}`}
            style={{
                background: selected ? 'var(--accent-light)' : hov ? 'var(--surface-hover)' : 'transparent',
                border: selected ? '1px solid var(--accent-border)' : '1px solid transparent',
            }}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
        >
            <div className="flex items-center gap-2.5">
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
                >
                    {emoji(peer.name)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold truncate" style={{ color: selected ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {peer.name}
                        </span>
                        <div className={`status-dot flex-shrink-0 ${peer.status === 'online' ? 'status-online' : peer.status === 'idle' ? 'status-idle' : 'status-offline'}`} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-[1px]">
                        <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{peer.docs} docs</span>
                        <span style={{ color: 'var(--border-medium)' }}>·</span>
                        <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{peer.lastSeen}</span>
                    </div>
                </div>
            </div>
        </button>
    );
}

function DocCard({ doc, colors, delay }) {
    const [hov, setHov] = useState(false);
    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-150 animate-slide-up ${delay}`}
            style={{
                background: 'var(--surface-card)',
                border: '1px solid',
                borderColor: hov ? 'var(--border-medium)' : 'var(--border-subtle)',
                boxShadow: hov ? 'var(--shadow-lg)' : 'var(--shadow-md)',
            }}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
        >
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--accent)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
            </div>

            <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{doc.title}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>from {doc.from}</span>
                    <span style={{ color: 'var(--border-medium)' }}>·</span>
                    <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{doc.time}</span>
                </div>
            </div>

            <span
                className="text-[10px] px-2 py-[3px] rounded border font-semibold flex-shrink-0"
                style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
            >
                {doc.subject}
            </span>
        </div>
    );
}

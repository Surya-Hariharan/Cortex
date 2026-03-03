import React, { useState, useEffect } from 'react';

const MOCK_DOCS = [
    { title: 'Quantum Entanglement Notes', from: "Arjun's Laptop", time: '3m ago', subject: 'Quantum Mechanics', ext: 'PDF' },
    { title: 'BST Implementation Guide', from: 'Study Group Hub', time: '8m ago', subject: 'Data Structures', ext: 'PDF' },
    { title: 'Organic Chemistry Lab Report', from: "Priya's Desktop", time: '15m ago', subject: 'Organic Chemistry', ext: 'PDF' },
    { title: 'Network Protocols Summary', from: 'Lab PC – Room 204', time: '22m ago', subject: 'Computer Networks', ext: 'PDF' },
    { title: 'Statistical Inference Cheatsheet', from: 'Study Group Hub', time: '1h ago', subject: 'Prob & Statistics', ext: 'PDF' },
];

const SUBJ = {
    'Quantum Mechanics': { bg: 'rgba(126,34,206,0.08)', text: '#7e22ce' },
    'Data Structures': { bg: 'rgba(22,101,52,0.08)', text: '#166534' },
    'Organic Chemistry': { bg: 'rgba(146,64,14,0.08)', text: '#92400e' },
    'Computer Networks': { bg: 'rgba(19,78,74,0.08)', text: '#134e4a' },
    'Prob & Statistics': { bg: 'rgba(55,48,163,0.08)', text: '#3730a3' },
};
const DSUBJ = { bg: 'var(--surface-recessed)', text: 'var(--text-secondary)' };

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
        <div className="h-full flex overflow-hidden" style={{ background: 'var(--surface-app)' }}>

            {/* ── Left sidebar ─────────────────────────────────────────────────── */}
            <div
                className="w-[280px] flex flex-col flex-shrink-0"
                style={{
                    background: 'var(--surface-sidebar)',
                    borderRight: '1px solid var(--border-subtle)',
                }}
            >
                {/* Sidebar header */}
                <div
                    className="h-[60px] px-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                    <div className="flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                        <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Network</h2>
                    </div>
                    <span
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md"
                        style={{ background: 'var(--surface-recessed)', color: 'var(--text-secondary)' }}
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {online} online
                    </span>
                </div>

                {/* Peer list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-[2px]">
                    {peers.length === 0 && (
                        <div className="text-center py-10 px-4 animate-fade-in">
                            <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Scanning network...</p>
                            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Looking for nearby peers</p>
                        </div>
                    )}
                    {peers.map((peer, idx) => (
                        <PeerRow
                            key={peer.id}
                            peer={peer}
                            selected={selected?.id === peer.id}
                            onClick={() => setSelected(selected?.id === peer.id ? null : peer)}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="py-1.5 px-3 rounded-lg text-center">
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            🔒 E2E encrypted · UDP port 41234
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Right panel ──────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-app)]">
                {selected ? (
                    /* Peer detail */
                    <div className="flex-1 overflow-y-auto px-10 py-12 animate-fade-in max-w-3xl mx-auto w-full">
                        <div className="flex items-center gap-5 mb-8">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                                style={{ background: 'var(--surface-recessed)', border: '1px solid var(--border-subtle)' }}
                            >
                                {emoji(selected.name)}
                            </div>
                            <div>
                                <h2 className="text-[24px] font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{selected.name}</h2>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className={`w-2 h-2 rounded-full ${selected.status === 'online' ? 'bg-green-500' : selected.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                                    <span className="text-[13px] capitalize font-medium" style={{ color: 'var(--text-secondary)' }}>{selected.status}</span>
                                    <span style={{ color: 'var(--border-medium)' }}>·</span>
                                    <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Last seen {selected.lastSeen}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {[
                                { label: 'Documents', value: selected.docs, icon: '📄' },
                                { label: 'OS', value: selected.os, icon: '💻' },
                                { label: 'IP', value: selected.ip, icon: '🌐' },
                            ].map((s) => (
                                <div key={s.label} className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
                                    <div className="text-lg mb-2 opacity-80">{s.icon}</div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                                    <div className="text-[14px] font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'ui-monospace, Consolas, monospace' }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium transition-colors" style={{ background: 'var(--text-primary)', color: 'var(--surface-app)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Sync Documents
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Activity feed */
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="px-8 py-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <h2 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>Activity Feed</h2>
                            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Recent documents shared across the mesh network.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                            {MOCK_DOCS.map((doc, idx) => (
                                <DocCard key={idx} doc={doc} colors={SUBJ[doc.subject] || DSUBJ} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PeerRow({ peer, selected, onClick }) {
    return (
        <div
            onClick={onClick}
            className={`px-3 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 transition-colors duration-150`}
            style={{ background: selected ? 'rgba(0,0,0,0.05)' : 'transparent' }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
        >
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
            >
                {emoji(peer.name)}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex justify-between items-start mb-0.5">
                    <span className="text-[13px] font-medium truncate pr-2" style={{ color: 'var(--text-primary)' }}>
                        {peer.name}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5.5px] ${peer.status === 'online' ? 'bg-green-500' : peer.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    <span>{peer.docs} shared</span>
                    <span style={{ color: 'var(--border-medium)' }}>·</span>
                    <span>{peer.lastSeen}</span>
                </div>
            </div>
        </div>
    );
}

function DocCard({ doc, colors }) {
    return (
        <div
            className="flex items-center gap-4 p-4 rounded-xl transition-colors duration-150 group"
            style={{ border: '1px solid var(--border-subtle)', background: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--surface-recessed)' }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-muted)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
            </div>

            <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium truncate mb-0.5" style={{ color: 'var(--text-primary)' }}>{doc.title}</div>
                <div className="flex items-center gap-2 text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
                    <span>{doc.from}</span>
                    <span style={{ color: 'var(--border-medium)' }}>·</span>
                    <span>{doc.time}</span>
                </div>
            </div>

            <span
                className="text-[11px] px-2.5 py-1 rounded-md font-medium flex-shrink-0"
                style={{ background: colors.bg, color: colors.text }}
            >
                {doc.subject}
            </span>
        </div>
    );
}

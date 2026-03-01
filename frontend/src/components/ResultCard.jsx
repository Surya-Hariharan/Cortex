import React, { useState } from 'react';

const SUBJECT_COLORS = {
    'Thermodynamics': { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
    'Data Structures': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    'Linear Algebra': { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
    'Organic Chemistry': { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
    'Machine Learning': { bg: '#ecfeff', text: '#155e75', border: '#a5f3fc' },
    'Quantum Mechanics': { bg: '#fdf4ff', text: '#7e22ce', border: '#f0abfc' },
    'Operating Systems': { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
    'Calculus': { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    'Computer Networks': { bg: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
    'Probability & Statistics': { bg: '#eef2ff', text: '#3730a3', border: '#c7d2fe' },
};
const DEFAULT_COLOR = { bg: '#f8fafc', text: '#334155', border: '#e2e8f0' };

function explain(result) {
    const pct = result.relevancePercent;
    const word = pct >= 85 ? 'highly relevant' : pct >= 65 ? 'semantically similar' : 'partially matching';
    const kw = result.content.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 4).slice(0, 4);
    const pg = Math.ceil((result.chunkIndex + 1) * 0.6) + 1;
    return `Vector matched at ${pct}% cosine similarity — ${word}. Key concepts: "${kw.join('", "')}". Chunk #${result.chunkIndex + 1}, ~page ${pg}.`;
}

function scoreColor(score) {
    if (score >= 0.8) return { text: '#166534', gradient: 'from-emerald-400 to-emerald-500' };
    if (score >= 0.6) return { text: '#3730a3', gradient: 'from-indigo-400 to-indigo-500' };
    if (score >= 0.4) return { text: '#92400e', gradient: 'from-amber-400 to-amber-500' };
    return { text: '#64748b', gradient: 'from-slate-300 to-slate-400' };
}

export default function ResultCard({ result, index, onToast }) {
    const [sharing, setSharing] = useState(false);
    const [shared, setShared] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [hovered, setHovered] = useState(false);

    const colors = SUBJECT_COLORS[result.subject] || DEFAULT_COLOR;
    const sc = scoreColor(result.score);
    const delay = `stagger-${Math.min(index + 1, 5)}`;

    const handleShare = async () => {
        if (sharing || shared) return;
        setSharing(true);
        try {
            if (window.electronAPI) await window.electronAPI.shareToNetwork(result.docId);
            else await new Promise((r) => setTimeout(r, 1400));
            setShared(true);
            onToast('Shared to network successfully!');
            setTimeout(() => setShared(false), 4000);
        } catch {
            onToast('Failed to share', 'error');
        } finally {
            setSharing(false);
        }
    };

    return (
        <div
            className={`animate-slide-up ${delay} transition-all duration-180`}
            style={{
                background: 'var(--surface-card)',
                border: '1px solid',
                borderColor: hovered ? 'var(--border-medium)' : 'var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow-md)',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank */}
                    <div
                        className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold"
                        style={{ background: 'var(--surface-recessed)', color: 'var(--text-muted)' }}
                    >
                        {result.rank}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3
                            className="text-[13.5px] font-semibold truncate mb-0.5"
                            style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
                        >
                            {result.title}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span
                                className="inline-flex items-center px-2 py-[2px] text-[10px] font-semibold rounded border"
                                style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                            >
                                {result.subject}
                            </span>
                            <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                                Chunk {result.chunkIndex + 1}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Score */}
                <div className="flex items-start gap-1.5 flex-shrink-0">
                    <div className="text-right">
                        <div className="text-[17px] font-bold metric-mono leading-none" style={{ color: sc.text }}>
                            {result.relevancePercent}%
                        </div>
                        <div className="w-14 h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--surface-recessed)' }}>
                            <div className={`score-bar ${sc.gradient}`} style={{ width: `${result.relevancePercent}%` }} />
                        </div>
                    </div>
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="mt-0.5 w-5 h-5 flex items-center justify-center rounded transition-colors duration-100"
                        style={{ color: expanded ? 'var(--accent)' : 'var(--text-muted)' }}
                        title="Why this matched"
                    >
                        <svg
                            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <p className="text-[13px] leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                {result.content}
            </p>

            {/* Expanded explanation */}
            {expanded && (
                <div
                    className="mt-3 p-3 rounded-lg animate-slide-down"
                    style={{ background: 'var(--surface-recessed)', border: '1px solid var(--border-subtle)' }}
                >
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Why this matched</span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{explain(result)}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-[10.5px] metric-mono" style={{ color: 'var(--text-muted)' }}>
                    {result.score.toFixed(3)}
                </span>

                <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all duration-150"
                    style={
                        shared
                            ? { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }
                            : sharing
                                ? { background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }
                                : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }
                    }
                    onMouseEnter={(e) => {
                        if (!shared && !sharing) {
                            e.currentTarget.style.background = 'var(--accent-light)';
                            e.currentTarget.style.color = 'var(--accent)';
                            e.currentTarget.style.borderColor = 'var(--accent-border)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!shared && !sharing) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-muted)';
                            e.currentTarget.style.borderColor = 'transparent';
                        }
                    }}
                >
                    {sharing ? (
                        <><div className="w-3 h-3 border-[1.5px] rounded-full animate-spin-slow" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: 'var(--accent)' }} /> Sharing…</>
                    ) : shared ? (
                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Shared!</>
                    ) : (
                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg> Share to Network</>
                    )}
                </button>
            </div>
        </div>
    );
}

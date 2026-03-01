import React, { useState } from 'react';

const SUBJECT_COLORS = {
    'Thermodynamics': { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    'Data Structures': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    'Linear Algebra': { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    'Organic Chemistry': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    'Machine Learning': { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
    'Quantum Mechanics': { bg: '#fdf4ff', text: '#86198f', border: '#f0abfc' },
    'Operating Systems': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    'Calculus': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    'Computer Networks': { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
    'Probability & Statistics': { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
};

const DEFAULT_COLOR = { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };

function generateExplanation(result) {
    const pct = result.relevancePercent;
    const scoreWord = pct >= 85 ? 'highly relevant' : pct >= 65 ? 'semantically similar' : 'partially matching';
    const words = result.content
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 4);
    const pageEst = Math.ceil((result.chunkIndex + 1) * 0.6) + 1;
    return `Query vector matched this passage at ${pct}% cosine similarity — ${scoreWord}. Key semantic concepts: "${words.join('", "')}". Source: chunk #${result.chunkIndex + 1}, approx. page ${pageEst}.`;
}

function getScoreGradient(score) {
    if (score >= 0.8) return 'from-emerald-400 to-emerald-500';
    if (score >= 0.6) return 'from-indigo-400 to-indigo-500';
    if (score >= 0.4) return 'from-amber-400 to-amber-500';
    return 'from-slate-300 to-slate-400';
}

function getScoreTextColor(score) {
    if (score >= 0.8) return '#15803d';
    if (score >= 0.6) return '#4338ca';
    if (score >= 0.4) return '#b45309';
    return '#64748b';
}

export default function ResultCard({ result, index, onToast }) {
    const [sharing, setSharing] = useState(false);
    const [shared, setShared] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const colors = SUBJECT_COLORS[result.subject] || DEFAULT_COLOR;
    const scoreGradient = getScoreGradient(result.score);
    const scoreTextColor = getScoreTextColor(result.score);
    const delay = `stagger-${Math.min(index + 1, 5)}`;

    const handleShare = async () => {
        if (sharing || shared) return;
        setSharing(true);
        try {
            if (window.electronAPI) {
                await window.electronAPI.shareToNetwork(result.docId);
            } else {
                await new Promise((r) => setTimeout(r, 1500));
            }
            setShared(true);
            onToast('Shared to network successfully!');
            setTimeout(() => setShared(false), 4000);
        } catch (err) {
            onToast('Failed to share', 'error');
        } finally {
            setSharing(false);
        }
    };

    return (
        <div
            className={`animate-slide-up ${delay} transition-all duration-200`}
            style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                boxShadow: isHovered
                    ? '0 4px 12px rgba(15,23,42,0.09), 0 2px 4px rgba(15,23,42,0.05)'
                    : '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
                padding: '16px',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank badge */}
                    <div
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: 'var(--surface-recessed)', color: 'var(--text-muted)' }}
                    >
                        {result.rank}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {result.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span
                                className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-md border"
                                style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                            >
                                {result.subject}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                Chunk {result.chunkIndex + 1}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Score + expand */}
                <div className="flex items-start gap-2 flex-shrink-0">
                    <div className="text-right">
                        <div className="text-lg font-bold leading-none" style={{ color: scoreTextColor }}>
                            {result.relevancePercent}%
                        </div>
                        <div className="w-16 h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--surface-recessed)' }}>
                            <div
                                className={`score-bar ${scoreGradient}`}
                                style={{ width: `${result.relevancePercent}%` }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setIsExpanded((v) => !v)}
                        className="mt-1 w-5 h-5 flex items-center justify-center rounded transition-all duration-150"
                        style={{ color: 'var(--text-muted)' }}
                        title="Explain why this matched"
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <svg
                            width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                {result.content}
            </p>

            {/* Expand: why this matched */}
            {isExpanded && (
                <div
                    className="mt-3 p-3 rounded-lg animate-slide-down"
                    style={{ background: 'var(--surface-recessed)', border: '1px solid var(--border-subtle)' }}
                >
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                            Why this matched
                        </span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {generateExplanation(result)}
                    </p>
                </div>
            )}

            {/* Actions */}
            <div
                className="flex items-center justify-between mt-3 pt-2.5"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    Score: {result.score.toFixed(3)}
                </div>

                <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150"
                    style={
                        shared
                            ? { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }
                            : sharing
                                ? { background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.25)' }
                                : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }
                    }
                    onMouseEnter={(e) => {
                        if (!shared && !sharing) {
                            e.currentTarget.style.background = 'var(--accent-light)';
                            e.currentTarget.style.color = 'var(--accent)';
                            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
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
                        <>
                            <div className="w-3 h-3 border-[1.5px] rounded-full animate-spin-slow" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: 'var(--accent)' }} />
                            Sharing…
                        </>
                    ) : shared ? (
                        <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Shared!
                        </>
                    ) : (
                        <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                            Share to Network
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

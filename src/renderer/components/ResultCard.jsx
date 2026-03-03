import React, { useState } from 'react';

const SUBJECT_COLORS = {
    'Thermodynamics': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    'Data Structures': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    'Linear Algebra': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
    'Organic Chemistry': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    'Machine Learning': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
    'Quantum Mechanics': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
    'Operating Systems': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
    'Calculus': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    'Computer Networks': { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
    'Probability & Statistics': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
};

const DEFAULT_COLOR = { bg: 'bg-dark-700/30', text: 'text-dark-300', border: 'border-dark-600/30' };

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
    return `Query vector matched this passage at ${pct}% cosine similarity — ${scoreWord}. Key semantic concepts: “${words.join('”, “')}”. Source: chunk #${result.chunkIndex + 1}, approx. page ${pageEst}.`;
}

function getScoreColor(score) {
    if (score >= 0.8) return 'from-emerald-400 to-emerald-500';
    if (score >= 0.6) return 'from-synapse-400 to-synapse-500';
    if (score >= 0.4) return 'from-amber-400 to-amber-500';
    return 'from-dark-400 to-dark-500';
}

export default function ResultCard({ result, index, onToast }) {
    const [sharing, setSharing] = useState(false);
    const [shared, setShared] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const colors = SUBJECT_COLORS[result.subject] || DEFAULT_COLOR;
    const scoreColor = getScoreColor(result.score);
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
        <div className={`glass-panel p-4 animate-slide-up ${delay} hover:border-dark-600/60 transition-all duration-200 group`}>
            {/* Top row: rank, title, subject, score */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank badge */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-dark-800/80 flex items-center justify-center text-xs font-bold text-dark-400">
                        {result.rank}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-dark-100 truncate">{result.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}>
                                {result.subject}
                            </span>
                            <span className="text-[10px] text-dark-500">Chunk {result.chunkIndex + 1}</span>
                        </div>
                    </div>
                </div>

                {/* Score + expand */}
                <div className="flex items-start gap-2 flex-shrink-0">
                    <div className="text-right">
                        <div className="text-lg font-bold text-dark-200">{result.relevancePercent}%</div>
                        <div className="w-16 h-1.5 bg-dark-800 rounded-full mt-1 overflow-hidden">
                            <div
                                className={`score-bar ${scoreColor}`}
                                style={{ width: `${result.relevancePercent}%` }}
                        />
                        </div>
                    </div>
                    <button
                        onClick={() => setIsExpanded((v) => !v)}
                        className="mt-1.5 w-5 h-5 flex items-center justify-center text-dark-500 hover:text-dark-200 transition-all duration-200"
                        title="Explain why this matched"
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

            {/* Content preview */}
            <p className="text-xs text-dark-400 leading-relaxed mt-2 line-clamp-3">
                {result.content}
            </p>

            {/* Expand: why this matched */}
            {isExpanded && (
                <div className="mt-3 p-3 bg-dark-800/40 rounded-lg border border-dark-700/30 animate-slide-down">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-synapse-400">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-[10px] font-semibold text-synapse-400 uppercase tracking-wider">Why this matched</span>
                    </div>
                    <p className="text-[11px] text-dark-400 leading-relaxed">
                        {generateExplanation(result)}
                    </p>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-dark-800/50">
                <div className="text-[10px] text-dark-600 font-mono">
                    Score: {result.score.toFixed(3)}
                </div>

                <button
                    onClick={handleShare}
                    disabled={sharing}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${shared
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : sharing
                                ? 'bg-synapse-500/10 text-synapse-300 border border-synapse-500/20'
                                : 'text-dark-400 hover:text-synapse-300 hover:bg-synapse-500/10 border border-transparent hover:border-synapse-500/20'
                        }`}
                >
                    {sharing ? (
                        <>
                            <div className="w-3 h-3 border-[1.5px] border-synapse-400/30 border-t-synapse-400 rounded-full animate-spin-slow" />
                            Sharing...
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
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                            Share to Network
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

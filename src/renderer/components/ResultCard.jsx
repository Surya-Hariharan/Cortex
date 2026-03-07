import React, { useState } from 'react';

const SUBJECT_COLORS = {
    'Thermodynamics': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    'Data Structures': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'Linear Algebra': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    'Organic Chemistry': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'Machine Learning': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    'Quantum Mechanics': { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
    'Operating Systems': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'Calculus': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Computer Networks': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    'Probability & Statistics': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

const DEFAULT_COLOR = { bg: 'bg-dark-100 dark:bg-dark-800', text: 'text-dark-600 dark:text-dark-300', border: 'border-dark-200 dark:border-dark-700' };

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
    if (score >= 0.6) return 'from-synapse-500 to-synapse-600';
    if (score >= 0.4) return 'from-amber-400 to-amber-500';
    return 'from-dark-300 to-dark-400';
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
        <div className={`glass-panel dark:bg-dark-900/80 dark:border-dark-700/60 p-4 animate-slide-up ${delay} hover:border-dark-300 dark:hover:border-dark-500 hover:shadow-md transition-all duration-200 group`}>
            {/* Top row: rank, title, subject, score */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank badge */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-dark-100 dark:bg-dark-800 flex items-center justify-center text-xs font-bold text-dark-500 dark:text-dark-400 border border-dark-200 dark:border-dark-700">
                        {result.rank}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-dark-800 dark:text-dark-50 truncate">{result.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}>
                                {result.subject}
                            </span>
                            <span className="text-[10px] text-dark-400 dark:text-dark-500 font-medium">Chunk {result.chunkIndex + 1}</span>
                        </div>
                    </div>
                </div>

                {/* Score + expand */}
                <div className="flex items-start gap-2 flex-shrink-0">
                    <div className="text-right">
                        <div className="text-lg font-extrabold text-dark-700 dark:text-dark-200">{result.relevancePercent}%</div>
                        <div className="w-16 h-1.5 bg-dark-200 dark:bg-dark-800 rounded-full mt-1 overflow-hidden shadow-inner">
                            <div
                                className={`score-bar ${scoreColor}`}
                                style={{ width: `${result.relevancePercent}%` }}
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setIsExpanded((v) => !v)}
                        className="mt-1.5 w-5 h-5 flex items-center justify-center text-dark-400 dark:text-dark-500 hover:text-dark-700 dark:hover:text-dark-200 bg-dark-50 dark:bg-dark-800/50 hover:bg-dark-100 dark:hover:bg-dark-700 rounded transition-all duration-200"
                        title="Explain why this matched"
                    >
                        <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content preview */}
            <p className="text-xs text-dark-600 dark:text-dark-300 font-medium leading-relaxed mt-2 line-clamp-3">
                {result.content}
            </p>

            {/* Expand: why this matched */}
            {isExpanded && (
                <div className="mt-3 p-3 bg-synapse-50/50 dark:bg-synapse-900/10 rounded-lg border border-synapse-200/50 dark:border-synapse-800/30 animate-slide-down shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-synapse-600 dark:text-synapse-500">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-[10px] font-bold text-synapse-700 dark:text-synapse-400 uppercase tracking-wider">Why this matched</span>
                    </div>
                    <p className="text-[11px] text-dark-600 dark:text-dark-300 font-medium leading-relaxed">
                        {generateExplanation(result)}
                    </p>
                </div>
            )}

            {/* AI Actions */}
            <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-dark-100 dark:border-dark-800 overflow-x-auto">
                {[
                    { label: 'Summarize', emoji: '📋' },
                    { label: 'Explain', emoji: '💡' },
                    { label: 'Quiz', emoji: '❓' },
                    { label: 'Citations', emoji: '📎' },
                    { label: 'Flashcards', emoji: '🃏' },
                ].map(action => (
                    <button
                        key={action.label}
                        onClick={() => onToast(`${action.label}: AI processing "${result.title}"...`)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-500 dark:text-dark-400 hover:text-synapse-600 dark:hover:text-synapse-400 bg-slate-50 dark:bg-dark-800/50 hover:bg-synapse-50 dark:hover:bg-synapse-900/20 border border-slate-200 dark:border-dark-700 hover:border-synapse-200 dark:hover:border-synapse-800 transition-all whitespace-nowrap"
                    >
                        <span>{action.emoji}</span> {action.label}
                    </button>
                ))}
            </div>

            {/* Share Action */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-100/50 dark:border-dark-800/50">
                <div className="text-[10px] text-dark-400 dark:text-dark-500 font-mono font-medium">
                    Score: {result.score.toFixed(3)}
                </div>

                <button
                    onClick={handleShare}
                    disabled={sharing}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${shared
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : sharing
                            ? 'bg-synapse-50 dark:bg-synapse-900/20 text-synapse-500 dark:text-synapse-400 border border-synapse-200 dark:border-synapse-800'
                            : 'text-dark-500 dark:text-dark-400 hover:text-synapse-600 dark:hover:text-synapse-400 bg-dark-50 dark:bg-dark-900 hover:bg-synapse-50 dark:hover:bg-synapse-900/30 border border-dark-200 dark:border-dark-700 hover:border-synapse-200 dark:hover:border-synapse-800'
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

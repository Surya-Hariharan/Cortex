import React, { useState, useRef, useEffect } from 'react';
import ResultCard from './ResultCard';

const SEARCH_STAGES = [
    'Tokenizing query…',
    'Running ONNX inference…',
    'Searching 384-dim vector space…',
    'Ranking by cosine similarity…',
];

const SUGGESTION_GROUPS = [
    { label: 'Physics', items: ['What is entropy?', 'Quantum tunneling'] },
    { label: 'CS', items: ['Binary search tree', 'TCP handshake'] },
    { label: 'Math', items: ['Eigenvalues explained', 'Taylor series'] },
    { label: 'Chemistry', items: ['SN2 reaction mechanism'] },
    { label: 'ML', items: ['Gradient descent'] },
];

const ALL_SUGGESTIONS = SUGGESTION_GROUPS.flatMap((g) => g.items);

export default function SearchTab({ onToast }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMeta, setSearchMeta] = useState(null);
    const [searchStage, setSearchStage] = useState(-1);
    const [synthesized, setSynthesized] = useState(null);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);
    const typewriterRef = useRef(null);
    const stageRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const doSearch = async (q) => {
        const trimmed = q.trim();
        if (!trimmed || isSearching) return;

        setIsSearching(true);
        setResults(null);
        setSynthesized(null);
        setSearchStage(0);
        clearInterval(typewriterRef.current);
        clearInterval(stageRef.current);

        let s = 0;
        stageRef.current = setInterval(() => {
            s = Math.min(s + 1, SEARCH_STAGES.length - 1);
            setSearchStage(s);
        }, 170);

        const minPause = new Promise((r) => setTimeout(r, 650));

        try {
            let response;
            if (window.electronAPI) {
                const [res] = await Promise.all([window.electronAPI.search(trimmed), minPause]);
                response = res;
            } else {
                await minPause;
                response = {
                    results: {
                        results: [
                            { rank: 1, docId: 1, title: 'Thermodynamics – Entropy', subject: 'Thermodynamics', content: 'The second law of thermodynamics introduces the concept of entropy. Entropy is a measure of the disorder or randomness in a closed system.', score: 0.924, relevancePercent: 92, chunkIndex: 1 },
                            { rank: 2, docId: 2, title: 'Thermodynamics – Disorder', subject: 'Thermodynamics', content: 'Entropy always increases in an isolated system. This is a key constraint on the efficiency of any heat engine operating between two temperatures.', score: 0.871, relevancePercent: 87, chunkIndex: 2 },
                            { rank: 3, docId: 3, title: 'Thermodynamics – First Law', subject: 'Thermodynamics', content: 'The first law of thermodynamics states that energy cannot be created or destroyed — only converted from one form to another.', score: 0.812, relevancePercent: 81, chunkIndex: 0 },
                        ],
                        searchTimeMs: 11,
                        totalDocuments: 100,
                        query: trimmed,
                        synthesizedAnswer: 'Based on your study materials: The second law of thermodynamics introduces entropy — a measure of disorder in a closed system. In any isolated system, entropy always increases, which constrains heat engine efficiency. The first law additionally establishes that total energy is always conserved.',
                    },
                };
            }

            clearInterval(stageRef.current);
            setSearchStage(-1);

            if (response.error) {
                onToast(response.error, 'error');
                setResults([]);
            } else {
                const r = response.results;
                setResults(r.results);
                setSearchMeta({ time: r.searchTimeMs, total: r.totalDocuments });
                if (r.synthesizedAnswer) {
                    setSynthesized('');
                    let i = 0;
                    typewriterRef.current = setInterval(() => {
                        i += 3;
                        setSynthesized(r.synthesizedAnswer.slice(0, i));
                        if (i >= r.synthesizedAnswer.length) {
                            setSynthesized(r.synthesizedAnswer);
                            clearInterval(typewriterRef.current);
                        }
                    }, 18);
                }
            }
        } catch (err) {
            clearInterval(stageRef.current);
            onToast('Search failed: ' + err.message, 'error');
        } finally {
            setIsSearching(false);
            setSearchStage(-1);
        }
    };

    const handleSubmit = (e) => { e.preventDefault(); doSearch(query); };

    const hasResults = results !== null;

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--surface-app)' }}>

            {/* ── Hero + Search Bar ────────────────────────────────────────────── */}
            <div className={`flex flex-col items-center transition-all duration-500 ease-in-out ${hasResults ? 'pt-4 pb-3' : 'pt-[9vh] pb-5'}`}>

                {/* Hero text – only before first search */}
                {!hasResults && (
                    <div className="text-center mb-6 animate-fade-in px-6">
                        <h2
                            className="text-[26px] font-bold tracking-tight mb-1.5"
                            style={{ color: 'var(--text-hero)', letterSpacing: '-0.025em', lineHeight: 1.2 }}
                        >
                            Search your knowledge
                        </h2>
                        <p className="text-[14px] leading-relaxed max-w-sm" style={{ color: 'var(--text-muted)' }}>
                            Semantic AI search across all your uploaded documents — fully offline.
                        </p>
                    </div>
                )}

                {/* Search bar */}
                <form onSubmit={handleSubmit} className="w-full max-w-[680px] px-5">
                    <div
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200"
                        style={{
                            background: 'var(--surface-card)',
                            border: isFocused || isSearching
                                ? '1.5px solid rgba(99,102,241,0.45)'
                                : '1.5px solid var(--border-subtle)',
                            boxShadow: isFocused || isSearching
                                ? '0 0 0 3px rgba(99,102,241,0.13), 0 4px 16px rgba(0,0,0,0.07)'
                                : '0 4px 14px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                        }}
                    >
                        {/* Icon */}
                        {isSearching ? (
                            <div
                                className="w-[17px] h-[17px] rounded-full border-2 animate-spin-slow flex-shrink-0"
                                style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: 'var(--accent)' }}
                            />
                        ) : (
                            <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                        )}

                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="Ask anything — e.g. second law of thermodynamics"
                            className="flex-1 bg-transparent outline-none text-[14.5px] font-medium"
                            style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
                            disabled={isSearching}
                        />

                        {query && !isSearching && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full transition-colors duration-100"
                                style={{ color: 'var(--text-muted)', background: 'var(--surface-recessed)' }}
                                tabIndex={-1}
                            >
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}

                        <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--border-subtle)' }} />

                        <button
                            type="submit"
                            disabled={!query.trim() || isSearching}
                            className="btn-primary flex-shrink-0 text-[12.5px] py-[5px] px-3.5"
                        >
                            Search
                        </button>
                    </div>
                </form>

                {/* Meta row / stage indicator */}
                <div className="h-6 flex items-center mt-2">
                    {isSearching && searchStage >= 0 && (
                        <div className="flex items-center gap-1.5 text-[11.5px] animate-fade-in" style={{ color: 'var(--accent)' }}>
                            <div
                                className="w-[10px] h-[10px] rounded-full border-[1.5px] animate-spin-slow flex-shrink-0"
                                style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: 'var(--accent)' }}
                            />
                            {SEARCH_STAGES[Math.min(searchStage, SEARCH_STAGES.length - 1)]}
                        </div>
                    )}
                    {!isSearching && searchMeta && (
                        <div className="flex items-center gap-3 text-[11.5px] animate-fade-in" style={{ color: 'var(--text-muted)' }}>
                            <span><strong style={{ color: 'var(--text-secondary)' }}>{results?.length || 0}</strong> results</span>
                            <span>·</span>
                            <span className="metric-mono" style={{ color: 'var(--accent)' }}>{searchMeta.time}ms</span>
                            <span>·</span>
                            <span><strong style={{ color: 'var(--text-secondary)' }}>{searchMeta.total}</strong> vectors</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Results Area ─────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">

                {/* AI Synthesis card */}
                {synthesized !== null && results?.length > 0 && (
                    <div className="max-w-[680px] mx-auto mb-3 animate-scale-in">
                        <div
                            className="p-4 rounded-xl"
                            style={{
                                background: 'rgba(99,102,241,0.05)',
                                border: '1px solid rgba(99,102,241,0.18)',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] flex-shrink-0"
                                    style={{ background: 'var(--accent-light)' }}
                                >
                                    ✦
                                </div>
                                <span className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                                    AI Synthesis
                                </span>
                                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                                    from top {Math.min(results.length, 3)} passages
                                </span>
                            </div>
                            <p
                                className="text-[13.5px] leading-relaxed typewriter-cursor"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {synthesized}
                            </p>
                        </div>
                    </div>
                )}

                {/* No results */}
                {results !== null && results.length === 0 && (
                    <div className="text-center py-16 animate-fade-in">
                        <div className="text-4xl mb-3">🔎</div>
                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No results found</p>
                        <p className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>Try a different query or upload more documents.</p>
                    </div>
                )}

                {/* Result list */}
                {results?.length > 0 && (
                    <div className="max-w-[680px] mx-auto space-y-2.5">
                        {results.map((result, idx) => (
                            <ResultCard key={result.docId + '-' + result.rank} result={result} index={idx} onToast={onToast} />
                        ))}
                    </div>
                )}

                {/* Suggestion chips – before first search */}
                {!hasResults && (
                    <div className="max-w-[680px] mx-auto pt-2 animate-fade-in">
                        <p className="text-[10.5px] font-semibold uppercase tracking-widest text-center mb-3" style={{ color: 'var(--text-muted)' }}>
                            Try asking
                        </p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {ALL_SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => { setQuery(s); setTimeout(() => doSearch(s), 60); }}
                                    className="px-3 py-1.5 text-[12.5px] font-medium rounded-lg select-none
                                               transition-all duration-150"
                                    style={{
                                        background: 'var(--surface-card)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-secondary)',
                                        boxShadow: 'var(--shadow-sm)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--accent-light)';
                                        e.currentTarget.style.borderColor = 'var(--accent-border)';
                                        e.currentTarget.style.color = 'var(--accent)';
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.10)';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'var(--surface-card)';
                                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

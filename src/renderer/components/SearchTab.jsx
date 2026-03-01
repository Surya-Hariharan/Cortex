import React, { useState, useRef, useEffect } from 'react';
import ResultCard from './ResultCard';

const SEARCH_STAGES = [
    'Tokenizing query…',
    'Running ONNX inference…',
    'Searching 384-dim vector space…',
    'Synthesizing answer…',
];

const SUGGESTIONS = [
    { group: 'Physics', items: ['What is entropy?', 'Quantum tunneling explained'] },
    { group: 'CS', items: ['Binary search tree operations', 'TCP three-way handshake'] },
    { group: 'Math', items: ['Eigenvalues and eigenvectors', 'Taylor series expansion'] },
    { group: 'Chemistry', items: ['SN2 reaction mechanism'] },
    { group: 'ML', items: ['Gradient descent optimization'] },
];

const ALL_SUGGESTIONS = SUGGESTIONS.flatMap((g) => g.items);

export default function SearchTab({ onToast }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMeta, setSearchMeta] = useState(null);
    const [searchStage, setSearchStage] = useState(-1);
    const [synthesizedAnswer, setSynthesizedAnswer] = useState(null);
    const inputRef = useRef(null);
    const typewriterRef = useRef(null);
    const stageTimerRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim() || isSearching) return;

        setIsSearching(true);
        setResults(null);
        setSynthesizedAnswer(null);
        setSearchStage(0);

        if (typewriterRef.current) clearInterval(typewriterRef.current);
        if (stageTimerRef.current) clearInterval(stageTimerRef.current);

        let stage = 0;
        stageTimerRef.current = setInterval(() => {
            stage = Math.min(stage + 1, SEARCH_STAGES.length - 1);
            setSearchStage(stage);
        }, 160);

        const minPause = new Promise((r) => setTimeout(r, 640));

        try {
            let response;
            if (window.electronAPI) {
                const [res] = await Promise.all([window.electronAPI.search(query.trim()), minPause]);
                response = res;
            } else {
                await minPause;
                response = {
                    results: {
                        results: [
                            { rank: 1, docId: 1, title: 'Thermodynamics - Concept 2', subject: 'Thermodynamics', content: 'The second law of thermodynamics introduces the concept of entropy. Entropy is a measure of the disorder or randomness in a closed system.', score: 0.924, relevancePercent: 92, chunkIndex: 1 },
                            { rank: 2, docId: 2, title: 'Thermodynamics - Concept 3', subject: 'Thermodynamics', content: 'Entropy always increases in an isolated system. This is a key constraint on the efficiency of any heat engine.', score: 0.871, relevancePercent: 87, chunkIndex: 2 },
                            { rank: 3, docId: 3, title: 'Thermodynamics - Concept 1', subject: 'Thermodynamics', content: 'The first law of thermodynamics states that energy cannot be created or destroyed, only converted from one form to another.', score: 0.812, relevancePercent: 81, chunkIndex: 0 },
                        ],
                        searchTimeMs: 11,
                        totalDocuments: 100,
                        query,
                        synthesizedAnswer: 'Based on your study materials: The second law of thermodynamics introduces the concept of entropy — a measure of disorder or randomness in a closed system. Furthermore, entropy always increases in an isolated system, which constrains heat engine efficiency. Additionally, the first law establishes that energy is conserved across all thermodynamic processes.',
                    },
                };
            }

            clearInterval(stageTimerRef.current);
            setSearchStage(-1);

            if (response.error) {
                onToast(response.error, 'error');
                setResults([]);
            } else {
                setResults(response.results.results);
                setSearchMeta({
                    time: response.results.searchTimeMs,
                    total: response.results.totalDocuments,
                    query: response.results.query,
                });
                const answer = response.results.synthesizedAnswer;
                if (answer) {
                    setSynthesizedAnswer('');
                    let i = 0;
                    typewriterRef.current = setInterval(() => {
                        i += 3;
                        setSynthesizedAnswer(answer.slice(0, i));
                        if (i >= answer.length) {
                            setSynthesizedAnswer(answer);
                            clearInterval(typewriterRef.current);
                        }
                    }, 20);
                }
            }
        } catch (error) {
            clearInterval(stageTimerRef.current);
            onToast('Search failed: ' + error.message, 'error');
        } finally {
            setIsSearching(false);
            setSearchStage(-1);
        }
    };

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--surface-app)' }}>

            {/* ── Search Section ──────────────────────────────────────────────── */}
            <div className={`flex flex-col items-center transition-all duration-500 ${results !== null ? 'pt-5 pb-3' : 'pt-[11vh] pb-6'}`}>

                {/* Hero – shown only before first search */}
                {results === null && (
                    <div className="text-center mb-7 animate-fade-in">
                        <h2 className="text-[28px] font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
                            Search your knowledge
                        </h2>
                        <p className="text-[15px] max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            Ask anything — Cortex searches your entire document library using AI-powered semantic understanding.
                        </p>
                    </div>
                )}

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="w-full max-w-2xl px-6">
                    <div
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${isSearching ? 'animate-pulse-glow' : ''}`}
                        style={{
                            background: 'var(--surface-card)',
                            border: isSearching
                                ? '1px solid rgba(99,102,241,0.45)'
                                : '1px solid var(--border-subtle)',
                            boxShadow: isSearching
                                ? '0 0 0 3px rgba(99,102,241,0.10), 0 4px 16px rgba(99,102,241,0.08)'
                                : '0 4px 16px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.05)',
                        }}
                        onFocus={(e) => {
                            if (!isSearching) {
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10), 0 4px 16px rgba(99,102,241,0.08)';
                                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.40)';
                            }
                        }}
                        onBlur={(e) => {
                            if (!isSearching) {
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.05)';
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            }
                        }}
                    >
                        {isSearching ? (
                            <div
                                className="w-4 h-4 rounded-full border-2 animate-spin-slow flex-shrink-0"
                                style={{ borderColor: 'rgba(99,102,241,0.25)', borderTopColor: 'var(--accent)' }}
                            />
                        ) : (
                            <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="What is the second law of thermodynamics?"
                            className="flex-1 bg-transparent outline-none text-base font-medium"
                            style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
                            disabled={isSearching}
                        />
                        <button
                            type="submit"
                            disabled={!query.trim() || isSearching}
                            className="btn-primary text-sm py-1.5 px-4 flex-shrink-0"
                        >
                            Search
                        </button>
                    </div>
                </form>

                {/* Meta row + stage indicator */}
                {searchMeta && !isSearching && (
                    <div className="flex items-center gap-4 mt-2.5 text-xs animate-fade-in" style={{ color: 'var(--text-muted)' }}>
                        <span>
                            Found <strong style={{ color: 'var(--text-secondary)' }}>{results?.length || 0}</strong> results
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                            ⚡ <strong style={{ color: 'var(--accent)' }}>{searchMeta.time}ms</strong> ONNX
                        </span>
                        <span>·</span>
                        <span>
                            <strong style={{ color: 'var(--text-secondary)' }}>{searchMeta.total}</strong> vectors searched
                        </span>
                    </div>
                )}
                {isSearching && searchStage >= 0 && (
                    <div className="flex items-center gap-2 mt-2.5 text-xs animate-fade-in" style={{ color: 'var(--accent)' }}>
                        <div
                            className="w-3 h-3 rounded-full border-2 animate-spin-slow flex-shrink-0"
                            style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: 'var(--accent)' }}
                        />
                        <span>{SEARCH_STAGES[Math.min(searchStage, SEARCH_STAGES.length - 1)]}</span>
                    </div>
                )}
            </div>

            {/* ── Results ─────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">

                {/* AI Synthesis */}
                {synthesizedAnswer !== null && results && results.length > 0 && (
                    <div className="max-w-2xl mx-auto mb-4 animate-scale-in">
                        <div className="card-accent p-4">
                            <div className="flex items-center gap-2 mb-2.5">
                                <div
                                    className="w-5 h-5 rounded-md flex items-center justify-center text-[11px]"
                                    style={{ background: 'var(--accent-muted)' }}
                                >💡</div>
                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                                    AI Synthesis
                                </span>
                                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                                    from top {Math.min(results.length, 3)} passages
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed typewriter-cursor" style={{ color: 'var(--text-secondary)' }}>
                                {synthesizedAnswer}
                            </p>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {results !== null && results.length === 0 && (
                    <div className="text-center py-16 animate-fade-in">
                        <div className="text-4xl mb-3">🔎</div>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results found. Try a different query.</p>
                    </div>
                )}

                {/* Result cards */}
                {results && results.length > 0 && (
                    <div className="max-w-2xl mx-auto space-y-2.5">
                        {results.map((result, idx) => (
                            <ResultCard
                                key={result.docId + '-' + result.rank}
                                result={result}
                                index={idx}
                                onToast={onToast}
                            />
                        ))}
                    </div>
                )}

                {/* Suggestion chips – shown only before first search */}
                {results === null && (
                    <div className="max-w-2xl mx-auto mt-5 animate-fade-in">
                        <p className="text-xs font-semibold mb-3 text-center uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            Try searching for
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {ALL_SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        setQuery(suggestion);
                                        setTimeout(() => {
                                            const form = document.querySelector('form');
                                            if (form) form.requestSubmit();
                                        }, 50);
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150"
                                    style={{
                                        background: 'var(--surface-card)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-secondary)',
                                        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--accent-light)';
                                        e.currentTarget.style.color = 'var(--accent)';
                                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'var(--surface-card)';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)';
                                    }}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

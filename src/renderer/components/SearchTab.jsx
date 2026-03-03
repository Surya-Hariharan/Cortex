import React, { useState, useRef, useEffect } from 'react';
import ResultCard from './ResultCard';

const SEARCH_STAGES = [
    'Tokenizing query…',
    'Running ONNX inference…',
    'Searching 384-dim vector space…',
    'Synthesizing answer…',
];

export default function SearchTab({ onToast, onUploadPdf }) {
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
        // Auto-focus search input
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

        // Advance stage label every 160ms for visual effect
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
        <div className="h-full flex flex-col">
            {/* ── Search Section ─────────────────────────────────────────────── */}
            <div className={`flex flex-col items-center transition-all duration-500 ${results !== null ? 'pt-6 pb-4' : 'pt-[18vh] pb-8'
                }`}>
                {/* Hero text - shows only before first search */}
                {results === null && (
                    <div className="text-center mb-8 animate-fade-in">
                        <h2 className="text-3xl font-bold mb-2 text-dark-800 dark:text-dark-50">
                            <span className="gradient-text">Search your knowledge</span>
                        </h2>
                        <p className="text-dark-500 dark:text-dark-400 text-sm max-w-md font-medium">
                            Ask anything — Cortex searches your entire document library using AI-powered semantic understanding
                        </p>
                    </div>
                )}

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="w-full max-w-2xl px-6 relative z-10">
                    <div className={`bg-white dark:bg-dark-900 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)] flex items-center gap-3 pl-2 pr-2 py-2 rounded-2xl transition-all duration-300 border ${isSearching ? 'border-synapse-300 dark:border-synapse-500/50 shadow-[0_4px_24px_rgba(99,102,241,0.15)] glow-border-active' : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] glow-border dark:glow-border-none'
                        }`}>

                        <button
                            type="button"
                            onClick={onUploadPdf}
                            className="bg-dark-100 dark:bg-dark-800 hover:bg-dark-200 dark:hover:bg-dark-700 text-dark-500 dark:text-dark-400 hover:text-dark-800 dark:hover:text-dark-100 transition-colors rounded-xl w-9 h-9 flex items-center justify-center flex-shrink-0"
                            title="Upload Context (PDF)"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>

                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="What is the second law of thermodynamics?"
                            className="flex-1 bg-transparent text-dark-800 dark:text-dark-50 placeholder-dark-400 dark:placeholder-dark-500 text-[15px] font-medium outline-none px-2"
                            disabled={isSearching}
                        />

                        <button
                            type="submit"
                            disabled={!query.trim() || isSearching}
                            className={`w-9 h-9 flex flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${query.trim() && !isSearching
                                ? 'bg-synapse-600 hover:bg-synapse-700 text-white shadow-sm'
                                : 'bg-dark-100 dark:bg-dark-800 text-dark-400 dark:text-dark-500 cursor-not-allowed'
                                }`}
                            title="Send Message"
                        >
                            {isSearching ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={query.trim() ? "translate-x-[-1px] translate-y-[1px]" : ""}>
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            )}
                        </button>
                    </div>
                </form>

                {/* Search metadata + stage indicator */}
                {searchMeta && !isSearching && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-dark-500 dark:text-dark-400 font-medium animate-fade-in">
                        <span>
                            Found <strong className="text-dark-800 dark:text-dark-100">{results?.length || 0}</strong> results
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            ⚡ <strong className="text-synapse-600 dark:text-synapse-500">{searchMeta.time}ms</strong> ONNX
                        </span>
                        <span>•</span>
                        <span>
                            Searched <strong className="text-slate-800 dark:text-dark-100">{searchMeta.total}</strong> vectors
                        </span>
                    </div>
                )}
                {isSearching && searchStage >= 0 && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-synapse-600 font-medium animate-fade-in">
                        <div className="w-3 h-3 border-2 border-synapse-400/30 border-t-synapse-600 rounded-full animate-spin-slow flex-shrink-0" />
                        <span>{SEARCH_STAGES[Math.min(searchStage, SEARCH_STAGES.length - 1)]}</span>
                    </div>
                )}
            </div>

            {/* ── Results ────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">

                {/* Synthesized AI answer */}
                {synthesizedAnswer !== null && results && results.length > 0 && (
                    <div className="max-w-2xl mx-auto mb-4 animate-scale-in">
                        <div className="bg-synapse-50/50 dark:bg-synapse-900/10 border border-synapse-200/60 dark:border-synapse-700/30 rounded-xl p-4 shadow-sm text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2 mb-2.5">
                                <div className="w-6 h-6 rounded-md bg-synapse-100 dark:bg-synapse-900/40 flex items-center justify-center text-xs">💡</div>
                                <span className="text-[11px] font-bold text-synapse-700 dark:text-synapse-400 uppercase tracking-wider">AI Synthesis</span>
                                <span className="text-[10px] text-slate-500 dark:text-dark-400 font-medium ml-auto">from top {Math.min(results.length, 3)} passages</span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-dark-200 font-medium leading-relaxed shadow-sm typewriter-cursor">
                                {synthesizedAnswer}
                            </p>
                        </div>
                    </div>
                )}

                {results !== null && results.length === 0 && (
                    <div className="text-center py-16 animate-fade-in">
                        <div className="text-4xl mb-3">🔎</div>
                        <p className="text-slate-500 dark:text-dark-400 text-sm font-medium">No results found. Try a different query.</p>
                    </div>
                )}

                {results && results.length > 0 && (
                    <div className="max-w-2xl mx-auto space-y-3">
                        {results.map((result, idx) => (
                            <ResultCard
                                key={result.docId + '-' + result.rank}
                                result={result}
                                index={idx}
                                onShare={() => handleShare(result)}
                                onToast={onToast}
                            />
                        ))}
                    </div>
                )}

                {/* Suggested queries - shows only before first search */}
                {results === null && (
                    <div className="max-w-2xl mx-auto mt-4 animate-fade-in">
                        <p className="text-xs text-slate-400 dark:text-dark-500 font-semibold mb-3 text-center uppercase tracking-wider">Try searching for</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {[
                                'What is entropy?',
                                'Binary search tree operations',
                                'Eigenvalues and eigenvectors',
                                'SN2 reaction mechanism',
                                'Gradient descent optimization',
                                'Quantum tunneling',
                                'TCP three-way handshake',
                                'Taylor series expansion',
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        setQuery(suggestion);
                                        setTimeout(() => {
                                            if (inputRef.current) inputRef.current.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                                        }, 50);
                                    }}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-dark-900 hover:bg-slate-100 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg text-xs font-medium text-slate-600 dark:text-dark-300 hover:text-slate-900 dark:hover:text-dark-50 transition-all flex items-center gap-1.5"
                                >
                                    <Search size={12} className="text-slate-400 dark:text-dark-500" />
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

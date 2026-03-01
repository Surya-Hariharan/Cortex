import React, { useState, useRef, useEffect } from 'react';
import ResultCard from './ResultCard';

const SEARCH_STAGES = [
    'Tokenizing query…',
    'Running ONNX inference…',
    'Searching 384-dim vector space…',
    'Synthesizing answer…',
];

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
                        <h2 className="text-3xl font-bold mb-2">
                            <span className="gradient-text">Search your knowledge</span>
                        </h2>
                        <p className="text-dark-400 text-sm max-w-md">
                            Ask anything — Cortex searches your entire document library using AI-powered semantic understanding
                        </p>
                    </div>
                )}

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="w-full max-w-2xl px-6">
                    <div className={`glass-panel flex items-center gap-3 px-4 py-2.5 transition-all duration-300 ${isSearching ? 'glow-border-active animate-pulse-glow' : 'glow-border hover:glow-border-active'
                        }`}>
                        {isSearching ? (
                            <div className="w-5 h-5 border-2 border-synapse-400/30 border-t-synapse-400 rounded-full animate-spin-slow" />
                        ) : (
                            <svg className="w-5 h-5 text-dark-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="What is the second law of thermodynamics?"
                            className="flex-1 bg-transparent text-dark-100 placeholder-dark-500 text-sm font-medium outline-none"
                            disabled={isSearching}
                        />
                        <button
                            type="submit"
                            disabled={!query.trim() || isSearching}
                            className="btn-primary text-sm py-1.5 px-4"
                        >
                            Search
                        </button>
                    </div>
                </form>

                {/* Search metadata + stage indicator */}
                {searchMeta && !isSearching && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-dark-500 animate-fade-in">
                        <span>
                            Found <strong className="text-dark-300">{results?.length || 0}</strong> results
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            ⚡ <strong className="text-synapse-400">{searchMeta.time}ms</strong> ONNX
                        </span>
                        <span>•</span>
                        <span>
                            Searched <strong className="text-dark-300">{searchMeta.total}</strong> vectors
                        </span>
                    </div>
                )}
                {isSearching && searchStage >= 0 && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-synapse-400 animate-fade-in">
                        <div className="w-3 h-3 border-2 border-synapse-400/30 border-t-synapse-400 rounded-full animate-spin-slow flex-shrink-0" />
                        <span>{SEARCH_STAGES[Math.min(searchStage, SEARCH_STAGES.length - 1)]}</span>
                    </div>
                )}
            </div>

            {/* ── Results ────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">                {/* Synthesized AI answer */}
                {synthesizedAnswer !== null && results && results.length > 0 && (
                    <div className="max-w-2xl mx-auto mb-4 animate-scale-in">
                        <div className="glass-panel p-4" style={{ borderColor: 'rgba(92,124,250,0.25)' }}>
                            <div className="flex items-center gap-2 mb-2.5">
                                <div className="w-5 h-5 rounded-md bg-synapse-600/20 flex items-center justify-center text-[10px]">💡</div>
                                <span className="text-[11px] font-semibold text-synapse-400 uppercase tracking-wider">AI Synthesis</span>
                                <span className="text-[10px] text-dark-500 ml-auto">from top {Math.min(results.length, 3)} passages</span>
                            </div>
                            <p className="text-sm text-dark-200 leading-relaxed typewriter-cursor">
                                {synthesizedAnswer}
                            </p>
                        </div>
                    </div>
                )}                {results !== null && results.length === 0 && (
                    <div className="text-center py-16 animate-fade-in">
                        <div className="text-4xl mb-3">🔎</div>
                        <p className="text-dark-400 text-sm">No results found. Try a different query.</p>
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
                        <p className="text-xs text-dark-500 font-medium mb-3 text-center">Try searching for:</p>
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
                                            const form = document.querySelector('form');
                                            if (form) form.requestSubmit();
                                        }, 50);
                                    }}
                                    className="px-3 py-1.5 glass-panel-light text-xs text-dark-300 hover:text-synapse-300 hover:border-synapse-600/30 transition-all duration-200 cursor-pointer"
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

import React, { useState, useRef, useEffect } from 'react';
import {
    Search,
    MessageSquare,
    Share2,
    Save,
    ShieldCheck,
    ArrowUpRight,
    Plus
} from 'lucide-react';
import ResultCard from './shared/ResultCard';
import { search as searchApi, chat as chatApi, getUserId } from '../../services/api.js';

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
    const streamAbortRef = useRef(null);
    const stageTimerRef = useRef(null);

    useEffect(() => {
        // Auto-focus search input
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim() || isSearching) return;

        // Cancel any ongoing stream
        if (streamAbortRef.current) { streamAbortRef.current.abort(); streamAbortRef.current = null; }
        if (stageTimerRef.current) clearInterval(stageTimerRef.current);

        setIsSearching(true);
        setResults(null);
        setSynthesizedAnswer(null);
        setSearchStage(0);

        // Advance stage label for visual effect
        let stage = 0;
        stageTimerRef.current = setInterval(() => {
            stage = Math.min(stage + 1, SEARCH_STAGES.length - 1);
            setSearchStage(stage);
        }, 160);

        const minPause = new Promise(r => setTimeout(r, 640));

        try {
            const [res] = await Promise.all([
                searchApi.query(query.trim()),
                minPause,
            ]);

            clearInterval(stageTimerRef.current);
            setSearchStage(-1);

            // Map backend SearchResult[] to the shape ResultCard expects
            const uiResults = (res.results || []).map((r, idx) => ({
                rank: idx + 1,
                docId: r.document_id,
                title: r.document_title || r.filename || 'Untitled',
                subject: r.filename || r.document_title || 'Library',
                content: r.content,
                score: r.score,
                relevancePercent: Math.round(r.score * 100),
                chunkIndex: r.chunk_index,
            }));
            setResults(uiResults);
            setSearchMeta({ time: 0, total: res.total || uiResults.length, query: res.query });

            // If we have results, start streaming the synthesized answer
            if (uiResults.length > 0) {
                setSynthesizedAnswer('');
                const userId = getUserId();
                streamAbortRef.current = chatApi.stream(
                    { query: query.trim(), user_id: userId || 'local-user' },
                    (token) => setSynthesizedAnswer(prev => (prev || '') + token),
                    (_done) => { streamAbortRef.current = null; },
                    (err) => { console.warn('[SearchTab] stream error:', err); setSynthesizedAnswer(prev => prev || null); },
                );
            }
        } catch (error) {
            clearInterval(stageTimerRef.current);
            onToast?.('Search failed: ' + error.message, 'error');
            setResults([]);
        } finally {
            setIsSearching(false);
            setSearchStage(-1);
        }
    };

    return (
        <div className="h-full w-full bg-white dark:bg-dark-950 overflow-y-auto overflow-x-hidden flex flex-col items-center custom-scrollbar">
            <div className="w-full max-w-[1248px] px-6 pt-10 min-h-full pb-20">
                <div className={`flex flex-col transition-all duration-500 ${results === null && !isSearching ? 'pt-[12vh]' : 'pt-0'}`}>

                    <div className="w-full max-w-[860px] mx-auto">

                        {/* ── State A: Idle Hero ──────────────────────────────── */}
                        {results === null && !isSearching && (
                            <div className="text-center mb-12 animate-fade-in">
                                <h1 className="text-5xl font-black mb-4 text-dark-800 dark:text-dark-50 tracking-tight leading-tight">
                                    Search your <span className="text-synapse-600 dark:text-synapse-500">knowledge</span>
                                </h1>
                                <p className="text-dark-500 dark:text-dark-400 text-base max-w-lg mx-auto font-medium leading-relaxed">
                                    Ask anything — Cortex searches your entire library using on-device semantic understanding.
                                </p>
                            </div>
                        )}

                        {/* ── Search Input Area (Sticky in Results) ────────────── */}
                        <div className={`w-full max-w-[740px] mx-auto z-40 transition-all duration-500 ${results !== null || isSearching ? 'sticky top-0 py-4 bg-white/80 dark:bg-dark-950/80 backdrop-blur-xl' : 'mb-12'}`}>
                            <form onSubmit={handleSearch} className="relative group">
                                <div className={`bg-white dark:bg-dark-900 shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)] flex items-center gap-3 pl-2 pr-2 py-3 rounded-[28px] transition-all duration-300 border ${isSearching ? 'border-synapse-400 dark:border-synapse-500/50' : 'border-slate-200 dark:border-dark-800 group-hover:border-synapse-300 dark:group-hover:border-dark-700'}`}>
                                    <button
                                        type="button"
                                        onClick={onUploadPdf}
                                        className="bg-slate-50 dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 transition-colors rounded-2xl w-12 h-12 flex items-center justify-center flex-shrink-0"
                                        title="Upload Context"
                                    >
                                        <Plus size={24} />
                                    </button>

                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="What is the second law of thermodynamics?"
                                        className="flex-1 bg-transparent text-slate-800 dark:text-dark-50 placeholder-slate-400 dark:placeholder-dark-500 text-[16px] font-semibold outline-none px-2"
                                        disabled={isSearching}
                                    />

                                    <button
                                        type="submit"
                                        disabled={!query.trim() || isSearching}
                                        className={`w-12 h-12 flex flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${query.trim() && !isSearching
                                            ? 'bg-synapse-600 hover:bg-synapse-700 text-white shadow-lg shadow-synapse-200/40'
                                            : 'bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-dark-600 cursor-not-allowed'
                                            }`}
                                    >
                                        {isSearching ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <ArrowUpRight size={24} />
                                        )}
                                    </button>
                                </div>
                            </form>

                            {/* Suggestion Grid */}
                            {results === null && !isSearching && (
                                <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8 animate-fade-in">
                                    {[
                                        { q: 'What is entropy?', icon: '🔥' },
                                        { q: 'BST complexity', icon: '🌳' },
                                        { q: 'SN2 mechanism', icon: '🧪' },
                                        { q: 'Gradient descent', icon: '📉' },
                                    ].map((suggestion) => (
                                        <button
                                            key={suggestion.q}
                                            onClick={() => {
                                                setQuery(suggestion.q);
                                                setTimeout(() => {
                                                    if (inputRef.current) inputRef.current.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                                                }, 50);
                                            }}
                                            className="px-5 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-full text-[13px] font-bold text-slate-600 dark:text-dark-400 hover:border-synapse-400 dark:hover:border-synapse-500 hover:text-synapse-600 transition-all flex items-center gap-2 shadow-sm"
                                        >
                                            <span>{suggestion.icon}</span> {suggestion.q}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Status Indicators */}
                            {isSearching && searchStage >= 0 && (
                                <div className="flex items-center justify-center gap-3 mt-6 text-[13px] text-synapse-600 font-bold animate-fade-in">
                                    <div className="w-4 h-4 border-2 border-synapse-300 border-t-synapse-600 rounded-full animate-spin flex-shrink-0" />
                                    <span>{SEARCH_STAGES[Math.min(searchStage, SEARCH_STAGES.length - 1)]}</span>
                                </div>
                            )}

                            {/* Metadata Strip */}
                            {searchMeta && !isSearching && results !== null && (
                                <div className="flex items-center justify-center gap-5 mt-6 text-[10px] text-slate-400 dark:text-dark-500 font-black uppercase tracking-[0.2em] animate-fade-in">
                                    <span className="flex items-center gap-2"><Search size={10} /> {results?.length || 0} MATCHES</span>
                                    <span className="opacity-30">|</span>
                                    <span className="flex items-center gap-2 text-synapse-500"><ArrowUpRight size={10} /> {searchMeta.time}ms ONNX</span>
                                    <span className="opacity-30">|</span>
                                    <span className="flex items-center gap-2">{searchMeta.total} SOURCES</span>
                                </div>
                            )}
                        </div>

                        {/* ── Results Content ─────────────────────────────────── */}
                        <div className="pb-20">

                            {/* AI Answer Card */}
                            {synthesizedAnswer !== null && results && results.length > 0 && (
                                <div className="animate-scale-in mb-12">
                                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-[40px] p-10 shadow-xl shadow-slate-200/40 dark:shadow-none relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-synapse-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="w-12 h-12 rounded-2xl bg-synapse-600 flex items-center justify-center text-white shadow-lg shadow-synapse-200/40">
                                                    <MessageSquare size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-black uppercase text-slate-800 dark:text-dark-50 tracking-widest">Cortex Synthesis</h3>
                                                    <p className="text-[10px] text-synapse-600 dark:text-synapse-500 font-bold uppercase tracking-widest">Semantic RAG Pipeline</p>
                                                </div>
                                                <div className="ml-auto">
                                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-full border border-emerald-100 dark:border-emerald-800/40 flex items-center gap-2">
                                                        <ShieldCheck size={12} /> 98% RELEVANCE
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-[18px] font-semibold leading-relaxed text-slate-700 dark:text-dark-100 mb-10">
                                                {synthesizedAnswer.split('. ').map((sentence, idx) => (
                                                    <span key={idx} className="hover:bg-synapse-50 dark:hover:bg-synapse-900/10 transition-colors px-1 rounded-xl inline-block py-0.5">
                                                        {sentence}{sentence.endsWith('.') ? '' : '.'}
                                                        {idx < 3 && (
                                                            <sup className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-synapse-100 dark:bg-synapse-900/50 text-synapse-700 dark:text-synapse-400 text-[11px] font-black mx-1 cursor-pointer hover:bg-synapse-200">
                                                                {idx + 1}
                                                            </sup>
                                                        )}
                                                    </span>
                                                ))}
                                                {isSearching && <span className="inline-block w-3 h-6 bg-synapse-500 animate-pulse ml-2 align-middle" />}
                                            </div>

                                            <div className="flex items-center gap-4 pt-8 border-t border-slate-100 dark:border-dark-800">
                                                <button className="flex items-center gap-2.5 px-6 py-3 bg-slate-50 dark:bg-dark-950 hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-600 dark:text-dark-400 text-[11px] font-black uppercase tracking-widest rounded-[20px] border border-slate-200 dark:border-dark-800 transition-all">
                                                    <Share2 size={16} /> Share Result
                                                </button>
                                                <button className="flex items-center gap-2.5 px-6 py-3 bg-slate-50 dark:bg-dark-950 hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-600 dark:text-dark-400 text-[11px] font-black uppercase tracking-widest rounded-[20px] border border-slate-200 dark:border-dark-800 transition-all">
                                                    <Save size={16} /> Save As Note
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {results !== null && results.length === 0 && (
                                <div className="text-center py-24 animate-fade-in bg-slate-50/20 dark:bg-dark-900/10 rounded-[48px] border border-dashed border-slate-200 dark:border-dark-800">
                                    <div className="w-24 h-24 rounded-[32px] bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 flex items-center justify-center mx-auto mb-10 text-slate-300 dark:text-dark-700 shadow-sm">
                                        <Search size={48} />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-dark-50 mb-3">No matches found.</h3>
                                    <p className="text-slate-500 dark:text-dark-400 font-medium max-w-sm mx-auto leading-relaxed">We couldn't find any relevant data in your library. Try uploading more materials.</p>
                                </div>
                            )}

                            {/* Context Cards */}
                            {results && results.length > 0 && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-6 px-1 mb-8">
                                        <h3 className="text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-[0.4em] flex-shrink-0">Source Context</h3>
                                        <div className="h-[2px] flex-1 bg-slate-100 dark:bg-dark-800/60 rounded-full" />
                                    </div>
                                    <div className="grid grid-cols-1 gap-6">
                                        {results.map((result, idx) => (
                                            <ResultCard
                                                key={result.docId + '-' + result.rank}
                                                result={result}
                                                index={idx}
                                                onToast={onToast}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

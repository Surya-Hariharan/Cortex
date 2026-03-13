import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUpRight, Plus, Zap, X, Check } from 'lucide-react';
import ResultCard from './shared/ResultCard';
import { search as searchApi, chat as chatApi, getUserId } from '../../services/api.js';
import { useCore } from '../context/CoreContext.jsx';

const SEARCH_STAGES = [
    'Tokenizing query…',
    'Running ONNX inference…',
    'Searching 384-dim vector space…',
    'Synthesizing answer…',
];

const OFFLINE_MODELS = [
    { id: 'cse',      label: 'CSE',      description: 'Computer Science & Engineering' },
    { id: 'aiml',     label: 'AI & ML',  description: 'Artificial Intelligence & Machine Learning' },
    { id: 'chemical', label: 'Chemical', description: 'Chemical Engineering' },
    { id: 'civil',    label: 'Civil',    description: 'Civil Engineering' },
    { id: 'mechanical', label: 'Mechanical', description: 'Mechanical Engineering' },
];

const ONLINE_MODELS = [
    { id: 'gemini', label: 'Gemini', description: 'Google Gemini AI' },
    { id: 'groq',   label: 'Groq',   description: 'Groq Fast Inference' },
];

export default function SearchTab({ onToast, savedState, onFirstSearch, onSearchComplete }) {
    const { isInternetOnline } = useCore();

    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchStage, setSearchStage] = useState(-1);
    const [selectedModel, setSelectedModel] = useState(null);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    const inputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const streamAbortRef = useRef(null);
    const stageTimerRef = useRef(null);
    const firstSearchReportedRef = useRef(!!savedState?.query);
    const dropdownRef = useRef(null);

    const models = isInternetOnline ? ONLINE_MODELS : OFFLINE_MODELS;

    // Auto-focus
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Close dropdown on outside click
    useEffect(() => {
        const handle = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setShowModelDropdown(false);
        };
        window.addEventListener('mousedown', handle);
        return () => window.removeEventListener('mousedown', handle);
    }, []);

    // Restore saved state as chat messages
    useEffect(() => {
        if (savedState?.query && messages.length === 0) {
            const msgs = [{ id: 'saved-user', role: 'user', content: savedState.query }];
            if (savedState.synthesizedAnswer) {
                msgs.push({
                    id: 'saved-ai',
                    role: 'ai',
                    content: savedState.synthesizedAnswer,
                    results: savedState.results || [],
                    isStreaming: false,
                });
            }
            setMessages(msgs);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Core submit logic — accepts the query string directly
    const submitQuery = useCallback(async (userQuery) => {
        if (!userQuery.trim() || isSearching) return;

        if (streamAbortRef.current) { streamAbortRef.current.abort(); streamAbortRef.current = null; }
        if (stageTimerRef.current) clearInterval(stageTimerRef.current);

        const aiMsgId = `ai-${Date.now()}`;
        setMessages(prev => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', content: userQuery },
            { id: aiMsgId, role: 'ai', content: '', isStreaming: true, results: null },
        ]);
        setIsSearching(true);
        setSearchStage(0);

        if (!firstSearchReportedRef.current) {
            firstSearchReportedRef.current = true;
            onFirstSearch?.(userQuery);
        }

        let stage = 0;
        stageTimerRef.current = setInterval(() => {
            stage = Math.min(stage + 1, SEARCH_STAGES.length - 1);
            setSearchStage(stage);
        }, 160);

        try {
            const [res] = await Promise.all([
                searchApi.query(userQuery),
                new Promise(r => setTimeout(r, 640)),
            ]);
            clearInterval(stageTimerRef.current);
            setSearchStage(-1);

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

            onSearchComplete?.({ query: userQuery, results: uiResults.slice(0, 3), searchMeta: { total: res.total || uiResults.length } });

            if (uiResults.length > 0) {
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, results: uiResults } : m));
                const userId = getUserId();
                streamAbortRef.current = chatApi.stream(
                    { query: userQuery, user_id: userId || 'local-user' },
                    (token) => setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, content: (m.content || '') + token } : m
                    )),
                    () => {
                        streamAbortRef.current = null;
                        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false } : m));
                    },
                    (err) => {
                        console.warn('[SearchTab] stream error:', err);
                        setMessages(prev => prev.map(m =>
                            m.id === aiMsgId ? { ...m, isStreaming: false, content: m.content || 'No response available.' } : m
                        ));
                    },
                );
            } else {
                setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, isStreaming: false, content: 'No relevant documents found in your library. Try uploading more study materials.' } : m
                ));
            }
        } catch (error) {
            clearInterval(stageTimerRef.current);
            onToast?.('Search failed: ' + error.message, 'error');
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, isStreaming: false, content: 'Search failed. Please try again.' } : m
            ));
        } finally {
            setIsSearching(false);
            setSearchStage(-1);
        }
    }, [isSearching, onFirstSearch, onSearchComplete, onToast]);

    const handleSearch = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;
        setQuery('');
        submitQuery(q);
    };

    const handleSuggestion = (q) => {
        setQuery('');
        submitQuery(q);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="h-full w-full bg-white dark:bg-dark-950 flex flex-col overflow-hidden">

            {/* ── Message area (scrollable) ─────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {messages.length === 0 ? (
                    /* Idle hero */
                    <div className="h-full flex flex-col items-center justify-center px-6 pb-8">
                        <div className="text-center mb-10 animate-fade-in max-w-xl">
                            <h1 className="text-5xl font-black mb-4 text-dark-800 dark:text-dark-50 tracking-tight leading-tight">
                                Search your{' '}
                                <span className="text-synapse-600 dark:text-synapse-500">knowledge</span>
                            </h1>
                            <p className="text-dark-500 dark:text-dark-400 text-base font-medium leading-relaxed">
                                Ask anything — Cortex searches your entire library using on-device semantic understanding.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 animate-fade-in">
                            {[
                                { q: 'What is entropy?', icon: '🔥' },
                                { q: 'BST complexity',  icon: '🌳' },
                                { q: 'SN2 mechanism',   icon: '🧪' },
                                { q: 'Gradient descent', icon: '📉' },
                            ].map(s => (
                                <button
                                    key={s.q}
                                    onClick={() => handleSuggestion(s.q)}
                                    className="px-5 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-full text-[13px] font-bold text-slate-600 dark:text-dark-400 hover:border-synapse-400 dark:hover:border-synapse-500 hover:text-synapse-600 transition-all flex items-center gap-2 shadow-sm"
                                >
                                    <span>{s.icon}</span> {s.q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Chat messages */
                    <div className="max-w-[860px] mx-auto px-6 py-8 space-y-6">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                            >
                                {/* Cortex avatar — AI only */}
                                {msg.role === 'ai' && (
                                    <div className="w-9 h-9 rounded-2xl bg-synapse-600 flex items-center justify-center text-white shadow-sm flex-shrink-0 mr-3 mt-1">
                                        <Zap size={18} fill="white" />
                                    </div>
                                )}

                                <div className={msg.role === 'user' ? 'max-w-[75%]' : 'flex-1 min-w-0'}>
                                    {msg.role === 'user' ? (
                                        /* User bubble — right */
                                        <div className="bg-synapse-600 text-white px-5 py-3 rounded-3xl rounded-tr-lg text-[15px] font-semibold leading-relaxed shadow-sm">
                                            {msg.content}
                                        </div>
                                    ) : (
                                        /* AI bubble — left */
                                        <div className="space-y-4">
                                            <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl rounded-tl-lg px-6 py-5 shadow-sm">
                                                {msg.isStreaming && !msg.content ? (
                                                    <div className="flex items-center gap-2.5 text-synapse-600 dark:text-synapse-400 text-sm font-bold">
                                                        <div className="w-4 h-4 border-2 border-synapse-300 border-t-synapse-600 rounded-full animate-spin flex-shrink-0" />
                                                        <span>{SEARCH_STAGES[Math.min(Math.max(searchStage, 0), SEARCH_STAGES.length - 1)]}</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-[15px] font-medium leading-relaxed text-slate-700 dark:text-dark-100 whitespace-pre-wrap">
                                                        {msg.content}
                                                        {msg.isStreaming && (
                                                            <span className="inline-block w-2 h-[1.1em] bg-synapse-500 animate-pulse ml-1 align-middle rounded-sm" />
                                                        )}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Source cards */}
                                            {msg.results && msg.results.length > 0 && !msg.isStreaming && (
                                                <div className="space-y-3 pl-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-[0.3em] flex-shrink-0">Sources</span>
                                                        <div className="h-px flex-1 bg-slate-100 dark:bg-dark-800" />
                                                    </div>
                                                    {msg.results.map((result, idx) => (
                                                        <ResultCard
                                                            key={result.docId + '-' + result.rank}
                                                            result={result}
                                                            index={idx}
                                                            onToast={onToast}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* ── Input — pinned to bottom ──────────────────────────────────── */}
            <div className="flex-shrink-0 px-6 pb-6 pt-3 bg-white dark:bg-dark-950 border-t border-slate-100 dark:border-dark-800/60">
                <div className="max-w-[860px] mx-auto space-y-2">

                    {/* Active model badge */}
                    {selectedModel && (
                        <div className="flex items-center animate-fade-in">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl text-blue-700 dark:text-blue-300 text-[12px] font-bold shadow-sm">
                                <Zap size={11} className="text-blue-500" />
                                <span>{models.find(m => m.id === selectedModel)?.label ?? selectedModel}</span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedModel(null)}
                                    className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                                >
                                    <X size={11} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Input form */}
                    <form onSubmit={handleSearch} className="relative group">
                        <div className={`bg-white dark:bg-dark-900 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.28)] flex items-center gap-3 pl-2 pr-2 py-3 rounded-[28px] transition-all duration-300 border ${isSearching ? 'border-synapse-400 dark:border-synapse-500/50' : 'border-slate-200 dark:border-dark-800 group-hover:border-synapse-300 dark:group-hover:border-dark-700'}`}>

                            {/* Plus → model dropdown */}
                            <div className="relative flex-shrink-0" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowModelDropdown(prev => !prev)}
                                    className={`rounded-2xl w-12 h-12 flex items-center justify-center transition-colors ${showModelDropdown ? 'bg-synapse-100 dark:bg-synapse-900/30 text-synapse-600' : 'bg-slate-50 dark:bg-dark-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-700 hover:text-slate-600 dark:hover:text-dark-200'}`}
                                    title="Select model"
                                >
                                    <Plus size={22} />
                                </button>

                                {showModelDropdown && (
                                    <div className="absolute bottom-[58px] left-0 z-50 w-60 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                                        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-dark-800">
                                            <p className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-widest">
                                                {isInternetOnline ? 'Cloud Models' : 'Local Stream Models'}
                                            </p>
                                        </div>
                                        {models.map(model => (
                                            <button
                                                key={model.id}
                                                type="button"
                                                onClick={() => { setSelectedModel(model.id); setShowModelDropdown(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selectedModel === model.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-dark-800'}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedModel === model.id ? 'bg-blue-500' : 'bg-slate-200 dark:bg-dark-700'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[13px] font-bold truncate ${selectedModel === model.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-dark-200'}`}>
                                                        {model.label}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 dark:text-dark-500 truncate">{model.description}</p>
                                                </div>
                                                {selectedModel === model.id && <Check size={14} className="text-blue-500 flex-shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Ask anything about your study materials…"
                                className="flex-1 bg-transparent text-slate-800 dark:text-dark-50 placeholder-slate-400 dark:placeholder-dark-500 text-[16px] font-semibold outline-none px-2"
                                disabled={isSearching}
                            />

                            <button
                                type="submit"
                                disabled={!query.trim() || isSearching}
                                className={`w-12 h-12 flex flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${query.trim() && !isSearching ? 'bg-synapse-600 hover:bg-synapse-700 text-white shadow-lg shadow-synapse-200/40' : 'bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-dark-600 cursor-not-allowed'}`}
                            >
                                {isSearching ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <ArrowUpRight size={24} />
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useRef, useEffect } from 'react';
import ResultCard from './ResultCard';
import ChatPane from './ChatPane';

const SEARCH_STAGES = [
    'Embedding query...',
    'Searching vector space...',
    'Retrieving top matches...',
    'Constructing LLM prompt...',
    'Synthesizing answer...',
];

const SUGGESTION_GROUPS = [
    { label: 'Physics', items: ['What is entropy?', 'Quantum tunneling'] },
    { label: 'CS', items: ['Binary search tree', 'TCP handshake'] },
    { label: 'Math', items: ['Eigenvalues explained', 'Taylor series'] },
    { label: 'Chemistry', items: ['SN2 reaction mechanism'] },
    { label: 'ML', items: ['Gradient descent'] },
];

const ALL_SUGGESTIONS = SUGGESTION_GROUPS.flatMap((g) => g.items);

export default function SearchTab({ onToast, activeChatId, setActiveChatId }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMeta, setSearchMeta] = useState(null);
    const [searchStage, setSearchStage] = useState(-1);
    const [synthesized, setSynthesized] = useState(null);
    const [genStats, setGenStats] = useState(null);
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
        setGenStats(null);
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
                if (window.electronAPI.onSearchToken) {
                    window.electronAPI.onSearchToken((tokenText) => {
                        setSynthesized(tokenText);
                        setSearchStage(4); // Synthesizing
                    });
                }
                const [res] = await Promise.all([window.electronAPI.search(trimmed), minPause]);
                response = res;
                if (window.electronAPI.removeSearchTokenListener) {
                    window.electronAPI.removeSearchTokenListener();
                }
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
                    setSynthesized(r.synthesizedAnswer);
                    setGenStats(r.generationStats);
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
        /* ── Search-specific layout: content only ──────────────────────── */
        <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

            {/* Content area */}
            <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-app)' }}>

                {activeChatId ? (
                    <ChatPane chatId={activeChatId} onTitleUpdate={() => { }} />
                ) : (
                    /* ── Search content ── */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-app)' }}>
                        {/* ── Scrollable Results Area ─────────────────────────────────────────────────── */}
                        <div className="flex-1 overflow-y-auto" style={{ padding: '24px 28px' }}>
                            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100%', justifyContent: !hasResults && !isSearching ? 'center' : 'flex-start' }}>

                                {/* Empty state – only before first search */}
                                {!hasResults && !isSearching && (
                                    <div className="text-center animate-fade-in pb-20">
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '18px',
                                            background: 'var(--surface-recessed)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
                                            marginBottom: '20px', margin: '0 auto 20px'
                                        }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                                            </svg>
                                        </div>
                                        <h2
                                            className="text-[24px] font-semibold tracking-tight mb-2"
                                            style={{ color: 'var(--text-hero)', letterSpacing: '-0.02em' }}
                                        >
                                            What do you want to know?
                                        </h2>
                                        <p className="text-[14.5px]" style={{ color: 'var(--text-muted)' }}>
                                            Semantic search across your offline knowledge base.
                                        </p>
                                    </div>
                                )}

                                {/* User query message bubble */}
                                {hasResults && searchMeta && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                        <div style={{
                                            maxWidth: '75%',
                                            padding: '10px 16px',
                                            borderRadius: '16px',
                                            background: 'var(--surface-recessed)',
                                            color: 'var(--text-primary)',
                                            fontSize: '15px',
                                            lineHeight: 1.6,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                        }}>
                                            {searchMeta.query || query}
                                        </div>
                                    </div>
                                )}

                                {/* Searching Indicator */}
                                {isSearching && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, marginRight: '16px',
                                            background: 'var(--accent)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="3" />
                                                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                                            </svg>
                                        </div>
                                        <div style={{ padding: '6px 0', color: 'var(--text-secondary)', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div
                                                className="w-4 h-4 rounded-full border-2 animate-spin-slow flex-shrink-0"
                                                style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent)' }}
                                            />
                                            {SEARCH_STAGES[Math.min(Math.max(searchStage, 0), SEARCH_STAGES.length - 1)]}
                                        </div>
                                    </div>
                                )}

                                {/* AI Synthesis (Assistant message) */}
                                {synthesized !== null && results?.length > 0 && !isSearching && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px', animation: 'fadeIn 0.3s ease' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, marginRight: '16px', marginTop: '2px',
                                            background: 'var(--accent)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="3" />
                                                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                                            </svg>
                                        </div>
                                        <div style={{ maxWidth: '100%' }}>
                                            <p
                                                className="text-[15px] leading-relaxed whitespace-pre-wrap"
                                                style={{ color: 'var(--text-primary)', paddingTop: '6px' }}
                                            >
                                                {synthesized || 'Synthesizing...'}
                                            </p>

                                            {/* Results citations grid */}
                                            {results?.length > 0 && (
                                                <div className="mt-6 flex gap-2 overflow-x-auto pb-2" style={{ maxWidth: '100%' }}>
                                                    {results.map((result, idx) => (
                                                        <ResultCard key={result.docId + '-' + result.rank} result={result} index={idx} onToast={onToast} />
                                                    ))}
                                                </div>
                                            )}

                                            {/* Search Meta */}
                                            {searchMeta && (
                                                <div className="flex items-center gap-3 text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
                                                    <span>{searchMeta.time}ms search time</span>
                                                    <span>·</span>
                                                    <span>{searchMeta.total} vectors deep</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* No results */}
                                {results !== null && results.length === 0 && !isSearching && (
                                    <div className="text-center py-16 animate-fade-in">
                                        <p className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No relevant documents found</p>
                                        <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>Try adjusting your keywords.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Input bar (Fixed Bottom) ─────────────────────────────────────────────────── */}
                        <div style={{
                            flexShrink: 0,
                            padding: '12px 0 24px',
                            background: 'var(--surface-app)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: '100%'
                        }}>
                            <form onSubmit={handleSubmit} className="w-full max-w-[800px] px-6">
                                <div style={{
                                    display: 'flex', gap: '10px', alignItems: 'flex-end',
                                    background: 'var(--surface-card)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '24px',
                                    padding: '8px 8px 8px 16px',
                                    boxShadow: 'var(--shadow-md)',
                                    transition: 'border-color 150ms, box-shadow 150ms',
                                    width: '100%',
                                }}
                                    onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                                    onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                                >
                                    <textarea
                                        ref={inputRef}
                                        value={query}
                                        onChange={(e) => { setQuery(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'; }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSearch(query); } }}
                                        placeholder="Search your knowledge base..."
                                        rows={1}
                                        disabled={isSearching}
                                        style={{
                                            flex: 1, resize: 'none', border: 'none', outline: 'none',
                                            background: 'transparent', fontSize: '15.5px',
                                            color: 'var(--text-primary)', lineHeight: 1.5,
                                            minHeight: '24px', maxHeight: '200px', overflow: 'auto',
                                            fontFamily: 'inherit',
                                            paddingTop: '2px',
                                            paddingBottom: '2px'
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!query.trim() || isSearching}
                                        style={{
                                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                            background: query.trim() && !isSearching ? 'var(--accent)' : 'var(--surface-recessed)',
                                            color: query.trim() && !isSearching ? '#fff' : 'var(--text-placeholder)',
                                            border: 'none', cursor: query.trim() && !isSearching ? 'pointer' : 'default',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 150ms ease',
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                        </svg>
                                    </button>
                                </div>
                            </form>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                                Cortex provides offline intelligent search over your documents.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

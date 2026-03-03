import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ── Icons ───────────────────────────────────────────────────────────────── */
const IconSend = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const IconBot = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
);

/* ── Message bubble ──────────────────────────────────────────────────────── */
function Bubble({ msg }) {
    const isUser = msg.role === 'user';
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                marginBottom: '24px',
            }}
        >
            {!isUser && (
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, marginRight: '16px', marginTop: '2px',
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                    <IconBot />
                </div>
            )}
            <div style={{
                maxWidth: '75%',
                padding: isUser ? '10px 16px' : '6px 0',
                borderRadius: isUser ? '16px' : '0',
                background: isUser ? 'var(--surface-recessed)' : 'transparent',
                color: 'var(--text-primary)',
                fontSize: '15px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {msg.content}
            </div>
        </div>
    );
}

/* ── Typing indicator ────────────────────────────────────────────────────── */
function TypingIndicator() {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, marginRight: '16px',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
                <IconBot />
            </div>
            <div style={{
                padding: '12px 0',
                display: 'flex', gap: '4px', alignItems: 'center',
            }}>
                {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: 'var(--text-muted)',
                        animation: `bounce 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                ))}
            </div>
        </div>
    );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState() {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', textAlign: 'center' }}>
            <div style={{
                width: '56px', height: '56px', borderRadius: '18px',
                background: 'var(--surface-recessed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
                marginBottom: '20px',
            }}>
                <IconBot />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
                Offline AI Ready
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '280px' }}>
                Select a chat from the sidebar or click <strong>New Chat</strong> to begin.
            </p>
        </div>
    );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function ChatPane({ chatId, onTitleUpdate }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [typing, setTyping] = useState(false);
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);

    const loadMessages = useCallback(async () => {
        if (!chatId || !window.electronAPI) return;
        setLoading(true);
        const res = await window.electronAPI.getChatMessages(chatId);
        setMessages(res.messages || []);
        setLoading(false);
    }, [chatId]);

    useEffect(() => {
        setMessages([]);
        setInput('');
        loadMessages();
    }, [chatId, loadMessages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || !chatId) return;

        // Optimistic user message
        const userMsg = { id: `temp-${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() };
        setMessages((m) => [...m, userMsg]);
        setInput('');
        textareaRef.current?.focus();

        // Auto-title on first message
        if (messages.length === 0) {
            const title = text.split(/\s+/).slice(0, 6).join(' ') + (text.split(/\s+/).length > 6 ? '…' : '');
            if (window.electronAPI) {
                // We don't have updateChatTitle in preload yet — handled gracefully
                onTitleUpdate?.(chatId, title);
            }
        }

        // Persist user message
        if (window.electronAPI) {
            await window.electronAPI.addChatMessage(chatId, 'user', text);
        }

        // Show typing indicator
        setTyping(true);

        // Try RAG search for context, then generate placeholder reply
        let assistantReply = "I'm your offline AI assistant. Upload PDFs and run searches to give me knowledge to draw from.";
        try {
            if (window.electronAPI) {
                const searchRes = await window.electronAPI.search(text);
                if (searchRes?.results?.length > 0) {
                    const topSnippet = searchRes.results[0].content?.slice(0, 300) || '';
                    assistantReply = topSnippet
                        ? `Based on your knowledge base:\n\n"${topSnippet}…"\n\n— From: ${searchRes.results[0].title}`
                        : assistantReply;
                }
            }
        } catch { /* ignore */ }

        // Simulate natural response delay
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
        setTyping(false);

        const aiMsg = { id: `ai-${Date.now()}`, role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() };
        setMessages((m) => [...m, aiMsg]);

        if (window.electronAPI) {
            await window.electronAPI.addChatMessage(chatId, 'assistant', assistantReply);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!chatId) return <EmptyState />;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-app)', minWidth: 0 }}>
            {/* Bounce animation */}
            <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                {loading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', paddingTop: '48px' }}>Loading…</div>
                )}
                {!loading && messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', paddingTop: '48px' }}>
                        Start the conversation below ↓
                    </div>
                )}
                {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}
                {typing && <TypingIndicator />}
                <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{
                flexShrink: 0,
                padding: '12px 0 24px',
                background: 'var(--surface-app)',
                display: 'flex',
                justifyContent: 'center',
                width: '100%'
            }}>
                <div style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-end',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '24px',
                    padding: '8px 8px 8px 16px',
                    boxShadow: 'var(--shadow-md)',
                    transition: 'border-color 150ms, box-shadow 150ms',
                    width: '100%',
                    maxWidth: '800px'
                }}
                    onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                    onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                >
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'; }}
                        onKeyDown={handleKeyDown}
                        placeholder="Message Assistant…"
                        rows={1}
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
                        onClick={handleSend}
                        disabled={!input.trim() || typing}
                        style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            background: input.trim() && !typing ? 'var(--accent)' : 'var(--surface-recessed)',
                            color: input.trim() && !typing ? '#fff' : 'var(--text-placeholder)',
                            border: 'none', cursor: input.trim() && !typing ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 150ms ease',
                        }}
                    >
                        <IconSend />
                    </button>
                </div>
            </div>
        </div>
    );
}

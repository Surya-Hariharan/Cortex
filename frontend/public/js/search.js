import api from './api.js';

const SUGGESTIONS = ['What is entropy?', 'Quantum tunneling', 'Binary search tree', 'TCP handshake', 'Eigenvalues explained', 'Taylor series', 'SN2 reaction mechanism', 'Gradient descent'];
const STAGES = ['Embedding query...', 'Searching vector space...', 'Retrieving top matches...', 'Constructing LLM prompt...', 'Synthesizing answer...'];

let chatState = { activeChatId: null, projects: [], chats: [] };
let searchState = { results: null, searching: false };
let container = null, toastFn = null;

// ── Render ───────────────────────────────────────────────────────────────────
export function renderSearch(el, onToast) {
    container = el; toastFn = onToast;
    el.innerHTML = `
    <div class="search-layout">
        <aside id="chat-sidebar" class="search-sidebar">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 12px 10px;flex-shrink:0;gap:8px">
                <button id="sidebar-toggle" style="width:32px;height:32px;border-radius:8px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button id="new-chat-btn" style="flex:1;padding:7px 14px;background:linear-gradient(135deg,#6366f1 0%,#4338ca 100%);color:#fff;font-weight:600;font-size:12.5px;border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 8px rgba(99,102,241,0.28);font-family:inherit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Chat
                </button>
            </div>
            <div style="padding:0 12px 10px;flex-shrink:0">
                <div style="display:flex;align-items:center;gap:8px;background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:10px;padding:7px 10px">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="chat-search" placeholder="Search chats…" style="flex:1;background:none;border:none;outline:none;font-size:12.5px;color:var(--text-primary);font-family:inherit">
                </div>
            </div>
            <div id="chat-list" style="flex:1;overflow-y:auto;padding:0 6px 16px;display:flex;flex-direction:column;gap:4px">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.10em;color:var(--text-muted);text-transform:uppercase;padding:0 6px 4px">Your Chats</div>
                <p style="font-size:11.5px;color:var(--text-muted);padding:4px 10px">No chats yet.</p>
            </div>
        </aside>
        <div class="search-content">
            <div id="search-area" class="search-center">
                <div id="search-inner" class="search-inner no-results">
                    <div id="search-hero" class="animate-fade-in" style="text-align:center;margin-bottom:24px;padding:0 24px">
                        <h2 style="font-size:26px;font-weight:700;letter-spacing:-0.025em;line-height:1.2;color:var(--text-hero);margin-bottom:6px">Search your knowledge</h2>
                        <p style="font-size:14px;line-height:1.6;color:var(--text-muted);max-width:360px;margin:0 auto">Semantic AI search across all your uploaded documents — fully offline.</p>
                    </div>
                    <form id="search-form" style="width:100%;max-width:680px;padding:0 20px">
                        <div id="search-bar" class="search-bar-wrap">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            <input id="search-input" type="text" placeholder="Ask anything — e.g. second law of thermodynamics" style="flex:1;background:transparent;outline:none;border:none;font-size:14.5px;font-weight:500;color:var(--text-primary);caret-color:var(--accent);font-family:inherit">
                            <div style="width:1px;height:16px;flex-shrink:0;background:var(--border-subtle)"></div>
                            <button type="submit" id="search-submit" class="btn-primary" style="flex-shrink:0;font-size:12.5px;padding:5px 14px" disabled>Search</button>
                        </div>
                    </form>
                    <div id="search-meta" style="height:24px;display:flex;align-items:center;margin-top:8px"></div>
                </div>
                <div id="results-area" class="results-area" style="display:none">
                    <div id="synthesis-card"></div>
                    <div id="results-list" class="results-list"></div>
                </div>
                <div id="suggestions" class="animate-fade-in" style="max-width:680px;margin:0 auto;padding-top:8px">
                    <p style="font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;text-align:center;margin-bottom:12px;color:var(--text-muted)">Try asking</p>
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px" id="chips"></div>
                </div>
            </div>
        </div>
    </div>`;

    // Render chips
    const chipsEl = el.querySelector('#chips');
    SUGGESTIONS.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.textContent = s;
        btn.onclick = () => { el.querySelector('#search-input').value = s; doSearch(s); };
        chipsEl.appendChild(btn);
    });

    // Wire events
    const input = el.querySelector('#search-input');
    const form = el.querySelector('#search-form');
    const submit = el.querySelector('#search-submit');
    input.addEventListener('input', () => { submit.disabled = !input.value.trim(); });
    input.addEventListener('focus', () => el.querySelector('#search-bar').classList.add('focused'));
    input.addEventListener('blur', () => el.querySelector('#search-bar').classList.remove('focused'));
    form.addEventListener('submit', e => { e.preventDefault(); doSearch(input.value); });
    input.focus();

    // Load chats
    loadChats();
    el.querySelector('#new-chat-btn').addEventListener('click', () => createNewChat());
}

async function loadChats() {
    try {
        const [pr, ch] = await Promise.all([api.getProjects(), api.getChats()]);
        chatState.projects = pr.projects || [];
        chatState.chats = ch.chats || [];
        renderChatList();
    } catch { }
}

function renderChatList() {
    const list = container?.querySelector('#chat-list');
    if (!list) return;
    const chats = chatState.chats;
    if (chats.length === 0) {
        list.innerHTML = '<div style="font-size:10px;font-weight:700;letter-spacing:0.10em;color:var(--text-muted);text-transform:uppercase;padding:0 6px 4px">Your Chats</div><p style="font-size:11.5px;color:var(--text-muted);padding:4px 10px">No chats yet.</p>';
        return;
    }
    list.innerHTML = '<div style="font-size:10px;font-weight:700;letter-spacing:0.10em;color:var(--text-muted);text-transform:uppercase;padding:0 6px 4px">Your Chats</div>';
    chats.forEach(c => {
        const active = c.id === chatState.activeChatId;
        const btn = document.createElement('button');
        btn.style.cssText = `display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:10px;text-align:left;background:${active ? 'var(--accent-light)' : 'transparent'};border:${active ? '1px solid var(--accent-border)' : '1px solid transparent'};color:${active ? 'var(--accent)' : 'var(--text-secondary)'};font-size:12.5px;cursor:pointer;transition:all 120ms;font-family:inherit`;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.55"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:${active ? 600 : 400}">${c.title}</span>`;
        btn.onclick = () => selectChat(c.id);
        list.appendChild(btn);
    });
}

async function createNewChat() {
    try {
        const res = await api.createChat(null);
        if (res.success) { await loadChats(); selectChat(res.chat.id); }
    } catch { }
}

function selectChat(id) {
    chatState.activeChatId = id;
    renderChatList();
    renderChatPane(id);
}

async function renderChatPane(chatId) {
    const area = container?.querySelector('.search-content');
    if (!area) return;
    area.innerHTML = `<div class="chat-pane">
        <div class="chat-messages" id="chat-msgs"><div style="text-align:center;color:var(--text-muted);font-size:12px;padding-top:48px">Loading…</div></div>
        <div class="chat-input-bar"><div class="chat-input-wrap" id="chat-wrap">
            <textarea id="chat-input" rows="1" placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"></textarea>
            <button id="chat-send" class="chat-send-btn inactive"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </div><p style="font-size:10.5px;color:var(--text-muted);margin-top:6px;text-align:center">Offline AI · answers draw from your uploaded PDFs</p></div>
    </div>`;

    const msgs = area.querySelector('#chat-msgs');
    const input = area.querySelector('#chat-input');
    const sendBtn = area.querySelector('#chat-send');
    const wrap = area.querySelector('#chat-wrap');

    // Load messages
    try {
        const res = await api.getChatMessages(chatId);
        const messages = res.messages || [];
        if (messages.length === 0) {
            msgs.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding-top:48px">Start the conversation below ↓</div>';
        } else {
            msgs.innerHTML = '';
            messages.forEach(m => appendBubble(msgs, m));
            msgs.scrollTop = msgs.scrollHeight;
        }
    } catch { msgs.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding-top:48px">Start the conversation below ↓</div>'; }

    // Events
    input.addEventListener('input', () => {
        sendBtn.className = `chat-send-btn ${input.value.trim() ? 'active' : 'inactive'}`;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    input.addEventListener('focus', () => wrap.classList.add('focused'));
    input.addEventListener('blur', () => wrap.classList.remove('focused'));
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatId, input, msgs, sendBtn); } });
    sendBtn.addEventListener('click', () => sendMessage(chatId, input, msgs, sendBtn));
}

async function sendMessage(chatId, input, msgs, sendBtn) {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.className = 'chat-send-btn inactive';

    appendBubble(msgs, { role: 'user', content: text });
    msgs.scrollTop = msgs.scrollHeight;

    await api.addChatMessage(chatId, 'user', text);

    // Show typing
    const typing = document.createElement('div');
    typing.className = 'bubble-ai';
    typing.innerHTML = `<div class="bubble-avatar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg></div><div style="padding:12px 14px;border-radius:16px 16px 16px 4px;background:var(--surface-card);border:1px solid var(--border-subtle);display:flex;gap:4px;align-items:center">${[0, 1, 2].map(i => `<div style="width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:0.7;animation:bounce 1.2s ease ${i * 0.2}s infinite"></div>`).join('')}</div>`;
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    let reply = "I'm your offline AI assistant. Upload PDFs and run searches to give me knowledge.";
    try {
        const r = await api.searchSimple(text);
        if (r?.results?.results?.length > 0) {
            const top = r.results.results[0];
            reply = `Based on your knowledge base:\n\n"${(top.content || '').slice(0, 300)}…"\n\n— From: ${top.title}`;
        }
    } catch { }

    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
    typing.remove();
    appendBubble(msgs, { role: 'assistant', content: reply });
    msgs.scrollTop = msgs.scrollHeight;
    await api.addChatMessage(chatId, 'assistant', reply);
}

function appendBubble(el, msg) {
    const div = document.createElement('div');
    div.className = msg.role === 'user' ? 'bubble-user' : 'bubble-ai';
    if (msg.role === 'assistant') {
        div.innerHTML = `<div class="bubble-avatar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg></div><div class="bubble-msg assistant">${escHtml(msg.content)}</div>`;
    } else {
        div.innerHTML = `<div class="bubble-msg user">${escHtml(msg.content)}</div>`;
    }
    el.appendChild(div);
}

function escHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// ── Search ───────────────────────────────────────────────────────────────────
async function doSearch(query) {
    const q = query.trim();
    if (!q || searchState.searching) return;
    searchState.searching = true;

    const hero = container.querySelector('#search-hero');
    const suggestions = container.querySelector('#suggestions');
    const inner = container.querySelector('#search-inner');
    const meta = container.querySelector('#search-meta');
    const resultsArea = container.querySelector('#results-area');
    const resultsList = container.querySelector('#results-list');
    const synthCard = container.querySelector('#synthesis-card');

    if (hero) hero.style.display = 'none';
    if (suggestions) suggestions.style.display = 'none';
    inner.className = 'search-inner has-results';
    meta.innerHTML = `<div class="animate-fade-in" style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--accent)"><div style="width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(99,102,241,0.2);border-top-color:var(--accent)" class="animate-spin-slow"></div><span id="stage-text">Embedding query...</span></div>`;

    let stageIdx = 0;
    const stageInterval = setInterval(() => {
        stageIdx = Math.min(stageIdx + 1, STAGES.length - 1);
        const st = container.querySelector('#stage-text');
        if (st) st.textContent = STAGES[stageIdx];
    }, 170);

    try {
        const res = await api.search(q, (tokenText) => {
            const st = container.querySelector('#stage-text');
            if (st) st.textContent = 'Synthesizing answer...';
        });
        clearInterval(stageInterval);

        const results = res?.results?.results || res?.results || [];
        const searchTime = res?.results?.searchTimeMs || 0;
        const totalDocs = res?.results?.totalDocuments || 0;
        const synth = res?.results?.synthesizedAnswer || null;

        meta.innerHTML = results.length > 0
            ? `<div class="animate-fade-in" style="display:flex;align-items:center;gap:12px;font-size:11.5px;color:var(--text-muted)"><span><strong style="color:var(--text-secondary)">${results.length}</strong> results</span><span>·</span><span class="metric-mono" style="color:var(--accent)">${searchTime}ms</span><span>·</span><span><strong style="color:var(--text-secondary)">${totalDocs}</strong> vectors</span></div>`
            : '';

        resultsArea.style.display = 'block';
        synthCard.innerHTML = '';
        resultsList.innerHTML = '';

        // Synthesis
        if (synth && results.length > 0) {
            synthCard.innerHTML = `<div class="synthesis-card animate-scale-in"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;background:var(--accent-light)">✦</div><span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--accent)">AI Synthesis</span><span style="font-size:10px;margin-left:auto;color:var(--text-muted)">from top ${Math.min(results.length, 3)} passages</span></div><p style="font-size:13.5px;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap" class="typewriter-cursor">${escHtml(synth)}</p></div>`;
        }

        // Result cards
        if (results.length === 0) {
            resultsList.innerHTML = '<div class="animate-fade-in" style="text-align:center;padding:64px 0"><div style="font-size:36px;margin-bottom:12px">🔎</div><p style="font-size:14px;font-weight:500;color:var(--text-secondary);margin-bottom:4px">No results found</p><p style="font-size:12.5px;color:var(--text-muted)">Try a different query or upload more documents.</p></div>';
        } else {
            results.forEach((r, i) => renderResultCard(resultsList, r, i));
        }
    } catch (err) {
        clearInterval(stageInterval);
        toastFn?.('Search failed: ' + err.message, 'error');
    }
    searchState.searching = false;
}

function renderResultCard(list, result, idx) {
    const COLORS = { 'Thermodynamics': { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' }, 'Data Structures': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' }, 'Linear Algebra': { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' }, 'Organic Chemistry': { bg: '#fffbeb', text: '#92400e', border: '#fde68a' }, 'Machine Learning': { bg: '#ecfeff', text: '#155e75', border: '#a5f3fc' }, 'Quantum Mechanics': { bg: '#fdf4ff', text: '#7e22ce', border: '#f0abfc' } };
    const c = COLORS[result.subject] || { bg: '#f8fafc', text: '#334155', border: '#e2e8f0' };
    const pct = result.relevancePercent || Math.round((result.score || 0) * 100);
    const sColor = pct >= 80 ? '#166534' : pct >= 60 ? '#3730a3' : '#92400e';
    const sGrad = pct >= 80 ? 'linear-gradient(90deg,#34d399,#10b981)' : pct >= 60 ? 'linear-gradient(90deg,#a5b4fc,#6366f1)' : 'linear-gradient(90deg,#fde68a,#f59e0b)';

    const card = document.createElement('div');
    card.className = `result-card animate-slide-up stagger-${Math.min(idx + 1, 5)}`;
    card.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">
                <div style="flex-shrink:0;width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:var(--surface-recessed);color:var(--text-muted)">${result.rank || idx + 1}</div>
                <div style="min-width:0;flex:1">
                    <h3 style="font-size:13.5px;font-weight:600;color:var(--text-primary);letter-spacing:-0.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${escHtml(result.title || '')}</h3>
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="display:inline-flex;align-items:center;padding:1px 8px;font-size:10px;font-weight:600;border-radius:4px;border:1px solid ${c.border};background:${c.bg};color:${c.text}">${escHtml(result.subject || '')}</span>
                        <span style="font-size:10.5px;color:var(--text-muted)">Chunk ${(result.chunkIndex || 0) + 1}</span>
                    </div>
                </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
                <div class="metric-mono" style="font-size:17px;font-weight:700;color:${sColor};line-height:1">${pct}%</div>
                <div style="width:56px;height:6px;border-radius:9999px;margin-top:6px;overflow:hidden;background:var(--surface-recessed)"><div class="score-bar" style="width:${pct}%;background:${sGrad}"></div></div>
            </div>
        </div>
        <p class="line-clamp-3" style="font-size:13px;line-height:1.6;color:var(--text-secondary)">${escHtml(result.content || '')}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle)">
            <span class="metric-mono" style="font-size:10.5px;color:var(--text-muted)">${(result.score || 0).toFixed(3)}</span>
            <button class="btn-ghost" style="font-size:12px;padding:4px 10px" onclick="this.textContent='✓ Shared!';this.disabled=true;setTimeout(()=>{this.textContent='Share to Network';this.disabled=false},3000)">Share to Network</button>
        </div>`;
    list.appendChild(card);
}

export function destroySearch() { container = null; toastFn = null; searchState = { results: null, searching: false }; chatState.activeChatId = null; }

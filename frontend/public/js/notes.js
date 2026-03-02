import api from './api.js';

const TYPE_CONFIG = {
    note: { icon: '📝', label: 'Note', bg: '#eef2ff', text: '#3730a3', border: '#c7d2fe' },
    deadline: { icon: '⏰', label: 'Deadline', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
    task: { icon: '✅', label: 'Task', bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    idea: { icon: '💡', label: 'Idea', bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
};

let container = null, toastFn = null, notes = [], filter = 'all';

function escHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function getDueStatus(dueDate) {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: '#991b1b', urgent: true };
    if (diff === 0) return { label: 'Due today', color: '#92400e', urgent: true };
    if (diff === 1) return { label: 'Due tomorrow', color: '#92400e', urgent: false };
    if (diff <= 7) return { label: `Due in ${diff}d`, color: '#3730a3', urgent: false };
    return { label: `Due ${new Date(dueDate).toLocaleDateString()}`, color: 'var(--text-muted)', urgent: false };
}

export function renderNotes(el, onToast) {
    container = el; toastFn = onToast;
    el.innerHTML = `<div class="notes-layout" id="notes-root">
        <div class="notes-header" id="notes-header"></div>
        <div id="notes-form-area"></div>
        <div class="notes-list" id="notes-list"></div>
        <div style="padding:0 20px 12px"><div style="padding:6px 12px;border-radius:8px;text-align:center;background:var(--surface-sidebar);border:1px solid var(--border-subtle)"><p style="font-size:10px;font-weight:500;color:var(--text-muted)">🔒 Encrypted at rest · AES-256-GCM</p></div></div>
    </div>`;
    loadNotes();
}

async function loadNotes() {
    try {
        const res = await api.getNotes();
        notes = res.notes || [];
    } catch { notes = []; }
    renderHeader();
    renderList();
}

function renderHeader() {
    const h = container.querySelector('#notes-header');
    if (!h) return;
    const completed = notes.filter(n => n.completed).length;
    const urgent = notes.filter(n => n.type === 'deadline' && !n.completed && n.dueDate && Math.ceil((new Date(n.dueDate) - new Date()) / 86400000) <= 1).length;
    const FILTERS = [
        { id: 'all', icon: '📋', label: 'All', count: notes.length },
        ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, icon: c.icon, label: c.label, count: notes.filter(n => n.type === id).length })),
    ];

    h.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;min-width:0;flex-shrink:1">
            <div style="flex-shrink:0">
                <h2 style="font-size:17px;font-weight:700;letter-spacing:-0.025em;line-height:1;color:var(--text-hero)">Notes &amp; Deadlines</h2>
                <p style="font-size:11.5px;margin-top:3px;white-space:nowrap;color:var(--text-muted)">${notes.length} items · ${completed} completed${urgent > 0 ? ` · <span style="color:#991b1b">${urgent} urgent</span>` : ''}</p>
            </div>
            <div style="width:1px;height:28px;flex-shrink:0;background:var(--border-subtle)"></div>
            <div class="notes-filters" id="notes-filters"></div>
        </div>
        <button id="add-note-btn" class="btn-primary" style="padding:6px 14px;font-size:12px;display:flex;align-items:center;gap:6px;flex-shrink:0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add
        </button>`;

    const filtersEl = h.querySelector('#notes-filters');
    FILTERS.forEach(f => {
        const btn = document.createElement('button');
        btn.className = `filter-btn${filter === f.id ? ' active' : ''}`;
        btn.innerHTML = `<span style="font-size:14px;line-height:1">${f.icon}</span><span>${f.label}</span>${f.count > 0 ? `<span class="filter-count" style="background:${filter === f.id ? 'var(--accent)' : 'rgba(0,0,0,0.08)'};color:${filter === f.id ? '#fff' : 'var(--text-muted)'}">${f.count}</span>` : ''}`;
        btn.onclick = () => { filter = f.id; renderHeader(); renderList(); };
        filtersEl.appendChild(btn);
    });

    h.querySelector('#add-note-btn').onclick = toggleForm;
}

let showForm = false;
function toggleForm() {
    showForm = !showForm;
    const area = container.querySelector('#notes-form-area');
    if (!showForm) { area.innerHTML = ''; return; }
    area.innerHTML = `<div style="padding:12px 20px 4px;background:var(--surface-sidebar)" class="animate-slide-down">
        <form id="note-form" class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;gap:10px">
                <input id="note-title" type="text" placeholder="Title…" class="input-base" style="flex:1;font-size:13.5px">
                <select id="note-type" class="input-base" style="width:auto;padding-right:28px;font-size:13px">
                    ${Object.entries(TYPE_CONFIG).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
                </select>
            </div>
            <textarea id="note-content" placeholder="Details (optional)…" rows="2" class="input-base" style="resize:none;font-size:13px"></textarea>
            <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:8px"><span style="font-size:11.5px;font-weight:500;color:var(--text-muted)">Due:</span><input id="note-due" type="date" class="input-base" style="width:auto;font-size:12.5px;padding:4px 8px"></div>
                <div style="display:flex;gap:8px"><button type="button" id="note-cancel" class="btn-ghost" style="font-size:12px;padding:6px 12px">Cancel</button><button type="submit" id="note-save" class="btn-primary" style="font-size:12px;padding:6px 16px" disabled>Save</button></div>
            </div>
        </form>
    </div>`;
    const titleInput = area.querySelector('#note-title');
    titleInput.focus();
    titleInput.addEventListener('input', () => { area.querySelector('#note-save').disabled = !titleInput.value.trim(); });
    area.querySelector('#note-cancel').onclick = () => { showForm = false; area.innerHTML = ''; };
    area.querySelector('#note-form').onsubmit = async (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        if (!title) return;
        try {
            const r = await api.addNote({ title, content: area.querySelector('#note-content').value.trim(), type: area.querySelector('#note-type').value, dueDate: area.querySelector('#note-due').value || null });
            if (r.success) { toastFn?.(`Added: "${title}"`); showForm = false; area.innerHTML = ''; loadNotes(); }
        } catch { }
    };
}

function renderList() {
    const list = container.querySelector('#notes-list');
    if (!list) return;
    const filtered = notes.filter(n => filter === 'all' || n.type === filter);

    if (filtered.length === 0) {
        list.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%" class="animate-fade-in"><div style="text-align:center;padding:40px 32px;border-radius:16px;max-width:280px;width:100%;background:var(--surface-card);border:1px solid var(--border-subtle);box-shadow:var(--shadow-md)"><div style="font-size:36px;margin-bottom:12px">${filter === 'all' ? '📋' : TYPE_CONFIG[filter]?.icon || '📝'}</div><p style="font-size:14px;font-weight:600;margin-bottom:4px;color:var(--text-primary)">${notes.length === 0 ? 'Nothing here yet' : `No ${filter} items`}</p><p style="font-size:12px;line-height:1.6;color:var(--text-muted)">${notes.length === 0 ? 'Click "Add" to create a note, task, or deadline.' : `Switch to "All" or add a new ${filter}.`}</p></div></div>`;
        return;
    }

    list.innerHTML = '';
    filtered.forEach((note, idx) => {
        const cfg = TYPE_CONFIG[note.type] || TYPE_CONFIG.note;
        const due = getDueStatus(note.dueDate);
        const card = document.createElement('div');
        card.className = `note-card animate-slide-up stagger-${Math.min(idx + 1, 5)}`;
        card.style.opacity = note.completed ? '0.5' : '1';
        card.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:12px">
                <button class="note-checkbox ${note.completed ? 'checked' : ''}" data-id="${note.id}">
                    ${note.completed ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                </button>
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:2px">
                        <h3 style="font-size:13px;font-weight:600;color:var(--text-primary);text-decoration:${note.completed ? 'line-through' : 'none'};letter-spacing:-0.01em">${escHtml(note.title)}</h3>
                        <span style="display:inline-flex;align-items:center;gap:4px;padding:1px 8px;font-size:10px;font-weight:600;border-radius:4px;border:1px solid ${cfg.border};background:${cfg.bg};color:${cfg.text}">${cfg.icon} ${cfg.label}</span>
                    </div>
                    ${note.content ? `<p class="line-clamp-2" style="font-size:12px;line-height:1.6;margin-bottom:6px;color:var(--text-secondary)">${escHtml(note.content)}</p>` : ''}
                    <div style="display:flex;align-items:center;gap:12px;font-size:10.5px">
                        ${due ? `<span style="font-weight:600;color:${due.color}">${due.urgent ? '⚠ ' : ''}${due.label}</span>` : ''}
                        <span style="color:var(--text-muted)">${new Date(note.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <button class="del-note-btn" data-id="${note.id}" style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:4px;border:none;background:transparent;cursor:pointer;color:var(--text-muted)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`;
        card.querySelector('.note-checkbox').onclick = async () => { await api.toggleNoteComplete(note.id); loadNotes(); };
        const delBtn = card.querySelector('.del-note-btn');
        delBtn.onmouseenter = () => { delBtn.style.color = '#ef4444'; };
        delBtn.onmouseleave = () => { delBtn.style.color = 'var(--text-muted)'; };
        delBtn.onclick = async () => { await api.deleteNote(note.id); loadNotes(); };
        list.appendChild(card);
    });
}

export function destroyNotes() { container = null; toastFn = null; notes = []; filter = 'all'; showForm = false; }

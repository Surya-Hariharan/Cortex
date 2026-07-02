import React, { useState, useRef, useEffect } from 'react';
import {
    Folder, Plus, Mic, ChevronDown, Upload, FileText,
    Bookmark, Trash2, MoreHorizontal, Search, Settings,
    ArrowUp, Pencil, X, Info
} from 'lucide-react';

const SORT_OPTIONS = ['Newest', 'Oldest'];
const TYPE_OPTIONS = ['All', 'Files', 'Saves'];

// Deterministic pastel color from project title
const PROJECT_COLORS = [
    { bg: 'bg-blue-100 dark:bg-blue-900/30',    icon: 'text-blue-500'   },
    { bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-500' },
    { bg: 'bg-emerald-100 dark:bg-emerald-900/30',icon: 'text-emerald-500'},
    { bg: 'bg-amber-100 dark:bg-amber-900/30',   icon: 'text-amber-500'  },
    { bg: 'bg-rose-100 dark:bg-rose-900/30',     icon: 'text-rose-500'   },
    { bg: 'bg-cyan-100 dark:bg-cyan-900/30',     icon: 'text-cyan-500'   },
];
function projectColor(title = '') {
    const idx = title.charCodeAt(0) % PROJECT_COLORS.length;
    return PROJECT_COLORS[idx];
}

export default function ProjectView({ project, onNewChat, onToast, onDeleteProject, onRenameProject }) {
    const [activeTab,   setActiveTab]   = useState('chats');
    const [sortBy,      setSortBy]      = useState('Newest');
    const [typeFilter,  setTypeFilter]  = useState('All');
    const [showSort,    setShowSort]    = useState(false);
    const [showType,    setShowType]    = useState(false);
    const [showMenu,    setShowMenu]    = useState(false);
    const [sources,     setSources]     = useState(project.sources || []);
    const [newChatText, setNewChatText] = useState('');
    const [isRenaming,  setIsRenaming]  = useState(false);
    const [renameVal,   setRenameVal]   = useState(project.title);
    const fileInputRef  = useRef(null);
    const menuRef       = useRef(null);
    const renameRef     = useRef(null);
    const color = projectColor(project.title);

    // Close dropdowns on outside click
    useEffect(() => {
        const fn = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, []);

    useEffect(() => {
        if (isRenaming) renameRef.current?.focus();
    }, [isRenaming]);

    const sortedChats = [...(project.chats || [])].sort((a, b) =>
        sortBy === 'Newest' ? (b.ts || 0) - (a.ts || 0) : (a.ts || 0) - (b.ts || 0)
    );
    const filteredSources = sources.filter(s => {
        if (typeFilter === 'Files') return s.type === 'file';
        if (typeFilter === 'Saves') return s.type === 'save';
        return true;
    }).sort((a, b) => sortBy === 'Newest' ? (b.ts || 0) - (a.ts || 0) : (a.ts || 0) - (b.ts || 0));

    const handleAddFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSources(prev => [{
            id: `src-${Date.now()}`, name: file.name, type: 'file',
            size: (file.size / 1024).toFixed(1) + ' KB', ts: Date.now(),
        }, ...prev]);
        onToast?.(`Added "${file.name}" to sources`, 'success');
        e.target.value = '';
    };

    const handleNewChat = () => {
        onNewChat?.(project.id, newChatText.trim());
        setNewChatText('');
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 overflow-hidden">
            {/* Session-only notice */}
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-medium flex-shrink-0">
                <Info size={13} className="flex-shrink-0" />
                Projects are local to this session — chat and file sync will be available in a future release.
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-2xl mx-auto px-6 pt-12 pb-10">

                    {/* ── Header ────────────────────────────────────────── */}
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                                <Folder size={22} className={color.icon} />
                            </div>
                            {isRenaming ? (
                                <input
                                    ref={renameRef}
                                    value={renameVal}
                                    onChange={e => setRenameVal(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            onRenameProject?.(project.id, renameVal);
                                            setIsRenaming(false);
                                            onToast?.('Project renamed', 'success');
                                        }
                                        if (e.key === 'Escape') { setRenameVal(project.title); setIsRenaming(false); }
                                    }}
                                    onBlur={() => setIsRenaming(false)}
                                    className="text-2xl font-bold text-slate-800 dark:text-dark-50 bg-transparent border-b-2 border-synapse-400 outline-none"
                                />
                            ) : (
                                <h1 className="text-2xl font-bold text-slate-800 dark:text-dark-50">{project.title}</h1>
                            )}
                        </div>

                        {/* ⋯ Project menu */}
                        <div ref={menuRef} className="relative mt-1">
                            <button
                                onClick={() => setShowMenu(v => !v)}
                                className="p-2 rounded-xl text-slate-400 dark:text-dark-500 hover:text-slate-700 dark:hover:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
                            >
                                <MoreHorizontal size={18} />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-1.5 z-30 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl shadow-xl overflow-hidden min-w-[160px] animate-scale-in">
                                    <button
                                        onClick={() => { setIsRenaming(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-800 transition-colors"
                                    >
                                        <Pencil size={13} className="text-slate-400" /> Rename
                                    </button>
                                    <button
                                        onClick={() => { setShowMenu(false); onDeleteProject?.(project.id); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <Trash2 size={13} /> Delete project
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── New chat input bar ─────────────────────────────── */}
                    <div className="flex items-center gap-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-[24px] px-5 py-3.5 mb-8 shadow-sm hover:shadow-md focus-within:shadow-lg focus-within:border-slate-300 dark:focus-within:border-dark-600 transition-all duration-300">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 rounded-full text-slate-400 dark:text-dark-500 hover:text-slate-700 dark:hover:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors flex-shrink-0"
                        >
                            <Plus size={18} />
                        </button>
                        <input
                            type="text"
                            value={newChatText}
                            onChange={e => setNewChatText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleNewChat()}
                            placeholder={`Ask anything about ${project.title}`}
                            className="flex-1 bg-transparent text-[15px] font-medium text-slate-800 dark:text-dark-100 placeholder-slate-400 dark:placeholder-dark-500 outline-none"
                        />
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button className="p-2 rounded-full text-slate-400 dark:text-dark-500 hover:text-slate-700 dark:hover:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors">
                                <Mic size={18} />
                            </button>
                            <button
                                onClick={handleNewChat}
                                disabled={!newChatText.trim()}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    newChatText.trim()
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-dark-900 hover:scale-105 shadow-sm hover:shadow-md'
                                        : 'bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-dark-600 cursor-not-allowed'
                                }`}
                            >
                                <ArrowUp size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* ── Tabs ──────────────────────────────────────────── */}
                    <div className="flex items-center gap-4 mb-6 border-b border-slate-100 dark:border-dark-800 px-2">
                        {[{ id: 'chats', label: 'Chats' }, { id: 'files', label: 'Files' }].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-3 text-sm font-bold transition-all relative -mb-px px-1 ${
                                    activeTab === tab.id
                                        ? 'text-slate-900 dark:text-dark-50'
                                        : 'text-slate-500 dark:text-dark-400 hover:text-slate-700 dark:hover:text-dark-200'
                                }`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 dark:bg-dark-50 rounded-t-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ── Chats Tab ─────────────────────────────────────── */}
                    {activeTab === 'chats' && (
                        <div className="animate-fade-in">
                            {sortedChats.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className={`w-16 h-16 rounded-3xl ${color.bg} flex items-center justify-center mb-6 shadow-sm border border-slate-100/50 dark:border-dark-800/50`}>
                                        <Folder size={28} className={color.icon} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-dark-100 mb-2">No chats yet</h3>
                                    <p className="text-sm font-medium text-slate-500 dark:text-dark-400">
                                        Ask anything about {project.title} to get started.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-dark-800/60 rounded-[20px] overflow-hidden bg-white dark:bg-dark-900 border border-slate-100 dark:border-dark-800 shadow-sm shadow-slate-100/50 dark:shadow-none">
                                    {sortedChats.map(chat => (
                                        <button
                                            key={chat.id}
                                            className="w-full flex items-start gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors text-left group"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[15px] font-semibold text-slate-800 dark:text-dark-100 truncate mb-0.5">{chat.title}</p>
                                                {chat.preview && (
                                                    <p className="text-sm text-slate-500 dark:text-dark-400 truncate">{chat.preview}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
                                                {chat.date && <span className="text-xs font-medium text-slate-400 dark:text-dark-500">{chat.date}</span>}
                                                <MoreHorizontal size={16} className="text-slate-300 dark:text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Files Tab ─────────────────────────────────────── */}
                    {activeTab === 'files' && (
                        <div className="animate-fade-in">

                            {/* Filter bar */}
                            {sources.length > 0 && (
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        {/* Sort */}
                                        <div className="relative">
                                            <button
                                                onClick={() => { setShowSort(p => !p); setShowType(false); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-dark-300 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 rounded-lg transition-colors border border-slate-200 dark:border-dark-700"
                                            >
                                                {sortBy} <ChevronDown size={11} />
                                            </button>
                                            {showSort && (
                                                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl shadow-lg overflow-hidden z-20 min-w-[110px]">
                                                    {SORT_OPTIONS.map(opt => (
                                                        <button key={opt} onClick={() => { setSortBy(opt); setShowSort(false); }}
                                                            className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${sortBy === opt ? 'text-synapse-600 dark:text-synapse-400 bg-synapse-50 dark:bg-synapse-900/20' : 'text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-800'}`}
                                                        >{opt}</button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {/* Type */}
                                        <div className="relative">
                                            <button
                                                onClick={() => { setShowType(p => !p); setShowSort(false); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-dark-300 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 rounded-lg transition-colors border border-slate-200 dark:border-dark-700"
                                            >
                                                {typeFilter} <ChevronDown size={11} />
                                            </button>
                                            {showType && (
                                                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl shadow-lg overflow-hidden z-20 min-w-[100px]">
                                                    {TYPE_OPTIONS.map(opt => (
                                                        <button key={opt} onClick={() => { setTypeFilter(opt); setShowType(false); }}
                                                            className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${typeFilter === opt ? 'text-synapse-600 dark:text-synapse-400 bg-synapse-50 dark:bg-synapse-900/20' : 'text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-800'}`}
                                                        >{opt}</button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-dark-800 rounded-lg border border-slate-200 dark:border-dark-700">
                                        <Search size={11} className="text-slate-400 dark:text-dark-500" />
                                        <input type="text" placeholder="Search files…" className="bg-transparent text-xs text-slate-700 dark:text-dark-200 placeholder-slate-400 dark:placeholder-dark-500 outline-none w-28" />
                                    </div>
                                </div>
                            )}

                            {/* File list */}
                            {filteredSources.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-dark-800 rounded-xl border border-slate-100 dark:border-dark-800 overflow-hidden bg-white dark:bg-dark-900">
                                    {filteredSources.map(src => (
                                        <div key={src.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-dark-800/60 transition-colors group">
                                            <div className="w-8 h-8 rounded-lg bg-synapse-50 dark:bg-synapse-900/20 flex items-center justify-center flex-shrink-0">
                                                {src.type === 'save' ? <Bookmark size={14} className="text-synapse-500" /> : <FileText size={14} className="text-synapse-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 dark:text-dark-200 truncate">{src.name}</p>
                                                <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">{src.size} · Indexed</p>
                                            </div>
                                            <button
                                                onClick={() => { setSources(prev => prev.filter(s => s.id !== src.id)); onToast?.('File removed', 'success'); }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* Empty state */
                                <div
                                    className="border-2 border-dashed border-slate-200 dark:border-dark-800 rounded-[24px] flex flex-col items-center justify-center py-20 px-8 text-center cursor-pointer hover:border-synapse-300 dark:hover:border-synapse-700 hover:bg-slate-50/50 dark:hover:bg-dark-800/30 transition-all group"
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files?.[0];
                                        if (file) {
                                            setSources(prev => [{ id: `src-${Date.now()}`, name: file.name, type: 'file', size: (file.size / 1024).toFixed(1) + ' KB', ts: Date.now() }, ...prev]);
                                            onToast?.(`Added "${file.name}"`, 'success');
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        {[Upload, FileText, Bookmark].map((Icon, i) => (
                                            <div key={i} className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-900 flex items-center justify-center shadow-sm border border-slate-100 dark:border-dark-800 group-hover:scale-105 transition-transform duration-300" style={{ transitionDelay: `${i * 50}ms` }}>
                                                <Icon size={20} className="text-slate-400 dark:text-dark-500 group-hover:text-synapse-500 transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-lg font-bold text-slate-800 dark:text-dark-100 mb-2">Give Cortex more context</p>
                                    <p className="text-sm font-medium text-slate-500 dark:text-dark-400 max-w-sm leading-relaxed mb-6">
                                        Upload PDFs, notes, or saved pages to give Cortex deeper context. Files stay until you remove them.
                                    </p>
                                    <button className="px-6 py-2.5 bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-200 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-dark-700 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm hover:shadow-md">
                                        Add files
                                    </button>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={handleAddFile} />
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

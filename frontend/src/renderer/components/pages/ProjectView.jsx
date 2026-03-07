import React, { useState, useRef } from 'react';
import { Folder, Plus, Mic, AudioWaveform, ChevronDown, Upload, FileText, Bookmark, Trash2, MoreHorizontal, Search } from 'lucide-react';

const SORT_OPTIONS  = ['Newest', 'Oldest'];
const TYPE_OPTIONS  = ['All', 'Files', 'Saves'];

export default function ProjectView({ project, onNewChat, onToast }) {
    const [activeTab,   setActiveTab]   = useState('chats');
    const [sortBy,      setSortBy]      = useState('Newest');
    const [typeFilter,  setTypeFilter]  = useState('All');
    const [showSort,    setShowSort]    = useState(false);
    const [showType,    setShowType]    = useState(false);
    const [sources,     setSources]     = useState(project.sources || []);
    const [newChatText, setNewChatText] = useState('');
    const fileInputRef = useRef(null);

    const sortedChats = [...(project.chats || [])].sort((a, b) => {
        if (sortBy === 'Newest') return (b.ts || 0) - (a.ts || 0);
        return (a.ts || 0) - (b.ts || 0);
    });

    const filteredSources = sources.filter(s => {
        if (typeFilter === 'Files')  return s.type === 'file';
        if (typeFilter === 'Saves')  return s.type === 'save';
        return true;
    }).sort((a, b) => {
        if (sortBy === 'Newest') return (b.ts || 0) - (a.ts || 0);
        return (a.ts || 0) - (b.ts || 0);
    });

    const handleAddFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const newSource = {
            id: `src-${Date.now()}`,
            name: file.name,
            type: 'file',
            size: (file.size / 1024).toFixed(1) + ' KB',
            ts: Date.now(),
        };
        setSources(prev => [newSource, ...prev]);
        onToast?.(`Added "${file.name}" to sources`, 'success');
        e.target.value = '';
    };

    const handleDeleteSource = (id) => {
        setSources(prev => prev.filter(s => s.id !== id));
        onToast?.('Source removed and embeddings cleared', 'success');
    };

    const handleNewChat = () => {
        if (newChatText.trim()) {
            onNewChat?.(project.id, newChatText.trim());
            setNewChatText('');
        } else {
            onNewChat?.(project.id, '');
        }
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 overflow-hidden">
            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto px-6 pt-14 pb-10">

                    {/* ── Header ── */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center border border-slate-200 dark:border-dark-700">
                            <Folder size={20} className="text-slate-500 dark:text-dark-300" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-dark-50">{project.title}</h1>
                    </div>

                    {/* ── New chat input bar ── */}
                    <div className="flex items-center gap-3 bg-slate-100 dark:bg-dark-800 rounded-2xl px-4 py-3 mb-8 border border-slate-200 dark:border-dark-700 hover:border-slate-300 dark:hover:border-dark-600 transition-colors">
                        <Plus size={16} className="text-slate-400 dark:text-dark-500 flex-shrink-0" />
                        <input
                            type="text"
                            value={newChatText}
                            onChange={e => setNewChatText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleNewChat()}
                            placeholder={`New chat in ${project.title}`}
                            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-dark-200 placeholder-slate-400 dark:placeholder-dark-500 outline-none"
                        />
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button className="p-1.5 rounded-lg text-slate-400 dark:text-dark-500 hover:text-slate-600 dark:hover:text-dark-300 hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors">
                                <Mic size={16} />
                            </button>
                            <button
                                onClick={handleNewChat}
                                className="w-7 h-7 rounded-full bg-slate-800 dark:bg-dark-100 hover:bg-slate-900 dark:hover:bg-white flex items-center justify-center transition-colors"
                            >
                                <AudioWaveform size={14} className="text-white dark:text-dark-900" />
                            </button>
                        </div>
                    </div>

                    {/* ── Tabs ── */}
                    <div className="flex items-center gap-1 mb-6 border-b border-slate-100 dark:border-dark-800">
                        {['chats', 'sources'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-semibold capitalize transition-all relative -mb-px ${
                                    activeTab === tab
                                        ? 'text-slate-900 dark:text-dark-50 border-b-2 border-slate-800 dark:border-dark-50'
                                        : 'text-slate-500 dark:text-dark-400 hover:text-slate-700 dark:hover:text-dark-200'
                                }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* ── Chats Tab ── */}
                    {activeTab === 'chats' && (
                        <div className="space-y-0 animate-fade-in">
                            {/* Memory badge */}
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-synapse-400 animate-pulse" />
                                <span className="text-[11px] font-medium text-slate-400 dark:text-dark-500">
                                    Chat memory shared across all chats in this project
                                </span>
                            </div>

                            {project.chats.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center mb-4">
                                        <Folder size={24} className="text-slate-300 dark:text-dark-600" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-500 dark:text-dark-400">No chats yet</p>
                                    <p className="text-xs text-slate-400 dark:text-dark-500 mt-1">Start a new chat above to begin</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-dark-800 rounded-xl border border-slate-100 dark:border-dark-800 overflow-hidden bg-white dark:bg-dark-900">
                                    {project.chats.map(chat => (
                                        <button
                                            key={chat.id}
                                            className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-dark-800/60 transition-colors text-left group"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-dark-100 truncate">{chat.title}</p>
                                                {chat.preview && (
                                                    <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5 truncate">{chat.preview}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                                                {chat.date && <span className="text-xs text-slate-400 dark:text-dark-500">{chat.date}</span>}
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal size={14} className="text-slate-400 dark:text-dark-500" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Sources Tab ── */}
                    {activeTab === 'sources' && (
                        <div className="animate-fade-in">
                            {/* Filter bar – only visible when there are sources */}
                            {filteredSources.length > 0 || sources.length > 0 ? (
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        {/* Sort dropdown */}
                                        <div className="relative">
                                            <button
                                                onClick={() => { setShowSort(p => !p); setShowType(false); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-dark-300 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 rounded-lg transition-colors border border-slate-200 dark:border-dark-700"
                                            >
                                                {sortBy} <ChevronDown size={12} />
                                            </button>
                                            {showSort && (
                                                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl shadow-lg overflow-hidden z-20 min-w-[110px] animate-scale-in">
                                                    {SORT_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => { setSortBy(opt); setShowSort(false); }}
                                                            className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${sortBy === opt ? 'text-synapse-600 dark:text-synapse-400 bg-synapse-50 dark:bg-synapse-900/20' : 'text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-700'}`}
                                                        >{opt}</button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Type dropdown */}
                                        <div className="relative">
                                            <button
                                                onClick={() => { setShowType(p => !p); setShowSort(false); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-dark-300 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 rounded-lg transition-colors border border-slate-200 dark:border-dark-700"
                                            >
                                                {typeFilter} <ChevronDown size={12} />
                                            </button>
                                            {showType && (
                                                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl shadow-lg overflow-hidden z-20 min-w-[100px] animate-scale-in">
                                                    {TYPE_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => { setTypeFilter(opt); setShowType(false); }}
                                                            className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${typeFilter === opt ? 'text-synapse-600 dark:text-synapse-400 bg-synapse-50 dark:bg-synapse-900/20' : 'text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-700'}`}
                                                        >{opt}</button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Search */}
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-dark-800 rounded-lg border border-slate-200 dark:border-dark-700">
                                        <Search size={12} className="text-slate-400 dark:text-dark-500" />
                                        <input type="text" placeholder="Search sources…" className="bg-transparent text-xs text-slate-700 dark:text-dark-200 placeholder-slate-400 dark:placeholder-dark-500 outline-none w-36" />
                                    </div>
                                </div>
                            ) : null}

                            {/* Source list */}
                            {filteredSources.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-dark-800 rounded-xl border border-slate-100 dark:border-dark-800 overflow-hidden bg-white dark:bg-dark-900">
                                    {filteredSources.map(src => (
                                        <div key={src.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-dark-800/60 transition-colors group">
                                            <div className="w-8 h-8 rounded-lg bg-synapse-50 dark:bg-synapse-900/20 flex items-center justify-center flex-shrink-0">
                                                {src.type === 'save'
                                                    ? <Bookmark size={14} className="text-synapse-500" />
                                                    : <FileText size={14} className="text-synapse-500" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 dark:text-dark-200 truncate">{src.name}</p>
                                                <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">{src.size} · Embeddings stored</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSource(src.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                                title="Remove source and clear embeddings"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* Empty state drop zone */
                                <div
                                    className="border-2 border-dashed border-slate-200 dark:border-dark-700 rounded-2xl flex flex-col items-center justify-center py-16 px-8 text-center cursor-pointer hover:border-synapse-300 dark:hover:border-synapse-700 hover:bg-synapse-50/30 dark:hover:bg-synapse-900/10 transition-all"
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files?.[0];
                                        if (file) {
                                            const newSource = {
                                                id: `src-${Date.now()}`,
                                                name: file.name,
                                                type: 'file',
                                                size: (file.size / 1024).toFixed(1) + ' KB',
                                                ts: Date.now(),
                                            };
                                            setSources(prev => [newSource, ...prev]);
                                            onToast?.(`Added "${file.name}" to sources`, 'success');
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-dark-800 flex items-center justify-center border border-slate-200 dark:border-dark-700">
                                            <Upload size={18} className="text-slate-400 dark:text-dark-500" />
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-dark-800 flex items-center justify-center border border-slate-200 dark:border-dark-700">
                                            <FileText size={18} className="text-slate-400 dark:text-dark-500" />
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-dark-800 flex items-center justify-center border border-slate-200 dark:border-dark-700">
                                            <Bookmark size={18} className="text-slate-400 dark:text-dark-500" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-dark-200 mb-1">Give Cortex more context</p>
                                    <p className="text-xs text-slate-400 dark:text-dark-500 max-w-xs leading-relaxed mb-5">
                                        Upload PDFs, notes, or save web pages to give Cortex deeper context about this project. Embeddings are stored until you remove a source.
                                    </p>
                                    <button className="px-5 py-2 bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-dark-200 text-sm font-semibold rounded-full hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors shadow-sm">
                                        Add
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

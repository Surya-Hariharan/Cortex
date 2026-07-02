import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, MoreVertical, Trash2, Clock, Hash } from 'lucide-react';
import { workspacePages } from '../../../services/api.js';
import CortexEditor from '../editor/CortexEditor';

function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function Workspace({ onToast }) {
    const [pages, setPages] = useState([]);
    const [selectedPageId, setSelectedPageId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editorContent, setEditorContent] = useState(null);

    const loadPages = useCallback(async () => {
        try {
            const res = await workspacePages.list();
            setPages(res);
            if (!selectedPageId && res.length > 0) {
                handleSelectPage(res[0].id);
            }
        } catch (err) {
            onToast?.(`Failed to load pages: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedPageId, onToast]);

    useEffect(() => {
        loadPages();
    }, [loadPages]);

    const handleSelectPage = async (id) => {
        setSelectedPageId(id);
        try {
            const page = await workspacePages.get(id);
            setEditorContent(page ? JSON.parse(page.content || '{}') : {});
        } catch (err) {
            onToast?.('Failed to load page content', 'error');
        }
    };

    const handleCreatePage = async () => {
        const id = generateId();
        try {
            await workspacePages.create(id, 'Untitled Page', '{}');
            await loadPages();
            handleSelectPage(id);
        } catch (err) {
            onToast?.('Failed to create page', 'error');
        }
    };

    const handleDeletePage = async (id, e) => {
        e.stopPropagation();
        try {
            await workspacePages.delete(id);
            if (selectedPageId === id) {
                setSelectedPageId(null);
                setEditorContent(null);
            }
            await loadPages();
        } catch (err) {
            onToast?.('Failed to delete page', 'error');
        }
    };

    const handleEditorChange = async (json) => {
        if (!selectedPageId) return;
        setEditorContent(json);
        
        // Extract title from the first heading, or fallback to 'Untitled Page'
        let title = 'Untitled Page';
        if (json && json.content && json.content.length > 0) {
            const firstBlock = json.content[0];
            if (firstBlock && firstBlock.content && firstBlock.content.length > 0) {
                title = firstBlock.content.map(c => c.text).join('') || 'Untitled Page';
            }
        }

        try {
            await workspacePages.update(selectedPageId, title, JSON.stringify(json));
            setPages(prev => prev.map(p => p.id === selectedPageId ? { ...p, title } : p));
        } catch (err) {
            console.error('Failed to save page:', err);
        }
    };

    return (
        <div className="h-full flex bg-white dark:bg-dark-950">
            {/* Sidebar */}
            <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-900/20 flex flex-col">
                <div className="p-4 flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">Workspace</h3>
                    <button onClick={handleCreatePage} className="p-1.5 hover:bg-slate-200 dark:hover:bg-dark-800 rounded-lg text-slate-500 transition-colors">
                        <Plus size={14} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar pb-4">
                    {loading ? (
                        <div className="text-[12px] text-slate-400 px-3">Loading pages...</div>
                    ) : pages.length === 0 ? (
                        <div className="text-[12px] text-slate-400 px-3">No pages yet.</div>
                    ) : (
                        pages.map(page => (
                            <button
                                key={page.id}
                                onClick={() => handleSelectPage(page.id)}
                                className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium flex items-center gap-2 group transition-all ${selectedPageId === page.id ? 'bg-synapse-50 dark:bg-synapse-900/20 text-synapse-600 dark:text-synapse-400' : 'text-slate-600 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800'}`}
                            >
                                <FileText size={14} className={selectedPageId === page.id ? 'text-synapse-500' : 'text-slate-400'} />
                                <span className="flex-1 truncate">{page.title}</span>
                                <div onClick={(e) => handleDeletePage(page.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded transition-colors">
                                    <Trash2 size={12} />
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden bg-white dark:bg-dark-950 relative">
                {selectedPageId && editorContent !== null ? (
                    <CortexEditor 
                        key={selectedPageId} // forces remount for new initialContent
                        initialContent={editorContent} 
                        onChange={handleEditorChange} 
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
                        <Hash size={48} className="text-slate-200 dark:text-dark-800" />
                        <p>Select or create a page</p>
                    </div>
                )}
            </div>
        </div>
    );
}

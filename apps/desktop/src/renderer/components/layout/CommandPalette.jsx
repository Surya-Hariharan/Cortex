import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Search,
    Home,
    BookOpen,
    FileText,
    Users,
    Activity,
    Cpu,
    ArrowRight,
    Command,
    CornerDownLeft,
    Hash,
    Zap,
    Upload,
    Plus,
    Settings
} from 'lucide-react';

const COMMANDS = [
    // Navigation
    { id: 'nav-home', label: 'Go to Home', section: 'Navigate', icon: <Home size={16} />, action: 'navigate', target: 'home' },
    { id: 'nav-knowledge', label: 'Go to Knowledge', section: 'Navigate', icon: <BookOpen size={16} />, action: 'navigate', target: 'knowledge' },
    { id: 'nav-workspace', label: 'Go to Workspace', section: 'Navigate', icon: <FileText size={16} />, action: 'navigate', target: 'workspace' },
    { id: 'nav-campus', label: 'Go to Campus', section: 'Navigate', icon: <Users size={16} />, action: 'navigate', target: 'campus' },
    { id: 'nav-activity', label: 'Go to Activity', section: 'Navigate', icon: <Activity size={16} />, action: 'navigate', target: 'activity' },
    { id: 'nav-ai-engine', label: 'Go to AI Engine', section: 'Navigate', icon: <Cpu size={16} />, action: 'navigate', target: 'ai-engine' },
    // Actions
    { id: 'act-search', label: 'Search Knowledge Base', section: 'Actions', icon: <Search size={16} />, action: 'navigate', target: 'knowledge' },
    { id: 'act-upload', label: 'Upload PDF', section: 'Actions', icon: <Upload size={16} />, action: 'upload' },
    { id: 'act-note', label: 'Create New Note', section: 'Actions', icon: <Plus size={16} />, action: 'navigate', target: 'workspace' },
    { id: 'act-group', label: 'Open Study Groups', section: 'Actions', icon: <Users size={16} />, action: 'navigate', target: 'campus' },
    // AI
    { id: 'ai-summarize', label: 'Summarize Document', section: 'AI Actions', icon: <Zap size={16} />, action: 'toast', message: 'AI Summarize: Select a document first' },
    { id: 'ai-quiz', label: 'Generate Quiz', section: 'AI Actions', icon: <Hash size={16} />, action: 'toast', message: 'AI Quiz: Select a document first' },
    { id: 'ai-flashcards', label: 'Create Flashcards', section: 'AI Actions', icon: <FileText size={16} />, action: 'toast', message: 'AI Flashcards: Select a document first' },
];

export default function CommandPalette({ isOpen, onClose, onNavigate, onUploadPdf, onToast }) {
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const filtered = useMemo(() => {
        if (!query.trim()) return COMMANDS;
        const q = query.toLowerCase();
        return COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q));
    }, [query]);

    const sections = useMemo(() => {
        const map = {};
        filtered.forEach(c => {
            if (!map[c.section]) map[c.section] = [];
            map[c.section].push(c);
        });
        return Object.entries(map);
    }, [filtered]);

    const executeCommand = (cmd) => {
        if (cmd.action === 'navigate') onNavigate?.(cmd.target);
        else if (cmd.action === 'upload') onUploadPdf?.();
        else if (cmd.action === 'toast') onToast?.(cmd.message);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && filtered.length > 0) executeCommand(filtered[0]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in" />

            {/* Palette */}
            <div
                className="relative w-full max-w-[560px] bg-white dark:bg-dark-900 rounded-2xl shadow-2xl shadow-black/20 border border-slate-200 dark:border-dark-700 overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-dark-800">
                    <Search size={18} className="text-slate-400 dark:text-dark-500 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent text-[15px] font-medium text-slate-800 dark:text-dark-50 placeholder-slate-400 dark:placeholder-dark-500 outline-none"
                    />
                    <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 dark:bg-dark-800 rounded-md text-[10px] font-bold text-slate-400 dark:text-dark-500 border border-slate-200 dark:border-dark-700">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[360px] overflow-y-auto py-2 custom-scrollbar">
                    {sections.map(([section, commands]) => (
                        <div key={section}>
                            <div className="px-5 py-2">
                                <span className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-[0.15em]">{section}</span>
                            </div>
                            {commands.map(cmd => (
                                <button
                                    key={cmd.id}
                                    onClick={() => executeCommand(cmd)}
                                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-synapse-50 dark:hover:bg-synapse-900/10 transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-dark-800 flex items-center justify-center text-slate-500 dark:text-dark-400 group-hover:bg-synapse-100 dark:group-hover:bg-synapse-900/20 group-hover:text-synapse-600 dark:group-hover:text-synapse-400 transition-colors flex-shrink-0">
                                        {cmd.icon}
                                    </div>
                                    <span className="text-[13px] font-semibold text-slate-700 dark:text-dark-200 group-hover:text-synapse-600 dark:group-hover:text-synapse-400 transition-colors">{cmd.label}</span>
                                    <ArrowRight size={14} className="ml-auto text-slate-300 dark:text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="px-5 py-10 text-center">
                            <Search size={24} className="text-slate-300 dark:text-dark-600 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-400 dark:text-dark-500">No commands found</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-dark-800 flex items-center gap-4 bg-slate-50/50 dark:bg-dark-950/30">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-dark-500">
                        <CornerDownLeft size={11} /> Select
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-dark-500">
                        <span className="text-[9px]">ESC</span> Close
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-slate-300 dark:text-dark-600">
                        <Command size={10} /> Cortex Command Palette
                    </div>
                </div>
            </div>
        </div>
    );
}

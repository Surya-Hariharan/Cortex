import React, { useState, useRef, useEffect } from 'react';
import { X, Lightbulb, TrendingUp, BookOpen, PenLine, Navigation, Briefcase, FlaskConical } from 'lucide-react';

const TAGS = [
    { label: 'Investing',  Icon: TrendingUp,   color: 'text-emerald-500', ring: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' },
    { label: 'Homework',   Icon: BookOpen,      color: 'text-blue-500',    ring: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40' },
    { label: 'Writing',    Icon: PenLine,       color: 'text-purple-500',  ring: 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40' },
    { label: 'Travel',     Icon: Navigation,    color: 'text-amber-500',   ring: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40' },
    { label: 'Work',       Icon: Briefcase,     color: 'text-slate-500',   ring: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-700' },
    { label: 'Research',   Icon: FlaskConical,  color: 'text-rose-500',    ring: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40' },
];

export default function CreateProjectModal({ onClose, onCreate }) {
    const [name, setName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleCreate = () => {
        if (!name.trim()) return;
        onCreate(name.trim());
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            style={{ WebkitAppRegion: 'no-drag' }}
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-dark-900 rounded-2xl w-full max-w-md mx-4 shadow-2xl border border-slate-200/80 dark:border-dark-700 p-6 animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-base font-bold text-slate-900 dark:text-dark-50">Create project</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── Name input ── */}
                <label className="block text-sm font-semibold text-slate-700 dark:text-dark-200 mb-2">
                    Project name
                </label>
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="e.g. Research, Study Notes, Work..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-sm text-slate-800 dark:text-dark-100 placeholder-slate-400 dark:placeholder-dark-500 outline-none focus:border-synapse-400 dark:focus:border-synapse-500 focus:ring-2 focus:ring-synapse-100 dark:focus:ring-synapse-900/30 transition-all mb-4"
                />

                {/* ── Tag suggestions ── */}
                <div className="flex flex-wrap gap-2 mb-5">
                    {TAGS.map(({ label, Icon, color, ring }) => (
                        <button
                            key={label}
                            onClick={() => setName(label)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${ring} ${name === label ? 'ring-2 ring-synapse-300 dark:ring-synapse-700' : ''}`}
                        >
                            <Icon size={11} className={color} />
                            <span className="text-slate-700 dark:text-dark-200">{label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Info box ── */}
                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 mb-6">
                    <Lightbulb size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 dark:text-dark-400 leading-relaxed">
                        Projects keep chats, files, and custom instructions in one place. Use them for ongoing work, or just to keep things tidy.
                    </p>
                </div>

                {/* ── Create button ── */}
                <button
                    onClick={handleCreate}
                    disabled={!name.trim()}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                        name.trim()
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-dark-900 hover:bg-slate-700 dark:hover:bg-slate-100 shadow-sm active:scale-[0.98]'
                            : 'bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-dark-500 cursor-not-allowed'
                    }`}
                >
                    Create project
                </button>
            </div>
        </div>
    );
}

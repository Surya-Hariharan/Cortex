import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search,
    Filter,
    Download,
    Eye,
    MessageSquare,
    FileText,
    GraduationCap,
    ChevronDown,
    ChevronUp,
    Star,
    CheckCircle2,
    Clock,
    Database,
    Type as TypeIcon,
    Layers,
    User,
    Plus
} from 'lucide-react';
import { notes as notesApi, getUserId } from '../../../services/api.js';
import UploadNoteModal from '../shared/UploadNoteModal';

const MOCK_NOTES = [];

const FilterSection = ({ title, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-slate-100 dark:border-dark-800 py-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider mb-2 hover:text-slate-800 dark:hover:text-dark-200 transition-colors"
            >
                {title}
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isOpen && <div className="space-y-1.5 animate-fade-in">{children}</div>}
        </div>
    );
};

const FilterItem = ({ label, count, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all ${active
            ? 'bg-synapse-50 dark:bg-synapse-900/20 text-synapse-600 dark:text-synapse-400 font-semibold shadow-sm ring-1 ring-synapse-200 dark:ring-synapse-800/50'
            : 'text-slate-600 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'
            }`}
    >
        <span>{label}</span>
        {count !== undefined && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-synapse-100 dark:bg-synapse-500/20' : 'bg-slate-200 dark:bg-dark-700'} text-slate-500 dark:text-dark-400`}>
                {count}
            </span>
        )}
    </button>
);

const NoteCard = ({ note }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="group relative bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-synapse-200 dark:hover:border-synapse-900/40 hover:-translate-y-1 overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hover Glow Effect */}
            <div className={`absolute inset-0 bg-gradient-to-tr from-synapse-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-500`} />

            <div className="relative z-10 h-full flex flex-col">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-synapse-50 dark:bg-synapse-900/20 text-synapse-600 dark:text-synapse-400 text-[10px] font-bold uppercase tracking-wide border border-synapse-100 dark:border-synapse-800/50">
                            {note.stream}
                        </span>
                        {note.isOCR && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wide border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-1">
                                <CheckCircle2 size={10} /> OCR
                            </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md ${note.isHandwritten ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'} text-[10px] font-bold uppercase tracking-wide border ${note.isHandwritten ? 'border-amber-100 dark:border-amber-800/50' : 'border-blue-100 dark:border-blue-800/50'}`}>
                            {note.isHandwritten ? 'Handwritten' : 'Typed'}
                        </span>
                    </div>
                    <div className="text-slate-300 dark:text-dark-700 group-hover:text-synapse-400 transition-colors">
                        {note.type.includes('PDF') ? <FileText size={20} /> : <Database size={20} />}
                    </div>
                </div>

                <h3 className="text-base font-bold text-slate-800 dark:text-dark-50 leading-tight mb-1 group-hover:text-synapse-600 dark:group-hover:text-synapse-400 transition-colors">
                    {note.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-dark-400 mb-4 flex items-center gap-1.5 font-medium">
                    <Layers size={12} /> {note.subject}
                </p>

                <div className="flex items-center gap-2 mb-4 bg-slate-50 dark:bg-dark-950/50 p-2 rounded-xl border border-slate-100 dark:border-dark-800/60">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-dark-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-dark-400">
                        {note.uploadedBy.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-700 dark:text-dark-200 truncate leading-none mb-0.5">{note.uploadedBy}</p>
                        <p className="text-[9px] text-slate-500 dark:text-dark-500 font-medium">Batch of {note.batch}</p>
                    </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-y-2 text-[10px] font-medium text-slate-500 dark:text-dark-400 border-t border-slate-100 dark:border-dark-800 pt-3">
                    <div className="flex items-center gap-1.5">
                        <Download size={12} className="text-slate-400" />
                        <span>{note.downloads} dls</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span>{note.rating} / 5.0</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Database size={12} className="text-slate-400" />
                        <span>{note.size}</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                        <Clock size={12} className="text-slate-400" />
                        <span>{note.date}</span>
                    </div>
                </div>

                {/* Quick Actions Overlay on Hover */}
                <div className={`mt-4 grid grid-cols-2 gap-2 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                    <button className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200 text-xs font-bold rounded-lg transition-colors">
                        <Eye size={14} /> Preview
                    </button>
                    <button className="flex items-center justify-center gap-2 px-3 py-1.5 bg-synapse-600 hover:bg-synapse-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-synapse-200 dark:shadow-none">
                        <Download size={14} /> Get PDF
                    </button>
                    <button className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-synapse-50 dark:bg-synapse-900/30 hover:bg-synapse-100 dark:hover:bg-synapse-900/50 text-synapse-600 dark:text-synapse-400 text-xs font-bold rounded-lg transition-colors border border-synapse-100 dark:border-synapse-800/50">
                        <MessageSquare size={14} /> Ask AI About This Note
                    </button>
                </div>
            </div>
        </div>
    );
};

const STREAM_MAP = {
    'ai-ml': 'AI & ML',
    'cs-core': 'Computer Science',
    'mechanical': 'Mechanical',
    'electronics': 'Electronics',
    'others': 'All'
};

export default function AcademicHub({ userStream }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeStream, setActiveStream] = useState(() => {
        if (userStream && STREAM_MAP[userStream]) return STREAM_MAP[userStream];
        return 'All';
    });
    const [activeYear, setActiveYear] = useState('All');
    const [activeType, setActiveType] = useState('All');
    const [sortBy, setSortBy] = useState('Most Recent');
    const [isSortOpen, setIsSortOpen] = useState(false);
    const sortRef = useRef(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [publicNotes, setPublicNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const handleOutside = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setIsSortOpen(false); };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    useEffect(() => {
        setIsLoading(true);
        notesApi.browsePublic({ limit: 100 }).then(res => {
            const raw = Array.isArray(res) ? res : (res?.notes ?? []);
            setPublicNotes(raw.map(n => {
                const parsedTags = n.tags
                    ? (typeof n.tags === 'string' ? JSON.parse(n.tags) : n.tags)
                    : [];
                const subject = parsedTags.find(t => t.startsWith('subject:'))?.split(':')[1] || 'General';
                const stream = parsedTags.find(t => t.startsWith('stream:'))?.split(':')[1] || 'All';
                const type = parsedTags.find(t => t.startsWith('type:'))?.split(':')[1] || 'Typed PDF';
                const isHandwritten = type === 'Handwritten Scan';
                return {
                    id: n.id,
                    title: n.title || 'Untitled',
                    subject,
                    stream,
                    type,
                    isHandwritten,
                    isOCR: isHandwritten,
                    uploadedBy: n.user_id ?? 'Anonymous',
                    batch: '2024',
                    downloads: n.share_info?.download_count ?? 0,
                    rating: 4.5,
                    size: '—',
                    date: n.created_at ? new Date(n.created_at).toLocaleDateString() : '—',
                    noteId: n.id,
                };
            }));
        }).catch(() => {}).finally(() => setIsLoading(false));
    }, []);

    // Compute real stream counts from fetched notes
    const streamCounts = useMemo(() => {
        const counts = {};
        publicNotes.forEach(n => {
            if (n.stream && n.stream !== 'All') {
                counts[n.stream] = (counts[n.stream] || 0) + 1;
            }
        });
        return counts;
    }, [publicNotes]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in pr-2">
            <UploadNoteModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUploadSuccess={() => setIsUploadOpen(false)}
            />
            {/* Header section with safe-area padding */}
            <header className="flex-shrink-0 px-8 py-6 mb-2">
                <div className="max-w-[1240px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-synapse-600 flex items-center justify-center text-white shadow-lg shadow-synapse-200 dark:shadow-none">
                                <GraduationCap size={24} />
                            </div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-dark-50">
                                Academic <span className="text-synapse-600 dark:text-synapse-500">Knowledge Hub</span>
                            </h1>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-dark-400 font-medium">
                            {activeStream === 'All'
                                ? 'Discover peer-reviewed notes shared by seniors'
                                : `Discovering notes for your stream: ${activeStream}`}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => setIsUploadOpen(true)}
                            className="px-5 py-2 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-synapse-200 dark:shadow-none flex items-center gap-2 group active:scale-95"
                        >
                            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                            Contribute Note
                        </button>
                        <div className="relative group w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-synapse-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search by title, subject, tags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-dark-900/50 border border-transparent focus:border-synapse-500/50 focus:bg-white dark:focus:bg-dark-900 rounded-xl text-sm transition-all outline-none text-slate-800 dark:text-dark-100"
                            />
                        </div>
                        <div ref={sortRef} className="relative">
                            <button
                                onClick={() => setIsSortOpen(v => !v)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-dark-900/50 border border-transparent hover:border-slate-200 dark:hover:border-dark-700 rounded-xl transition-all"
                            >
                                <span className="text-xs font-bold text-slate-400 dark:text-dark-500">Sort:</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-dark-100">{sortBy}</span>
                                <ChevronDown size={12} className={`text-slate-400 dark:text-dark-500 transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isSortOpen && (
                                <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
                                    {['Most Recent', 'Most Downloaded', 'Highest Rated', 'Recommended for You'].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => { setSortBy(opt); setIsSortOpen(false); }}
                                            className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${sortBy === opt
                                                ? 'text-synapse-600 dark:text-synapse-400 bg-synapse-50 dark:bg-synapse-900/20'
                                                : 'text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-800'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden px-8 pb-8">
                <div className="max-w-[1240px] mx-auto h-full flex gap-8">
                    {/* Left Filter Panel */}
                    <aside className="w-64 flex-shrink-0 flex flex-col h-full bg-slate-50/50 dark:bg-dark-900/30 rounded-2xl border border-slate-200/60 dark:border-dark-800/60 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-dark-800 flex items-center gap-2">
                            <Filter size={16} className="text-synapse-600 dark:text-synapse-500" />
                            <h2 className="text-sm font-black text-slate-800 dark:text-dark-50 uppercase tracking-wider">Refine Results</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 scrollbar-thin">
                            <FilterSection title="Stream">
                                <FilterItem label="All Streams" active={activeStream === 'All'} onClick={() => setActiveStream('All')} />
                                <FilterItem label="AI & ML" count={streamCounts['AI & ML']} active={activeStream === 'AI & ML'} onClick={() => setActiveStream('AI & ML')} />
                                <FilterItem label="Computer Science" count={streamCounts['Computer Science']} active={activeStream === 'Computer Science'} onClick={() => setActiveStream('Computer Science')} />
                                <FilterItem label="Mechanical" count={streamCounts['Mechanical']} active={activeStream === 'Mechanical'} onClick={() => setActiveStream('Mechanical')} />
                                <FilterItem label="Electronics" count={streamCounts['Electronics']} active={activeStream === 'Electronics'} onClick={() => setActiveStream('Electronics')} />
                                <FilterItem label="Civil" count={streamCounts['Civil']} active={activeStream === 'Civil'} onClick={() => setActiveStream('Civil')} />
                            </FilterSection>

                            <FilterSection title="Year">
                                <FilterItem label="All Years" active={activeYear === 'All'} onClick={() => setActiveYear('All')} />
                                <FilterItem label="1st Year" active={activeYear === '1st Year'} onClick={() => setActiveYear('1st Year')} />
                                <FilterItem label="2nd Year" active={activeYear === '2nd Year'} onClick={() => setActiveYear('2nd Year')} />
                                <FilterItem label="3rd Year" active={activeYear === '3rd Year'} onClick={() => setActiveYear('3rd Year')} />
                                <FilterItem label="Final Year" active={activeYear === 'Final Year'} onClick={() => setActiveYear('Final Year')} />
                            </FilterSection>

                            <FilterSection title="Type">
                                <FilterItem label="All Types" active={activeType === 'All'} onClick={() => setActiveType('All')} />
                                <FilterItem label="Typed PDF" active={activeType === 'Typed PDF'} onClick={() => setActiveType('Typed PDF')} />
                                <FilterItem label="Handwritten Scan" active={activeType === 'Handwritten Scan'} onClick={() => setActiveType('Handwritten Scan')} />
                                <FilterItem label="Lecture Notes" active={activeType === 'Lecture Notes'} onClick={() => setActiveType('Lecture Notes')} />
                                <FilterItem label="Lab Manual" active={activeType === 'Lab Manual'} onClick={() => setActiveType('Lab Manual')} />
                            </FilterSection>

                            <FilterSection title="OCR Status">
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-dark-800 text-[10px] font-bold text-slate-600 dark:text-dark-400 hover:bg-synapse-50 dark:hover:bg-synapse-900/20 hover:text-synapse-600 transition-all border border-transparent hover:border-synapse-200">
                                        OCR Processed
                                    </button>
                                    <button className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-dark-800 text-[10px] font-bold text-slate-600 dark:text-dark-400 hover:bg-synapse-50 dark:hover:bg-synapse-900/20 hover:text-synapse-600 transition-all border border-transparent hover:border-synapse-200">
                                        Raw Scan
                                    </button>
                                </div>
                            </FilterSection>

                            <div className="py-6">
                                <h3 className="text-xs font-bold text-slate-500 dark:text-dark-400 uppercase tracking-wider mb-3">Popular Tags</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {['Python', 'Calculus', 'Microservices', 'CAD', 'Signals', 'Java'].map(tag => (
                                        <span key={tag} className="px-2 py-1 rounded-md bg-white dark:bg-dark-800 text-[10px] font-medium text-slate-500 dark:text-dark-400 border border-slate-200 dark:border-dark-700 cursor-pointer hover:border-synapse-400 dark:hover:border-synapse-500 transition-colors">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-100 dark:bg-dark-900/50 border-t border-slate-200 dark:border-dark-800">
                            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-dark-800 text-slate-700 dark:text-dark-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-dark-700 hover:bg-slate-50 dark:hover:bg-dark-700 transition-all shadow-sm">
                                Reset Filters
                            </button>
                        </div>
                    </aside>

                    {/* Right Notes Grid */}
                    <main className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center text-slate-400 dark:text-dark-600">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-2 border-synapse-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm font-medium">Loading notes…</span>
                                </div>
                            </div>
                        ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {publicNotes
                                .filter(note => {
                                    const matchesStream = activeStream === 'All' || note.stream === activeStream;
                                    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        note.subject.toLowerCase().includes(searchQuery.toLowerCase());
                                    return matchesStream && matchesSearch;
                                })
                                .map(note => (
                                    <NoteCard key={note.id} note={note} />
                                ))
                            }
                        </div>
                        )}

                        {/* Empty State */}
                        {!isLoading && publicNotes.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-dark-900 flex items-center justify-center text-slate-300 dark:text-dark-800 mb-6">
                                    <Search size={40} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-2">No public notes yet</h3>
                                <p className="text-sm text-slate-500 dark:text-dark-400 max-w-xs mx-auto">
                                    Be the first to contribute! Upload a note and set visibility to <b>Academic Hub</b>.
                                </p>
                                <button
                                    onClick={() => setIsUploadOpen(true)}
                                    className="mt-6 px-6 py-2 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-synapse-200 dark:shadow-none"
                                >
                                    Contribute a Note
                                </button>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
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
import UploadNoteModal from './UploadNoteModal';

const MOCK_NOTES = [
    {
        id: 'n1',
        title: 'Neural Networks & Deep Learning',
        subject: 'Machine Learning',
        stream: 'AI & ML',
        uploadedBy: 'Aditya Raj',
        batch: '2024',
        type: 'Typed PDF',
        isOCR: true,
        isHandwritten: false,
        downloads: 1240,
        rating: 4.8,
        size: '12.4 MB',
        date: 'Oct 24, 2025',
        tags: ['Neural Networks', 'PyTorch', 'Backpropagation']
    },
    {
        id: 'n2',
        title: 'Operating Systems - Core Concepts',
        subject: 'System Programming',
        stream: 'Computer Science',
        uploadedBy: 'Sneha Kapoor',
        batch: '2023',
        type: 'Handwritten Scan',
        isOCR: true,
        isHandwritten: true,
        downloads: 850,
        rating: 4.5,
        size: '45.1 MB',
        date: 'Sep 12, 2025',
        tags: ['Kernel', 'Scheduling', 'Memory Management']
    },
    {
        id: 'n3',
        title: 'Microprocessors and Interfacing',
        subject: 'Hardware Design',
        stream: 'Electronics',
        uploadedBy: 'Vikram Singh',
        batch: '2024',
        type: 'Lecture Notes',
        isOCR: false,
        isHandwritten: true,
        downloads: 420,
        rating: 4.2,
        size: '18.2 MB',
        date: 'Jan 15, 2026',
        tags: ['8085', 'Assembly', 'Registers']
    },
    {
        id: 'n4',
        title: 'Theory of Computation - PDA & Turing',
        subject: 'TOC',
        stream: 'Computer Science',
        uploadedBy: 'Rohan Sharma',
        batch: '2023',
        type: 'Cheatsheet',
        isOCR: true,
        isHandwritten: false,
        downloads: 3100,
        rating: 4.9,
        size: '2.4 MB',
        date: 'Feb 05, 2026',
        tags: ['Automata', 'Language Theory', 'Grammar']
    },
    {
        id: 'n5',
        title: 'Thermodynamics Final Revision',
        subject: 'Thermal Engineering',
        stream: 'Mechanical',
        uploadedBy: 'Priya Iyer',
        batch: '2024',
        type: 'Typed PDF',
        isOCR: true,
        isHandwritten: false,
        downloads: 670,
        rating: 4.6,
        size: '8.7 MB',
        date: 'Nov 30, 2025',
        tags: ['Entropy', 'Laws of Thermo', 'Cycles']
    }
];

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
        // Default to user preference if available
        if (userStream && STREAM_MAP[userStream]) {
            return STREAM_MAP[userStream];
        }
        return 'All';
    });
    const [activeYear, setActiveYear] = useState('All');
    const [activeType, setActiveType] = useState('All');
    const [sortBy, setSortBy] = useState('Recent');
    const [isUploadOpen, setIsUploadOpen] = useState(false);

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
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-dark-900/50 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-dark-800 transition-all cursor-pointer">
                            <span className="text-xs font-bold text-slate-500 dark:text-dark-400">Sort:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-dark-200 outline-none cursor-pointer"
                            >
                                <option>Most Recent</option>
                                <option>Most Downloaded</option>
                                <option>Highest Rated</option>
                                <option>Recommended for You</option>
                            </select>
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
                                <FilterItem label="AI & ML" count={12} active={activeStream === 'AI & ML'} onClick={() => setActiveStream('AI & ML')} />
                                <FilterItem label="Computer Science" count={28} active={activeStream === 'Computer Science'} onClick={() => setActiveStream('Computer Science')} />
                                <FilterItem label="Mechanical" count={8} active={activeStream === 'Mechanical'} onClick={() => setActiveStream('Mechanical')} />
                                <FilterItem label="Electronics" count={15} active={activeStream === 'Electronics'} onClick={() => setActiveStream('Electronics')} />
                                <FilterItem label="Civil" count={4} active={activeStream === 'Civil'} onClick={() => setActiveStream('Civil')} />
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
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {MOCK_NOTES
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

                        {/* Empty State Mockup */}
                        {MOCK_NOTES.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-12">
                                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-dark-900 flex items-center justify-center text-slate-300 dark:text-dark-800 mb-6">
                                    <Search size={40} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-2">Nothing found</h3>
                                <p className="text-sm text-slate-500 dark:text-dark-400 max-w-xs mx-auto">
                                    Try adjusting your filters or search query to discover more shared notes.
                                </p>
                                <button className="mt-6 px-6 py-2 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-synapse-200 dark:shadow-none">
                                    Clear all filters
                                </button>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}

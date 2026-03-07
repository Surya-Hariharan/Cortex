import React, { useState } from 'react';
import {
    BookOpen,
    FileText,
    Upload,
    Search,
    Grid3X3,
    List,
    Filter,
    ChevronDown,
    Clock,
    HardDrive,
    CheckCircle2,
    AlertCircle,
    Eye,
    Trash2,
    MoreHorizontal,
    ArrowUpDown,
    Zap,
    Mic,
    Image as ImageIcon,
    File,
    Plus
} from 'lucide-react';

const MOCK_FILES = [
    { id: 'f1', name: 'Neural Networks & Deep Learning.pdf', type: 'pdf', size: '14.2 MB', date: 'Mar 02, 2026', status: 'indexed', chunks: 28, subject: 'Machine Learning' },
    { id: 'f2', name: 'Operating Systems — Core Concepts.pdf', type: 'pdf', size: '9.8 MB', date: 'Feb 25, 2026', status: 'indexed', chunks: 19, subject: 'Computer Science' },
    { id: 'f3', name: 'Lecture 12 — Thermodynamics.pdf', type: 'pdf', size: '5.4 MB', date: 'Feb 18, 2026', status: 'indexed', chunks: 12, subject: 'Physics' },
    { id: 'f4', name: 'Handwritten Notes — TOC.png', type: 'scan', size: '18.2 MB', date: 'Feb 14, 2026', status: 'processing', chunks: 0, subject: 'TOC' },
    { id: 'f5', name: 'Research Paper — Attention Is All You Need.pdf', type: 'research', size: '1.2 MB', date: 'Jan 30, 2026', status: 'indexed', chunks: 15, subject: 'AI Research' },
    { id: 'f6', name: 'Lab Recording — Digital Electronics.mp3', type: 'recording', size: '48.6 MB', date: 'Jan 22, 2026', status: 'pending', chunks: 0, subject: 'Electronics' },
    { id: 'f7', name: 'Data Structures Cheatsheet.pdf', type: 'pdf', size: '2.1 MB', date: 'Jan 15, 2026', status: 'indexed', chunks: 5, subject: 'Computer Science' },
    { id: 'f8', name: 'Microprocessors Lab Manual.pdf', type: 'pdf', size: '7.6 MB', date: 'Jan 10, 2026', status: 'indexed', chunks: 22, subject: 'Electronics' },
];

const TYPE_ICONS = {
    pdf: { icon: FileText, color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
    scan: { icon: ImageIcon, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
    research: { icon: BookOpen, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
    recording: { icon: Mic, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
    default: { icon: File, color: 'text-slate-400 bg-slate-50 dark:bg-dark-800' },
};

const STATUS_CONFIG = {
    indexed: { label: 'Indexed', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50' },
    processing: { label: 'Processing', icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50' },
    pending: { label: 'Pending', icon: Clock, color: 'text-slate-400 bg-slate-50 dark:bg-dark-800 border-slate-200 dark:border-dark-700' },
    failed: { label: 'Failed', icon: AlertCircle, color: 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50' },
};

const FILTERS = ['All', 'PDFs', 'Scans', 'Research', 'Recordings'];

export default function Library({ onUploadPdf, onToast }) {
    const [viewMode, setViewMode] = useState('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');

    const filteredFiles = MOCK_FILES.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.subject.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = activeFilter === 'All' ||
            (activeFilter === 'PDFs' && f.type === 'pdf') ||
            (activeFilter === 'Scans' && f.type === 'scan') ||
            (activeFilter === 'Research' && f.type === 'research') ||
            (activeFilter === 'Recordings' && f.type === 'recording');
        return matchesSearch && matchesFilter;
    });

    const totalSize = '106.1 MB';
    const indexedCount = MOCK_FILES.filter(f => f.status === 'indexed').length;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in overflow-y-auto custom-scrollbar">
            {/* Header */}
            <header className="flex-shrink-0 px-8 pt-8 pb-4">
                <div className="max-w-[1240px] mx-auto">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-200/40 dark:shadow-none">
                                    <BookOpen size={24} />
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-dark-50">
                                    My <span className="text-amber-500">Library</span>
                                </h1>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-dark-400 font-medium">
                                Your personal knowledge base — the raw dataset for Cortex AI.
                            </p>
                        </div>
                        <button
                            onClick={onUploadPdf}
                            className="flex items-center gap-2 px-5 py-2.5 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-synapse-200/40 dark:shadow-none"
                        >
                            <Plus size={18} /> Upload File
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 px-8 pb-12">
                <div className="max-w-[1240px] mx-auto space-y-6">

                    {/* Storage Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-synapse-50 dark:bg-synapse-900/20"><FileText size={18} className="text-synapse-500" /></div>
                            <div>
                                <p className="text-lg font-black text-slate-800 dark:text-dark-50">{MOCK_FILES.length}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">Total Files</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20"><CheckCircle2 size={18} className="text-emerald-500" /></div>
                            <div>
                                <p className="text-lg font-black text-slate-800 dark:text-dark-50">{indexedCount}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">Indexed</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20"><Zap size={18} className="text-blue-500" /></div>
                            <div>
                                <p className="text-lg font-black text-slate-800 dark:text-dark-50">101</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">AI Chunks</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20"><HardDrive size={18} className="text-amber-500" /></div>
                            <div>
                                <p className="text-lg font-black text-slate-800 dark:text-dark-50">{totalSize}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">Storage</p>
                            </div>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-3 flex items-center gap-3">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search your library..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 transition-all text-slate-800 dark:text-dark-50 placeholder-slate-400 dark:placeholder-dark-500"
                            />
                        </div>
                        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-dark-800 pl-3">
                            {FILTERS.map(f => (
                                <button
                                    key={f}
                                    onClick={() => setActiveFilter(f)}
                                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeFilter === f ? 'bg-synapse-600 text-white' : 'text-slate-500 dark:text-dark-400 hover:bg-slate-100 dark:hover:bg-dark-800'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-dark-800 pl-3">
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-800/50'}`}>
                                <List size={16} />
                            </button>
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-800/50'}`}>
                                <Grid3X3 size={16} />
                            </button>
                        </div>
                    </div>

                    {/* File List / Grid */}
                    {viewMode === 'list' ? (
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-dark-950/30 border-b border-slate-100 dark:border-dark-800">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest">File</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest">Subject</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest text-center">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest text-center">Chunks</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest">Size</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest">Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                                        {filteredFiles.map(file => {
                                            const typeConfig = TYPE_ICONS[file.type] || TYPE_ICONS.default;
                                            const statusConfig = STATUS_CONFIG[file.status];
                                            const StatusIcon = statusConfig.icon;
                                            return (
                                                <tr key={file.id} className="hover:bg-slate-50/50 dark:hover:bg-dark-800/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 rounded-lg ${typeConfig.color} flex items-center justify-center flex-shrink-0`}>
                                                                <typeConfig.icon size={18} />
                                                            </div>
                                                            <span className="text-sm font-bold text-slate-800 dark:text-dark-100 truncate max-w-[240px]">{file.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-bold text-slate-500 dark:text-dark-400">{file.subject}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusConfig.color}`}>
                                                            <StatusIcon size={11} /> {statusConfig.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm font-bold text-slate-700 dark:text-dark-200">{file.chunks || '—'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-medium text-slate-500 dark:text-dark-400">{file.size}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-slate-500 dark:text-dark-400 text-[11px] font-medium">
                                                            <Clock size={12} /> {file.date}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button className="p-2 hover:bg-white dark:hover:bg-dark-700 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-dark-600 transition-all text-slate-400 hover:text-synapse-600 opacity-0 group-hover:opacity-100">
                                                                <Eye size={14} />
                                                            </button>
                                                            <button className="p-2 hover:bg-white dark:hover:bg-dark-700 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-dark-600 transition-all text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-all text-slate-400">
                                                                <MoreHorizontal size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredFiles.map(file => {
                                const typeConfig = TYPE_ICONS[file.type] || TYPE_ICONS.default;
                                const statusConfig = STATUS_CONFIG[file.status];
                                return (
                                    <div key={file.id} className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-5 hover:shadow-lg hover:shadow-slate-100/50 dark:hover:shadow-none transition-all group cursor-pointer">
                                        <div className={`w-12 h-12 rounded-xl ${typeConfig.color} flex items-center justify-center mb-4`}>
                                            <typeConfig.icon size={24} />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-dark-100 mb-1 truncate">{file.name}</h4>
                                        <p className="text-[11px] text-slate-400 dark:text-dark-500 font-medium mb-3">{file.subject} · {file.size}</p>
                                        <div className="flex items-center justify-between">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${statusConfig.color.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
                                                <statusConfig.icon size={11} /> {statusConfig.label}
                                            </span>
                                            <span className="text-[10px] text-slate-400 dark:text-dark-500">{file.date}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Upload Card */}
                            <button
                                onClick={onUploadPdf}
                                className="border-2 border-dashed border-slate-200 dark:border-dark-800 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-dark-500 hover:border-synapse-400 hover:text-synapse-500 transition-all min-h-[180px]"
                            >
                                <Upload size={32} />
                                <span className="text-sm font-bold">Upload New File</span>
                            </button>
                        </div>
                    )}

                    {filteredFiles.length === 0 && (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-dark-600">
                                <Search size={32} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-dark-50 mb-2">No files found</h3>
                            <p className="text-sm text-slate-500 dark:text-dark-400">Try adjusting your search or filters.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

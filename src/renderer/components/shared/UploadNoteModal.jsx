import React, { useState, useEffect } from 'react';
import {
    X,
    Upload,
    FileText,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    Globe,
    Users,
    Lock,
    Settings,
    Loader2,
    Type,
    Layers,
    GraduationCap,
    Tags as TagsIcon,
    AlertCircle
} from 'lucide-react';

const STEPS = [
    { id: 1, label: 'Upload' },
    { id: 2, label: 'Metadata' },
    { id: 3, label: 'Visibility' },
    { id: 4, label: 'AI Process' },
    { id: 5, label: 'Complete' }
];

export default function UploadNoteModal({ isOpen, onClose, onUploadSuccess }) {
    const [step, setStep] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadData, setUploadData] = useState({
        file: null,
        title: '',
        subject: '',
        stream: 'AI & ML',
        year: '3rd Year',
        type: 'Typed PDF',
        visibility: 'Academic Hub',
        tags: '',
        description: ''
    });

    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrText, setOcrText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (step === 4 && uploadData.type === 'Handwritten Scan') {
            simulateOCR();
        } else if (step === 4) {
            // Skip OCR for typed notes but show "Analyzing"
            simulateAnalysis();
        }
    }, [step]);

    const simulateOCR = () => {
        setIsProcessing(true);
        setOcrProgress(0);
        setOcrText('');

        const lines = [
            'Detecting handwriting zones...',
            'Normalizing contrast...',
            'Extracting core features: [Kernel, Scheduling, Priority]',
            'Mapping to Subject: Operating Systems',
            'Finalizing text extraction...'
        ];

        let currentLine = 0;
        const interval = setInterval(() => {
            setOcrProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsProcessing(false);
                    return 100;
                }
                return prev + 2;
            });

            if (currentLine < lines.length && Math.random() > 0.7) {
                setOcrText(prev => prev + '\n' + lines[currentLine]);
                currentLine++;
            }
        }, 100);
    };

    const simulateAnalysis = () => {
        setIsProcessing(true);
        setOcrProgress(0);
        const interval = setInterval(() => {
            setOcrProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsProcessing(false);
                    return 100;
                }
                return prev + 5;
            });
        }, 100);
    };

    if (!isOpen) return null;

    const handleFileDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.type === 'application/pdf' || file.name.endsWith('.docx'))) {
            setUploadData({ ...uploadData, file, title: file.name.split('.')[0] });
            setStep(2);
        }
    };

    const nextStep = () => setStep(s => Math.min(s + 1, 5));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-dark-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/60 dark:border-dark-800/60 overflow-hidden animate-scale-in">

                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-dark-800 flex items-center justify-between bg-slate-50/50 dark:bg-dark-950/30">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-dark-50">Contribute <span className="text-synapse-600 dark:text-synapse-500">Knowledge</span></h2>
                        <p className="text-xs text-slate-500 dark:text-dark-400 font-medium">Step {step} of 5 — {STEPS[step - 1].label}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-dark-800 rounded-xl transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-dark-200">
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper Indicator */}
                <div className="px-8 pt-6 pb-2">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 dark:bg-dark-800 -translate-y-1/2 z-0" />
                        <div
                            className="absolute top-1/2 left-0 h-0.5 bg-synapse-500 -translate-y-1/2 z-0 transition-all duration-500"
                            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
                        />
                        {STEPS.map((s) => (
                            <div key={s.id} className="relative z-10 flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step >= s.id
                                        ? 'bg-synapse-600 text-white shadow-lg shadow-synapse-200 dark:shadow-none'
                                        : 'bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-dark-600'
                                    }`}>
                                    {step > s.id ? <CheckCircle2 size={16} /> : s.id}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="p-8 min-h-[400px]">

                    {step === 1 && (
                        <div className="h-full flex flex-col">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleFileDrop}
                                className={`flex-1 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-12 transition-all ${isDragging
                                        ? 'border-synapse-500 bg-synapse-50/30 dark:bg-synapse-900/10'
                                        : 'border-slate-200 dark:border-dark-800 hover:border-synapse-300 dark:hover:border-synapse-800'
                                    }`}
                            >
                                <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-dark-800 flex items-center justify-center text-slate-400 dark:text-dark-600 mb-6 group-hover:scale-110 transition-transform">
                                    <Upload size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-2">Drop your note here</h3>
                                <p className="text-sm text-slate-500 dark:text-dark-400 text-center mb-8 max-w-xs">
                                    Support PDF and DOCX files. Handwritten scans are automatically processed with OCR.
                                </p>
                                <button className="px-6 py-2.5 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-synapse-100 dark:shadow-none">
                                    Browse Files
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5 animate-slide-up">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 mb-1.5 tracking-widest pl-1">
                                        <Type size={12} /> Document Title
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadData.title}
                                        onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-sm focus:ring-2 focus:ring-synapse-500/20 focus:border-synapse-500 outline-none transition-all text-slate-800 dark:text-dark-50"
                                        placeholder="e.g. Adv Operating Systems - Lec 4"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 mb-1.5 tracking-widest pl-1">
                                        <Layers size={12} /> Subject
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadData.subject}
                                        onChange={(e) => setUploadData({ ...uploadData, subject: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-sm focus:ring-2 focus:ring-synapse-500/20 focus:border-synapse-500 outline-none transition-all text-slate-800 dark:text-dark-50"
                                        placeholder="e.g. CS401"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 mb-1.5 tracking-widest pl-1">
                                        <GraduationCap size={12} /> Stream
                                    </label>
                                    <select
                                        value={uploadData.stream}
                                        onChange={(e) => setUploadData({ ...uploadData, stream: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-sm outline-none text-slate-800 dark:text-dark-50 cursor-pointer"
                                    >
                                        <option>AI & ML</option>
                                        <option>Computer Science</option>
                                        <option>Mechanical</option>
                                        <option>Electronics</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 mb-1.5 tracking-widest pl-1">
                                        <Settings size={12} /> Note Type
                                    </label>
                                    <select
                                        value={uploadData.type}
                                        onChange={(e) => setUploadData({ ...uploadData, type: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-sm outline-none text-slate-800 dark:text-dark-50 cursor-pointer"
                                    >
                                        <option>Typed PDF</option>
                                        <option>Handwritten Scan</option>
                                        <option>Lecture Notes</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 dark:text-dark-500 mb-1.5 tracking-widest pl-1">
                                        <TagsIcon size={12} /> Tags (Comma separated)
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadData.tags}
                                        onChange={(e) => setUploadData({ ...uploadData, tags: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-sm outline-none text-slate-800 dark:text-dark-50"
                                        placeholder="OS, Kernel, Revision"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-slide-up">
                            <h3 className="text-sm font-black uppercase text-slate-400 dark:text-dark-500 tracking-widest mb-4">Choose Target Audience</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { id: 'Private', label: 'Private (Archive)', icon: <Lock size={18} />, desc: 'Only visible in your personal Notes dashboard.' },
                                    { id: 'Mesh Network', label: 'Mesh Network (Peer-to-Peer)', icon: <Users size={18} />, desc: 'Shared with local peers on your current subnet.' },
                                    { id: 'Academic Hub', label: 'Academic Hub (Global)', icon: <Globe size={18} />, desc: 'Upload to the public hub for senior contribution points.' }
                                ].map((choice) => (
                                    <button
                                        key={choice.id}
                                        onClick={() => setUploadData({ ...uploadData, visibility: choice.id })}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${uploadData.visibility === choice.id
                                                ? 'border-synapse-500 bg-synapse-50/50 dark:bg-synapse-900/10 ring-1 ring-synapse-500'
                                                : 'border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/50 hover:bg-slate-50 dark:hover:bg-dark-800'
                                            }`}
                                    >
                                        <div className={`p-2.5 rounded-xl ${uploadData.visibility === choice.id ? 'bg-synapse-600 text-white' : 'bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-dark-500'}`}>
                                            {choice.icon}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold ${uploadData.visibility === choice.id ? 'text-synapse-700 dark:text-synapse-400' : 'text-slate-700 dark:text-dark-200'}`}>
                                                {choice.label}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-dark-400">{choice.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="h-full flex flex-col items-center justify-center animate-fade-in">
                            <div className="relative mb-8">
                                <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center text-synapse-600 dark:text-synapse-400">
                                    {isProcessing ? <Loader2 size={40} className="animate-spin" /> : <CheckCircle2 size={40} className="text-emerald-500" />}
                                </div>
                                {isProcessing && (
                                    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-lg px-2 py-1 shadow-sm">
                                        <span className="text-[10px] font-black text-synapse-600">{ocrProgress}%</span>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-2">
                                {isProcessing ? 'On-Device Processing...' : 'Analysis Complete'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-dark-400 mb-8 max-w-xs text-center">
                                Cortex is currently {uploadData.type === 'Handwritten Scan' ? 'extracting text using OCR' : 'analyzing semantics'} and generating embeddings.
                            </p>

                            <div className="w-full max-w-sm space-y-4">
                                <div className="h-2 bg-slate-100 dark:bg-dark-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-synapse-600 transition-all duration-300"
                                        style={{ width: `${ocrProgress}%` }}
                                    />
                                </div>

                                {uploadData.type === 'Handwritten Scan' && (
                                    <div className="bg-dark-950 p-4 rounded-xl border border-dark-800 font-mono text-[10px] text-emerald-400/80 max-h-32 overflow-y-auto w-full">
                                        <div className="flex items-center gap-2 mb-2 text-dark-500 font-bold border-b border-dark-800 pb-2">
                                            <AlertCircle size={10} /> LOCAL_ENGINE_LOGS
                                        </div>
                                        <pre>{ocrText}</pre>
                                        {isProcessing && <span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse align-middle ml-1" />}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-scale-in">
                            <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-500 mb-6 shadow-lg shadow-emerald-100 dark:shadow-none">
                                <CheckCircle2 size={48} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-dark-50 mb-2">Upload Successful</h2>
                            <p className="text-sm text-slate-500 dark:text-dark-400 mb-10 max-w-sm">
                                Your contribution has been processed and is now live on the <b>Academic Hub</b>. Thank you for supporting the Cortex community!
                            </p>

                            <div className="flex gap-3">
                                <button className="px-6 py-2.5 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200 text-sm font-bold rounded-xl transition-all">
                                    View Note
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-8 py-2.5 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-synapse-200 dark:shadow-none"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Modal Footer Controls */}
                <div className="px-8 py-4 bg-slate-50/50 dark:bg-dark-950/30 border-t border-slate-100 dark:border-dark-800 flex items-center justify-between">
                    <button
                        onClick={prevStep}
                        disabled={step === 1 || step === 5 || isProcessing}
                        className="flex items-center gap-2 px-4 py-2 text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-200 text-sm font-bold disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft size={16} /> Previous
                    </button>

                    {step !== 1 && step !== 5 && (
                        <button
                            onClick={nextStep}
                            disabled={isProcessing}
                            className="flex items-center gap-2 pl-6 pr-4 py-2 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-synapse-100 dark:shadow-none disabled:opacity-50"
                        >
                            {step === 4 ? 'Finalize' : 'Continue'} <ChevronRight size={16} />
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}

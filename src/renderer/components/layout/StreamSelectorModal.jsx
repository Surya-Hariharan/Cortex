import React, { useState } from 'react';
import {
    GraduationCap,
    Code,
    Cpu,
    Settings,
    CheckCircle2,
    ArrowRight,
    X
} from 'lucide-react';

const STREAMS = [
    { id: 'ai-ml', label: 'AI & ML', icon: <Cpu size={20} />, description: 'Neural networks, ONNX, and RAG' },
    { id: 'cs-core', label: 'Computer Science', icon: <Code size={20} />, description: 'Algorithms, OS, and Systems' },
    { id: 'mechanical', label: 'Mechanical', icon: <Settings size={20} />, description: 'Thermodynamics and CAD' },
    { id: 'electronics', label: 'Electronics', icon: <ZapIcon size={20} />, description: 'Embedded systems and VLSI' },
    { id: 'others', label: 'Others', icon: <GraduationCap size={20} />, description: 'General academic notes' },
];

function ZapIcon({ size, className }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    );
}

export default function StreamSelectorModal({ onSelect, onSkip }) {
    const [selectedStream, setSelectedStream] = useState(null);

    const handleConfirm = () => {
        if (selectedStream) {
            onSelect(selectedStream);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-dark-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl shadow-black/40 overflow-hidden border border-slate-200 dark:border-dark-800 animate-scale-in">

                {/* Header */}
                <div className="px-10 pt-12 pb-8 text-center relative">
                    <button
                        onClick={onSkip}
                        className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="w-16 h-16 bg-synapse-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-synapse-200 dark:shadow-none">
                        <GraduationCap size={32} />
                    </div>

                    <h2 className="text-2xl font-black text-slate-800 dark:text-dark-50 mb-2">Personalize your Experience</h2>
                    <p className="text-slate-500 dark:text-dark-400 text-sm font-medium">
                        Select your academic stream to see relevant notes and AI insights tailored for your curriculum.
                    </p>
                </div>

                {/* Stream Options */}
                <div className="px-10 pb-8 space-y-3">
                    {STREAMS.map(stream => (
                        <button
                            key={stream.id}
                            onClick={() => setSelectedStream(stream.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group ${selectedStream === stream.id
                                    ? 'bg-synapse-50 dark:bg-synapse-900/20 border-synapse-300 dark:border-synapse-700 shadow-sm'
                                    : 'bg-slate-50/50 dark:bg-dark-950/40 border-slate-100 dark:border-dark-800 hover:border-slate-300 dark:hover:border-dark-700'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedStream === stream.id
                                    ? 'bg-synapse-600 text-white'
                                    : 'bg-white dark:bg-dark-800 text-slate-500 dark:text-dark-400 group-hover:text-slate-700 dark:group-hover:text-dark-100'
                                }`}>
                                {stream.icon}
                            </div>
                            <div className="text-left flex-1">
                                <h4 className={`text-sm font-black ${selectedStream === stream.id ? 'text-synapse-700 dark:text-synapse-300' : 'text-slate-700 dark:text-dark-200'}`}>
                                    {stream.label}
                                </h4>
                                <p className="text-[11px] text-slate-400 dark:text-dark-500 font-medium">{stream.description}</p>
                            </div>
                            {selectedStream === stream.id && (
                                <CheckCircle2 className="text-synapse-600 dark:text-synapse-400 animate-scale-in" size={20} />
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-10 pb-12 pt-4 flex items-center gap-4">
                    <button
                        onClick={onSkip}
                        className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 transition-colors"
                    >
                        Skip for now
                    </button>
                    <button
                        disabled={!selectedStream}
                        onClick={handleConfirm}
                        className={`flex-[2] py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${selectedStream
                                ? 'bg-synapse-600 hover:bg-synapse-700 text-white shadow-lg shadow-synapse-200 dark:shadow-none translate-y-0 active:translate-y-0.5'
                                : 'bg-slate-100 dark:bg-dark-800 text-slate-400 cursor-not-allowed opacity-50'
                            }`}
                    >
                        Confirm Preference <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import { Search, BookOpen, GraduationCap } from 'lucide-react';
import SearchTab from './SearchTab';
import Library from './Library';
import AcademicHub from './AcademicHub';

const SUB_TABS = [
    { id: 'search', label: 'Search', icon: <Search size={16} /> },
    { id: 'library', label: 'My Library', icon: <BookOpen size={16} /> },
    { id: 'campus-hub', label: 'Campus Hub', icon: <GraduationCap size={16} /> },
];

export default function Knowledge({ onToast, onUploadPdf, userStream }) {
    const [activeTab, setActiveTab] = useState('search');

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950">
            {/* Sub-Tab Bar */}
            <div className="flex-shrink-0 px-6 pt-5 pb-0 bg-white dark:bg-dark-950 z-30">
                <div className="max-w-[1240px] mx-auto">
                    <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-dark-900/80 rounded-2xl w-fit">
                        {SUB_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 ${activeTab === tab.id
                                        ? 'bg-white dark:bg-dark-800 text-synapse-600 dark:text-synapse-400 shadow-sm border border-slate-200/60 dark:border-dark-700/60'
                                        : 'text-slate-500 dark:text-dark-400 hover:text-slate-700 dark:hover:text-dark-200'
                                    }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'search' && <SearchTab onToast={onToast} onUploadPdf={onUploadPdf} />}
                {activeTab === 'library' && <Library onUploadPdf={onUploadPdf} onToast={onToast} />}
                {activeTab === 'campus-hub' && <AcademicHub userStream={userStream} />}
            </div>
        </div>
    );
}

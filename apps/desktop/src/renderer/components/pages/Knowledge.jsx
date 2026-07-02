import React, { useState, useEffect } from 'react';
import { Search, BookOpen, GraduationCap } from 'lucide-react';
import SearchTab from '../panels/SearchTab';
import Library from './Library';
import AcademicHub from './AcademicHub';

const SUB_TABS = [
    { id: 'search', label: 'Search', icon: <Search size={14} /> },
    { id: 'library', label: 'My Library', icon: <BookOpen size={14} /> },
    { id: 'campus-hub', label: 'Campus Hub', icon: <GraduationCap size={14} /> },
];

export default function Knowledge({ onToast, onUploadPdf, userStream, chatKey, savedChatState, onFirstSearch, onSearchComplete }) {
    const [activeTab, setActiveTab] = useState('search');

    // When a new chat session starts, switch back to the search sub-tab
    useEffect(() => {
        if (chatKey) setActiveTab('search');
    }, [chatKey]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950">
            {/* Sub-Tab Bar */}
            <div className="flex-shrink-0 px-6 pt-5 pb-0 bg-white dark:bg-dark-950 z-30">
                <div className="max-w-[1240px] mx-auto flex items-center">
                    <div className="flex items-center gap-0.5 p-1 bg-slate-100/80 dark:bg-dark-900/80 rounded-xl w-fit">
                        {SUB_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === tab.id
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
                {activeTab === 'search' && (
                    <SearchTab
                        key={chatKey}
                        savedState={savedChatState}
                        onToast={onToast}
                        onUploadPdf={onUploadPdf}
                        onFirstSearch={onFirstSearch}
                        onSearchComplete={onSearchComplete}
                    />
                )}
                {activeTab === 'library' && <Library onUploadPdf={onUploadPdf} onToast={onToast} />}
                {activeTab === 'campus-hub' && <AcademicHub userStream={userStream} />}
            </div>
        </div>
    );
}

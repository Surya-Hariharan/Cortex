import React, { useState } from 'react';
import { Users, Globe } from 'lucide-react';
import StudyGroups from '../StudyGroups';
import NetworkTab from '../NetworkTab';
import MyContributions from '../MyContributions';

const SUB_TABS = [
    { id: 'study-groups', label: 'Study Groups', icon: <Users size={16} /> },
    { id: 'nearby-mesh', label: 'Nearby Mesh', icon: <Globe size={16} /> },
    { id: 'contributions', label: 'My Contributions', icon: <Users size={16} /> }, // Reusing Users icon or similar
];

export default function Campus({ onToast }) {
    const [activeTab, setActiveTab] = useState('study-groups');

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
                {activeTab === 'study-groups' && <StudyGroups onToast={onToast} />}
                {activeTab === 'nearby-mesh' && <NetworkTab />}
                {activeTab === 'contributions' && <MyContributions />}
            </div>
        </div>
    );
}

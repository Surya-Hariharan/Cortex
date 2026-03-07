import React, { useState } from 'react';
import { FileText, CheckSquare, Plus, Calendar, Clock, AlertCircle, Flag, ChevronRight, GripVertical } from 'lucide-react';
import NotesTab from './NotesTab';

const MOCK_TASKS = [
    { id: 't1', title: 'Submit ML Assignment — Backpropagation', due: 'Mar 10, 2026', priority: 'high', course: 'Machine Learning', completed: false },
    { id: 't2', title: 'Read Chapter 5 — Operating Systems', due: 'Mar 12, 2026', priority: 'medium', course: 'Operating Systems', completed: false },
    { id: 't3', title: 'Complete Lab Report — Digital Electronics', due: 'Mar 14, 2026', priority: 'low', course: 'Electronics', completed: false },
    { id: 't4', title: 'Review TOC — PDA & Turing Machines', due: 'Mar 08, 2026', priority: 'high', course: 'TOC', completed: true },
    { id: 't5', title: 'Group meeting — Final Year Project', due: 'Mar 09, 2026', priority: 'medium', course: 'Project', completed: true },
    { id: 't6', title: 'Practice coding problems — Arrays', due: 'Mar 15, 2026', priority: 'low', course: 'DSA', completed: false },
];

const PRIORITY_CONFIG = {
    high: { label: 'High', color: 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50', dot: 'bg-red-500' },
    medium: { label: 'Medium', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50', dot: 'bg-amber-500' },
    low: { label: 'Low', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50', dot: 'bg-blue-500' },
};

const SUB_TABS = [
    { id: 'notes', label: 'Notes', icon: <FileText size={16} /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
];

function TasksView({ onToast }) {
    const [tasks, setTasks] = useState(MOCK_TASKS);
    const [filter, setFilter] = useState('all');

    const toggleTask = (id) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const filtered = tasks.filter(t => {
        if (filter === 'active') return !t.completed;
        if (filter === 'completed') return t.completed;
        return true;
    });

    const activeCount = tasks.filter(t => !t.completed).length;
    const overdueCount = tasks.filter(t => !t.completed && new Date(t.due) < new Date()).length;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in overflow-y-auto custom-scrollbar">
            <div className="flex-1 px-8 py-6 pb-12">
                <div className="max-w-[1240px] mx-auto space-y-6">

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-synapse-50 dark:bg-synapse-900/20"><CheckSquare size={18} className="text-synapse-500" /></div>
                            <div>
                                <p className="text-lg font-black text-slate-800 dark:text-dark-50">{activeCount}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">Active Tasks</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20"><AlertCircle size={18} className="text-red-500" /></div>
                            <div>
                                <p className="text-lg font-black text-slate-800 dark:text-dark-50">{overdueCount}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">Overdue</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20"><Calendar size={18} className="text-emerald-500" /></div>
                            <div>
                                <p className="text-lg font-black text-slate-800 dark:text-dark-50">{tasks.filter(t => t.completed).length}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-dark-500 uppercase tracking-widest">Completed</p>
                            </div>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {['all', 'active', 'completed'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 text-[11px] font-bold rounded-xl transition-all capitalize ${filter === f ? 'bg-synapse-600 text-white' : 'bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-slate-500 dark:text-dark-400 hover:bg-slate-50 dark:hover:bg-dark-800'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-synapse-600 hover:bg-synapse-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-sm">
                            <Plus size={16} /> Add Task
                        </button>
                    </div>

                    {/* Task List */}
                    <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-dark-800">
                            {filtered.map(task => {
                                const pConfig = PRIORITY_CONFIG[task.priority];
                                return (
                                    <div key={task.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-dark-800/30 transition-colors group">
                                        <button
                                            onClick={() => toggleTask(task.id)}
                                            className={`w-5 h-5 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all ${task.completed
                                                    ? 'bg-synapse-600 border-synapse-600 text-white'
                                                    : 'border-slate-300 dark:border-dark-600 hover:border-synapse-400'
                                                }`}
                                        >
                                            {task.completed && (
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[13px] font-bold mb-0.5 ${task.completed ? 'text-slate-400 dark:text-dark-500 line-through' : 'text-slate-800 dark:text-dark-100'}`}>
                                                {task.title}
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-dark-500">{task.course}</span>
                                                <span className="text-[10px] text-slate-300 dark:text-dark-600">•</span>
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-dark-500">
                                                    <Clock size={10} /> {task.due}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${pConfig.color}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${pConfig.dot}`} /> {pConfig.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {filtered.length === 0 && (
                        <div className="text-center py-16">
                            <CheckSquare size={32} className="text-slate-300 dark:text-dark-600 mx-auto mb-3" />
                            <h3 className="text-lg font-black text-slate-800 dark:text-dark-50 mb-1">All caught up!</h3>
                            <p className="text-sm text-slate-500 dark:text-dark-400">No tasks to show.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Workspace({ onToast }) {
    const [activeTab, setActiveTab] = useState('notes');

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
                {activeTab === 'notes' && <NotesTab onToast={onToast} />}
                {activeTab === 'tasks' && <TasksView onToast={onToast} />}
            </div>
        </div>
    );
}

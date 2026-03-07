import React, { useState, useEffect } from 'react';
import { FileText, CheckSquare, Plus, Calendar, Clock, AlertCircle, Flag, ChevronRight, GripVertical, X, RefreshCw } from 'lucide-react';
import NotesTab from '../NotesTab';
import { tasks as tasksApi, getUserId } from '../../../services/api.js';

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
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newPriority, setNewPriority] = useState('medium');
    const [newDue, setNewDue] = useState('');

    useEffect(() => { loadTasks(); }, []);

    async function loadTasks() {
        setLoading(true);
        try {
            const userId = getUserId();
            const res = await tasksApi.list(userId);
            setTasks(Array.isArray(res) ? res : (res?.tasks ?? []));
        } catch (err) {
            onToast?.(`Failed to load tasks: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }

    async function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        try {
            await tasksApi.update(id, { status: newStatus });
            setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
        } catch (err) {
            onToast?.(`Update failed: ${err.message}`, 'error');
        }
    }

    async function deleteTask(id) {
        try {
            await tasksApi.delete(id);
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            onToast?.(`Delete failed: ${err.message}`, 'error');
        }
    }

    async function handleAddTask(e) {
        e.preventDefault();
        if (!newTitle.trim()) return;
        try {
            const userId = getUserId();
            const created = await tasksApi.create({
                user_id: userId,
                title: newTitle.trim(),
                priority: newPriority,
                due_date: newDue || null,
            });
            setTasks(prev => [created, ...prev]);
            setNewTitle('');
            setNewPriority('medium');
            setNewDue('');
            setShowAdd(false);
            onToast?.('Task added', 'success');
        } catch (err) {
            onToast?.(`Failed to add task: ${err.message}`, 'error');
        }
    }

    const filtered = tasks.filter(t => {
        if (filter === 'active') return t.status !== 'completed';
        if (filter === 'completed') return t.status === 'completed';
        return true;
    });

    const activeCount = tasks.filter(t => t.status !== 'completed').length;
    const overdueCount = tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()).length;

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
                                <p className="text-lg font-black text-slate-800 dark:text-dark-50">{tasks.filter(t => t.status === 'completed').length}</p>
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
                        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-synapse-600 hover:bg-synapse-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-sm">
                            <Plus size={16} /> Add Task
                        </button>
                    </div>

                    {/* Inline Add Form */}
                    {showAdd && (
                        <form onSubmit={handleAddTask} className="bg-white dark:bg-dark-900 border border-synapse-200 dark:border-synapse-800/50 rounded-2xl p-4 space-y-3 shadow-sm">
                            <div className="flex gap-3">
                                <input
                                    autoFocus
                                    type="text"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Task title…"
                                    className="flex-1 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-dark-50 outline-none focus:ring-2 focus:ring-synapse-500/20 focus:border-synapse-400"
                                />
                                <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl px-3 text-sm font-bold text-slate-700 dark:text-dark-200 outline-none">
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                                <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl px-3 text-sm font-medium text-slate-700 dark:text-dark-200 outline-none" />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="px-5 py-2 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all">Save</button>
                            </div>
                        </form>
                    )}

                    {/* Task List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-slate-400">
                            <RefreshCw size={20} className="animate-spin mr-2" /><span className="text-sm">Loading tasks…</span>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl overflow-hidden">
                            <div className="divide-y divide-slate-100 dark:divide-dark-800">
                                {filtered.map(task => {
                                    const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                                    const completed = task.status === 'completed';
                                    const dueLabel = task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
                                    return (
                                        <div key={task.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-dark-800/30 transition-colors group">
                                            <button
                                                onClick={() => toggleTask(task.id)}
                                                className={`w-5 h-5 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all ${completed
                                                        ? 'bg-synapse-600 border-synapse-600 text-white'
                                                        : 'border-slate-300 dark:border-dark-600 hover:border-synapse-400'
                                                    }`}
                                            >
                                                {completed && (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[13px] font-bold mb-0.5 ${completed ? 'text-slate-400 dark:text-dark-500 line-through' : 'text-slate-800 dark:text-dark-100'}`}>
                                                    {task.title}
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    {task.description && <span className="text-[10px] font-bold text-slate-400 dark:text-dark-500 truncate max-w-[200px]">{task.description}</span>}
                                                    {dueLabel && (
                                                        <>
                                                            <span className="text-[10px] text-slate-300 dark:text-dark-600">•</span>
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-dark-500">
                                                                <Clock size={10} /> {dueLabel}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${pConfig.color}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${pConfig.dot}`} /> {pConfig.label}
                                            </span>
                                            <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-300 hover:text-red-500 transition-all">
                                                <X size={13} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {!loading && filtered.length === 0 && (
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

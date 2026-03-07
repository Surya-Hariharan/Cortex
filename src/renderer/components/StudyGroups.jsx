import React, { useState } from 'react';
import {
    Users,
    Plus,
    Search,
    MessageSquare,
    FileText,
    Crown,
    ChevronRight,
    ArrowUpRight,
    BookOpen,
    Zap,
    Pin,
    Hash,
    Settings,
    UserPlus,
    Send,
    Paperclip,
    Smile
} from 'lucide-react';

const MOCK_GROUPS = [
    {
        id: 'g1',
        name: 'ML Study Group',
        description: 'Deep learning, neural networks, and AI research',
        members: [
            { name: 'Surya H.', avatar: 'SH', role: 'admin', online: true },
            { name: 'Aditya R.', avatar: 'AR', role: 'member', online: true },
            { name: 'Priya S.', avatar: 'PS', role: 'member', online: false },
            { name: 'Rohan K.', avatar: 'RK', role: 'member', online: true },
            { name: 'Maya D.', avatar: 'MD', role: 'member', online: false },
        ],
        sharedFiles: 24,
        messages: 156,
        color: 'from-synapse-500 to-indigo-500',
        recentActivity: '2 min ago',
        pinnedResources: ['Attention Is All You Need.pdf', 'PyTorch Tutorial Notes'],
        channels: ['general', 'papers', 'assignments'],
    },
    {
        id: 'g2',
        name: 'Operating Systems',
        description: 'OS concepts, lab work, and exam prep',
        members: [
            { name: 'Surya H.', avatar: 'SH', role: 'member', online: true },
            { name: 'Vikram P.', avatar: 'VP', role: 'admin', online: true },
            { name: 'Neha T.', avatar: 'NT', role: 'member', online: true },
        ],
        sharedFiles: 18,
        messages: 89,
        color: 'from-emerald-500 to-teal-500',
        recentActivity: '15 min ago',
        pinnedResources: ['Scheduling Algorithms Cheatsheet'],
        channels: ['general', 'labs'],
    },
    {
        id: 'g3',
        name: 'Final Year Project',
        description: 'Cortex — Offline AI for Students',
        members: [
            { name: 'Surya H.', avatar: 'SH', role: 'admin', online: true },
            { name: 'Aditya R.', avatar: 'AR', role: 'member', online: false },
        ],
        sharedFiles: 42,
        messages: 312,
        color: 'from-amber-500 to-orange-500',
        recentActivity: '1h ago',
        pinnedResources: ['Project Proposal.pdf', 'Architecture Diagram', 'Research Survey'],
        channels: ['general', 'dev', 'docs', 'design'],
    },
    {
        id: 'g4',
        name: 'AI Hackathon Team',
        description: 'AMD hackathon preparation and brainstorming',
        members: [
            { name: 'Surya H.', avatar: 'SH', role: 'admin', online: true },
            { name: 'Priya S.', avatar: 'PS', role: 'member', online: true },
            { name: 'Rohan K.', avatar: 'RK', role: 'member', online: true },
            { name: 'Neha T.', avatar: 'NT', role: 'member', online: false },
        ],
        sharedFiles: 8,
        messages: 67,
        color: 'from-red-500 to-pink-500',
        recentActivity: '3h ago',
        pinnedResources: ['Hackathon Rules.pdf'],
        channels: ['general', 'ideas'],
    },
];

const MOCK_MESSAGES = [
    { id: 'm1', user: 'Aditya R.', avatar: 'AR', message: 'Has anyone tried the new transformer architecture from the latest paper?', time: '2:14 PM', reactions: ['🔥', '👍'] },
    { id: 'm2', user: 'Priya S.', avatar: 'PS', message: 'Yes! I implemented it using PyTorch. The attention mechanism is much more efficient.', time: '2:18 PM', reactions: ['🎉'] },
    { id: 'm3', user: 'Surya H.', avatar: 'SH', message: 'I uploaded my notes on GANs to the shared folder. Check it out!', time: '2:22 PM', reactions: ['👀', '❤️'] },
    { id: 'm4', user: 'Rohan K.', avatar: 'RK', message: 'Can we schedule a study session this weekend? I need help with backpropagation.', time: '2:30 PM', reactions: [] },
];

export default function StudyGroups() {
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [activeChannel, setActiveChannel] = useState('general');

    if (selectedGroup) {
        const group = MOCK_GROUPS.find(g => g.id === selectedGroup);
        const onlineCount = group.members.filter(m => m.online).length;

        return (
            <div className="h-full flex bg-white dark:bg-dark-950 animate-fade-in">
                {/* Group Sidebar */}
                <div className="w-[260px] flex-shrink-0 border-r border-slate-200 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-900/50 flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-dark-800">
                        <button onClick={() => setSelectedGroup(null)} className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-dark-500 hover:text-synapse-600 transition-colors mb-3">
                            ← Back to Groups
                        </button>
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${group.color} flex items-center justify-center text-white font-bold text-sm shadow-lg mb-3`}>
                            {group.name.substring(0, 2)}
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-dark-50">{group.name}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-dark-500 mt-0.5">{onlineCount} online · {group.members.length} members</p>
                    </div>

                    {/* Channels */}
                    <div className="p-3">
                        <p className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-widest mb-2 px-2">Channels</p>
                        {group.channels.map(ch => (
                            <button
                                key={ch}
                                onClick={() => setActiveChannel(ch)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${activeChannel === ch ? 'bg-white dark:bg-dark-800 text-synapse-600 dark:text-synapse-400 shadow-sm border border-slate-200 dark:border-dark-700' : 'text-slate-500 dark:text-dark-400 hover:bg-white/50 dark:hover:bg-dark-800/50'}`}
                            >
                                <Hash size={14} /> {ch}
                            </button>
                        ))}
                    </div>

                    {/* Members */}
                    <div className="p-3 mt-auto border-t border-slate-100 dark:border-dark-800">
                        <p className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-widest mb-2 px-2">Members</p>
                        <div className="space-y-1">
                            {group.members.map((m, i) => (
                                <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                                    <div className="relative">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-dark-300">
                                            {m.avatar}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-50 dark:border-dark-900 ${m.online ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-dark-600'}`} />
                                    </div>
                                    <span className="text-[12px] font-semibold text-slate-600 dark:text-dark-300 truncate">{m.name}</span>
                                    {m.role === 'admin' && <Crown size={10} className="text-amber-500 flex-shrink-0" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Chat Header */}
                    <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 dark:border-dark-800 flex items-center justify-between bg-white dark:bg-dark-950">
                        <div className="flex items-center gap-2">
                            <Hash size={18} className="text-slate-400" />
                            <h3 className="text-sm font-black text-slate-800 dark:text-dark-50">{activeChannel}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors text-slate-400"><Pin size={16} /></button>
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors text-slate-400"><Search size={16} /></button>
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors text-slate-400"><Settings size={16} /></button>
                        </div>
                    </div>

                    {/* Pinned Resources */}
                    {group.pinnedResources.length > 0 && (
                        <div className="px-6 py-3 border-b border-slate-100 dark:border-dark-800/60 bg-slate-50/50 dark:bg-dark-900/30 flex items-center gap-3 overflow-x-auto">
                            <Pin size={12} className="text-slate-400 flex-shrink-0" />
                            {group.pinnedResources.map((res, i) => (
                                <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-[11px] font-bold text-slate-600 dark:text-dark-300 flex-shrink-0 cursor-pointer hover:border-synapse-300 transition-colors">
                                    <FileText size={11} /> {res}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 custom-scrollbar">
                        {MOCK_MESSAGES.map(msg => (
                            <div key={msg.id} className="flex items-start gap-3 group">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-[11px] font-bold text-slate-500 dark:text-dark-300 flex-shrink-0">
                                    {msg.avatar}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[13px] font-bold text-slate-800 dark:text-dark-100">{msg.user}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-dark-500 font-medium">{msg.time}</span>
                                    </div>
                                    <p className="text-[14px] text-slate-600 dark:text-dark-300 leading-relaxed">{msg.message}</p>
                                    {msg.reactions.length > 0 && (
                                        <div className="flex items-center gap-1 mt-2">
                                            {msg.reactions.map((r, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-dark-800 rounded-full text-[12px] cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors border border-slate-200 dark:border-dark-700">
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Message Input */}
                    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 dark:border-dark-800 bg-white dark:bg-dark-950">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-dark-800 px-4 py-3">
                            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 transition-colors"><Paperclip size={18} /></button>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder={`Message #${activeChannel}...`}
                                className="flex-1 bg-transparent text-sm font-medium text-slate-800 dark:text-dark-50 placeholder-slate-400 dark:placeholder-dark-500 outline-none"
                            />
                            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 transition-colors"><Smile size={18} /></button>
                            <button className="w-8 h-8 rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white flex items-center justify-center transition-colors">
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in overflow-y-auto custom-scrollbar">
            {/* Header */}
            <header className="flex-shrink-0 px-8 pt-8 pb-4">
                <div className="max-w-[1240px] mx-auto">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-200/40 dark:shadow-none">
                                    <Users size={24} />
                                </div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-dark-50">
                                    Study <span className="text-blue-500">Groups</span>
                                </h1>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-dark-400 font-medium">
                                Collaborate with peers — share notes, chat, and learn together.
                            </p>
                        </div>
                        <button className="flex items-center gap-2 px-5 py-2.5 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-synapse-200/40 dark:shadow-none">
                            <Plus size={18} /> Create Group
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 px-8 pb-12">
                <div className="max-w-[1240px] mx-auto space-y-6">

                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search groups..."
                            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 transition-all text-slate-800 dark:text-dark-50 placeholder-slate-400 dark:placeholder-dark-500"
                        />
                    </div>

                    {/* Groups Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {MOCK_GROUPS.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).map(group => {
                            const onlineCount = group.members.filter(m => m.online).length;
                            return (
                                <button
                                    key={group.id}
                                    onClick={() => setSelectedGroup(group.id)}
                                    className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 text-left hover:shadow-xl hover:shadow-slate-100/50 dark:hover:shadow-none transition-all duration-300 group/card"
                                >
                                    <div className="flex items-start gap-4 mb-5">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${group.color} flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0 group-hover/card:scale-110 transition-transform duration-300`}>
                                            {group.name.substring(0, 2)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-black text-slate-800 dark:text-dark-50 mb-0.5 group-hover/card:text-synapse-600 transition-colors">{group.name}</h3>
                                            <p className="text-[12px] text-slate-500 dark:text-dark-400 font-medium truncate">{group.description}</p>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-300 dark:text-dark-600 group-hover/card:text-synapse-500 transition-colors flex-shrink-0 mt-1" />
                                    </div>

                                    {/* Member Avatars */}
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="flex -space-x-2">
                                            {group.members.slice(0, 4).map((m, i) => (
                                                <div key={i} className="relative">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-dark-300 border-2 border-white dark:border-dark-900">
                                                        {m.avatar}
                                                    </div>
                                                </div>
                                            ))}
                                            {group.members.length > 4 && (
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-dark-800 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-dark-400 border-2 border-white dark:border-dark-900">
                                                    +{group.members.length - 4}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/50">
                                            {onlineCount} online
                                        </span>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-5 text-[11px] text-slate-400 dark:text-dark-500 font-bold">
                                        <span className="flex items-center gap-1.5"><FileText size={12} /> {group.sharedFiles} files</span>
                                        <span className="flex items-center gap-1.5"><MessageSquare size={12} /> {group.messages} messages</span>
                                        <span className="ml-auto text-[10px] uppercase tracking-wider">{group.recentActivity}</span>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Create Group Card */}
                        <button className="border-2 border-dashed border-slate-200 dark:border-dark-800 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-dark-500 hover:border-synapse-400 hover:text-synapse-500 transition-all min-h-[220px]">
                            <div className="w-14 h-14 rounded-xl border-2 border-dashed border-current flex items-center justify-center">
                                <Plus size={28} />
                            </div>
                            <span className="text-sm font-bold">Create New Group</span>
                            <span className="text-[11px] font-medium">Invite peers and start collaborating</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

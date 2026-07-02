import React, { useState, useEffect, useRef } from 'react';
import { useCore } from '../../context/CoreContext';
import { groups as groupsApi, getUserId } from '../../../services/api.js';
import {
    Users, Plus, Search, MessageSquare, Crown, ChevronRight,
    Hash, Send, X, Lock, Unlock, Trash2, RefreshCw,
    Link, Copy, Check, LogOut,
} from 'lucide-react';

const GROUP_COLORS = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-emerald-500 to-emerald-600',
    'from-amber-500 to-amber-600',
    'from-rose-500 to-rose-600',
    'from-cyan-500 to-cyan-600',
];

const CHANNELS = ['general', 'resources', 'questions', 'announcements'];

export default function StudyGroups({ onToast }) {
    const { isOnline } = useCore();
    const userId = getUserId();

    // ── List view ──────────────────────────────────────────────────────────────
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // ── Group detail ───────────────────────────────────────────────────────────
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [activeChannel, setActiveChannel] = useState('general');
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [copiedInvite, setCopiedInvite] = useState(false);

    // ── Modals ─────────────────────────────────────────────────────────────────
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', description: '', colorIdx: 0 });
    const [joinCode, setJoinCode] = useState('');
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);

    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    // ── Load group list ────────────────────────────────────────────────────────
    const loadGroups = async () => {
        if (!userId) { setLoading(false); return; }
        try {
            const res = await groupsApi.list(userId);
            setGroups(Array.isArray(res) ? res : []);
        } catch (err) {
            onToast?.(`Failed to load groups: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOnline) loadGroups();
    }, [isOnline]);

    // ── Poll messages while in a group ────────────────────────────────────────
    const fetchMessages = async (groupId, channel) => {
        try {
            const res = await groupsApi.getMessages(groupId, channel);
            setMessages(Array.isArray(res) ? res : []);
        } catch (_) { /* silent poll failure */ }
    };

    useEffect(() => {
        if (!selectedGroup) {
            clearInterval(pollRef.current);
            return;
        }
        setMessagesLoading(true);
        fetchMessages(selectedGroup.id, activeChannel).finally(() => setMessagesLoading(false));
        pollRef.current = setInterval(() => fetchMessages(selectedGroup.id, activeChannel), 5000);
        return () => clearInterval(pollRef.current);
    }, [selectedGroup?.id, activeChannel]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Derived ────────────────────────────────────────────────────────────────
    const getProfile = () => {
        try { return JSON.parse(localStorage.getItem('cortex-auth-profile') || '{}'); } catch { return {}; }
    };
    const currentMember = selectedGroup?.members?.find(m => m.user_id === userId);
    const isAdmin = currentMember?.role === 'admin';
    const canSend = currentMember && !currentMember.is_blocked &&
        (selectedGroup?.messaging_mode === 'everyone' || isAdmin);

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleCreateGroup = async () => {
        if (!createForm.name.trim()) return;
        setCreating(true);
        try {
            const profile = getProfile();
            const group = await groupsApi.create({
                name: createForm.name.trim(),
                description: createForm.description.trim() || null,
                creator_id: userId,
                creator_name: profile.name || profile.username || 'You',
                color: GROUP_COLORS[createForm.colorIdx],
            });
            setGroups(prev => [group, ...prev]);
            setShowCreateModal(false);
            setCreateForm({ name: '', description: '', colorIdx: 0 });
            onToast?.('Group created!', 'success');
        } catch (err) {
            onToast?.(`Failed to create: ${err.message}`, 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleJoinGroup = async () => {
        if (!joinCode.trim()) return;
        setJoining(true);
        try {
            const profile = getProfile();
            // Accept full link (last path segment) or raw code
            const code = joinCode.trim().split('/').filter(Boolean).pop();
            const group = await groupsApi.join(code, userId, profile.name || profile.username || 'Member');
            setGroups(prev => prev.some(g => g.id === group.id) ? prev : [group, ...prev]);
            setShowJoinModal(false);
            setJoinCode('');
            onToast?.(`Joined "${group.name}"!`, 'success');
        } catch (err) {
            onToast?.(`Failed to join: ${err.message}`, 'error');
        } finally {
            setJoining(false);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !canSend || sending) return;
        const content = messageInput.trim();
        setMessageInput('');
        setSending(true);
        try {
            const profile = getProfile();
            const msg = await groupsApi.sendMessage(selectedGroup.id, {
                sender_id: userId,
                sender_name: profile.name || profile.username || 'You',
                content,
                channel: activeChannel,
            });
            setMessages(prev => [...prev, msg]);
        } catch (err) {
            setMessageInput(content); // restore on failure
            onToast?.(`Send failed: ${err.message}`, 'error');
        } finally {
            setSending(false);
        }
    };

    const handleDeleteGroup = async () => {
        if (!selectedGroup || !isAdmin) return;
        if (!window.confirm(`Delete "${selectedGroup.name}"? This cannot be undone.`)) return;
        try {
            await groupsApi.delete(selectedGroup.id, userId);
            setGroups(prev => prev.filter(g => g.id !== selectedGroup.id));
            setSelectedGroup(null);
            onToast?.('Group deleted', 'success');
        } catch (err) {
            onToast?.(`Delete failed: ${err.message}`, 'error');
        }
    };

    const handleLeaveGroup = async () => {
        if (!selectedGroup) return;
        if (!window.confirm(`Leave "${selectedGroup.name}"?`)) return;
        try {
            await groupsApi.leave(selectedGroup.id, userId);
            setGroups(prev => prev.filter(g => g.id !== selectedGroup.id));
            setSelectedGroup(null);
            onToast?.('Left group', 'success');
        } catch (err) {
            onToast?.(`Failed to leave: ${err.message}`, 'error');
        }
    };

    const handleBlockMember = async (memberUserId) => {
        if (!isAdmin) return;
        try {
            await groupsApi.blockMember(selectedGroup.id, memberUserId, userId);
            setSelectedGroup(prev => ({
                ...prev,
                members: prev.members.map(m =>
                    m.user_id === memberUserId ? { ...m, is_blocked: 1 } : m
                ),
            }));
            onToast?.('Member blocked', 'success');
        } catch (err) {
            onToast?.(`Block failed: ${err.message}`, 'error');
        }
    };

    const handleToggleMessaging = async () => {
        const newMode = selectedGroup.messaging_mode === 'everyone' ? 'admin_only' : 'everyone';
        try {
            const updated = await groupsApi.updateSettings(selectedGroup.id, userId, { messaging_mode: newMode });
            setSelectedGroup(updated);
            setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
            onToast?.(`Messaging: ${newMode === 'everyone' ? 'everyone can send' : 'admin only'}`, 'success');
        } catch (err) {
            onToast?.(`Update failed: ${err.message}`, 'error');
        }
    };

    const handleCopyInvite = () => {
        navigator.clipboard?.writeText(selectedGroup.invite_code).then(() => {
            setCopiedInvite(true);
            setTimeout(() => setCopiedInvite(false), 2000);
        }).catch(() => onToast?.('Copy failed', 'error'));
    };

    // ── Group Detail View ──────────────────────────────────────────────────────
    if (selectedGroup) {
        const activeMembers = (selectedGroup.members || []).filter(m => !m.is_blocked);

        return (
            <div className="h-full flex bg-white dark:bg-dark-950 animate-fade-in">
                {/* Sidebar */}
                <div className="w-[260px] flex-shrink-0 border-r border-slate-200 dark:border-dark-800 bg-slate-50/50 dark:bg-dark-900/50 flex flex-col overflow-y-auto custom-scrollbar">
                    <div className="p-4 border-b border-slate-100 dark:border-dark-800">
                        <button
                            onClick={() => setSelectedGroup(null)}
                            className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-dark-500 hover:text-synapse-600 transition-colors mb-3"
                        >
                            ← Back to Groups
                        </button>
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${selectedGroup.color} flex items-center justify-center text-white font-bold text-sm shadow-lg mb-3`}>
                            {selectedGroup.name.substring(0, 2).toUpperCase()}
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-dark-50">{selectedGroup.name}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-dark-500 mt-0.5">{activeMembers.length} members</p>

                        {/* Invite code */}
                        <div className="mt-3 flex items-center gap-2 bg-slate-100 dark:bg-dark-800 rounded-lg px-2 py-1.5">
                            <code className="text-[10px] font-mono text-slate-500 dark:text-dark-400 flex-1 truncate">
                                {selectedGroup.invite_code}
                            </code>
                            <button
                                onClick={handleCopyInvite}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-dark-700 rounded transition-colors text-slate-400 hover:text-synapse-500 flex-shrink-0"
                                title="Copy invite code"
                            >
                                {copiedInvite ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                        </div>
                    </div>

                    {/* Channels */}
                    <div className="p-3">
                        <p className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-widest mb-2 px-2">Channels</p>
                        {CHANNELS.map(ch => (
                            <button
                                key={ch}
                                onClick={() => setActiveChannel(ch)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${activeChannel === ch ? 'bg-white dark:bg-dark-800 text-synapse-600 dark:text-synapse-400 shadow-sm border border-slate-200 dark:border-dark-700' : 'text-slate-500 dark:text-dark-400 hover:bg-white/50 dark:hover:bg-dark-800/50'}`}
                            >
                                <Hash size={14} /> {ch}
                            </button>
                        ))}
                    </div>

                    {/* Admin controls */}
                    {isAdmin && (
                        <div className="p-3 border-t border-slate-100 dark:border-dark-800">
                            <p className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-widest mb-2 px-2">Admin</p>
                            <button
                                onClick={handleToggleMessaging}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-slate-600 dark:text-dark-300 hover:bg-white dark:hover:bg-dark-800 transition-all"
                            >
                                {selectedGroup.messaging_mode === 'everyone'
                                    ? <><Unlock size={13} /> Everyone can message</>
                                    : <><Lock size={13} className="text-amber-500" /> Admin-only messages</>
                                }
                            </button>
                            <button
                                onClick={handleDeleteGroup}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            >
                                <Trash2 size={13} /> Delete Group
                            </button>
                        </div>
                    )}

                    {/* Members list */}
                    <div className="p-3 border-t border-slate-100 dark:border-dark-800 mt-auto">
                        <p className="text-[10px] font-black text-slate-400 dark:text-dark-500 uppercase tracking-widest mb-2 px-2">
                            Members ({activeMembers.length})
                        </p>
                        <div className="space-y-0.5">
                            {activeMembers.map((m) => (
                                <div
                                    key={m.id}
                                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg group/member hover:bg-white dark:hover:bg-dark-800 transition-all"
                                >
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-dark-300 flex-shrink-0">
                                        {m.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-[12px] font-semibold text-slate-600 dark:text-dark-300 truncate flex-1">
                                        {m.name}
                                    </span>
                                    {m.role === 'admin' && <Crown size={10} className="text-amber-500 flex-shrink-0" />}
                                    {isAdmin && m.user_id !== userId && (
                                        <button
                                            onClick={() => handleBlockMember(m.user_id)}
                                            className="opacity-0 group-hover/member:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-300 hover:text-red-500 transition-all flex-shrink-0"
                                            title="Block member"
                                        >
                                            <X size={10} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {!isAdmin && (
                            <button
                                onClick={handleLeaveGroup}
                                className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-slate-400 dark:text-dark-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all"
                            >
                                <LogOut size={13} /> Leave Group
                            </button>
                        )}
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
                        {selectedGroup.messaging_mode === 'admin_only' && (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full border border-amber-100 dark:border-amber-800/50">
                                <Lock size={10} /> Admin-only messaging
                            </span>
                        )}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 custom-scrollbar">
                        {messagesLoading && messages.length === 0 && (
                            <div className="flex items-center justify-center py-12 text-slate-400">
                                <RefreshCw size={20} className="animate-spin mr-2" />
                                <span className="text-sm font-medium">Loading…</span>
                            </div>
                        )}
                        {!messagesLoading && messages.length === 0 && (
                            <div className="text-center py-16">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-3 text-slate-300 dark:text-dark-600">
                                    <MessageSquare size={24} />
                                </div>
                                <p className="text-sm font-bold text-slate-400 dark:text-dark-500">No messages yet</p>
                                <p className="text-[12px] text-slate-400 dark:text-dark-500 mt-1">
                                    {canSend ? `Start the conversation in #${activeChannel}` : 'Only admins can message here.'}
                                </p>
                            </div>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} className="flex items-start gap-3 group">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-synapse-200 to-synapse-300 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-[11px] font-bold text-synapse-700 dark:text-dark-300 flex-shrink-0">
                                    {msg.sender_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[13px] font-bold text-slate-800 dark:text-dark-100">
                                            {msg.sender_name}
                                        </span>
                                        <span className="text-[10px] text-slate-400 dark:text-dark-500 font-medium">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[14px] text-slate-600 dark:text-dark-300 leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 dark:border-dark-800 bg-white dark:bg-dark-950">
                        {canSend ? (
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-dark-800 px-4 py-3">
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    placeholder={`Message #${activeChannel}…`}
                                    className="flex-1 bg-transparent text-sm font-medium text-slate-800 dark:text-dark-50 placeholder-slate-400 dark:placeholder-dark-500 outline-none"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim() || sending}
                                    className="w-8 h-8 rounded-xl bg-synapse-600 hover:bg-synapse-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-dark-800 px-4 py-3 text-slate-400 dark:text-dark-500">
                                <Lock size={14} />
                                <span className="text-sm">
                                    {currentMember?.is_blocked
                                        ? 'You have been blocked from this group.'
                                        : 'Only admins can send messages in this group.'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Groups List View ───────────────────────────────────────────────────────
    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-white dark:bg-dark-950 animate-fade-in overflow-y-auto custom-scrollbar">
            {/* Header */}
            <header className="flex-shrink-0 px-8 pt-8 pb-4">
                <div className="max-w-[1240px] mx-auto">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200/40 dark:shadow-none">
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
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowJoinModal(true)}
                                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-dark-800 transition-all"
                            >
                                <Link size={16} /> Join Group
                            </button>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-synapse-200/40 dark:shadow-none"
                            >
                                <Plus size={18} /> Create Group
                            </button>
                        </div>
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
                            placeholder="Search groups…"
                            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 transition-all text-slate-800 dark:text-dark-50 placeholder-slate-400 dark:placeholder-dark-500"
                        />
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-24 text-slate-400 dark:text-dark-500">
                            <RefreshCw size={24} className="animate-spin mr-3" />
                            <span className="text-sm font-medium">Loading groups…</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Empty state — no groups at all */}
                            {filteredGroups.length === 0 && groups.length === 0 && (
                                <div className="col-span-2 text-center py-16">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-dark-600">
                                        <Users size={28} />
                                    </div>
                                    <h3 className="text-base font-black text-slate-800 dark:text-dark-50 mb-2">No groups yet</h3>
                                    <p className="text-sm text-slate-500 dark:text-dark-400 mb-5">
                                        Create a group to collaborate with peers, or join one with an invite code.
                                    </p>
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setShowJoinModal(true)}
                                            className="px-4 py-2 border border-slate-200 dark:border-dark-700 text-sm font-bold rounded-xl text-slate-600 dark:text-dark-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition-all"
                                        >
                                            Join with code
                                        </button>
                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            className="px-4 py-2 bg-synapse-600 text-white text-sm font-bold rounded-xl hover:bg-synapse-700 transition-all"
                                        >
                                            Create first group
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Group cards */}
                            {filteredGroups.map(group => {
                                const me = (group.members || []).find(m => m.user_id === userId);
                                const adminFlag = me?.role === 'admin';
                                const activeCount = (group.members || []).filter(m => !m.is_blocked).length;
                                return (
                                    <button
                                        key={group.id}
                                        onClick={() => { setSelectedGroup(group); setActiveChannel('general'); setMessages([]); }}
                                        className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 text-left hover:shadow-xl hover:shadow-slate-100/50 dark:hover:shadow-none transition-all duration-300 group/card"
                                    >
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${group.color} flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0 group-hover/card:scale-110 transition-transform duration-300`}>
                                                {group.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-base font-black text-slate-800 dark:text-dark-50 group-hover/card:text-synapse-600 transition-colors">
                                                        {group.name}
                                                    </h3>
                                                    {adminFlag && <Crown size={12} className="text-amber-500 flex-shrink-0" />}
                                                </div>
                                                <p className="text-[12px] text-slate-500 dark:text-dark-400 font-medium truncate">
                                                    {group.description || 'No description'}
                                                </p>
                                            </div>
                                            <ChevronRight size={18} className="text-slate-300 dark:text-dark-600 group-hover/card:text-synapse-500 transition-colors flex-shrink-0 mt-1" />
                                        </div>

                                        {/* Avatars */}
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="flex -space-x-2">
                                                {(group.members || []).filter(m => !m.is_blocked).slice(0, 4).map((m) => (
                                                    <div key={m.id} className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-dark-300 border-2 border-white dark:border-dark-900">
                                                        {m.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                ))}
                                                {activeCount > 4 && (
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-dark-800 flex items-center justify-center text-[9px] font-bold text-slate-500 border-2 border-white dark:border-dark-900">
                                                        +{activeCount - 4}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-800/50">
                                                {activeCount} {activeCount === 1 ? 'member' : 'members'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-5 text-[11px] text-slate-400 dark:text-dark-500 font-bold">
                                            <span className="flex items-center gap-1.5">
                                                <MessageSquare size={12} /> {group.message_count} messages
                                            </span>
                                            {group.messaging_mode === 'admin_only' && (
                                                <span className="flex items-center gap-1.5 text-amber-500">
                                                    <Lock size={11} /> Admin-only
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}

                            {/* Create Group card — shown once there are existing groups */}
                            {groups.length > 0 && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="border-2 border-dashed border-slate-200 dark:border-dark-800 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-dark-500 hover:border-synapse-400 hover:text-synapse-500 transition-all min-h-[220px]"
                                >
                                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-current flex items-center justify-center">
                                        <Plus size={28} />
                                    </div>
                                    <span className="text-sm font-bold">Create New Group</span>
                                    <span className="text-[11px] font-medium">Invite peers and start collaborating</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create Group Modal ───────────────────────────────────────────────────── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-fade-in">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-black text-slate-800 dark:text-dark-50">Create Study Group</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-dark-400 mb-1.5">Group Name *</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={createForm.name}
                                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                                    placeholder="e.g. AI & ML Study Circle"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 text-slate-800 dark:text-dark-50 placeholder-slate-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-dark-400 mb-1.5">Description</label>
                                <textarea
                                    rows={2}
                                    value={createForm.description}
                                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="What is this group for?"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 text-slate-800 dark:text-dark-50 placeholder-slate-400 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-dark-400 mb-2">Color</label>
                                <div className="flex gap-2">
                                    {GROUP_COLORS.map((c, i) => (
                                        <button
                                            key={c}
                                            onClick={() => setCreateForm(f => ({ ...f, colorIdx: i }))}
                                            className={`w-8 h-8 rounded-full bg-gradient-to-tr ${c} transition-all ${createForm.colorIdx === i ? 'ring-2 ring-offset-2 ring-synapse-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-dark-800 transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={!createForm.name.trim() || creating}
                                className="flex-1 py-2.5 bg-synapse-600 hover:bg-synapse-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
                            >
                                {creating ? 'Creating…' : 'Create Group'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Join Group Modal ──────────────────────────────────────────────────────── */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black text-slate-800 dark:text-dark-50">Join a Group</h2>
                            <button onClick={() => setShowJoinModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-dark-400 mb-4">
                            Paste the invite code or link shared by the group admin.
                        </p>
                        <input
                            autoFocus
                            type="text"
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleJoinGroup()}
                            placeholder="Invite code or link…"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl text-sm font-medium font-mono focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 text-slate-800 dark:text-dark-50 placeholder-slate-400 mb-5"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowJoinModal(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-dark-700 text-slate-600 dark:text-dark-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-dark-800 transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={handleJoinGroup}
                                disabled={!joinCode.trim() || joining}
                                className="flex-1 py-2.5 bg-synapse-600 hover:bg-synapse-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
                            >
                                {joining ? 'Joining…' : 'Join Group'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

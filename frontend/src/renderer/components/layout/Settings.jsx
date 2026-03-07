import React, { useState, useRef, useEffect } from 'react';
import {
    Settings as SettingsIcon, Bell, Palette, Database, ShieldCheck, User,
    LogOut, X, ChevronRight, ChevronDown, Check, Sun, Moon, Monitor as MonitorIcon,
    Cpu, Download, Trash2, Archive, Shield, Eye, EyeOff, AlertTriangle, Pencil
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Reusable primitives
───────────────────────────────────────────────────────────── */

const Divider = () => <div className="h-px bg-slate-100 dark:bg-dark-800" />;

const Row = ({ label, desc, children }) => (
    <>
        <div className="flex items-start justify-between gap-6 py-3">
            <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-dark-100">{label}</p>
                {desc && <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5 leading-relaxed">{desc}</p>}
            </div>
            <div className="flex-shrink-0 flex items-center">{children}</div>
        </div>
        <Divider />
    </>
);

const Toggle = ({ value, onChange, disabled }) => (
    <button
        onClick={disabled ? undefined : () => onChange(!value)}
        disabled={disabled}
        className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-synapse-500/50
            ${value ? 'bg-synapse-500' : 'bg-slate-200 dark:bg-dark-700'}
            ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        role="switch"
        aria-checked={value}
    >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${value ? 'right-1' : 'left-1'}`} />
    </button>
);

const Btn = ({ children, onClick, variant = 'default', className = '' }) => {
    const base = 'px-4 py-1.5 text-xs font-semibold rounded-full transition-all focus:outline-none focus-visible:ring-2';
    const variants = {
        default: 'border border-slate-300 dark:border-dark-600 text-slate-700 dark:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 focus-visible:ring-synapse-400/40',
        danger:  'border border-red-300 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 focus-visible:ring-red-400/40',
        primary: 'bg-synapse-600 hover:bg-synapse-700 text-white border border-synapse-500 shadow-sm focus-visible:ring-synapse-400/40',
    };
    return (
        <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>{children}</button>
    );
};

/* Dropdown primitive (custom styled) */
const Dropdown = ({ value, onChange, options }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o => o.value === value) || options[0];

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-dark-200 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 rounded-xl border border-slate-200 dark:border-dark-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-synapse-500/40 min-w-[130px] justify-between"
            >
                <span className="flex items-center gap-1.5">{selected.icon && <span className="opacity-70">{selected.icon}</span>}{selected.label}</span>
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-xl shadow-xl z-50 min-w-[150px] overflow-hidden animate-fade-in py-1">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left
                                ${opt.value === value
                                    ? 'text-synapse-600 dark:text-synapse-400 bg-synapse-50 dark:bg-synapse-900/20 font-semibold'
                                    : 'text-slate-700 dark:text-dark-200 hover:bg-slate-50 dark:hover:bg-dark-800'}`}
                        >
                            {opt.icon && <span className="opacity-60">{opt.icon}</span>}
                            <span className="flex-1">{opt.label}</span>
                            {opt.value === value && <Check size={14} className="text-synapse-500" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/* Confirmation mini-dialog (stacked above modal) */
const ConfirmDialog = ({ open, title, message, confirmText = 'Confirm', danger = false, onConfirm, onCancel, children }) => {
    if (!open) return null;
    return (
        <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center rounded-2xl">
            <div className="bg-white dark:bg-dark-900 rounded-2xl w-[340px] shadow-2xl p-6 border border-slate-200/60 dark:border-dark-700/60 animate-scale-in mx-4">
                {danger && (
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                        <AlertTriangle size={20} className="text-red-500" />
                    </div>
                )}
                <h3 className="text-base font-bold text-slate-800 dark:text-dark-50 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-dark-400 mb-5 leading-relaxed">{message}</p>
                {children}
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-5 py-2 text-sm font-bold rounded-xl transition-colors shadow-sm ${danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-synapse-600 hover:bg-synapse-700 text-white'}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────
   Settings Tab Panels
───────────────────────────────────────────────────────────── */

function GeneralPanel({ theme, setTheme, perfProvider, setPerfProvider, onToast }) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

    const langOptions = [
        { value: 'en', label: 'English' },
        { value: 'hi', label: 'Hindi' },
        { value: 'ta', label: 'Tamil' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
        { value: 'de', label: 'German' },
    ];
    const [language, setLanguage] = useState('en');

    const hwOptions = [
        { value: 'cpu',  label: 'CPU',        icon: <Cpu size={14} /> },
        { value: 'gpu',  label: 'GPU (CUDA)',  icon: <MonitorIcon size={14} /> },
        { value: 'npu',  label: 'NPU (ROCm)',  icon: <MonitorIcon size={14} /> },
    ];

    const themeOptions = [
        { value: 'light',  label: 'Light',  icon: <Sun size={14} /> },
        { value: 'dark',   label: 'Dark',   icon: <Moon size={14} /> },
        { value: 'system', label: 'System', icon: <MonitorIcon size={14} /> },
    ];

    return (
        <>
            <ConfirmDialog
                open={showArchiveConfirm}
                title="Archive all chats?"
                message="Your chats will be hidden from the sidebar. You can restore them any time from Data controls."
                confirmText="Archive all"
                onConfirm={() => { onToast('All chats archived', 'success'); setShowArchiveConfirm(false); }}
                onCancel={() => setShowArchiveConfirm(false)}
            />
            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete all chats?"
                message="All of your chat history will be permanently deleted and cannot be recovered."
                confirmText="Delete all"
                danger
                onConfirm={() => { onToast('All chats deleted', 'success'); setShowDeleteConfirm(false); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            <div className="p-7 space-y-0">
                <div className="mb-5">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-4">General</h3>
                    <Divider />
                </div>

                <Row label="Theme">
                    <Dropdown value={theme} onChange={setTheme} options={themeOptions} />
                </Row>

                <Row label="Language">
                    <Dropdown value={language} onChange={(v) => { setLanguage(v); onToast(`Language set to ${langOptions.find(o=>o.value===v)?.label}`, 'success'); }} options={langOptions} />
                </Row>

                <Row
                    label="Hardware acceleration"
                    desc={`Currently running on ${perfProvider.toUpperCase()}`}
                >
                    <Dropdown value={perfProvider} onChange={(v) => { setPerfProvider(v); onToast(`Switched to ${hwOptions.find(o=>o.value===v)?.label}`, 'success'); }} options={hwOptions} />
                </Row>

                <Row label="Archive all chats" desc="Hide all conversations from the sidebar">
                    <Btn onClick={() => setShowArchiveConfirm(true)}>Archive all</Btn>
                </Row>

                <div className="flex items-start justify-between gap-6 py-3">
                    <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-dark-100">Delete all chats</p>
                        <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Permanently remove all conversations</p>
                    </div>
                    <Btn variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete all</Btn>
                </div>
            </div>
        </>
    );
}

function NotificationsPanel() {
    const [push, setPush]         = useState(false);
    const [email, setEmail]       = useState(false);
    const [reminders, setReminders] = useState(true);
    const [peerAlerts, setPeerAlerts] = useState(true);
    const [downloadAlerts, setDownloadAlerts] = useState(false);
    const [ratings, setRatings]   = useState(true);

    const items = [
        { label: 'Push notifications',  desc: 'Alerts for new messages and AI responses',        value: push,          set: setPush         },
        { label: 'Email digest',         desc: 'Weekly summary of your study activity',            value: email,         set: setEmail        },
        { label: 'Study reminders',      desc: 'Daily reminders for your learning goals',           value: reminders,     set: setReminders    },
        { label: 'Peer activity',        desc: 'When peers join or share on the mesh network',     value: peerAlerts,    set: setPeerAlerts   },
        { label: 'Download milestones',  desc: 'When your notes cross a download milestone',       value: downloadAlerts,set: setDownloadAlerts},
        { label: 'Ratings & reviews',    desc: 'When someone rates or reviews your uploads',       value: ratings,       set: setRatings      },
    ];

    return (
        <div className="p-7 space-y-0">
            <div className="mb-5">
                <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-4">Notifications</h3>
                <Divider />
            </div>
            {items.map(({ label, desc, value, set }) => (
                <Row key={label} label={label} desc={desc}>
                    <Toggle value={value} onChange={set} />
                </Row>
            ))}
        </div>
    );
}

function PersonalizationPanel({ username, setUsername, userStream, onOpenStreamSelector, onToast }) {
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName]       = useState(username);
    const [memory, setMemory]           = useState(true);
    const [compactMode, setCompactMode] = useState(false);
    const [codeHighlight, setCodeHighlight] = useState(true);
    const nameRef = useRef(null);

    useEffect(() => {
        if (editingName && nameRef.current) nameRef.current.focus();
    }, [editingName]);

    const saveName = () => {
        const trimmed = tempName.trim();
        if (trimmed && trimmed !== username) {
            setUsername(trimmed);
            onToast('Display name updated', 'success');
        }
        setEditingName(false);
    };

    return (
        <div className="p-7 space-y-0">
            <div className="mb-5">
                <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-4">Personalization</h3>
                <Divider />
            </div>

            {/* Display name */}
            <Row label="Display name" desc="How you appear across the app">
                {editingName ? (
                    <div className="flex items-center gap-2">
                        <input
                            ref={nameRef}
                            type="text"
                            value={tempName}
                            onChange={e => setTempName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditingName(false); setTempName(username); } }}
                            className="w-36 px-3 py-1.5 text-sm bg-white dark:bg-dark-950 border border-synapse-400 dark:border-synapse-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-synapse-500/30 text-slate-800 dark:text-dark-50 text-right transition-all"
                        />
                        <button onClick={saveName} className="p-1.5 bg-synapse-600 text-white rounded-lg hover:bg-synapse-700 transition-colors">
                            <Check size={14} />
                        </button>
                        <button onClick={() => { setEditingName(false); setTempName(username); }} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setEditingName(true)}
                        className="flex items-center gap-2 text-sm text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-100 group px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
                    >
                        {username}
                        <Pencil size={13} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                )}
            </Row>

            {/* Academic stream */}
            <Row label="Academic stream" desc="Personalises content and recommendations">
                <button
                    onClick={onOpenStreamSelector}
                    className="flex items-center gap-2 text-sm text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-100 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors font-medium"
                >
                    <span className="capitalize">{userStream ? userStream.replace('-', ' ') : 'Not set'}</span>
                    <ChevronRight size={14} />
                </button>
            </Row>

            {/* Memory */}
            <Row label="Memory" desc="Cortex remembers details from your sessions for smarter, personalised responses">
                <Toggle value={memory} onChange={setMemory} />
            </Row>

            {/* Compact mode */}
            <Row label="Compact mode" desc="Reduces spacing and padding across the interface">
                <Toggle value={compactMode} onChange={setCompactMode} />
            </Row>

            {/* Syntax highlighting */}
            <div className="flex items-start justify-between gap-6 py-3">
                <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-dark-100">Code syntax highlighting</p>
                    <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Colourises code blocks in AI responses</p>
                </div>
                <Toggle value={codeHighlight} onChange={setCodeHighlight} />
            </div>
        </div>
    );
}

function DataControlsPanel({ onToast }) {
    const [improveModel, setImproveModel] = useState(true);
    const [chat2Improve, setChat2Improve] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

    const handleExport = () => {
        const data = { exportedAt: new Date().toISOString(), version: '1.0', note: 'Cortex data export' };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `cortex-export-${Date.now()}.json`; a.click();
        URL.revokeObjectURL(url);
        onToast('Data exported successfully', 'success');
    };

    return (
        <>
            <ConfirmDialog
                open={showArchiveConfirm}
                title="Archive all chats?"
                message="Your chats will be hidden from the sidebar. You can restore them from Archived chats."
                confirmText="Archive all"
                onConfirm={() => { onToast('All chats archived', 'success'); setShowArchiveConfirm(false); }}
                onCancel={() => setShowArchiveConfirm(false)}
            />
            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete all chats?"
                message="All of your chat history will be permanently deleted and cannot be recovered."
                confirmText="Delete all"
                danger
                onConfirm={() => { onToast('All chats deleted', 'success'); setShowDeleteConfirm(false); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            <div className="p-7 space-y-0">
                <div className="mb-5">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-4">Data controls</h3>
                    <Divider />
                </div>

                <Row
                    label="Improve Cortex for everyone"
                    desc="Allow your interactions to help train and improve Cortex's AI models. You can opt out at any time."
                >
                    <Toggle value={improveModel} onChange={setImproveModel} />
                </Row>

                <Row
                    label="Share chats for improvement"
                    desc="Allow anonymised chat transcripts to be reviewed for model quality"
                >
                    <Toggle value={chat2Improve} onChange={setChat2Improve} />
                </Row>

                <Row label="Shared links" desc="View and revoke any shared links you've created">
                    <Btn onClick={() => onToast('No shared links yet', 'success')}>Manage</Btn>
                </Row>

                <Row label="Archived chats" desc="View and restore your archived conversations">
                    <Btn onClick={() => onToast('No archived chats', 'success')}>Manage</Btn>
                </Row>

                <Row label="Archive all chats" desc="Move all conversations to archive">
                    <Btn onClick={() => setShowArchiveConfirm(true)}>Archive all</Btn>
                </Row>

                <Row label="Delete all chats" desc="Permanently remove all conversation history">
                    <Btn variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete all</Btn>
                </Row>

                <div className="flex items-start justify-between gap-6 py-3">
                    <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-dark-100">Export data</p>
                        <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Download a copy of your notes, chats, and settings</p>
                    </div>
                    <Btn onClick={handleExport}><span className="flex items-center gap-1.5"><Download size={12} />Export</span></Btn>
                </div>
            </div>
        </>
    );
}

function SecurityPanel({ onToast, onLogout }) {
    const [twoFA, setTwoFA]                     = useState(false);
    const [showPwForm, setShowPwForm]           = useState(false);
    const [currentPw, setCurrentPw]             = useState('');
    const [newPw, setNewPw]                     = useState('');
    const [confirmPw, setConfirmPw]             = useState('');
    const [showCurrent, setShowCurrent]         = useState(false);
    const [showNew, setShowNew]                 = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const savePassword = () => {
        if (!currentPw) { onToast('Enter your current password', 'error'); return; }
        if (newPw.length < 8) { onToast('Password must be at least 8 characters', 'error'); return; }
        if (newPw !== confirmPw) { onToast('Passwords do not match', 'error'); return; }
        onToast('Password updated successfully', 'success');
        setShowPwForm(false); setCurrentPw(''); setNewPw(''); setConfirmPw('');
    };

    return (
        <>
            <ConfirmDialog
                open={showLogoutConfirm}
                title="Log out of all devices?"
                message="You will be signed out from every device where Cortex is active. This cannot be undone."
                confirmText="Log out all"
                danger
                onConfirm={() => {
                    onToast('Logged out', 'success');
                    setShowLogoutConfirm(false);
                    onLogout?.();
                }}
                onCancel={() => setShowLogoutConfirm(false)}
            />

            <div className="p-7 space-y-0">
                <div className="mb-5">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-4">Security</h3>
                    <Divider />
                </div>

                {/* Password */}
                <Row label="Password" desc="Last changed over 30 days ago">
                    <Btn onClick={() => setShowPwForm(v => !v)}>{showPwForm ? 'Cancel' : 'Change'}</Btn>
                </Row>

                {showPwForm && (
                    <div className="mb-4 p-4 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-2xl space-y-3 animate-fade-in">
                        {[
                            { label: 'Current password', value: currentPw, set: setCurrentPw, show: showCurrent, toggle: setShowCurrent },
                            { label: 'New password',     value: newPw,     set: setNewPw,     show: showNew,    toggle: setShowNew    },
                            { label: 'Confirm password', value: confirmPw, set: setConfirmPw, show: showNew,    toggle: setShowNew    },
                        ].map(({ label, value, set, show, toggle }) => (
                            <div key={label}>
                                <label className="text-xs font-semibold text-slate-500 dark:text-dark-400 mb-1.5 block">{label}</label>
                                <div className="relative">
                                    <input
                                        type={show ? 'text' : 'password'}
                                        value={value}
                                        onChange={e => set(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-synapse-500/30 focus:border-synapse-400 text-slate-800 dark:text-dark-50 pr-10 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggle(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 transition-colors"
                                    >
                                        {show ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={savePassword}
                            className="w-full py-2 bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold rounded-xl transition-colors mt-1 shadow-sm"
                        >
                            Update password
                        </button>
                    </div>
                )}

                {/* 2FA */}
                <Row
                    label="Two-factor authentication"
                    desc={twoFA ? 'Your account is protected with 2FA' : 'Add an extra layer of security to your account'}
                >
                    <Toggle value={twoFA} onChange={(v) => { setTwoFA(v); onToast(v ? '2FA enabled' : '2FA disabled', 'success'); }} />
                </Row>

                {/* Active sessions */}
                <Row label="Active sessions" desc="1 active session on this device">
                    <Btn onClick={() => onToast('1 session — this device only', 'success')}>
                        <span className="flex items-center gap-1.5">View <ChevronRight size={12} /></span>
                    </Btn>
                </Row>

                {/* Biometric unlock */}
                <Row label="Biometric unlock" desc="Use fingerprint or face ID to unlock Cortex">
                    <Btn onClick={() => onToast('Biometric unlock not available on this device', 'error')}>Set up</Btn>
                </Row>

                {/* Log out all */}
                <div className="flex items-start justify-between gap-6 py-3">
                    <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-dark-100">Log out of all devices</p>
                        <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">End all active sessions everywhere</p>
                    </div>
                    <Btn variant="danger" onClick={() => setShowLogoutConfirm(true)}>Log out all</Btn>
                </div>
            </div>
        </>
    );
}

function AccountPanel({ username, setUsername, userStream, onToast, onClose }) {
    const [editingEmail, setEditingEmail]       = useState(false);
    const [email, setEmail]                     = useState('suryahariharan2006@gmail.com');
    const [tempEmail, setTempEmail]             = useState(email);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput]         = useState('');
    const DELETE_PHRASE = 'delete my account';

    const saveEmail = () => {
        if (!tempEmail.includes('@')) { onToast('Enter a valid email address', 'error'); return; }
        setEmail(tempEmail); onToast('Email updated', 'success'); setEditingEmail(false);
    };

    return (
        <>
            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete your account?"
                message={`This will permanently delete your account and all data. Type "${DELETE_PHRASE}" to confirm.`}
                confirmText="Delete account"
                danger
                onConfirm={() => {
                    if (deleteInput.toLowerCase() !== DELETE_PHRASE) {
                        onToast('Please type the confirmation phrase exactly', 'error'); return;
                    }
                    onToast('Account deletion requested', 'success'); setShowDeleteConfirm(false); onClose();
                }}
                onCancel={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
            >
                <input
                    type="text"
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder={DELETE_PHRASE}
                    className="w-full mt-1 mb-4 px-3 py-2 text-sm bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 text-slate-800 dark:text-dark-50 transition-all"
                />
            </ConfirmDialog>

            <div className="p-7 space-y-0">
                <div className="mb-5">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-dark-50 mb-4">Account</h3>
                    <Divider />
                </div>

                {/* Name */}
                <Row label="Name">
                    <span className="text-sm text-slate-500 dark:text-dark-400">{username}</span>
                </Row>

                {/* Email */}
                <Row label="Email address">
                    {editingEmail ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="email"
                                value={tempEmail}
                                onChange={e => setTempEmail(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEmail(); if (e.key === 'Escape') setEditingEmail(false); }}
                                className="w-52 px-3 py-1.5 text-sm bg-white dark:bg-dark-950 border border-synapse-400 dark:border-synapse-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-synapse-500/30 text-slate-800 dark:text-dark-50 text-right transition-all"
                                autoFocus
                            />
                            <button onClick={saveEmail} className="p-1.5 bg-synapse-600 text-white rounded-lg hover:bg-synapse-700 transition-colors"><Check size={14} /></button>
                            <button onClick={() => setEditingEmail(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-dark-200 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors"><X size={14} /></button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setEditingEmail(true)}
                            className="flex items-center gap-2 text-sm text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-100 group px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
                        >
                            {email}
                            <Pencil size={13} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                    )}
                </Row>

                {/* Plan card */}
                <div className="py-3">
                    <div className="rounded-2xl border border-slate-200 dark:border-dark-700 overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-synapse-500/10 to-indigo-500/10 dark:from-synapse-900/30 dark:to-indigo-900/30 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-dark-50">Cortex Free</p>
                                <p className="text-xs text-slate-500 dark:text-dark-400 mt-0.5">Your current plan</p>
                            </div>
                            <button
                                onClick={() => onToast('Upgrade coming soon!', 'success')}
                                className="px-4 py-1.5 bg-synapse-600 hover:bg-synapse-700 text-white text-xs font-bold rounded-full transition-colors shadow-sm"
                            >
                                Upgrade
                            </button>
                        </div>
                        <div className="p-4 bg-white dark:bg-dark-900 space-y-2">
                            <p className="text-xs font-bold text-slate-700 dark:text-dark-200 mb-2">Your plan includes:</p>
                            {['Offline AI document search', 'Up to 50 documents', 'Basic RAG pipeline', 'Peer mesh network access'].map(f => (
                                <div key={f} className="flex items-center gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-synapse-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-600 dark:text-dark-300">{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <Divider />

                {/* Payment */}
                <Row label="Billing & payment" desc="Manage your subscription and invoices">
                    <Btn onClick={() => onToast('No billing info on free plan', 'success')}>Manage</Btn>
                </Row>

                {/* Delete account */}
                <div className="flex items-start justify-between gap-6 py-3">
                    <div>
                        <p className="text-sm font-medium text-red-500">Delete account</p>
                        <p className="text-xs text-slate-400 dark:text-dark-500 mt-0.5">Permanently remove your account and all data</p>
                    </div>
                    <Btn variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete</Btn>
                </div>
            </div>
        </>
    );
}

/* ─────────────────────────────────────────────────────────────
   Main Settings Modal
───────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
    { id: 'general',         label: 'General',         Icon: SettingsIcon },
    { id: 'notifications',   label: 'Notifications',   Icon: Bell         },
    { id: 'personalization', label: 'Personalization', Icon: Palette      },
    { id: 'data-controls',   label: 'Data controls',   Icon: Database     },
    { id: 'security',        label: 'Security',        Icon: ShieldCheck  },
    { id: 'account',         label: 'Account',         Icon: User         },
];

export default function Settings({
    open, onClose,
    theme, setTheme,
    username, setUsername,
    userStream, setShowStreamSelector,
    perfProvider, setPerfProvider,
    onToast,
    onLogout,
}) {
    const [tab, setTab] = useState('general');

    if (!open) return null;

    const handleOpenStreamSelector = () => {
        onClose();
        setShowStreamSelector(true);
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            style={{ WebkitAppRegion: 'no-drag' }}
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-dark-900 rounded-2xl w-full max-w-3xl h-[600px] shadow-2xl overflow-hidden border border-slate-200/60 dark:border-dark-700/60 flex animate-scale-in relative"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Left nav ── */}
                <div className="w-52 flex-shrink-0 bg-slate-50 dark:bg-dark-950/70 border-r border-slate-100 dark:border-dark-800 flex flex-col p-3">
                    <div className="flex items-center justify-between px-2 py-2 mb-3">
                        <h2 className="text-base font-bold text-slate-800 dark:text-dark-50">Settings</h2>
                        <button
                            onClick={onClose}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:text-dark-500 dark:hover:text-dark-200 hover:bg-slate-200 dark:hover:bg-dark-800 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <nav className="flex flex-col gap-0.5 flex-1">
                        {NAV_ITEMS.map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                onClick={() => setTab(id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full
                                    ${tab === id
                                        ? 'bg-white dark:bg-dark-800 text-synapse-600 dark:text-synapse-400 shadow-sm border border-slate-100 dark:border-dark-700'
                                        : 'text-slate-600 dark:text-dark-400 hover:bg-white/70 dark:hover:bg-dark-800/60 hover:text-slate-900 dark:hover:text-dark-100'}`}
                            >
                                <Icon size={16} className={tab === id ? 'text-synapse-500' : ''} />
                                {label}
                            </button>
                        ))}
                    </nav>

                    <div className="pt-3 border-t border-slate-100 dark:border-dark-800">
                        <button
                            onClick={() => { onClose(); onToast('Logged out', 'success'); }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors w-full"
                        >
                            <LogOut size={16} />
                            Log out
                        </button>
                    </div>
                </div>

                {/* ── Right content ── */}
                <div className="flex-1 overflow-y-auto relative">
                    {tab === 'general'         && <GeneralPanel theme={theme} setTheme={setTheme} perfProvider={perfProvider} setPerfProvider={setPerfProvider} onToast={onToast} />}
                    {tab === 'notifications'   && <NotificationsPanel />}
                    {tab === 'personalization' && <PersonalizationPanel username={username} setUsername={setUsername} userStream={userStream} onOpenStreamSelector={handleOpenStreamSelector} onToast={onToast} />}
                    {tab === 'data-controls'   && <DataControlsPanel onToast={onToast} />}
                    {tab === 'security'        && <SecurityPanel onToast={onToast} onLogout={onLogout} />}
                    {tab === 'account'         && <AccountPanel username={username} setUsername={setUsername} userStream={userStream} onToast={onToast} onClose={onClose} />}
                </div>
            </div>
        </div>
    );
}

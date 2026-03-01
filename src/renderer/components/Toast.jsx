import React, { useEffect, useState } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, 3500);
        return () => clearTimeout(timer);
    }, []);

    const styles = {
        success: { accent: '#10b981', iconColor: '#065f46', textColor: '#14532d', badgeBg: '#f0fdf4' },
        error: { accent: '#ef4444', iconColor: '#991b1b', textColor: '#7f1d1d', badgeBg: '#fef2f2' },
        info: { accent: 'var(--accent)', iconColor: '#312e81', textColor: '#1e1b4b', badgeBg: 'var(--accent-light)' },
    };
    const s = styles[type] || styles.info;

    const icon = type === 'success' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    ) : type === 'error' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    ) : null;

    return (
        <div
            className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
        >
            <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                    background: 'var(--surface-card)',
                    border: `1px solid var(--border-subtle)`,
                    borderLeft: `4px solid ${s.accent}`,
                    boxShadow: '0 8px 24px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.08)',
                    minWidth: '260px',
                    maxWidth: '380px',
                }}
            >
                {icon && <span className="flex-shrink-0">{icon}</span>}
                <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{message}</span>
                <button
                    onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
                    className="ml-1 flex-shrink-0 transition-colors duration-150"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

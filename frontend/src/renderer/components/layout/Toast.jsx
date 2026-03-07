import React, { useEffect, useState } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Animate in
        requestAnimationFrame(() => setVisible(true));

        // Auto-dismiss after 3 seconds
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300); // Wait for exit animation
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const bgColor = type === 'success'
        ? 'bg-emerald-50 border-emerald-200'
        : type === 'error'
            ? 'bg-red-50 border-red-200'
            : 'bg-synapse-50 border-synapse-200';

    const textColor = type === 'success'
        ? 'text-emerald-700'
        : type === 'error'
            ? 'text-red-700'
            : 'text-synapse-700';

    const icon = type === 'success' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    ) : type === 'error' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    ) : null;

    return (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
            }`}>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${bgColor}`}>
                {icon}
                <span className={`text-sm font-bold ${textColor}`}>{message}</span>
                <button
                    onClick={() => {
                        setVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

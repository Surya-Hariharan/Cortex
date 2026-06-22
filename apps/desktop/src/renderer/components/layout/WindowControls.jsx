import React, { useState, useEffect } from 'react';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';

export default function WindowControls() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        window.electronAPI?.windowIsMaximized?.().then(v => setIsMaximized(v ?? false));
        const unsub = window.electronAPI?.onWindowMaximizeChange?.(v => setIsMaximized(v));
        return () => unsub?.();
    }, []);

    return (
        <div
            className="flex items-center flex-shrink-0"
            style={{ WebkitAppRegion: 'no-drag' }}
        >
            {/* Minimize */}
            <button
                onClick={() => window.electronAPI?.windowMinimize?.()}
                title="Minimize"
                className="w-11 h-8 flex items-center justify-center
                    text-slate-400 dark:text-dark-500
                    hover:bg-slate-200/70 dark:hover:bg-dark-800
                    hover:text-slate-700 dark:hover:text-dark-100
                    transition-colors duration-150"
            >
                <Minus size={13} strokeWidth={2.5} />
            </button>

            {/* Maximize / Restore */}
            <button
                onClick={() => window.electronAPI?.windowMaximize?.()}
                title={isMaximized ? 'Restore' : 'Maximize'}
                className="w-11 h-8 flex items-center justify-center
                    text-slate-400 dark:text-dark-500
                    hover:bg-slate-200/70 dark:hover:bg-dark-800
                    hover:text-slate-700 dark:hover:text-dark-100
                    transition-colors duration-150"
            >
                {isMaximized
                    ? <Minimize2 size={12} strokeWidth={2.5} />
                    : <Maximize2 size={12} strokeWidth={2.5} />
                }
            </button>

            {/* Close */}
            <button
                onClick={() => window.electronAPI?.windowClose?.()}
                title="Close"
                className="w-11 h-8 flex items-center justify-center
                    text-slate-400 dark:text-dark-500
                    hover:bg-red-500 hover:text-white
                    transition-colors duration-150 rounded-tr-sm"
            >
                <X size={13} strokeWidth={2.5} />
            </button>
        </div>
    );
}

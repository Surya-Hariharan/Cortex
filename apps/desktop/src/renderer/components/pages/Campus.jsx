import React from 'react';
import { Users, Clock } from 'lucide-react';

export default function Campus() {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-dark-950 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-synapse-50 dark:bg-synapse-900/20 border border-synapse-200 dark:border-synapse-800/40 flex items-center justify-center mb-5">
                <Users size={26} className="text-synapse-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-dark-50 mb-2">Community</h2>
            <p className="text-sm text-slate-500 dark:text-dark-400 max-w-xs leading-relaxed mb-4">
                Study groups, campus mesh networking, and collaborative knowledge sharing are being built for the next release.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-dark-500 font-medium">
                <Clock size={13} />
                Coming in a future release
            </div>
        </div>
    );
}

import React from 'react';
import { BarChart3, Clock } from 'lucide-react';

export default function Activity() {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-dark-950 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-dark-900/40 border border-slate-200 dark:border-dark-800/40 flex items-center justify-center mb-5">
                <BarChart3 size={26} className="text-slate-400 dark:text-dark-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-dark-50 mb-2">Activity</h2>
            <p className="text-sm text-slate-500 dark:text-dark-400 max-w-xs leading-relaxed mb-4">
                Contribution history, engagement metrics, and notification centre are not yet available in this release.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-dark-500 font-medium">
                <Clock size={13} />
                Coming in a future release
            </div>
        </div>
    );
}

let running = false;

function setRunning(next) {
    running = !!next;
    window.dispatchEvent(new CustomEvent('mesh-controller-updated', { detail: { running } }));
}

export const meshController = {
    async start() {
        if (running) return;
        try {
            await window.electronAPI?.meshStart?.();
        } catch {
            // Keep UI non-blocking even when IPC is unavailable.
        } finally {
            setRunning(true);
        }
    },

    async stop() {
        try {
            await window.electronAPI?.meshStop?.();
        } catch {
            // Keep UI non-blocking even when IPC is unavailable.
        } finally {
            setRunning(false);
        }
    },

    isRunning() {
        return running;
    },
};

/**
 * Offline/Online State Manager
 * Tracks internet availability and mesh/sync connectivity state.
 */

const { EventEmitter } = require('events');

class NetworkStateManager extends EventEmitter {
    constructor() {
        super();
        this.state = {
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            syncStatus: 'idle', // 'idle', 'syncing', 'error'
            meshActive: false,
            aiProvider: 'local' // 'local', 'cloud'
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.setOnline(true));
            window.addEventListener('offline', () => this.setOnline(false));
        }
    }

    setOnline(status) {
        if (this.state.isOnline !== status) {
            this.state.isOnline = status;
            this.state.aiProvider = status ? 'cloud' : 'local';
            console.log(`[NetworkState] Connection status changed to: ${status ? 'ONLINE' : 'OFFLINE'}`);
            this.emit('network_change', this.state);
        }
    }

    updateSyncStatus(status) {
        if (this.state.syncStatus !== status) {
            this.state.syncStatus = status;
            this.emit('sync_change', this.state.syncStatus);
        }
    }

    getState() {
        return { ...this.state };
    }
}

module.exports = new NetworkStateManager();

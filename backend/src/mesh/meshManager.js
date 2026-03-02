const { MeshNode } = require('./meshNode');
const { requestDocument } = require('./documentSync');

/**
 * Mesh Manager - High-level Mesh Networking Interface
 * 
 * This is the public API for the mesh networking layer.
 * UI and main process interact ONLY through this manager.
 * 
 * Architecture:
 * UI → MeshManager → MeshNode → libp2p
 * 
 * Responsibilities:
 * - Lifecycle management (start/stop)
 * - Peer list retrieval
 * - Document metadata queries
 * - Error handling and fault tolerance
 * 
 * Isolation Rules:
 * - Must NOT directly call AI runtime
 * - Must NOT directly modify vector database
 * - Must NOT directly control UI
 * - Only handles networking and metadata
 */

class MeshManager {
    constructor(db) {
        this.db = db;
        this.meshNode = null;
        this.running = false;
        this.onPeersChanged = null; // Callback for UI updates
    }

    /**
     * Start the mesh network
     */
    async start() {
        if (this.running) {
            console.log('[MeshManager] Already running');
            return;
        }

        try {
            console.log('[MeshManager] Starting mesh network...');

            // Create mesh node
            this.meshNode = new MeshNode(this.db);

            // Setup callbacks
            this.meshNode.onPeerDiscovered = (peerId) => {
                console.log(`[MeshManager] Peer discovered: ${peerId.substring(0, 8)}`);
                this._notifyPeersChanged();
            };

            this.meshNode.onPeerConnected = (peerId) => {
                console.log(`[MeshManager] Peer connected: ${peerId.substring(0, 8)}`);
                this._notifyPeersChanged();
            };

            this.meshNode.onPeerDisconnected = (peerId) => {
                console.log(`[MeshManager] Peer disconnected: ${peerId.substring(0, 8)}`);
                this._notifyPeersChanged();
            };

            // Start the node
            await this.meshNode.start();
            
            this.running = true;
            console.log('[MeshManager] Mesh network started successfully');

        } catch (error) {
            console.error('[MeshManager] Failed to start mesh network:', error);
            this.running = false;
            // Don't throw - graceful degradation
            // The app should still work without mesh networking
        }
    }

    /**
     * Stop the mesh network
     */
    async stop() {
        if (!this.running) {
            return;
        }

        try {
            console.log('[MeshManager] Stopping mesh network...');

            if (this.meshNode) {
                await this.meshNode.stop();
                this.meshNode = null;
            }

            this.running = false;
            console.log('[MeshManager] Mesh network stopped');

        } catch (error) {
            console.error('[MeshManager] Error stopping mesh network:', error);
        }
    }

    /**
     * Get list of discovered peers
     * 
     * @returns {Array} Array of peer information
     */
    getPeers() {
        if (!this.running || !this.meshNode) {
            return [];
        }

        try {
            return this.meshNode.getPeers();
        } catch (error) {
            console.error('[MeshManager] Error getting peers:', error);
            return [];
        }
    }

    /**
     * Get documents shared by a specific peer
     * 
     * @param {string} peerId - Peer ID
     * @returns {Array} Array of document metadata
     */
    getPeerDocuments(peerId) {
        try {
            return this.db.getPeerDocuments(peerId);
        } catch (error) {
            console.error('[MeshManager] Error getting peer documents:', error);
            return [];
        }
    }

    /**
     * Get all documents from all peers
     * 
     * @returns {Array} Array of all peer documents with source info
     */
    getAllPeerDocuments() {
        try {
            return this.db.getAllPeerDocuments();
        } catch (error) {
            console.error('[MeshManager] Error getting all peer documents:', error);
            return [];
        }
    }

    /**
     * Request full document from peer (stub - not implemented)
     * 
     * @param {string} peerId - Source peer ID
     * @param {string} docId - Document ID
     * @returns {Promise<Object>} Document data
     * @throws {Error} Not implemented
     */
    async requestDocument(peerId, docId) {
        console.log(`[MeshManager] Document request: docId=${docId} from peer=${peerId.substring(0, 8)}`);
        
        // Call the stub which will throw "Not Implemented"
        return await requestDocument(peerId, docId);
    }

    /**
     * Get mesh network status
     * 
     * @returns {Object} Status information
     */
    getStatus() {
        if (!this.running || !this.meshNode) {
            return {
                running: false,
                peerId: null,
                connections: 0,
                discoveredPeers: 0
            };
        }

        try {
            const nodeStatus = this.meshNode.getStatus();
            return {
                running: this.running,
                ...nodeStatus
            };
        } catch (error) {
            console.error('[MeshManager] Error getting status:', error);
            return {
                running: false,
                error: error.message
            };
        }
    }

    /**
     * Notify listeners that peer list has changed
     * @private
     */
    _notifyPeersChanged() {
        if (this.onPeersChanged) {
            try {
                const peers = this.getPeers();
                this.onPeersChanged(peers);
            } catch (error) {
                console.error('[MeshManager] Error in onPeersChanged callback:', error);
            }
        }
    }

    /**
     * Check if mesh is running
     * 
     * @returns {boolean}
     */
    isRunning() {
        return this.running;
    }

    /**
     * Get local peer ID
     * 
     * @returns {string|null} Our peer ID
     */
    getPeerId() {
        if (!this.meshNode) {
            return null;
        }
        return this.meshNode.peerId;
    }

    /**
     * Force refresh peer list from database
     * Useful after peer cleanup or manual database updates
     * 
     * @returns {Array} Updated peer list
     */
    refreshPeers() {
        this._notifyPeersChanged();
        return this.getPeers();
    }
}

// Export singleton instance
let meshManagerInstance = null;

function createMeshManager(db) {
    if (!meshManagerInstance) {
        meshManagerInstance = new MeshManager(db);
    }
    return meshManagerInstance;
}

function getMeshManager() {
    return meshManagerInstance;
}

module.exports = {
    MeshManager,
    createMeshManager,
    getMeshManager
};

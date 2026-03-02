const { setupProtocolHandlers, sendHandshake, requestMetadata } = require('./protocolHandlers');
const { generatePeerSeed } = require('./crypto');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

let libp2pDeps = null;

function resolveModulePath(packageName) {
    try {
        return require.resolve(packageName);
    } catch (_) {
        const frontendNodeModules = path.resolve(__dirname, '../../../frontend/node_modules');
        try {
            return require.resolve(packageName, { paths: [frontendNodeModules] });
        } catch {
            const distEntry = path.resolve(frontendNodeModules, packageName, 'dist/src/index.js');
            if (fsExists(distEntry)) {
                return distEntry;
            }
            throw _;
        }
    }
}

function fsExists(targetPath) {
    try {
        return require('fs').existsSync(targetPath);
    } catch {
        return false;
    }
}

async function importResolved(packageName) {
    const resolvedPath = resolveModulePath(packageName);
    return import(pathToFileURL(resolvedPath).href);
}

async function getLibp2pDeps() {
    if (libp2pDeps) return libp2pDeps;

    const [libp2pMod, tcpMod, noiseMod, yamuxMod, mdnsMod] = await Promise.all([
        importResolved('libp2p'),
        importResolved('@libp2p/tcp'),
        importResolved('@chainsafe/libp2p-noise'),
        importResolved('@chainsafe/libp2p-yamux'),
        importResolved('@libp2p/mdns'),
    ]);

    libp2pDeps = {
        createLibp2p: libp2pMod.createLibp2p,
        tcp: tcpMod.tcp,
        noise: noiseMod.noise,
        yamux: yamuxMod.yamux,
        mdns: mdnsMod.mdns,
    };

    return libp2pDeps;
}

/**
 * Cortex Mesh Node - libp2p P2P Networking Core
 * 
 * Implements real peer-to-peer networking using libp2p with:
 * - TCP transport for reliable connections
 * - mDNS for automatic local network discovery
 * - Noise protocol for encrypted communication
 * - Yamux for stream multiplexing
 * 
 * Architecture:
 * UI → MeshManager → MeshNode → libp2p → Network
 * 
 * This module is isolated from UI and AI runtime.
 */

class MeshNode {
    constructor(db) {
        this.db = db;
        this.node = null;
        this.started = false;
        this.peerId = null;
        this.deviceName = `${os.userInfo().username}'s ${os.hostname()}`;
        this.discoveredPeers = new Map(); // peerId -> peerInfo
        this.onPeerDiscovered = null; // callback
        this.onPeerConnected = null; // callback
        this.onPeerDisconnected = null; // callback
    }

    /**
     * Initialize and start the libp2p node
     */
    async start() {
        if (this.started) {
            console.log('[MeshNode] Already started');
            return;
        }

        try {
            console.log('[MeshNode] Initializing libp2p node...');

            // Get or create persistent peer ID
            const peerIdData = this._getOrCreatePeerId();

            const { createLibp2p, tcp, noise, yamux, mdns } = await getLibp2pDeps();

            // Create libp2p node
            this.node = await createLibp2p({
                // Use TCP for transport
                transports: [
                    tcp()
                ],
                
                // Noise for encryption
                connectionEncryption: [
                    noise()
                ],
                
                // Yamux for stream multiplexing
                streamMuxers: [
                    yamux()
                ],
                
                // mDNS for local network peer discovery
                peerDiscovery: [
                    mdns({
                        interval: 5000, // Scan every 5 seconds
                        serviceTag: 'cortex.local'
                    })
                ],
                
                // Connection manager settings
                connectionManager: {
                    maxConnections: 50,
                    minConnections: 0,
                    autoDial: true
                },
                
                // Listen on any available port
                addresses: {
                    listen: [
                        '/ip4/0.0.0.0/tcp/0' // Let OS assign port
                    ]
                }
            });

            // Store peer ID
            this.peerId = this.node.peerId.toString();
            console.log(`[MeshNode] Peer ID: ${this.peerId.substring(0, 16)}...`);

            // Setup protocol handlers
            const nodeInfo = {
                peerId: this.peerId,
                deviceName: this.deviceName,
                docCount: this._getDocCount()
            };
            
            setupProtocolHandlers(this.node, this.db, nodeInfo);

            // Setup event listeners
            this._setupEventListeners();

            // Start the node
            await this.node.start();
            this.started = true;

            const listenAddrs = this.node.getMultiaddrs();
            console.log('[MeshNode] Listening on:');
            listenAddrs.forEach(addr => console.log(`  ${addr.toString()}`));

            console.log('[MeshNode] Started successfully');
        } catch (error) {
            console.error('[MeshNode] Failed to start:', error);
            throw error;
        }
    }

    /**
     * Stop the libp2p node
     */
    async stop() {
        if (!this.started || !this.node) {
            return;
        }

        try {
            console.log('[MeshNode] Stopping...');
            await this.node.stop();
            this.started = false;
            this.node = null;
            console.log('[MeshNode] Stopped');
        } catch (error) {
            console.error('[MeshNode] Error stopping:', error);
        }
    }

    /**
     * Get list of discovered peers
     * 
     * @returns {Array} Array of peer information
     */
    getPeers() {
        const peers = [];
        const now = Date.now();

        for (const [peerId, info] of this.discoveredPeers) {
            const elapsed = now - info.lastSeen;
            let status = 'online';
            
            if (elapsed > 60000) status = 'offline';
            else if (elapsed > 30000) status = 'idle';

            peers.push({
                id: peerId,
                name: info.name || peerId.substring(0, 8),
                docs: info.docCount || 0,
                status,
                lastSeen: this._formatLastSeen(elapsed),
                connected: this._isPeerConnected(peerId)
            });
        }

        return peers;
    }

    /**
     * Setup event listeners for libp2p events
     * @private
     */
    _setupEventListeners() {
        // Peer discovery via mDNS
        this.node.addEventListener('peer:discovery', (evt) => {
            const peerId = evt.detail.id.toString();
            
            if (peerId === this.peerId) {
                return; // Ignore self
            }

            console.log(`[MeshNode] Discovered peer: ${peerId.substring(0, 8)}`);

            // Store in discovered peers
            this.discoveredPeers.set(peerId, {
                peerId,
                name: null,
                docCount: 0,
                lastSeen: Date.now()
            });

            // Update database
            this.db.upsertPeer(peerId, `Peer ${peerId.substring(0, 8)}`, Date.now());

            // Notify callback
            if (this.onPeerDiscovered) {
                this.onPeerDiscovered(peerId);
            }

            // Try to connect and handshake
            this._connectToPeer(peerId);
        });

        // Peer connection established
        this.node.addEventListener('peer:connect', (evt) => {
            const peerId = evt.detail.toString();
            console.log(`[MeshNode] Connected to peer: ${peerId.substring(0, 8)}`);

            if (this.onPeerConnected) {
                this.onPeerConnected(peerId);
            }

            // Perform handshake
            this._performHandshake(peerId);
        });

        // Peer disconnected
        this.node.addEventListener('peer:disconnect', (evt) => {
            const peerId = evt.detail.toString();
            console.log(`[MeshNode] Disconnected from peer: ${peerId.substring(0, 8)}`);

            if (this.onPeerDisconnected) {
                this.onPeerDisconnected(peerId);
            }
        });
    }

    /**
     * Connect to a discovered peer
     * @private
     */
    async _connectToPeer(peerId) {
        try {
            // libp2p will automatically dial known peers via peerDiscovery
            // We just need to ensure the peer is in the address book
            console.log(`[MeshNode] Initiating connection to ${peerId.substring(0, 8)}`);
        } catch (error) {
            console.error(`[MeshNode] Error connecting to ${peerId}:`, error.message);
        }
    }

    /**
     * Perform handshake with peer
     * @private
     */
    async _performHandshake(peerId) {
        try {
            const nodeInfo = {
                peerId: this.peerId,
                deviceName: this.deviceName,
                docCount: this._getDocCount()
            };

            const response = await sendHandshake(this.node, peerId, nodeInfo);
            
            if (response) {
                console.log(`[MeshNode] Handshake complete with ${response.deviceName}`);
                
                // Update peer info
                if (this.discoveredPeers.has(peerId)) {
                    const peerInfo = this.discoveredPeers.get(peerId);
                    peerInfo.name = response.deviceName;
                    peerInfo.docCount = response.docCount;
                    peerInfo.lastSeen = Date.now();
                }

                // Update database
                this.db.upsertPeer(peerId, response.deviceName, Date.now());

                // Request metadata after successful handshake
                this._requestPeerMetadata(peerId);
            }
        } catch (error) {
            console.error(`[MeshNode] Handshake failed with ${peerId}:`, error.message);
        }
    }

    /**
     * Request metadata from peer
     * @private
     */
    async _requestPeerMetadata(peerId) {
        try {
            console.log(`[MeshNode] Requesting metadata from ${peerId.substring(0, 8)}`);
            
            const metadata = await requestMetadata(this.node, peerId);
            
            console.log(`[MeshNode] Received ${metadata.length} document metadata entries`);
            
            // Store in database via documentSync module
            const { storePeerDocuments } = require('./documentSync');
            storePeerDocuments(this.db, peerId, metadata);
            
        } catch (error) {
            console.error(`[MeshNode] Metadata request failed:`, error.message);
        }
    }

    /**
     * Check if peer is currently connected
     * @private
     */
    _isPeerConnected(peerId) {
        if (!this.node) return false;
        
        try {
            const connections = this.node.getConnections(peerId);
            return connections.length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get or create persistent peer ID
     * @private
     */
    _getOrCreatePeerId() {
        try {
            // Try to load from database
            const existing = this.db.getMeshPeerId();
            if (existing) {
                console.log('[MeshNode] Using existing peer ID from database');
                return existing;
            }

            // Generate new peer ID seed
            console.log('[MeshNode] Generating new peer ID');
            const seed = generatePeerSeed();
            this.db.storeMeshPeerId(seed);
            
            return seed;
        } catch (error) {
            console.error('[MeshNode] Error managing peer ID:', error);
            // Generate temporary ID if DB fails
            return generatePeerSeed();
        }
    }

    /**
     * Get document count for sharing
     * @private
     */
    _getDocCount() {
        try {
            const stats = this.db.getStats();
            return stats.documents || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Format elapsed time
     * @private
     */
    _formatLastSeen(elapsedMs) {
        if (elapsedMs < 10000) return 'now';
        if (elapsedMs < 60000) return `${Math.round(elapsedMs / 1000)}s ago`;
        if (elapsedMs < 3600000) return `${Math.round(elapsedMs / 60000)}m ago`;
        return `${Math.round(elapsedMs / 3600000)}h ago`;
    }

    /**
     * Get node status information
     */
    getStatus() {
        if (!this.node || !this.started) {
            return {
                started: false,
                peerId: null,
                connections: 0,
                discoveredPeers: 0
            };
        }

        return {
            started: true,
            peerId: this.peerId,
            connections: this.node.getConnections().length,
            discoveredPeers: this.discoveredPeers.size,
            listenAddrs: this.node.getMultiaddrs().map(addr => addr.toString())
        };
    }
}

module.exports = { MeshNode };

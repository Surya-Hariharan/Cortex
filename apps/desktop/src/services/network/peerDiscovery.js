/**
 * Cortex — LAN Peer Discovery via UDP Broadcast
 * Discovers peers on the same local network (WiFi/LAN) using UDP broadcast.
 * No cloud, no internet — pure local mesh.
 */

const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');

const BROADCAST_PORT = 41234;
const DISCOVERY_INTERVAL = 5000;  // broadcast every 5s
const PEER_TIMEOUT = 20000;       // peer considered offline after 20s silence
const PROTOCOL_MAGIC = 'CORTEX_MESH_V1';

class PeerDiscovery {
    constructor() {
        this.peerId = crypto.randomBytes(6).toString('hex');
        this.peerName = `${os.userInfo().username}'s ${os.hostname()}`;
        this.peers = new Map();  // peerId → { id, name, ip, port, status, docs, lastSeen, os }
        this.socket = null;
        this.broadcastTimer = null;
        this.cleanupTimer = null;
        this.docCount = 0;
        this.running = false;
        this.onPeersChanged = null;  // callback
    }

    /**
     * Start broadcasting and listening for peers
     */
    start() {
        if (this.running) return;
        this.running = true;

        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
            console.error('[Cortex Mesh] Socket error:', err.message);
            // Don't crash — just log and continue
        });

        this.socket.on('message', (msg, rinfo) => {
            this._handleMessage(msg, rinfo);
        });

        this.socket.bind(BROADCAST_PORT, () => {
            try {
                this.socket.setBroadcast(true);
                console.log(`[Cortex Mesh] Listening on UDP :${BROADCAST_PORT} (peer: ${this.peerId})`);
            } catch (err) {
                console.warn('[Cortex Mesh] Could not enable broadcast:', err.message);
            }
        });

        // Broadcast presence periodically
        this.broadcastTimer = setInterval(() => this._broadcast(), DISCOVERY_INTERVAL);
        // Also broadcast immediately
        setTimeout(() => this._broadcast(), 500);

        // Cleanup stale peers
        this.cleanupTimer = setInterval(() => this._cleanupPeers(), PEER_TIMEOUT / 2);
    }

    /**
     * Stop discovery
     */
    stop() {
        this.running = false;
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        if (this.socket) {
            try { this.socket.close(); } catch (_) {}
            this.socket = null;
        }
        if (this.peers.size > 0) {
            this.peers.clear();
            if (this.onPeersChanged) {
                this.onPeersChanged(this.getPeers());
            }
        }
    }

    /**
     * Update local doc count for broadcasting
     */
    setDocCount(count) {
        this.docCount = count;
    }

    /**
     * Get current peer list
     */
    getPeers() {
        const now = Date.now();
        return Array.from(this.peers.values()).map((p) => {
            const elapsed = now - p.lastSeen;
            let status = 'online';
            if (elapsed > PEER_TIMEOUT) status = 'offline';
            else if (elapsed > PEER_TIMEOUT / 2) status = 'idle';
            return {
                ...p,
                status,
                lastSeen: this._formatLastSeen(elapsed),
            };
        });
    }

    /**
     * Broadcast our presence to LAN
     */
    _broadcast() {
        if (!this.socket || !this.running) return;

        const payload = JSON.stringify({
            magic: PROTOCOL_MAGIC,
            peerId: this.peerId,
            name: this.peerName,
            docs: this.docCount,
            os: `${os.platform()} ${os.release()}`,
            ts: Date.now(),
        });

        const message = Buffer.from(payload);

        // Send to all broadcast addresses
        const broadcastAddrs = this._getBroadcastAddresses();
        for (const addr of broadcastAddrs) {
            try {
                this.socket.send(message, 0, message.length, BROADCAST_PORT, addr);
            } catch (err) {
                // Ignore send errors (e.g., no network)
            }
        }
    }

    /**
     * Handle incoming peer message
     */
    _handleMessage(msg, rinfo) {
        try {
            const data = JSON.parse(msg.toString());
            if (data.magic !== PROTOCOL_MAGIC) return;
            if (data.peerId === this.peerId) return; // ignore self

            const existing = this.peers.get(data.peerId);
            this.peers.set(data.peerId, {
                id: data.peerId,
                name: data.name || 'Unknown Peer',
                ip: rinfo.address,
                port: rinfo.port,
                docs: data.docs || 0,
                os: data.os || 'Unknown',
                lastSeen: Date.now(),
                status: 'online',
            });

            // Notify if new peer or if peer list changed
            if (!existing && this.onPeersChanged) {
                this.onPeersChanged(this.getPeers());
            }
        } catch (_) {
            // Ignore malformed messages
        }
    }

    /**
     * Remove peers that haven't been seen recently
     */
    _cleanupPeers() {
        const now = Date.now();
        let changed = false;
        for (const [id, peer] of this.peers.entries()) {
            if (now - peer.lastSeen > PEER_TIMEOUT * 3) {
                this.peers.delete(id);
                changed = true;
            }
        }
        if (changed && this.onPeersChanged) {
            this.onPeersChanged(this.getPeers());
        }
    }

    /**
     * Get all broadcast addresses for local network interfaces
     */
    _getBroadcastAddresses() {
        const addrs = new Set();
        const interfaces = os.networkInterfaces();
        for (const iface of Object.values(interfaces)) {
            for (const addr of iface) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    // Calculate broadcast address from IP + netmask
                    const ipParts = addr.address.split('.').map(Number);
                    const maskParts = addr.netmask.split('.').map(Number);
                    const broadcast = ipParts.map((ip, i) => (ip | (~maskParts[i] & 255))).join('.');
                    addrs.add(broadcast);
                }
            }
        }
        // Fallback: always include the common broadcast
        addrs.add('255.255.255.255');
        return Array.from(addrs);
    }

    _formatLastSeen(elapsedMs) {
        if (elapsedMs < 10000) return 'now';
        if (elapsedMs < 60000) return `${Math.round(elapsedMs / 1000)}s ago`;
        if (elapsedMs < 3600000) return `${Math.round(elapsedMs / 60000)}m ago`;
        return `${Math.round(elapsedMs / 3600000)}h ago`;
    }
}

module.exports = { PeerDiscovery };

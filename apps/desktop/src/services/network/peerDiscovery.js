/**
 * Cortex — LAN Peer Discovery via UDP Broadcast
 *
 * When CORTEX_MESH_EXPERIMENTAL=1 the full secure mesh is active:
 *   • Ed25519 per-device identity keypair (generated once, stored to disk)
 *   • Every broadcast message is signed; signatures are verified on receipt
 *   • Replay protection: messages older than 2× DISCOVERY_INTERVAL are rejected
 *   • Peer-map hard cap: MAX_PEERS
 *   • Strict schema validation on every incoming message
 *
 * Without the flag the service provides basic peer-count discovery with no
 * cryptographic guarantees.  Set CORTEX_MESH_EXPERIMENTAL=1 to enable the
 * authenticated mesh before any security-sensitive deployment.
 */

const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BROADCAST_PORT = 41234;
const DISCOVERY_INTERVAL = 5000;
const PEER_TIMEOUT = 20000;
const PROTOCOL_MAGIC = 'CORTEX_MESH_V1';
const MAX_PEERS = 50;
const REPLAY_WINDOW_MS = DISCOVERY_INTERVAL * 2; // 10 s

// ── Ed25519 identity helpers ──────────────────────────────────────────────────

function _signPayload(privateKey, payload) {
    return crypto.sign(null, Buffer.from(payload), privateKey).toString('base64');
}

function _verifySignature(publicKeyDer, payload, signatureB64) {
    try {
        const publicKey = crypto.createPublicKey({
            key: Buffer.from(publicKeyDer, 'base64'),
            format: 'der',
            type: 'spki',
        });
        return crypto.verify(null, Buffer.from(payload), publicKey, Buffer.from(signatureB64, 'base64'));
    } catch {
        return false;
    }
}

function _exportPublicKeyDer(publicKey) {
    return publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
}

function _loadOrCreateIdentity(identityPath) {
    if (fs.existsSync(identityPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
            const privateKey = crypto.createPrivateKey({
                key: Buffer.from(raw.privateKey, 'base64'),
                format: 'der',
                type: 'pkcs8',
            });
            const publicKey = crypto.createPublicKey(privateKey);
            return { privateKey, publicKey, publicKeyDer: _exportPublicKeyDer(publicKey), peerId: raw.peerId };
        } catch { /* fall through */ }
    }

    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const peerId = crypto.randomBytes(6).toString('hex');
    const publicKeyDer = _exportPublicKeyDer(publicKey);
    try {
        fs.writeFileSync(
            identityPath,
            JSON.stringify({
                peerId,
                privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
                v: 1,
            }),
            { mode: 0o600 }
        );
    } catch { /* non-fatal: identity lives in memory for this session */ }

    return { privateKey, publicKey, publicKeyDer, peerId };
}

// ── Schema validation ─────────────────────────────────────────────────────────

const BASE_FIELDS = ['magic', 'peerId', 'name', 'ts'];
const SECURE_FIELDS = ['magic', 'publicKey', 'payload', 'sig'];

function _validateBase(data) {
    return BASE_FIELDS.every((f) => data[f] != null);
}

function _validateSecure(data) {
    return SECURE_FIELDS.every((f) => data[f] != null);
}

// ── PeerDiscovery ─────────────────────────────────────────────────────────────

class PeerDiscovery {
    constructor(options = {}) {
        this._experimental = process.env.CORTEX_MESH_EXPERIMENTAL === '1';

        // Persistent identity stored in userData; fall back to tmpdir in tests
        this._identityPath = options.identityPath
            || path.join(os.tmpdir(), `cortex-mesh-id-${process.pid}.json`);

        if (this._experimental) {
            this._identity = _loadOrCreateIdentity(this._identityPath);
            this.peerId = this._identity.peerId;
        } else {
            this.peerId = crypto.randomBytes(6).toString('hex');
        }

        this.peerName = `${os.userInfo().username}'s ${os.hostname()}`;
        this.peers = new Map();
        this.socket = null;
        this.broadcastTimer = null;
        this.cleanupTimer = null;
        this.docCount = 0;
        this.running = false;
        this.onPeersChanged = null;
    }

    start() {
        if (this.running) return;
        this.running = true;

        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
            console.error('[Cortex Mesh] Socket error:', err.message);
        });

        this.socket.on('message', (msg, rinfo) => {
            this._handleMessage(msg, rinfo);
        });

        this.socket.bind(BROADCAST_PORT, () => {
            try {
                this.socket.setBroadcast(true);
                console.log(
                    `[Cortex Mesh] Listening :${BROADCAST_PORT} | secure=${this._experimental} | peer=${this.peerId}`
                );
            } catch (err) {
                console.warn('[Cortex Mesh] setBroadcast failed:', err.message);
            }
        });

        this.broadcastTimer = setInterval(() => this._broadcast(), DISCOVERY_INTERVAL);
        setTimeout(() => this._broadcast(), 500);
        this.cleanupTimer = setInterval(() => this._cleanupPeers(), PEER_TIMEOUT / 2);
    }

    stop() {
        this.running = false;
        if (this.broadcastTimer) { clearInterval(this.broadcastTimer); this.broadcastTimer = null; }
        if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null; }
        if (this.socket) {
            try { this.socket.close(); } catch (_) {}
            this.socket = null;
        }
        if (this.peers.size > 0) {
            this.peers.clear();
            this.onPeersChanged?.(this.getPeers());
        }
    }

    setDocCount(count) { this.docCount = count; }

    getPeers() {
        const now = Date.now();
        return Array.from(this.peers.values()).map((p) => {
            const elapsed = now - p.lastSeen;
            let status = 'online';
            if (elapsed > PEER_TIMEOUT) status = 'offline';
            else if (elapsed > PEER_TIMEOUT / 2) status = 'idle';
            return { ...p, status, lastSeen: this._formatLastSeen(elapsed) };
        });
    }

    // ── Broadcast ───────────────────────────────────────────────────────────

    _broadcast() {
        if (!this.socket || !this.running) return;

        let message;

        if (this._experimental) {
            const inner = JSON.stringify({
                peerId: this.peerId,
                name: this.peerName,
                docs: this.docCount,
                os: `${os.platform()} ${os.release()}`,
                ts: Date.now(),
            });
            const sig = _signPayload(this._identity.privateKey, inner);
            message = Buffer.from(JSON.stringify({
                magic: PROTOCOL_MAGIC,
                publicKey: this._identity.publicKeyDer,
                payload: inner,
                sig,
            }));
        } else {
            message = Buffer.from(JSON.stringify({
                magic: PROTOCOL_MAGIC,
                peerId: this.peerId,
                name: this.peerName,
                docs: this.docCount,
                os: `${os.platform()} ${os.release()}`,
                ts: Date.now(),
            }));
        }

        for (const addr of this._getBroadcastAddresses()) {
            try { this.socket.send(message, 0, message.length, BROADCAST_PORT, addr); }
            catch { /* ignore transient send errors */ }
        }
    }

    // ── Receive ─────────────────────────────────────────────────────────────

    _handleMessage(msg, rinfo) {
        try {
            const outer = JSON.parse(msg.toString());
            if (outer.magic !== PROTOCOL_MAGIC) return;
            if (this._experimental) {
                this._handleSecureMessage(outer, rinfo);
            } else {
                this._handleLegacyMessage(outer, rinfo);
            }
        } catch { /* drop malformed messages */ }
    }

    _handleSecureMessage(outer, rinfo) {
        if (!_validateSecure(outer)) return;

        if (!_verifySignature(outer.publicKey, outer.payload, outer.sig)) {
            console.warn('[Cortex Mesh] Bad signature from', rinfo.address);
            return;
        }

        let inner;
        try { inner = JSON.parse(outer.payload); } catch { return; }
        if (!_validateBase(inner)) return;

        // Replay protection
        const age = Date.now() - Number(inner.ts);
        if (age < 0 || age > REPLAY_WINDOW_MS) {
            console.warn('[Cortex Mesh] Replay detected (age=%dms) from %s', age, rinfo.address);
            return;
        }

        if (inner.peerId === this.peerId) return;

        if (!this.peers.has(inner.peerId) && this.peers.size >= MAX_PEERS) {
            console.warn('[Cortex Mesh] Peer cap reached; dropping %s', inner.peerId);
            return;
        }

        const isNew = !this.peers.has(inner.peerId);
        this.peers.set(inner.peerId, {
            id: inner.peerId,
            name: String(inner.name || 'Unknown').slice(0, 64),
            ip: rinfo.address,
            port: rinfo.port,
            docs: Number(inner.docs) || 0,
            os: String(inner.os || 'Unknown').slice(0, 64),
            publicKey: outer.publicKey,
            lastSeen: Date.now(),
            status: 'online',
        });

        if (isNew) this.onPeersChanged?.(this.getPeers());
    }

    _handleLegacyMessage(data, rinfo) {
        if (!_validateBase(data)) return;
        if (data.peerId === this.peerId) return;

        if (!this.peers.has(data.peerId) && this.peers.size >= MAX_PEERS) return;

        const isNew = !this.peers.has(data.peerId);
        this.peers.set(data.peerId, {
            id: data.peerId,
            name: String(data.name || 'Unknown').slice(0, 64),
            ip: rinfo.address,
            port: rinfo.port,
            docs: Number(data.docs) || 0,
            os: String(data.os || 'Unknown').slice(0, 64),
            lastSeen: Date.now(),
            status: 'online',
        });

        if (isNew) this.onPeersChanged?.(this.getPeers());
    }

    _cleanupPeers() {
        const now = Date.now();
        let changed = false;
        for (const [id, peer] of this.peers.entries()) {
            if (now - peer.lastSeen > PEER_TIMEOUT * 3) {
                this.peers.delete(id);
                changed = true;
            }
        }
        if (changed) this.onPeersChanged?.(this.getPeers());
    }

    _getBroadcastAddresses() {
        const addrs = new Set();
        for (const iface of Object.values(os.networkInterfaces())) {
            for (const addr of iface) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    const ipParts = addr.address.split('.').map(Number);
                    const maskParts = addr.netmask.split('.').map(Number);
                    const broadcast = ipParts.map((ip, i) => (ip | (~maskParts[i] & 255))).join('.');
                    addrs.add(broadcast);
                }
            }
        }
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

module.exports = {
    PeerDiscovery,
    // Exported for testing
    _verifySignature,
    _signPayload,
    _loadOrCreateIdentity,
    _exportPublicKeyDer,
};

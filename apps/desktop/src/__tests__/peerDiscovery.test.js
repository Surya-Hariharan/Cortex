// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    PeerDiscovery,
    _verifySignature,
    _signPayload,
    _loadOrCreateIdentity,
    _exportPublicKeyDer,
} from '../services/network/peerDiscovery.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-pd-test-'));

function makeKeyPair() {
    return crypto.generateKeyPairSync('ed25519');
}

describe('peerDiscovery helpers', () => {
    // ── _exportPublicKeyDer ─────────────────────────────────────────────────
    describe('_exportPublicKeyDer', () => {
        it('exports a public key as base64 DER string', () => {
            const { publicKey } = makeKeyPair();
            const der = _exportPublicKeyDer(publicKey);
            expect(typeof der).toBe('string');
            expect(der.length).toBeGreaterThan(0);
            // Should be valid base64
            expect(() => Buffer.from(der, 'base64')).not.toThrow();
        });
    });

    // ── _signPayload / _verifySignature ────────────────────────────────────
    describe('_signPayload + _verifySignature', () => {
        it('signs a payload and verifies it successfully', () => {
            const { privateKey, publicKey } = makeKeyPair();
            const der = _exportPublicKeyDer(publicKey);
            const payload = 'test-payload-123';

            const sig = _signPayload(privateKey, payload);
            expect(typeof sig).toBe('string');

            expect(_verifySignature(der, payload, sig)).toBe(true);
        });

        it('rejects a signature for tampered payload', () => {
            const { privateKey, publicKey } = makeKeyPair();
            const der = _exportPublicKeyDer(publicKey);
            const sig = _signPayload(privateKey, 'original');

            expect(_verifySignature(der, 'tampered', sig)).toBe(false);
        });

        it('rejects a signature from a different key', () => {
            const { privateKey } = makeKeyPair();
            const { publicKey: otherPub } = makeKeyPair();
            const otherDer = _exportPublicKeyDer(otherPub);

            const sig = _signPayload(privateKey, 'payload');
            expect(_verifySignature(otherDer, 'payload', sig)).toBe(false);
        });

        it('returns false for invalid base64 public key', () => {
            expect(_verifySignature('!!!not-base64!!!', 'payload', 'sig')).toBe(false);
        });

        it('returns false for invalid base64 signature', () => {
            const { publicKey } = makeKeyPair();
            const der = _exportPublicKeyDer(publicKey);
            expect(_verifySignature(der, 'payload', '!!!invalid!!!')).toBe(false);
        });
    });

    // ── _loadOrCreateIdentity ──────────────────────────────────────────────
    describe('_loadOrCreateIdentity', () => {
        let dir;
        beforeEach(() => { dir = tmpDir(); });
        afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

        it('creates a new identity when file does not exist', () => {
            const identityPath = path.join(dir, 'identity.json');
            const id = _loadOrCreateIdentity(identityPath);

            expect(id).toHaveProperty('peerId');
            expect(id).toHaveProperty('privateKey');
            expect(id).toHaveProperty('publicKey');
            expect(id).toHaveProperty('publicKeyDer');
        });

        it('persists the identity to disk', () => {
            const identityPath = path.join(dir, 'identity.json');
            _loadOrCreateIdentity(identityPath);
            expect(fs.existsSync(identityPath)).toBe(true);
        });

        it('loads the same peerId on subsequent calls', () => {
            const identityPath = path.join(dir, 'identity.json');
            const id1 = _loadOrCreateIdentity(identityPath);
            const id2 = _loadOrCreateIdentity(identityPath);
            expect(id1.peerId).toBe(id2.peerId);
        });

        it('generates new identity when file is corrupted JSON', () => {
            const identityPath = path.join(dir, 'identity.json');
            fs.writeFileSync(identityPath, 'not-valid-json');
            const id = _loadOrCreateIdentity(identityPath);
            expect(id).toHaveProperty('peerId');
        });

        it('the loaded keypair can sign and verify', () => {
            const identityPath = path.join(dir, 'identity.json');
            const id = _loadOrCreateIdentity(identityPath);
            const payload = 'test';
            const sig = _signPayload(id.privateKey, payload);
            expect(_verifySignature(id.publicKeyDer, payload, sig)).toBe(true);
        });

        it('a loaded-from-disk keypair can also sign and verify', () => {
            const identityPath = path.join(dir, 'identity.json');
            _loadOrCreateIdentity(identityPath);
            const id = _loadOrCreateIdentity(identityPath);
            const sig = _signPayload(id.privateKey, 'msg');
            expect(_verifySignature(id.publicKeyDer, 'msg', sig)).toBe(true);
        });
    });

    // ── PeerDiscovery class ────────────────────────────────────────────────
    describe('PeerDiscovery', () => {
        it('constructs with default values', () => {
            const pd = new PeerDiscovery();
            expect(pd.peers).toBeInstanceOf(Map);
            expect(pd.running).toBe(false);
            expect(typeof pd.peerId).toBe('string');
        });

        it('constructs in experimental mode when env var is set', () => {
            process.env.CORTEX_MESH_EXPERIMENTAL = '1';
            const dir2 = tmpDir();
            const pd = new PeerDiscovery({ identityPath: path.join(dir2, 'id.json') });
            expect(pd._experimental).toBe(true);
            expect(pd._identity).toHaveProperty('peerId');
            delete process.env.CORTEX_MESH_EXPERIMENTAL;
            fs.rmSync(dir2, { recursive: true, force: true });
        });

        it('constructs in legacy mode by default', () => {
            const pd = new PeerDiscovery();
            expect(pd._experimental).toBe(false);
            expect(pd._identity).toBeUndefined();
        });

        it('setDocCount updates docCount', () => {
            const pd = new PeerDiscovery();
            pd.setDocCount(42);
            expect(pd.docCount).toBe(42);
        });

        it('getPeers returns empty array when no peers', () => {
            const pd = new PeerDiscovery();
            expect(pd.getPeers()).toEqual([]);
        });

        it('getPeers returns peer with status online when recently seen', () => {
            const pd = new PeerDiscovery();
            pd.peers.set('abc', {
                id: 'abc',
                name: 'TestPeer',
                ip: '192.168.1.2',
                port: 41234,
                docs: 5,
                os: 'linux',
                lastSeen: Date.now(),
                status: 'online',
            });
            const peers = pd.getPeers();
            expect(peers).toHaveLength(1);
            expect(peers[0].status).toBe('online');
        });

        it('stop clears peers and notifies callback', () => {
            const pd = new PeerDiscovery();
            const cb = vi.fn();
            pd.onPeersChanged = cb;
            pd.peers.set('x', { id: 'x', lastSeen: Date.now() });
            pd.stop();
            expect(pd.peers.size).toBe(0);
            expect(cb).toHaveBeenCalledWith([]);
        });

        it('handles legacy message correctly via _handleMessage', () => {
            const pd = new PeerDiscovery();
            const changed = vi.fn();
            pd.onPeersChanged = changed;

            const msg = Buffer.from(JSON.stringify({
                magic: 'CORTEX_MESH_V1',
                peerId: 'remote-peer',
                name: 'Remote',
                ts: Date.now(),
                docs: 3,
                os: 'windows 11',
            }));
            pd._handleMessage(msg, { address: '10.0.0.2', port: 41234 });

            expect(pd.peers.has('remote-peer')).toBe(true);
            expect(changed).toHaveBeenCalled();
        });

        it('ignores messages from self in legacy mode', () => {
            const pd = new PeerDiscovery();
            const msg = Buffer.from(JSON.stringify({
                magic: 'CORTEX_MESH_V1',
                peerId: pd.peerId,
                name: 'Self',
                ts: Date.now(),
            }));
            pd._handleMessage(msg, { address: '127.0.0.1', port: 41234 });
            expect(pd.peers.size).toBe(0);
        });

        it('drops malformed JSON messages silently', () => {
            const pd = new PeerDiscovery();
            expect(() => pd._handleMessage(Buffer.from('not-json'), {})).not.toThrow();
        });

        it('drops messages with wrong magic', () => {
            const pd = new PeerDiscovery();
            const msg = Buffer.from(JSON.stringify({ magic: 'WRONG', peerId: 'x', name: 'y', ts: Date.now() }));
            pd._handleMessage(msg, { address: '10.0.0.2', port: 41234 });
            expect(pd.peers.size).toBe(0);
        });

        it('enforces MAX_PEERS cap in legacy mode', () => {
            const pd = new PeerDiscovery();
            // Fill to MAX_PEERS (50)
            for (let i = 0; i < 50; i++) {
                pd.peers.set(`peer-${i}`, { id: `peer-${i}`, lastSeen: Date.now() });
            }
            const msg = Buffer.from(JSON.stringify({
                magic: 'CORTEX_MESH_V1',
                peerId: 'new-peer',
                name: 'New',
                ts: Date.now(),
            }));
            pd._handleMessage(msg, { address: '10.0.0.2', port: 41234 });
            expect(pd.peers.has('new-peer')).toBe(false);
        });

        it('handles secure message with valid signature', () => {
            process.env.CORTEX_MESH_EXPERIMENTAL = '1';
            const dir2 = tmpDir();
            const pd = new PeerDiscovery({ identityPath: path.join(dir2, 'id.json') });
            const { privateKey, publicKey } = makeKeyPair();
            const pubDer = _exportPublicKeyDer(publicKey);
            const inner = JSON.stringify({
                magic: 'CORTEX_MESH_V1',
                peerId: 'other-peer',
                name: 'Other',
                ts: Date.now(),
            });
            const sig = _signPayload(privateKey, inner);
            const outer = { magic: 'CORTEX_MESH_V1', publicKey: pubDer, payload: inner, sig };
            const msg = Buffer.from(JSON.stringify(outer));
            const changed = vi.fn();
            pd.onPeersChanged = changed;

            pd._handleMessage(msg, { address: '10.0.0.5', port: 41234 });
            expect(pd.peers.has('other-peer')).toBe(true);

            delete process.env.CORTEX_MESH_EXPERIMENTAL;
            fs.rmSync(dir2, { recursive: true, force: true });
        });

        it('rejects secure message with invalid signature', () => {
            process.env.CORTEX_MESH_EXPERIMENTAL = '1';
            const dir2 = tmpDir();
            const pd = new PeerDiscovery({ identityPath: path.join(dir2, 'id.json') });
            const { publicKey } = makeKeyPair();
            const pubDer = _exportPublicKeyDer(publicKey);
            const inner = JSON.stringify({
                magic: 'CORTEX_MESH_V1',
                peerId: 'attacker',
                name: 'Attacker',
                ts: Date.now(),
            });
            const outer = { magic: 'CORTEX_MESH_V1', publicKey: pubDer, payload: inner, sig: 'invalidsig' };
            pd._handleMessage(Buffer.from(JSON.stringify(outer)), { address: '10.0.0.9', port: 41234 });
            expect(pd.peers.has('attacker')).toBe(false);

            delete process.env.CORTEX_MESH_EXPERIMENTAL;
            fs.rmSync(dir2, { recursive: true, force: true });
        });

        it('rejects replayed secure message (old timestamp)', () => {
            process.env.CORTEX_MESH_EXPERIMENTAL = '1';
            const dir2 = tmpDir();
            const pd = new PeerDiscovery({ identityPath: path.join(dir2, 'id.json') });
            const { privateKey, publicKey } = makeKeyPair();
            const pubDer = _exportPublicKeyDer(publicKey);
            const inner = JSON.stringify({
                magic: 'CORTEX_MESH_V1',
                peerId: 'replay-peer',
                name: 'Replay',
                ts: Date.now() - 60000, // 60s old — beyond 10s replay window
            });
            const sig = _signPayload(privateKey, inner);
            const outer = { magic: 'CORTEX_MESH_V1', publicKey: pubDer, payload: inner, sig };
            pd._handleMessage(Buffer.from(JSON.stringify(outer)), { address: '10.0.0.6', port: 41234 });
            expect(pd.peers.has('replay-peer')).toBe(false);

            delete process.env.CORTEX_MESH_EXPERIMENTAL;
            fs.rmSync(dir2, { recursive: true, force: true });
        });
    });
});

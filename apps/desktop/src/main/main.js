/**
 * Cortex — Electron Main Process
 *
 * Initializes services (SQLite, BGE embeddings, peer discovery) and
 * exposes them to the React renderer via IPC handlers.
 * Loads the locally built renderer bundle from dist/renderer/index.html.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

// ── Local Auth Utilities ────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');

// Backend API connectivity has been intentionally removed.

// ── Internet Connectivity Check ──────────────────────────────────────────────
let isInternetOnline = false;
let internetCheckInterval = null;
let _consecutiveFailures = 0;
const OFFLINE_THRESHOLD = 3;

const PROBE_ENDPOINTS = [
    'https://1.1.1.1',
    'https://cloudflare.com',
    'https://www.google.com',
];

// Tries each endpoint via HEAD request; returns true if ANY responds successfully.
// AbortController enforces a 5 s per-probe timeout.
async function checkInternetConnectivity() {
    for (const url of PROBE_ENDPOINTS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timer);
            // Any non-server-error response confirms connectivity
            if (res.status < 500) return true;
        } catch (_err) {
            clearTimeout(timer);
        }
    }
    return false;
}

async function updateInternetStatus() {
    const probeResult = await checkInternetConnectivity();

    let newStatus;
    if (probeResult) {
        _consecutiveFailures = 0;
        newStatus = true;
    } else {
        _consecutiveFailures++;
        // Stay ONLINE until OFFLINE_THRESHOLD consecutive failures are reached
        newStatus = (_consecutiveFailures >= OFFLINE_THRESHOLD) ? false : isInternetOnline;
    }

    if (newStatus !== isInternetOnline) {
        isInternetOnline = newStatus;
        console.log(`[CORTEX-CONNECTIVITY] status changed: ${isInternetOnline ? 'ONLINE' : 'OFFLINE'}`);
        mainWindow?.webContents.send('internet-status', { online: isInternetOnline });
        // Coming back online is exactly when queued offline changes need to
        // go out — retry immediately rather than waiting for the next
        // interval tick (see startCloudSyncLoop below).
        if (isInternetOnline && syncEngine.isEnabled()) {
            syncEngine.runSync({ trigger: 'reconnect' }).catch(() => { });
        }
    }
}

function startInternetChecks() {
    // Run immediately, then every 10 seconds
    updateInternetStatus();
    internetCheckInterval = setInterval(updateInternetStatus, 10000);
}

// ── Cloud sync / backup background loop ──────────────────────────────────
// A single interval drives both: automatic sync every tick, and an
// automatic backup once per calendar day. Both are strictly additive to the
// local-first app — gated on isInternetOnline + syncEngine.isEnabled()
// (which itself requires cloudClient.isConfigured(), an active cloud
// session, and an established content key), so this is entirely inert
// unless the user opted into cloud sync.
let cloudSyncInterval = null;
const CLOUD_SYNC_INTERVAL_MS = 60 * 1000;
let _lastAutoBackupDate = null; // 'YYYY-MM-DD', in-memory only — worst case one extra automatic backup after a restart

async function maybeRunAutoBackup() {
    const today = new Date().toISOString().slice(0, 10);
    if (_lastAutoBackupDate === today) return;
    const session = getCloudSession();
    if (!session) return;
    try {
        await withValidAccessToken((accessToken) =>
            cloudClient.createBackup(accessToken, { deviceId: session.device?.id, kind: 'automatic' })
        );
        _lastAutoBackupDate = today;
    } catch (_) {
        // Best-effort — retried on the next interval tick.
    }
}

function startCloudSyncLoop() {
    if (cloudSyncInterval) return;
    cloudSyncInterval = setInterval(async () => {
        if (!isInternetOnline || !syncEngine.isEnabled()) return;
        await syncEngine.runSync({ trigger: 'interval' }).catch(() => { });
        await maybeRunAutoBackup();
    }, CLOUD_SYNC_INTERVAL_MS);
}

// Session file stored in Electron's userData folder — survives app restarts
// but is removed on explicit logout, causing the landing page to show again.
function sessionFilePath() {
    return path.join(app.getPath('userData'), 'cortex-session.json');
}
function hasSession() {
    return fs.existsSync(sessionFilePath());
}
function readSession() {
    try { return JSON.parse(fs.readFileSync(sessionFilePath(), 'utf8')); }
    catch { return null; }
}
function writeSession(profile) {
    fs.writeFileSync(sessionFilePath(), JSON.stringify(profile));
}
function deleteSession() {
    const f = sessionFilePath();
    if (fs.existsSync(f)) fs.unlinkSync(f);
}

// Services
const { initKeyStore } = require('../services/storage/keyStore');
const { initializeDatabase, getDatabase } = require('../services/storage/database');
const { EmbeddingsEngine } = require('../services/ai/embeddings');
const { extractPdfText } = require('../services/storage/pdfHandler');
const { ragSearch } = require('../services/ai/ragPipeline');
const { PeerDiscovery } = require('../services/network/peerDiscovery');

// Optional cloud backend (apps/server) — never required for the app to run.
// See docs/ARCHITECTURE.md "Optional Cloud Backend".
const cloudClient = require('../services/cloud/cloudClient');
const { initCloudTokenStore, saveCloudSession, getCloudSession, clearCloudSession } = require('../services/storage/cloudTokenStore');
const deviceKeys = require('../services/cloud/deviceKeys');
const contentKey = require('../services/cloud/contentKey');
const syncEngine = require('../services/cloud/syncEngine');
const { withValidAccessToken } = require('../services/cloud/cloudSession');

let mainWindow;
let embeddingsEngine;
let peerDiscovery;
let offlineEngineReady = false;

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#FFFFFF',
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    // Open DevTools only when explicitly enabled.
    if (process.env.CORTEX_OPEN_DEVTOOLS === '1') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    const rendererPath = path.join(__dirname, '../../dist/renderer/index.html');

    if (fs.existsSync(rendererPath)) {
        mainWindow.loadFile(rendererPath);
    } else {
        // Tell the user to run npm run build first
        mainWindow.loadURL(`data:text/html,
            <html><body style="font-family:system-ui;display:flex;align-items:center;
                     justify-content:center;height:100vh;margin:0;background:#fff;">
                <div style="text-align:center;color:#374151;">
                    <h2 style="margin:0 0 8px">Build not found</h2>
                    <p style="margin:0;color:#6B7280;font-size:14px">
                        Run <code style="background:#F3F4F6;padding:2px 6px;border-radius:4px">
                        npm run build</code> first, then restart.
                    </p>
                </div>
            </body></html>
        `);
    }

    mainWindow.on('closed', () => { mainWindow = null; });

    mainWindow.webContents.on('did-finish-load', () => {
        if (offlineEngineReady) {
            mainWindow?.webContents.send('offline-engine-ready', { ready: true });
        }
    });

    mainWindow.on('maximize', () => mainWindow?.webContents.send('window-maximize-change', true));
    mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-maximize-change', false));

    // Keyboard zoom: Ctrl +/-/0 and Ctrl+scroll
    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 2.0;

    function applyZoom(factor) {
        mainWindow.webContents.setZoomFactor(factor);
        mainWindow.webContents.send('zoom-changed', Math.round(factor * 100));
    }

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (!input.control && !input.meta) return;
        const k = input.key;
        if ((k === '=' || k === '+') && input.type === 'keyDown') {
            const cur = mainWindow.webContents.getZoomFactor();
            applyZoom(Math.min(+(cur + ZOOM_STEP).toFixed(1), ZOOM_MAX));
            event.preventDefault();
        } else if (k === '-' && input.type === 'keyDown') {
            const cur = mainWindow.webContents.getZoomFactor();
            applyZoom(Math.max(+(cur - ZOOM_STEP).toFixed(1), ZOOM_MIN));
            event.preventDefault();
        } else if ((k === '0' || k === 'num0') && input.type === 'keyDown') {
            applyZoom(1.0);
            event.preventDefault();
        }
    });
}

// ── Service Initialization ───────────────────────────────────────────────────
async function initializeServices() {
    try {
        // Key store must be initialised before database (encryption depends on it)
        initKeyStore(app.getPath('userData'));
        console.log('[Cortex] Key store initialised');

        // Cloud token store / device keypair / content key all reuse the same
        // device master key for at-rest encryption — must come after initKeyStore.
        initCloudTokenStore(app.getPath('userData'));
        deviceKeys.initDeviceKeys(app.getPath('userData'));
        contentKey.initContentKey(app.getPath('userData'));

        const dbPath = path.join(app.getPath('userData'), 'cortex.db');
        initializeDatabase(dbPath);
        console.log('[Cortex] Database initialized at', dbPath);

        const modelCandidates = [
            path.join(app.getPath('userData'), 'models', 'bge-small-en-v1.5'),
            path.join(__dirname, '../../models/bge-small-en-v1.5'),
            path.join(__dirname, '../../../models/bge-small-en-v1.5'),
        ];
        const modelDir = modelCandidates.find((dir) => fs.existsSync(path.join(dir, 'model.onnx'))) || modelCandidates[0];
        embeddingsEngine = new EmbeddingsEngine(modelDir);
        await embeddingsEngine.initialize();
        console.log('[Cortex] Embeddings engine initialized');
        offlineEngineReady = true;

        peerDiscovery = new PeerDiscovery();
        peerDiscovery.start();
        try {
            const stats = getDatabase()?.getStats();
            if (stats) peerDiscovery.setDocCount(stats.documents);
        } catch (_) { }
        console.log('[Cortex] Peer discovery started');
    } catch (error) {
        offlineEngineReady = false;
        console.error('[Cortex] Service init error:', error.message);
        console.log('[Cortex] Running with limited functionality — ensure native modules are rebuilt (npm run rebuild).');
        if (!peerDiscovery) {
            peerDiscovery = new PeerDiscovery();
            peerDiscovery.start();
        }
    }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────
function registerIpcHandlers() {
    // Zoom (triggered by preload scroll handler)
    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 2.0;
    function broadcastZoom(factor) {
        if (!mainWindow) return;
        mainWindow.webContents.setZoomFactor(factor);
        mainWindow.webContents.send('zoom-changed', Math.round(factor * 100));
    }
    // ── Window Controls ────────────────────────────────────────────────────
    ipcMain.on('window-minimize', () => mainWindow?.minimize());
    ipcMain.on('window-maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
    ipcMain.on('window-close', () => mainWindow?.close());
    ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

    // ── Launch App (from landing page) ──────────────────────────────────────
    ipcMain.on('launch-app', () => {
        const rendererPath = path.join(__dirname, '../../dist/renderer/index.html');
        if (mainWindow && fs.existsSync(rendererPath)) {
            mainWindow.loadFile(rendererPath);
        }
    });

    // ── Session management ─────────────────────────────────────────────
    ipcMain.handle('save-session', (_e, profile) => {
        try { writeSession(profile); return { success: true }; }
        catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('get-session', () => readSession());

    ipcMain.on('logout', () => {
        deleteSession();
        const rendererPath = path.join(__dirname, '../../dist/renderer/index.html');
        if (!mainWindow) return;
        if (fs.existsSync(rendererPath)) {
            mainWindow.loadFile(rendererPath);
        }
    });

    // ── Local Auth API ──────────────────────────────────────────────────────────
    ipcMain.handle('auth-register', async (_e, body) => {
        try {
            const { email, password, full_name } = body;
            const db = getDatabase();
            const existing = db.getUserByEmail(email);
            if (existing) {
                return { status: 400, data: { detail: 'Email already registered.' } };
            }
            const hash = await bcrypt.hash(password, 12);
            db.createUser(email, hash, full_name);
            return {
                status: 200,
                data: {
                    user: { email, full_name },
                    accessToken: 'local-access-token',
                    refreshToken: 'local-refresh-token'
                }
            };
        } catch (error) {
            console.error('[auth-register]', error);
            return { status: 500, data: { detail: 'Registration failed.' } };
        }
    });

    ipcMain.handle('auth-login', async (_e, body) => {
        try {
            const { email, password } = body;
            const db = getDatabase();
            const user = db.getUserByEmail(email);
            if (!user) {
                return { status: 400, data: { detail: 'Invalid credentials.' } };
            }
            const match = await bcrypt.compare(password, user.password_hash);
            if (!match) {
                return { status: 400, data: { detail: 'Invalid credentials.' } };
            }
            return {
                status: 200,
                data: {
                    user: { email: user.email, full_name: user.full_name },
                    accessToken: 'local-access-token',
                    refreshToken: 'local-refresh-token'
                }
            };
        } catch (error) {
            console.error('[auth-login]', error);
            return { status: 500, data: { detail: 'Login failed.' } };
        }
    });

    // Forgot password is removed in local-first, return not supported
    ipcMain.handle('auth-forgot-password', async () => {
        return { status: 400, data: { detail: 'Password reset is not available in local-first mode. Please remember your password.' } };
    });

    ipcMain.handle('auth-reset-password', async () => {
        return { status: 400, data: { detail: 'Password reset is not available.' } };
    });

    // ── Optional Cloud Account (apps/server, backed by Supabase) ─────────────────
    // Entirely separate from local auth above: local login/signup never call
    // these, and these never touch the local session file. Opt-in only, and a
    // no-op when CORTEX_CLOUD_API_URL isn't set (cloudClient.isConfigured()).
    //
    // Two thin wrappers standardize the { success, data, error } response
    // shape: authedCloudHandler injects the current session's access token
    // (refreshing it transparently on expiry via withValidAccessToken) and
    // publicCloudHandler is for the handful of calls that don't need one
    // (e.g. forgot-password, before the caller is signed in).
    function authedCloudHandler(fn) {
        return async (_e, ...args) => {
            if (!cloudClient.isConfigured()) return { success: false, notConfigured: true, error: 'Cloud sync is not configured.' };
            try {
                const data = await withValidAccessToken((accessToken, session) => fn(accessToken, session, ...args));
                return { success: true, data };
            } catch (error) {
                return { success: false, error: error.data?.detail || error.message };
            }
        };
    }
    function publicCloudHandler(fn) {
        return async (_e, ...args) => {
            if (!cloudClient.isConfigured()) return { success: false, notConfigured: true, error: 'Cloud sync is not configured.' };
            try {
                return { success: true, data: await fn(...args) };
            } catch (error) {
                return { success: false, error: error.data?.detail || error.message };
            }
        };
    }

    // Wipes the local device keypair + content key — called after account
    // deletion, since both are meaningless once the account is gone. A
    // fresh keypair/content key is generated automatically next time cloud
    // sync is enabled again.
    function clearCloudCryptoState() {
        deviceKeys.clearDeviceKeys();
        contentKey.clearContentKey();
    }

    // register/login augment the device payload with this device's public
    // key (deviceKeys is main-process-only Node crypto, unreachable from the
    // renderer) and, on success, establish this device's copy of the cloud
    // content key (syncEngine.ensureDeviceEnrolled) so sync can run.
    ipcMain.handle('cloud-auth-register', async (_e, { email, password, full_name, device }) => {
        if (!cloudClient.isConfigured()) return { success: false, notConfigured: true, error: 'Cloud sync is not configured.' };
        try {
            const result = await cloudClient.register({ email, password, full_name, device: { ...device, publicKey: deviceKeys.getPublicKey() } });
            saveCloudSession(result);
            await syncEngine.ensureDeviceEnrolled(result.device);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: error.data?.detail || error.message };
        }
    });

    ipcMain.handle('cloud-auth-login', async (_e, { email, password, device }) => {
        if (!cloudClient.isConfigured()) return { success: false, notConfigured: true, error: 'Cloud sync is not configured.' };
        try {
            const result = await cloudClient.login({ email, password, device: { ...device, publicKey: deviceKeys.getPublicKey() } });
            saveCloudSession(result);
            await syncEngine.ensureDeviceEnrolled(result.device);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: error.data?.detail || error.message };
        }
    });

    ipcMain.handle('cloud-auth-logout', async () => {
        const session = getCloudSession();
        if (session?.accessToken && cloudClient.isConfigured()) {
            try { await cloudClient.logout(session.accessToken); } catch (_) { /* best-effort */ }
        }
        clearCloudSession();
        return { success: true };
    });

    // "Sign out from all devices" — revokes every session server-side, not
    // just this one.
    ipcMain.handle('cloud-auth-logout-all', async () => {
        if (!cloudClient.isConfigured()) return { success: false, notConfigured: true, error: 'Cloud sync is not configured.' };
        try {
            await withValidAccessToken((accessToken) => cloudClient.logoutAllDevices(accessToken));
            clearCloudSession();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.data?.detail || error.message };
        }
    });

    ipcMain.handle('cloud-account-delete', async () => {
        if (!cloudClient.isConfigured()) return { success: false, notConfigured: true, error: 'Cloud sync is not configured.' };
        try {
            await withValidAccessToken((accessToken) => cloudClient.deleteAccount(accessToken));
            clearCloudSession();
            clearCloudCryptoState();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.data?.detail || error.message };
        }
    });

    ipcMain.handle('cloud-verify-email-request', authedCloudHandler((accessToken) => cloudClient.requestEmailVerification(accessToken)));
    ipcMain.handle('cloud-verify-email-confirm', authedCloudHandler((accessToken, _session, token) => cloudClient.confirmEmailVerification(accessToken, token)));

    ipcMain.handle('cloud-forgot-password', publicCloudHandler((email) => cloudClient.forgotPassword(email)));
    ipcMain.handle('cloud-reset-password', publicCloudHandler((payload) => cloudClient.resetPassword(payload)));

    ipcMain.handle('cloud-devices-list', authedCloudHandler((accessToken) => cloudClient.listDevices(accessToken)));
    ipcMain.handle('cloud-devices-revoke', authedCloudHandler((accessToken, _session, deviceId) => cloudClient.revokeDevice(accessToken, deviceId)));

    ipcMain.handle('cloud-profile-get', authedCloudHandler((accessToken) => cloudClient.getMe(accessToken)));
    ipcMain.handle('cloud-profile-update', authedCloudHandler((accessToken, _session, patch) => cloudClient.updateMe(accessToken, patch)));
    ipcMain.handle('cloud-preferences-get', authedCloudHandler((accessToken) => cloudClient.getPreferences(accessToken)));
    ipcMain.handle('cloud-preferences-set', authedCloudHandler((accessToken, _session, preferences) => cloudClient.setPreferences(accessToken, preferences)));
    ipcMain.handle('cloud-subscription-get', authedCloudHandler((accessToken) => cloudClient.getSubscription(accessToken)));

    // ── Sync ──────────────────────────────────────────────────────────────
    ipcMain.handle('cloud-sync-now', async () => syncEngine.runSync({ trigger: 'manual' }));
    ipcMain.handle('cloud-sync-status', async () => {
        const session = getCloudSession();
        return {
            configured: cloudClient.isConfigured(),
            connected: !!session,
            user: session?.user ?? null,
            enrolled: contentKey.hasContentKey(),
            syncing: syncEngine.isSyncing(),
            lastResult: syncEngine.getLastResult(),
        };
    });

    // ── Backup ────────────────────────────────────────────────────────────
    ipcMain.handle('cloud-backup-now', authedCloudHandler((accessToken, session, opts) =>
        cloudClient.createBackup(accessToken, { deviceId: session.device?.id, kind: 'manual', ...opts })
    ));
    ipcMain.handle('cloud-backup-list', authedCloudHandler((accessToken) => cloudClient.listBackups(accessToken)));
    ipcMain.handle('cloud-backup-restore', authedCloudHandler(async (accessToken, _session, backupId) => {
        const result = await cloudClient.restoreBackup(accessToken, backupId);
        const db = getDatabase();
        if (db) {
            for (const blob of result.blobs) {
                db.setSyncVersion(blob.resourceType, blob.resourceId, blob.version);
                if (blob.deleted) { db.applyRemoteDelete(blob.resourceType, blob.resourceId); continue; }
                const value = contentKey.decryptResource(blob);
                if (blob.resourceType === 'note') db.upsertNoteFromCloud({ syncId: blob.resourceId, ...value });
                else if (blob.resourceType === 'page') db.upsertPageFromCloud({ id: blob.resourceId, ...value });
            }
        }
        return { backup: result.backup, restoredResources: result.blobs.length };
    }));

    // ── Collaboration ─────────────────────────────────────────────────────
    ipcMain.handle('cloud-friends-send-request', authedCloudHandler((accessToken, _s, addresseeEmail) => cloudClient.sendFriendRequest(accessToken, addresseeEmail)));
    ipcMain.handle('cloud-friends-list-requests', authedCloudHandler((accessToken) => cloudClient.listFriendRequests(accessToken)));
    ipcMain.handle('cloud-friends-respond', authedCloudHandler((accessToken, _s, requestId, accept) => cloudClient.respondToFriendRequest(accessToken, requestId, accept)));
    ipcMain.handle('cloud-friends-list', authedCloudHandler((accessToken) => cloudClient.listFriends(accessToken)));

    ipcMain.handle('cloud-workspaces-create', authedCloudHandler((accessToken, _s, payload) => cloudClient.createWorkspace(accessToken, payload)));
    ipcMain.handle('cloud-workspaces-list', authedCloudHandler((accessToken) => cloudClient.listWorkspaces(accessToken)));
    ipcMain.handle('cloud-workspaces-get', authedCloudHandler((accessToken, _s, workspaceId) => cloudClient.getWorkspace(accessToken, workspaceId)));
    ipcMain.handle('cloud-workspaces-update', authedCloudHandler((accessToken, _s, workspaceId, patch) => cloudClient.updateWorkspace(accessToken, workspaceId, patch)));
    ipcMain.handle('cloud-workspaces-delete', authedCloudHandler((accessToken, _s, workspaceId) => cloudClient.deleteWorkspace(accessToken, workspaceId)));
    ipcMain.handle('cloud-workspaces-members', authedCloudHandler((accessToken, _s, workspaceId) => cloudClient.listWorkspaceMembers(accessToken, workspaceId)));
    ipcMain.handle('cloud-workspaces-update-member', authedCloudHandler((accessToken, _s, workspaceId, userId, role) => cloudClient.updateMemberRole(accessToken, workspaceId, userId, role)));
    ipcMain.handle('cloud-workspaces-remove-member', authedCloudHandler((accessToken, _s, workspaceId, userId) => cloudClient.removeMember(accessToken, workspaceId, userId)));

    ipcMain.handle('cloud-invitations-create', authedCloudHandler((accessToken, _s, workspaceId, payload) => cloudClient.createInvitation(accessToken, workspaceId, payload)));
    ipcMain.handle('cloud-invitations-list', authedCloudHandler((accessToken, _s, workspaceId) => cloudClient.listInvitations(accessToken, workspaceId)));
    // NOTE: workspace-level content-key wrapping (so an accepted invite can
    // actually decrypt the notebook's shared content) isn't implemented in
    // this pass — only the personal per-user cloud content key (contentKey.js)
    // is. wrappedContentKey is sent as null until that handshake is built.
    ipcMain.handle('cloud-invitations-accept', authedCloudHandler((accessToken, _s, token) => cloudClient.acceptInvitation(accessToken, token, null)));
    ipcMain.handle('cloud-invitations-decline', authedCloudHandler((accessToken, _s, token) => cloudClient.declineInvitation(accessToken, token)));

    ipcMain.handle('cloud-organizations-create', authedCloudHandler((accessToken, _s, name) => cloudClient.createOrganization(accessToken, name)));
    ipcMain.handle('cloud-organizations-add-member', authedCloudHandler((accessToken, _s, orgId, userId, role) => cloudClient.addOrganizationMember(accessToken, orgId, userId, role)));
    ipcMain.handle('cloud-organizations-remove-member', authedCloudHandler((accessToken, _s, orgId, userId) => cloudClient.removeOrganizationMember(accessToken, orgId, userId)));

    // ── Notifications ─────────────────────────────────────────────────────
    ipcMain.handle('cloud-notifications-list', authedCloudHandler((accessToken, _s, unreadOnly) => cloudClient.listNotifications(accessToken, unreadOnly)));
    ipcMain.handle('cloud-notifications-mark-read', authedCloudHandler((accessToken, _s, id) => cloudClient.markNotificationRead(accessToken, id)));
    ipcMain.handle('cloud-notifications-mark-all-read', authedCloudHandler((accessToken) => cloudClient.markAllNotificationsRead(accessToken)));

    ipcMain.on('zoom-in', () => { if (!mainWindow) return; const c = mainWindow.webContents.getZoomFactor(); broadcastZoom(Math.min(+(c + ZOOM_STEP).toFixed(1), ZOOM_MAX)); });
    ipcMain.on('zoom-out', () => { if (!mainWindow) return; const c = mainWindow.webContents.getZoomFactor(); broadcastZoom(Math.max(+(c - ZOOM_STEP).toFixed(1), ZOOM_MIN)); });
    ipcMain.on('zoom-reset', () => { if (!mainWindow) return; broadcastZoom(1.0); });
    ipcMain.on('zoom-set', (_e, pct) => { if (!mainWindow) return; broadcastZoom(Math.min(Math.max(+(pct / 100).toFixed(2), ZOOM_MIN), ZOOM_MAX)); });
    ipcMain.handle('zoom-get', () => mainWindow ? Math.round(mainWindow.webContents.getZoomFactor() * 100) : 100);

    // ── Search ──────────────────────────────────────────────────────────────
    ipcMain.handle('search', async (_event, query) => {
        try {
            if (!embeddingsEngine?.isReady()) return { error: 'AI engine not ready. Run npm run rebuild, then restart.' };
            const results = await ragSearch(query, embeddingsEngine, getDatabase());
            return { results };
        } catch (e) { return { error: e.message }; }
    });

    // ── Upload PDF — local-only path while backend is being redesigned ──────
    ipcMain.handle('upload-pdf', async (_event, userId) => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openFile'],
                filters: [
                    { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'docx'] },
                    { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg'] },
                ],
            });
            if (result.canceled || result.filePaths.length === 0) return { canceled: true };

            const filePath = result.filePaths[0];
            const chunks = await extractPdfText(filePath);
            const db = getDatabase();
            const title = path.basename(filePath, '.pdf');
            for (const chunk of chunks) {
                const docId = db.insertDocument(title, 'Uploaded', chunk.content, chunk.chunkIndex);
                if (embeddingsEngine?.isReady()) {
                    const vector = await embeddingsEngine.embed(chunk.content);
                    db.insertEmbedding(docId, vector);
                }
            }
            return { success: true, title, chunks: chunks.length, source: 'local' };
        } catch (e) { return { error: e.message }; }
    });

    // ── Stats — local DB only ────────────────────────────────────────────────
    ipcMain.handle('get-stats', async () => {
        try { return getDatabase()?.getStats() ?? { documents: 0, embeddings: 0 }; }
        catch { return { documents: 0, embeddings: 0 }; }
    });

    // ── Backend status ──────────────────────────────────────────────────────
    ipcMain.handle('backend-ready', async () => {
        return false;
    });

    ipcMain.handle('get-offline-engine-status', () => offlineEngineReady);

    // ── Internet status ─────────────────────────────────────────────────────
    ipcMain.handle('get-internet-status', () => isInternetOnline);

    // ── Performance ─────────────────────────────────────────────────────────
    ipcMain.handle('get-perf-stats', () => {
        if (!embeddingsEngine?.isReady()) return { provider: 'cpu', lastEmbedTimeMs: 0, avgEmbedTimeMs: 0, embedHistory: [], ready: false };
        return { ...embeddingsEngine.getPerfStats(), ready: true };
    });

    // ── Network ─────────────────────────────────────────────────────────────
    ipcMain.handle('share-to-network', async (_event, _docId) => {
        await new Promise((r) => setTimeout(r, 800));
        const peers = peerDiscovery?.getPeers().filter((p) => p.status === 'online') ?? [];
        return { success: true, peersReached: peers.length };
    });

    ipcMain.handle('get-peers', () => {
        const real = peerDiscovery?.getPeers() ?? [];
        return { peers: real };
    });

    ipcMain.handle('mesh-start', () => {
        if (!peerDiscovery) {
            peerDiscovery = new PeerDiscovery();
        }
        peerDiscovery.start();
        return { success: true };
    });

    ipcMain.handle('mesh-stop', () => {
        peerDiscovery?.stop();
        return { success: true };
    });

    // ── Notes ────────────────────────────────────────────────────────────────
    ipcMain.handle('add-note', (_event, note) => {
        try {
            const db = getDatabase();
            if (!db) return { error: 'Database not ready' };
            const id = db.addNote(note.title, note.content || '', note.type || 'note', note.dueDate || null);
            return { success: true, id };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('get-notes', () => {
        try { return { notes: getDatabase()?.getNotes() ?? [] }; }
        catch { return { notes: [] }; }
    });

    ipcMain.handle('delete-note', (_event, id) => {
        try { getDatabase()?.deleteNote(id); return { success: true }; }
        catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('toggle-note-complete', (_event, id) => {
        try { getDatabase()?.toggleNoteComplete(id); return { success: true }; }
        catch (e) { return { error: e.message }; }
    });

    // ── Workspace Pages ──────────────────────────────────────────────────────
    ipcMain.handle('create-page', (_event, id, title, content, parentId) => {
        try {
            getDatabase()?.createPage(id, title, content, parentId);
            return { success: true };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('update-page', (_event, id, title, content) => {
        try {
            getDatabase()?.updatePage(id, title, content);
            return { success: true };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('get-page', (_event, id) => {
        try {
            const page = getDatabase()?.getPage(id);
            return { success: true, page };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('get-pages', () => {
        try {
            const pages = getDatabase()?.getPages() ?? [];
            return { success: true, pages };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('delete-page', (_event, id) => {
        try {
            getDatabase()?.deletePage(id);
            return { success: true };
        } catch (e) { return { error: e.message }; }
    });

    // ── Window Controls ──────────────────────────────────────────────────────
    ipcMain.on('update-titlebar-overlay', (_event, settings) => {
        if (!mainWindow || !mainWindow.setTitleBarOverlay) return;
        try {
            mainWindow.setTitleBarOverlay(settings);
        } catch (error) {
            // Frameless windows may not have overlay enabled on all platforms.
            // Keep this as a non-fatal best-effort update.
        }
    });
}

// ── App Lifecycle ────────────────────────────────────────────────────────────
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    registerIpcHandlers();
    await initializeServices();
    createWindow();

    // Backend connectivity intentionally disabled during redesign.
    mainWindow?.webContents.send('backend-status', { ready: false });

    // Start 10-second internet connectivity checks
    startInternetChecks();
    // Optional cloud sync/backup loop — inert unless cloud sync is enabled.
    startCloudSyncLoop();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (internetCheckInterval) clearInterval(internetCheckInterval);
    if (cloudSyncInterval) clearInterval(cloudSyncInterval);
    if (process.platform !== 'darwin') app.quit();
});

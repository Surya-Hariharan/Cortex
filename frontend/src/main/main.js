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
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

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
    }
}

function startInternetChecks() {
    // Run immediately, then every 10 seconds
    updateInternetStatus();
    internetCheckInterval = setInterval(updateInternetStatus, 10000);
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
const { initializeDatabase, getDatabase } = require('../services/storage/database');
const { EmbeddingsEngine } = require('../services/ai/embeddings');
const { extractPdfText } = require('../services/storage/pdfHandler');
const { ragSearch } = require('../services/ai/ragPipeline');
const { PeerDiscovery } = require('../services/network/peerDiscovery');

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
            sandbox: false,
        },
    });

    // Open DevTools only when explicitly enabled.
    if (process.env.CORTEX_OPEN_DEVTOOLS === '1') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Route: skip landing page for returning users who have a saved session.
    const landingPath = path.join(__dirname, '../../landing.html');
    const rendererPath = path.join(__dirname, '../../dist/renderer/index.html');

    if (hasSession() && fs.existsSync(rendererPath)) {
        mainWindow.loadFile(rendererPath);
    } else if (fs.existsSync(landingPath)) {
        mainWindow.loadFile(landingPath);
    } else if (fs.existsSync(rendererPath)) {
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
        const dbPath = path.join(__dirname, '../../data/cortex.db');
        initializeDatabase(dbPath);
        console.log('[Cortex] Database initialized');

        const modelCandidates = [
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
        const landingPath = path.join(__dirname, '../../landing.html');
        const rendererPath = path.join(__dirname, '../../dist/renderer/index.html');
        if (!mainWindow) return;
        if (fs.existsSync(landingPath)) {
            mainWindow.loadFile(landingPath);
        } else if (fs.existsSync(rendererPath)) {
            mainWindow.loadFile(rendererPath);
        }
    });

    // ── Auth API proxies (disabled while backend is being redesigned) ──────
    ipcMain.handle('auth-register', async (_e, body) => {
        return { status: 0, data: { detail: 'Auth API is disabled during backend redesign.' } };
    });

    ipcMain.handle('auth-login', async (_e, body) => {
        return { status: 0, data: { detail: 'Auth API is disabled during backend redesign.' } };
    });

    ipcMain.handle('auth-forgot-password', async (_e, body) => {
        return { status: 0, data: { detail: 'Auth API is disabled during backend redesign.' } };
    });

    ipcMain.handle('auth-reset-password', async (_e, body) => {
        return { status: 0, data: { detail: 'Auth API is disabled during backend redesign.' } };
    });

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

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (internetCheckInterval) clearInterval(internetCheckInterval);
    if (process.platform !== 'darwin') app.quit();
});

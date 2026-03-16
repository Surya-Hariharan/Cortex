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
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// ── Python Backend ────────────────────────────────────────────────────────────
let pythonProcess = null;
const BACKEND_PORT = 8765;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}/api/v1`;

function findPython() {
    // Prefer the project venv, then fall back to system python.
    const root = path.join(__dirname, '../../../');
    const candidates = [
        path.join(root, '.venv', 'Scripts', 'python.exe'),  // Windows venv
        path.join(root, '.venv', 'bin', 'python'),           // Unix venv
        'python',
        'python3',
    ];
    return candidates.find(p => {
        try { return p.includes(path.sep) ? fs.existsSync(p) : true; }
        catch { return false; }
    }) || 'python';
}

function isBackendReachable(timeoutMs = 1000) {
    return new Promise(resolve => {
        const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/v1/system/health`, res => {
            res.resume();
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
    });
}

function isPortOpen(port, host = '127.0.0.1', timeoutMs = 800) {
    return new Promise(resolve => {
        const socket = net.createConnection({ port, host });
        let settled = false;
        const done = (value) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(value);
        };
        socket.on('connect', () => done(true));
        socket.on('error', () => done(false));
        socket.setTimeout(timeoutMs, () => done(false));
    });
}

async function startPythonBackend() {
    // Reachable backend already available: reuse it.
    const isRunning = await isBackendReachable(1000);

    if (isRunning) {
        console.log(`[Cortex] Using already running backend on port ${BACKEND_PORT}.`);
        return;
    }

    // If the port is occupied by a backend that is still booting, avoid
    // launching another process that would fail with EADDRINUSE.
    const portOpen = await isPortOpen(BACKEND_PORT);
    if (portOpen) {
        console.log(`[Cortex] Port ${BACKEND_PORT} is in use. Waiting for backend health...`);
        const ready = await waitForBackend(45000);
        if (ready) {
            console.log(`[Cortex] Reused backend that was already starting on port ${BACKEND_PORT}.`);
        } else {
            console.error(`[Cortex] Port ${BACKEND_PORT} is occupied by another process that is not responding as Cortex backend.`);
        }
        return;
    }

    const root = path.join(__dirname, '../../../');
    const py = findPython();
    console.log('[Cortex] Starting Python backend with:', py);
    pythonProcess = spawn(
        py,
        ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT), '--log-level', 'warning'],
        {
            cwd: root,
            stdio: 'pipe',
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PYTHONUTF8: '1',
            },
        }
    );
    pythonProcess.stdout.on('data', d => console.log('[Python]', d.toString('utf8').trim()));
    pythonProcess.stderr.on('data', d => console.error('[Python]', d.toString('utf8').trim()));
    pythonProcess.on('exit', code => {
        console.log('[Cortex] Python backend exited with code', code);
        pythonProcess = null;
    });
}

function stopPythonBackend() {
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
    }
}

// Ping the backend until it answers (max 30s)
function waitForBackend(timeout = 60000) {
    return new Promise(resolve => {
        let settled = false;
        const finalize = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const start = Date.now();
        const tryPing = () => {
            const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/v1/system/health`, res => {
                res.resume();
                if (res.statusCode) { finalize(true); return; }
                retry();
            });
            req.on('error', retry);
            req.setTimeout(1000, () => { req.destroy(); retry(); });
        };
        const retry = async () => {
            if (Date.now() - start > timeout) {
                const portOpen = await isPortOpen(BACKEND_PORT);
                finalize(portOpen);
                return;
            }
            setTimeout(tryPing, 500);
        };
        tryPing();
    });
}

// ── Backend HTTP Utility ─────────────────────────────────────────────────────
function postToBackend(apiPath, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request({
            hostname: '127.0.0.1',
            port: BACKEND_PORT,
            path: apiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch {
                    resolve({ status: res.statusCode, data: { detail: data } });
                }
            });
        });
        req.on('error', err => reject(err));
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
        req.write(payload);
        req.end();
    });
}

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

        // Notify the Python backend so it can switch AI model modes
        try {
            await postToBackend('/api/v1/system/internet-status', { online: isInternetOnline });
        } catch (_) { /* backend may not be up yet */ }
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

        peerDiscovery = new PeerDiscovery();
        peerDiscovery.start();
        try {
            const stats = getDatabase()?.getStats();
            if (stats) peerDiscovery.setDocCount(stats.documents);
        } catch (_) { }
        console.log('[Cortex] Peer discovery started');
    } catch (error) {
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

    // ── Auth API proxies ────────────────────────────────────────────────────
    ipcMain.handle('auth-register', async (_e, body) => {
        try {
            return await postToBackend('/api/v1/auth/register', body);
        } catch (err) {
            return { status: 0, data: { detail: 'Backend is not running. Please start the server.' } };
        }
    });

    ipcMain.handle('auth-login', async (_e, body) => {
        try {
            return await postToBackend('/api/v1/auth/login', body);
        } catch (err) {
            return { status: 0, data: { detail: 'Backend is not running. Please start the server.' } };
        }
    });

    ipcMain.handle('auth-forgot-password', async (_e, body) => {
        try {
            return await postToBackend('/api/v1/auth/forgot-password', body);
        } catch (err) {
            return { status: 0, data: { detail: 'Backend is not running. Please start the server.' } };
        }
    });

    ipcMain.handle('auth-reset-password', async (_e, body) => {
        try {
            return await postToBackend('/api/v1/auth/reset-password', body);
        } catch (err) {
            return { status: 0, data: { detail: 'Backend is not running.' } };
        }
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

    // ── Upload PDF — forward to FastAPI backend ──────────────────────────────
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
            const filename = path.basename(filePath);

            // Try to upload via FastAPI; fall back to old local engine if backend is down
            try {
                const FormData = require('form-data');
                const fileStream = fs.createReadStream(filePath);
                const fd = new FormData();
                fd.append('file', fileStream, filename);
                fd.append('user_id', userId || 'local-user');

                // Node's built-in http to avoid a fetch polyfill dep
                const uploadResult = await new Promise((resolve, reject) => {
                    const req = http.request({
                        hostname: '127.0.0.1',
                        port: BACKEND_PORT,
                        path: '/api/v1/documents/upload',
                        method: 'POST',
                        headers: fd.getHeaders(),
                    }, res => {
                        let body = '';
                        res.on('data', d => body += d);
                        res.on('end', () => {
                            try { resolve(JSON.parse(body)); }
                            catch { resolve({ error: 'Invalid response' }); }
                        });
                    });
                    req.on('error', reject);
                    fd.pipe(req);
                });
                return { success: true, ...uploadResult };
            } catch (_apiErr) {
                // Backend unavailable — fall back to legacy local pipeline
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
            }
        } catch (e) { return { error: e.message }; }
    });

    // ── Stats — prefer FastAPI; fall back to local DB ────────────────────────
    ipcMain.handle('get-stats', async () => {
        try {
            const res = await new Promise((resolve, reject) => {
                const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/v1/system/health`, r => {
                    let b = ''; r.on('data', d => b += d);
                    r.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
                });
                req.on('error', reject);
                req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            if (res?.subsystems) return res;
        } catch (_) { }
        try { return getDatabase()?.getStats() ?? { documents: 0, embeddings: 0 }; }
        catch { return { documents: 0, embeddings: 0 }; }
    });

    // ── Backend status ──────────────────────────────────────────────────────
    ipcMain.handle('backend-ready', async () => {
        try {
            return await isBackendReachable(2000);
        } catch { return false; }
    });

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
    startPythonBackend();
    createWindow();

    // Notify renderer when backend becomes ready
    waitForBackend().then(ready => {
        console.log('[Cortex] Python backend ready:', ready);
        mainWindow?.webContents.send('backend-status', { ready });
    });

    // Start 10-second internet connectivity checks
    startInternetChecks();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    stopPythonBackend();
    if (internetCheckInterval) clearInterval(internetCheckInterval);
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => stopPythonBackend());

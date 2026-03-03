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

// Services
const { initializeDatabase, getDatabase } = require('../services/database');
const { EmbeddingsEngine } = require('../services/embeddings');
const { extractPdfText } = require('../services/pdfHandler');
const { ragSearch } = require('../services/ragPipeline');
const { PeerDiscovery } = require('../services/peerDiscovery');

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
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#FFFFFF',
            symbolColor: '#475569',
            height: 32,
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // Open DevTools immediately for debugging
    mainWindow.webContents.openDevTools();

    // Load the built React bundle
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

    // Keyboard zoom: Ctrl +/-/0 and Ctrl+scroll
    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 2.0;

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (!input.control && !input.meta) return;
        const k = input.key;
        if ((k === '=' || k === '+') && input.type === 'keyDown') {
            const cur = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.min(+(cur + ZOOM_STEP).toFixed(1), ZOOM_MAX));
            event.preventDefault();
        } else if (k === '-' && input.type === 'keyDown') {
            const cur = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.max(+(cur - ZOOM_STEP).toFixed(1), ZOOM_MIN));
            event.preventDefault();
        } else if ((k === '0' || k === 'num0') && input.type === 'keyDown') {
            mainWindow.webContents.setZoomFactor(1.0);
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

        const modelDir = path.join(__dirname, '../../models/bge-small-en-v1.5');
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
    ipcMain.on('zoom-in', () => { if (!mainWindow) return; const c = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(Math.min(+(c + ZOOM_STEP).toFixed(1), ZOOM_MAX)); });
    ipcMain.on('zoom-out', () => { if (!mainWindow) return; const c = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(Math.max(+(c - ZOOM_STEP).toFixed(1), ZOOM_MIN)); });
    ipcMain.on('zoom-reset', () => { if (!mainWindow) return; mainWindow.webContents.setZoomFactor(1.0); });

    // ── Search ──────────────────────────────────────────────────────────────
    ipcMain.handle('search', async (_event, query) => {
        try {
            if (!embeddingsEngine?.isReady()) return { error: 'AI engine not ready. Run npm run rebuild, then restart.' };
            const results = await ragSearch(query, embeddingsEngine, getDatabase());
            return { results };
        } catch (e) { return { error: e.message }; }
    });

    // ── Upload PDF ──────────────────────────────────────────────────────────
    ipcMain.handle('upload-pdf', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openFile'],
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
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
            return { success: true, title, chunks: chunks.length };
        } catch (e) { return { error: e.message }; }
    });

    // ── Stats ───────────────────────────────────────────────────────────────
    ipcMain.handle('get-stats', () => {
        try { return getDatabase()?.getStats() ?? { documents: 0, embeddings: 0 }; }
        catch { return { documents: 0, embeddings: 0 }; }
    });

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
        if (mainWindow && mainWindow.setTitleBarOverlay) {
            mainWindow.setTitleBarOverlay(settings);
        }
    });
}

// ── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    registerIpcHandlers();
    await initializeServices();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Services
const { initializeDatabase, getDatabase, getStorageManager } = require('./services/database');
const { aiManager } = require('./services/ai/runtime/aiManager');
const { searchVectors } = require('./services/vectorSearch');
const { extractPdfText } = require('./services/pdfHandler');
const { ragSearch } = require('./services/ragPipeline');
const { createMeshManager, getMeshManager } = require('./services/mesh/meshManager');

let mainWindow;
let meshManager;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#FFFFFF',         // matches --surface-card (navbar bg)
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#FFFFFF',               // exact navbar background
            symbolColor: '#475569',         // --text-secondary: neutral dark gray icons
            height: 64,                     // matches navbar height
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // Load renderer
    const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
    if (fs.existsSync(rendererPath)) {
        mainWindow.loadFile(rendererPath);
    } else {
        // Fallback: show a message if renderer hasn't been built
        mainWindow.loadURL(`data:text/html,
      <html><body style="background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center">
          <h1>Cortex</h1>
          <p>Run <code>npm run build:renderer</code> first, then <code>npm start</code></p>
        </div>
      </body></html>
    `);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

async function initializeServices() {
    try {
        // Initialize AI components first (needed for embeddings)
        await aiManager.initialize();
        console.log('[Cortex] ✓ AI engines initialized');

        // Initialize new storage architecture (Phase 2D: SQLite + LanceDB)
        const dataDir = path.join(__dirname, '../data');
        const dbPath = path.join(dataDir, 'cortex.db');
        
        await initializeDatabase(dbPath);
        console.log('[Cortex] ✓ Storage architecture initialized (Phase 2D)');
        
        const storageManager = getStorageManager();
        if (storageManager.isReady()) {
            const stats = await storageManager.getStats();
            console.log(`[Cortex]   → ${stats.documents} documents, ${stats.chunks} chunks, ${stats.vectors} vectors`);
            console.log(`[Cortex]   → Embedding version: ${stats.embeddingVersion}`);
            
            // Check if migration needed
            const migrationInfo = storageManager.checkMigration();
            if (migrationInfo) {
                console.warn('[Cortex] ⚠ Embedding version migration required!');
                console.warn(`[Cortex]   → Run migration via Performance tab or call storageManager.migrateAll()`);
            }
        }

        // Start mesh networking (libp2p-based P2P)
        meshManager = createMeshManager(getDatabase());
        
        // Setup peer change callback to notify UI
        meshManager.onPeersChanged = (peers) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('peers-updated', peers);
            }
        };
        
        // Start mesh networking
        await meshManager.start();
        console.log('[Cortex] ✓ Mesh networking started (libp2p)');
        
    } catch (error) {
        console.error('[Cortex] Service initialization error:', error);
        console.log('[Cortex] App will run with limited functionality.');
        throw error; // Re-throw to help diagnose initialization issues
    }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers() {
    // Search
    ipcMain.handle('search', async (event, query) => {
        try {
            if (!aiManager.embedder.isReady()) {
                return { error: 'Embeddings engine not initialized. Run "npm run setup-demo" first.' };
            }

            // Stream tokens back directly to the originating webContents
            const onToken = (text) => {
                event.sender.send('search-token', text);
            };

            const results = await ragSearch(query, getDatabase(), onToken);
            return { results };
        } catch (error) {
            console.error('[Cortex] Search error:', error);
            return { error: error.message };
        }
    });

    // Upload PDF (Phase 2D: Uses new storage architecture)
    ipcMain.handle('upload-pdf', async (event) => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openFile'],
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
            });

            if (result.canceled || result.filePaths.length === 0) {
                return { canceled: true };
            }

            const filePath = result.filePaths[0];
            const title = path.basename(filePath, '.pdf');
            
            // Phase 2D: Use new storage manager
            const storageManager = getStorageManager();
            
            if (!storageManager.isReady()) {
                return { error: 'Storage not initialized' };
            }

            // Index document with progress tracking
            const indexResult = await storageManager.indexDocument(
                filePath, 
                title,
                (progress) => {
                    // Optional: Send progress to UI
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('indexing-progress', {
                            title,
                            stage: progress.stage,
                            progress: progress.progress,
                        });
                    }
                }
            );

            if (!indexResult.success) {
                if (indexResult.skipped) {
                    return { 
                        success: true, 
                        skipped: true,
                        title, 
                        message: indexResult.reason 
                    };
                }
                return { error: indexResult.error };
            }

            return { 
                success: true, 
                title, 
                chunks: indexResult.chunkCount,
                docId: indexResult.docId,
                embeddingVersion: indexResult.embeddingVersion,
                timeMs: indexResult.timeMs,
            };
        } catch (error) {
            console.error('[Cortex] PDF upload error:', error);
            return { error: error.message };
        }
    });

    // Get stats (Phase 2D: Enhanced with storage manager)
    ipcMain.handle('get-stats', async () => {
        try {
            const storageManager = getStorageManager();
            
            if (storageManager && storageManager.isReady()) {
                // Use new storage manager for accurate stats
                const stats = await storageManager.getStats();
                return {
                    documents: stats.documents,
                    embeddings: stats.vectors,
                    chunks: stats.chunks,
                    embeddingVersion: stats.embeddingVersion,
                    needsMigration: stats.needsMigration,
                };
            }
            
            // Fallback to legacy
            const db = getDatabase();
            if (!db) return { documents: 0, embeddings: 0, chunks: 0 };
            
            const stats = await db.getStats();
            return stats;
        } catch (error) {
            console.error('[Cortex] Error getting stats:', error);
            return { documents: 0, embeddings: 0, chunks: 0 };
        }
    });

    // Performance stats (provider, embed timing)
    ipcMain.handle('get-perf-stats', async () => {
        try {
            // Use new getRuntimeInfo for comprehensive runtime metadata
            const runtimeInfo = aiManager.getRuntimeInfo();
            
            // Maintain backward compatibility with old format
            const embedderStats = runtimeInfo.models.embedding.ready 
                ? {
                    ready: true,
                    modelName: runtimeInfo.models.embedding.name,
                    provider: runtimeInfo.models.embedding.provider,
                    lastEmbedTimeMs: runtimeInfo.models.embedding.performance.lastInferenceMs,
                    avgEmbedTimeMs: runtimeInfo.models.embedding.performance.avgInferenceMs,
                    embedHistory: [], // Could be populated if needed
                    cpuBaselineMs: 41,
                    speedupX: runtimeInfo.models.embedding.performance.speedupX,
                    inferenceCount: runtimeInfo.models.embedding.performance.inferenceCount
                }
                : {
                    ready: false,
                    provider: 'cpu',
                    lastEmbedTimeMs: 0,
                    avgEmbedTimeMs: 0,
                    embedHistory: [],
                    cpuBaselineMs: 41,
                    speedupX: null
                };

            const llmStats = runtimeInfo.models.llm.ready
                ? {
                    ready: true,
                    modelId: runtimeInfo.models.llm.name,
                    inferenceCount: runtimeInfo.models.llm.performance.inferenceCount,
                    lastStats: {
                        loadTime: runtimeInfo.models.llm.performance.loadTimeMs,
                        ttft: runtimeInfo.models.llm.performance.ttftMs,
                        tokensPerSec: runtimeInfo.models.llm.performance.tokensPerSec,
                        totalTime: 0
                    }
                }
                : { ready: false };

            // Return enhanced format with runtime info
            return {
                embedder: embedderStats,
                llm: llmStats,
                runtime: runtimeInfo // Full runtime metadata for advanced UI
            };
        } catch (error) {
            console.error('[Cortex] Error getting perf stats:', error);
            return {
                embedder: { ready: false, provider: 'cpu', lastEmbedTimeMs: 0, avgEmbedTimeMs: 0, embedHistory: [], cpuBaselineMs: 41, speedupX: null },
                llm: { ready: false },
                runtime: null
            };
        }
    });

    // Share to network — broadcast to real discovered peers
    ipcMain.handle('share-to-network', async (event, docId) => {
        try {
            // Small delay for UX feedback
            await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));
            
            const mesh = getMeshManager();
            if (!mesh || !mesh.isRunning()) {
                return { success: false, error: 'Mesh network not running', peersReached: 0 };
            }
            
            const peers = mesh.getPeers().filter(p => p.status === 'online');
            
            // In future phases, this would actually broadcast the document
            // For now, just report how many peers could receive it
            return { success: true, peersReached: peers.length };
        } catch (error) {
            console.error('[Cortex] Share to network error:', error);
            return { success: false, error: error.message, peersReached: 0 };
        }
    });

    // Get real discovered peers via libp2p mesh
    ipcMain.handle('get-peers', async () => {
        try {
            const mesh = getMeshManager();
            
            if (!mesh || !mesh.isRunning()) {
                // Mesh not started yet - return empty (UI will show scanning)
                return { peers: [] };
            }
            
            const realPeers = mesh.getPeers();
            
            // Return real peers from libp2p mesh network
            return { peers: realPeers };
        } catch (error) {
            console.error('[Cortex] Error getting peers:', error);
            return { peers: [] };
        }
    });

    // Get peer documents (metadata only)
    ipcMain.handle('get-peer-documents', async (event, peerId) => {
        try {
            const mesh = getMeshManager();
            if (!mesh) {
                return { documents: [] };
            }
            
            const documents = peerId 
                ? mesh.getPeerDocuments(peerId)
                : mesh.getAllPeerDocuments();
            
            return { documents };
        } catch (error) {
            console.error('[Cortex] Error getting peer documents:', error);
            return { documents: [] };
        }
    });

    // Request document from peer (stub - not implemented)
    ipcMain.handle('request-peer-document', async (event, peerId, docId) => {
        try {
            const mesh = getMeshManager();
            if (!mesh) {
                return { error: 'Mesh network not available' };
            }
            
            // This will throw "Not Implemented"
            await mesh.requestDocument(peerId, docId);
            
            return { success: true };
        } catch (error) {
            console.log('[Cortex] Document request (expected to fail):', error.message);
            return { 
                error: error.message,
                notImplemented: true 
            };
        }
    });

    // Get mesh network status
    ipcMain.handle('get-mesh-status', async () => {
        try {
            const mesh = getMeshManager();
            if (!mesh) {
                return { running: false };
            }
            
            return mesh.getStatus();
        } catch (error) {
            console.error('[Cortex] Error getting mesh status:', error);
            return { running: false, error: error.message };
        }
    });

    // ── Notes & Deadlines ─────────────────────────────────────────────────

    ipcMain.handle('add-note', async (event, note) => {
        try {
            const db = getDatabase();
            if (!db) return { error: 'Database not initialized' };
            const id = db.addNote(note.title, note.content || '', note.type || 'note', note.dueDate || null);
            return { success: true, id };
        } catch (error) {
            return { error: error.message };
        }
    });

    ipcMain.handle('get-notes', async () => {
        try {
            const db = getDatabase();
            if (!db) return { notes: [] };
            return { notes: db.getNotes() };
        } catch (error) {
            return { notes: [] };
        }
    });

    ipcMain.handle('delete-note', async (event, id) => {
        try {
            const db = getDatabase();
            if (db) db.deleteNote(id);
            return { success: true };
        } catch (error) {
            return { error: error.message };
        }
    });

    ipcMain.handle('toggle-note-complete', async (event, id) => {
        try {
            const db = getDatabase();
            if (db) db.toggleNoteComplete(id);
            return { success: true };
        } catch (error) {
            return { error: error.message };
        }
    });

    // ── Chat — Projects ────────────────────────────────────────────────────

    ipcMain.handle('create-project', async (event, name) => {
        try {
            const db = getDatabase();
            if (!db) return { error: 'Database not ready' };
            const id = db.createProject(name);
            return { success: true, id };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('get-projects', async () => {
        try {
            const db = getDatabase();
            return { projects: db ? db.getProjects() : [] };
        } catch (e) { return { projects: [] }; }
    });

    ipcMain.handle('delete-project', async (event, id) => {
        try {
            const db = getDatabase();
            if (db) db.deleteProject(id);
            return { success: true };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('rename-project', async (event, id, name) => {
        try {
            const db = getDatabase();
            if (db) db.renameProject(id, name);
            return { success: true };
        } catch (e) { return { error: e.message }; }
    });

    // ── Chat — Chats ───────────────────────────────────────────────────────

    ipcMain.handle('create-chat', async (event, projectId) => {
        try {
            const db = getDatabase();
            if (!db) return { error: 'Database not ready' };
            const chat = db.createChat(projectId ?? null);
            return { success: true, chat };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('get-chats', async (event, projectId) => {
        try {
            const db = getDatabase();
            return { chats: db ? db.getChats(projectId) : [] };
        } catch (e) { return { chats: [] }; }
    });

    ipcMain.handle('delete-chat', async (event, id) => {
        try {
            const db = getDatabase();
            if (db) db.deleteChat(id);
            return { success: true };
        } catch (e) { return { error: e.message }; }
    });

    ipcMain.handle('search-chats', async (event, query) => {
        try {
            const db = getDatabase();
            return { chats: db ? db.searchChats(query) : [] };
        } catch (e) { return { chats: [] }; }
    });

    // ── Chat — Messages ────────────────────────────────────────────────────

    ipcMain.handle('get-chat-messages', async (event, chatId) => {
        try {
            const db = getDatabase();
            return { messages: db ? db.getChatMessages(chatId) : [] };
        } catch (e) { return { messages: [] }; }
    });

    ipcMain.handle('add-chat-message', async (event, chatId, role, content) => {
        try {
            const db = getDatabase();
            if (!db) return { error: 'Database not ready' };
            const id = db.addChatMessage(chatId, role, content);
            return { success: true, id };
        } catch (e) { return { error: e.message }; }
    });
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────

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

app.on('before-quit', async () => {
    // Cleanup mesh networking
    if (meshManager) {
        console.log('[Cortex] Stopping mesh network...');
        try {
            await meshManager.stop();
        } catch (error) {
            console.error('[Cortex] Error stopping mesh network:', error);
        }
    }
});

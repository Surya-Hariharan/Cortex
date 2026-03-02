const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── Service imports (same as main.js) ─────────────────────────────────────────
const { initializeDatabase, getDatabase, getStorageManager } = require('./services/database');
const { aiManager } = require('./services/ai/runtime/aiManager');
const { searchVectors } = require('./services/vectorSearch');
const { extractPdfText } = require('./services/pdfHandler');
const { ragSearch } = require('./services/ragPipeline');
const { createMeshManager, getMeshManager } = require('./services/mesh/meshManager');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Multer for PDF upload
const upload = multer({ dest: path.join(__dirname, '../data/uploads/') });

let meshManager;

// ── Initialize Services ───────────────────────────────────────────────────────
async function initializeServices() {
    try {
        await aiManager.initialize();
        console.log('[Cortex] ✓ AI engines initialized');

        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        const uploadsDir = path.join(dataDir, 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const dbPath = path.join(dataDir, 'cortex.db');
        await initializeDatabase(dbPath);
        console.log('[Cortex] ✓ Storage architecture initialized');

        const storageManager = getStorageManager();
        if (storageManager.isReady()) {
            const stats = await storageManager.getStats();
            console.log(`[Cortex]   → ${stats.documents} documents, ${stats.chunks} chunks, ${stats.vectors} vectors`);
        }

        // Start mesh networking
        meshManager = createMeshManager(getDatabase());
        meshManager.onPeersChanged = (peers) => {
            // In web mode, peers are fetched via polling from the client
        };
        await meshManager.start();
        console.log('[Cortex] ✓ Mesh networking started (libp2p)');
    } catch (error) {
        console.error('[Cortex] Service initialization error:', error);
        console.log('[Cortex] App will run with limited functionality.');
    }
}

// ── API Routes ────────────────────────────────────────────────────────────────

// Search (with SSE token streaming)
app.post('/api/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        if (!aiManager.embedder.isReady()) {
            return res.json({ error: 'Embeddings engine not initialized.' });
        }

        // Check if client wants SSE streaming
        if (req.headers.accept === 'text/event-stream') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });

            const onToken = (text) => {
                res.write(`data: ${JSON.stringify({ type: 'token', text })}\n\n`);
            };

            const results = await ragSearch(query, getDatabase(), onToken);
            res.write(`data: ${JSON.stringify({ type: 'results', results })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            const results = await ragSearch(query, getDatabase());
            res.json({ results });
        }
    } catch (error) {
        console.error('[Cortex] Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload PDF
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file provided' });
        }

        const filePath = req.file.path;
        const title = req.file.originalname.replace(/\.pdf$/i, '');

        const storageManager = getStorageManager();
        if (!storageManager || !storageManager.isReady()) {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            return res.json({ error: 'Storage not initialized' });
        }

        const indexResult = await storageManager.indexDocument(filePath, title);

        // Clean up uploaded file after indexing
        try { fs.unlinkSync(filePath); } catch { }

        if (!indexResult.success) {
            if (indexResult.skipped) {
                return res.json({
                    success: true,
                    skipped: true,
                    title,
                    message: indexResult.reason,
                });
            }
            return res.json({ error: indexResult.error });
        }

        res.json({
            success: true,
            title,
            chunks: indexResult.chunkCount,
            docId: indexResult.docId,
            embeddingVersion: indexResult.embeddingVersion,
            timeMs: indexResult.timeMs,
        });
    } catch (error) {
        console.error('[Cortex] PDF upload error:', error);
        // Clean up uploaded file on error
        if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch { }
        res.status(500).json({ error: error.message });
    }
});

// Get stats
app.get('/api/stats', async (req, res) => {
    try {
        const storageManager = getStorageManager();
        if (storageManager && storageManager.isReady()) {
            const stats = await storageManager.getStats();
            return res.json({
                documents: stats.documents,
                embeddings: stats.vectors,
                chunks: stats.chunks,
                embeddingVersion: stats.embeddingVersion,
                needsMigration: stats.needsMigration,
            });
        }
        const db = getDatabase();
        if (!db) return res.json({ documents: 0, embeddings: 0, chunks: 0 });
        const stats = await db.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[Cortex] Error getting stats:', error);
        res.json({ documents: 0, embeddings: 0, chunks: 0 });
    }
});

// Performance stats
app.get('/api/perf-stats', async (req, res) => {
    try {
        const runtimeInfo = aiManager.getRuntimeInfo();

        const embedderStats = runtimeInfo.models.embedding.ready
            ? {
                ready: true,
                modelName: runtimeInfo.models.embedding.name,
                provider: runtimeInfo.models.embedding.provider,
                lastEmbedTimeMs: runtimeInfo.models.embedding.performance.lastInferenceMs,
                avgEmbedTimeMs: runtimeInfo.models.embedding.performance.avgInferenceMs,
                embedHistory: [],
                cpuBaselineMs: 41,
                speedupX: runtimeInfo.models.embedding.performance.speedupX,
                inferenceCount: runtimeInfo.models.embedding.performance.inferenceCount,
            }
            : {
                ready: false,
                provider: 'cpu',
                lastEmbedTimeMs: 0,
                avgEmbedTimeMs: 0,
                embedHistory: [],
                cpuBaselineMs: 41,
                speedupX: null,
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
                    totalTime: 0,
                },
            }
            : { ready: false };

        res.json({
            embedder: embedderStats,
            llm: llmStats,
            runtime: runtimeInfo,
        });
    } catch (error) {
        console.error('[Cortex] Error getting perf stats:', error);
        res.json({
            embedder: { ready: false, provider: 'cpu', lastEmbedTimeMs: 0, avgEmbedTimeMs: 0, embedHistory: [], cpuBaselineMs: 41, speedupX: null },
            llm: { ready: false },
            runtime: null,
        });
    }
});

// ── Network Routes ────────────────────────────────────────────────────────────

app.post('/api/network/share', async (req, res) => {
    try {
        const { docId } = req.body;
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

        const mesh = getMeshManager();
        if (!mesh || !mesh.isRunning()) {
            return res.json({ success: false, error: 'Mesh network not running', peersReached: 0 });
        }

        const peers = mesh.getPeers().filter((p) => p.status === 'online');
        res.json({ success: true, peersReached: peers.length });
    } catch (error) {
        console.error('[Cortex] Share to network error:', error);
        res.json({ success: false, error: error.message, peersReached: 0 });
    }
});

app.get('/api/network/peers', async (req, res) => {
    try {
        const mesh = getMeshManager();
        if (!mesh || !mesh.isRunning()) return res.json({ peers: [] });
        res.json({ peers: mesh.getPeers() });
    } catch (error) {
        console.error('[Cortex] Error getting peers:', error);
        res.json({ peers: [] });
    }
});

app.get('/api/network/peer-documents/:peerId', async (req, res) => {
    try {
        const mesh = getMeshManager();
        if (!mesh) return res.json({ documents: [] });
        const documents = req.params.peerId
            ? mesh.getPeerDocuments(req.params.peerId)
            : mesh.getAllPeerDocuments();
        res.json({ documents });
    } catch (error) {
        console.error('[Cortex] Error getting peer documents:', error);
        res.json({ documents: [] });
    }
});

app.post('/api/network/request-document', async (req, res) => {
    try {
        const { peerId, docId } = req.body;
        const mesh = getMeshManager();
        if (!mesh) return res.json({ error: 'Mesh network not available' });
        await mesh.requestDocument(peerId, docId);
        res.json({ success: true });
    } catch (error) {
        res.json({ error: error.message, notImplemented: true });
    }
});

app.get('/api/network/mesh-status', async (req, res) => {
    try {
        const mesh = getMeshManager();
        if (!mesh) return res.json({ running: false });
        res.json(mesh.getStatus());
    } catch (error) {
        console.error('[Cortex] Error getting mesh status:', error);
        res.json({ running: false, error: error.message });
    }
});

// ── Notes Routes ──────────────────────────────────────────────────────────────

app.post('/api/notes', async (req, res) => {
    try {
        const db = getDatabase();
        if (!db) return res.json({ error: 'Database not initialized' });
        const { title, content, type, dueDate } = req.body;
        const id = db.addNote(title, content || '', type || 'note', dueDate || null);
        res.json({ success: true, id });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.get('/api/notes', async (req, res) => {
    try {
        const db = getDatabase();
        if (!db) return res.json({ notes: [] });
        res.json({ notes: db.getNotes() });
    } catch (error) {
        res.json({ notes: [] });
    }
});

app.delete('/api/notes/:id', async (req, res) => {
    try {
        const db = getDatabase();
        if (db) db.deleteNote(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.patch('/api/notes/:id/toggle', async (req, res) => {
    try {
        const db = getDatabase();
        if (db) db.toggleNoteComplete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// ── Project Routes ────────────────────────────────────────────────────────────

app.post('/api/projects', async (req, res) => {
    try {
        const db = getDatabase();
        if (!db) return res.json({ error: 'Database not ready' });
        const id = db.createProject(req.body.name);
        res.json({ success: true, id });
    } catch (e) { res.json({ error: e.message }); }
});

app.get('/api/projects', async (req, res) => {
    try {
        const db = getDatabase();
        res.json({ projects: db ? db.getProjects() : [] });
    } catch (e) { res.json({ projects: [] }); }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const db = getDatabase();
        if (db) db.deleteProject(req.params.id);
        res.json({ success: true });
    } catch (e) { res.json({ error: e.message }); }
});

app.patch('/api/projects/:id', async (req, res) => {
    try {
        const db = getDatabase();
        if (db) db.renameProject(req.params.id, req.body.name);
        res.json({ success: true });
    } catch (e) { res.json({ error: e.message }); }
});

// ── Chat Routes ───────────────────────────────────────────────────────────────

app.post('/api/chats', async (req, res) => {
    try {
        const db = getDatabase();
        if (!db) return res.json({ error: 'Database not ready' });
        const chat = db.createChat(req.body.projectId ?? null);
        res.json({ success: true, chat });
    } catch (e) { res.json({ error: e.message }); }
});

app.get('/api/chats', async (req, res) => {
    try {
        const db = getDatabase();
        const projectId = req.query.projectId || undefined;
        res.json({ chats: db ? db.getChats(projectId) : [] });
    } catch (e) { res.json({ chats: [] }); }
});

app.delete('/api/chats/:id', async (req, res) => {
    try {
        const db = getDatabase();
        if (db) db.deleteChat(req.params.id);
        res.json({ success: true });
    } catch (e) { res.json({ error: e.message }); }
});

app.get('/api/chats/search', async (req, res) => {
    try {
        const db = getDatabase();
        const query = req.query.q || '';
        res.json({ chats: db ? db.searchChats(query) : [] });
    } catch (e) { res.json({ chats: [] }); }
});

app.get('/api/chats/:chatId/messages', async (req, res) => {
    try {
        const db = getDatabase();
        res.json({ messages: db ? db.getChatMessages(req.params.chatId) : [] });
    } catch (e) { res.json({ messages: [] }); }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
    try {
        const db = getDatabase();
        if (!db) return res.json({ error: 'Database not ready' });
        const { role, content } = req.body;
        const id = db.addChatMessage(req.params.chatId, role, content);
        res.json({ success: true, id });
    } catch (e) { res.json({ error: e.message }); }
});

// ── Start Server ──────────────────────────────────────────────────────────────

async function start() {
    await initializeServices();
    app.listen(PORT, () => {
        console.log(`[Cortex] ✓ API server running on http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error('[Cortex] Fatal error starting server:', err);
    process.exit(1);
});

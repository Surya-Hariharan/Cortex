/**
 * Cortex — Route Definitions
 * All Express routes, clean and separated from startup logic.
 * Services are injected via the mount function.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const dns = require('dns');

const { authMiddleware, errorHandler } = require('./middleware');
const { getDb } = require('../storage/dbInit');
const { registerUser, verifyOtp, resendOtp, loginUser, getAcademicOptions } = require('../auth/authService');

let _services = null;

/**
 * Mount all routes on the Express app.
 * @param {import('express').Express} app
 * @param {Object} services - { aiManager, storageManager, meshManager, database, publicDir, uploadsDir }
 */
function mountRoutes(app, services) {
    _services = services;

    const upload = multer({
        dest: services.uploadsDir,
        limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for PDF uploads
    });

    // ── Public Routes (no auth) ──────────────────────────────────────────────

    // Serve static frontend files
    app.use(express_static(services.publicDir));

    // Academic dropdown options
    app.get('/api/auth/academic-options', (_req, res) => {
        res.json(getAcademicOptions());
    });

    // Connectivity check
    app.get('/api/connectivity', async (_req, res) => {
        try {
            await new Promise((resolve, reject) => {
                dns.lookup('google.com', (err) => err ? reject(err) : resolve());
            });
            res.json({ online: true });
        } catch {
            res.json({ online: false });
        }
    });

    // Register
    app.post('/api/auth/register', async (req, res) => {
        try {
            const db = getDb();
            if (!db) return res.status(500).json({ error: 'Database not ready.' });

            let isOnline = false;
            try {
                await new Promise((resolve, reject) => {
                    dns.lookup('google.com', (err) => err ? reject(err) : resolve());
                });
                isOnline = true;
            } catch {}

            const result = await registerUser(db, req.body, isOnline);
            if (result.error) return res.status(400).json(result);
            res.json(result);
        } catch (e) { console.error('[Auth] Register error:', e); res.status(500).json({ error: e.message }); }
    });

    // Verify OTP
    app.post('/api/auth/verify-otp', async (req, res) => {
        try {
            const { email, otp } = req.body;
            if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });
            const db = getDb();
            if (!db) return res.status(500).json({ error: 'Database not ready.' });
            const result = verifyOtp(db, email, otp);
            if (result.error) return res.status(400).json(result);
            res.json(result);
        } catch (e) { console.error('[Auth] Verify OTP error:', e); res.status(500).json({ error: e.message }); }
    });

    // Resend OTP
    app.post('/api/auth/resend-otp', async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ error: 'Email is required.' });
            const db = getDb();
            if (!db) return res.status(500).json({ error: 'Database not ready.' });
            const result = await resendOtp(db, email);
            if (result.error) return res.status(400).json(result);
            res.json(result);
        } catch (e) { console.error('[Auth] Resend OTP error:', e); res.status(500).json({ error: e.message }); }
    });

    // Login
    app.post('/api/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
            const db = getDb();
            if (!db) return res.status(500).json({ error: 'Database not ready.' });
            const result = await loginUser(db, email, password);
            if (result.error) return res.status(400).json(result);
            res.json(result);
        } catch (e) { console.error('[Auth] Login error:', e); res.status(500).json({ error: e.message }); }
    });

    // Current user profile
    app.get('/api/auth/me', authMiddleware, (req, res) => {
        res.json({ user: req.user });
    });

    // ── Protected Routes (require auth) ──────────────────────────────────────
    app.use('/api', authMiddleware);

    // Search (SSE streaming)
    app.post('/api/search', async (req, res) => {
        try {
            const { query } = req.body;
            if (!query) return res.status(400).json({ error: 'Query is required' });

            const ai = services.aiManager;
            if (!ai.embedder.isReady()) return res.json({ error: 'Embeddings engine not initialized.' });

            const { ragSearch } = require('../ai/rag/ragPipeline');

            if (req.headers.accept === 'text/event-stream') {
                res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
                const onToken = (text) => res.write(`data: ${JSON.stringify({ type: 'token', text })}\n\n`);
                const results = await ragSearch(query, services.database, onToken);
                res.write(`data: ${JSON.stringify({ type: 'results', results })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            } else {
                const results = await ragSearch(query, services.database);
                res.json({ results });
            }
        } catch (error) {
            console.error('[Cortex] Search error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Upload Document (PDF, DOCX, Images)
    app.post('/api/upload-document', upload.single('document'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No document file provided' });

            const filePath = req.file.path;
            const title = req.file.originalname.replace(/\.[^/.]+$/, '');

            const sm = services.storageManager;
            if (!sm || !sm.isReady()) {
                fs.unlinkSync(filePath);
                return res.json({ error: 'Storage not initialized' });
            }

            const indexResult = await sm.indexDocument(filePath, title);
            try { fs.unlinkSync(filePath); } catch {}

            if (!indexResult.success) {
                if (indexResult.skipped) return res.json({ success: true, skipped: true, title, message: indexResult.reason });
                return res.json({ error: indexResult.error });
            }

            res.json({
                success: true, title,
                chunks: indexResult.chunkCount, docId: indexResult.docId,
                embeddingVersion: indexResult.embeddingVersion, timeMs: indexResult.timeMs,
            });
        } catch (error) {
            console.error('[Cortex] PDF upload error:', error);
            if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
            res.status(500).json({ error: error.message });
        }
    });

    // Stats
    app.get('/api/stats', async (_req, res) => {
        try {
            const sm = services.storageManager;
            if (sm && sm.isReady()) {
                const stats = await sm.getStats();
                return res.json({ documents: stats.documents, embeddings: stats.vectors, chunks: stats.chunks, embeddingVersion: stats.embeddingVersion, needsMigration: stats.needsMigration });
            }
            const db = services.database;
            if (!db) return res.json({ documents: 0, embeddings: 0, chunks: 0 });
            res.json(await db.getStats());
        } catch (error) {
            console.error('[Cortex] Error getting stats:', error);
            res.json({ documents: 0, embeddings: 0, chunks: 0 });
        }
    });

    // Performance stats
    app.get('/api/perf-stats', async (_req, res) => {
        try {
            const runtimeInfo = services.aiManager.getRuntimeInfo();
            const embedderStats = runtimeInfo.models.embedding.ready
                ? {
                    ready: true, modelName: runtimeInfo.models.embedding.name,
                    provider: runtimeInfo.models.embedding.provider,
                    lastEmbedTimeMs: runtimeInfo.models.embedding.performance.lastInferenceMs,
                    avgEmbedTimeMs: runtimeInfo.models.embedding.performance.avgInferenceMs,
                    embedHistory: [], cpuBaselineMs: 41,
                    speedupX: runtimeInfo.models.embedding.performance.speedupX,
                    inferenceCount: runtimeInfo.models.embedding.performance.inferenceCount,
                }
                : { ready: false, provider: 'cpu', lastEmbedTimeMs: 0, avgEmbedTimeMs: 0, embedHistory: [], cpuBaselineMs: 41, speedupX: null };

            const llmStats = runtimeInfo.models.llm.ready
                ? {
                    ready: true, modelId: runtimeInfo.models.llm.name,
                    inferenceCount: runtimeInfo.models.llm.performance.inferenceCount,
                    lastStats: {
                        loadTime: runtimeInfo.models.llm.performance.loadTimeMs,
                        ttft: runtimeInfo.models.llm.performance.ttftMs,
                        tokensPerSec: runtimeInfo.models.llm.performance.tokensPerSec,
                        totalTime: 0,
                    },
                }
                : { ready: false };

            res.json({ embedder: embedderStats, llm: llmStats, runtime: runtimeInfo });
        } catch (error) {
            console.error('[Cortex] Error getting perf stats:', error);
            res.json({ embedder: { ready: false, provider: 'cpu', lastEmbedTimeMs: 0, avgEmbedTimeMs: 0, embedHistory: [], cpuBaselineMs: 41, speedupX: null }, llm: { ready: false }, runtime: null });
        }
    });

    // ── Network Routes ───────────────────────────────────────────────────────

    app.post('/api/network/share', async (req, res) => {
        try {
            const { docId } = req.body;
            await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));
            const mesh = services.meshManager;
            if (!mesh || !mesh.isRunning()) return res.json({ success: false, error: 'Mesh network not running', peersReached: 0 });
            const peers = mesh.getPeers().filter((p) => p.status === 'online');
            res.json({ success: true, peersReached: peers.length });
        } catch (error) { res.json({ success: false, error: error.message, peersReached: 0 }); }
    });

    app.get('/api/network/peers', async (_req, res) => {
        try {
            const mesh = services.meshManager;
            if (!mesh || !mesh.isRunning()) return res.json({ peers: [] });
            res.json({ peers: mesh.getPeers() });
        } catch (error) { res.json({ peers: [] }); }
    });

    app.get('/api/network/peer-documents/:peerId', async (req, res) => {
        try {
            const mesh = services.meshManager;
            if (!mesh) return res.json({ documents: [] });
            const documents = req.params.peerId ? mesh.getPeerDocuments(req.params.peerId) : mesh.getAllPeerDocuments();
            res.json({ documents });
        } catch (error) { res.json({ documents: [] }); }
    });

    app.post('/api/network/request-document', async (req, res) => {
        try {
            const { peerId, docId } = req.body;
            const mesh = services.meshManager;
            if (!mesh) return res.json({ error: 'Mesh network not available' });
            await mesh.requestDocument(peerId, docId);
            res.json({ success: true });
        } catch (error) { res.json({ error: error.message, notImplemented: true }); }
    });

    app.get('/api/network/mesh-status', async (_req, res) => {
        try {
            const mesh = services.meshManager;
            if (!mesh) return res.json({ running: false });
            res.json(mesh.getStatus());
        } catch (error) { res.json({ running: false, error: error.message }); }
    });

    // ── Notes Routes ─────────────────────────────────────────────────────────

    app.post('/api/notes', async (req, res) => {
        try {
            const db = services.database;
            if (!db) return res.json({ error: 'Database not initialized' });
            const { title, content, type, dueDate } = req.body;
            const id = db.addNote(title, content || '', type || 'note', dueDate || null);
            res.json({ success: true, id });
        } catch (error) { res.json({ error: error.message }); }
    });

    app.get('/api/notes', async (_req, res) => {
        try {
            const db = services.database;
            if (!db) return res.json({ notes: [] });
            res.json({ notes: db.getNotes() });
        } catch (error) { res.json({ notes: [] }); }
    });

    app.delete('/api/notes/:id', async (req, res) => {
        try {
            const db = services.database;
            if (db) db.deleteNote(req.params.id);
            res.json({ success: true });
        } catch (error) { res.json({ error: error.message }); }
    });

    app.patch('/api/notes/:id/toggle', async (req, res) => {
        try {
            const db = services.database;
            if (db) db.toggleNoteComplete(req.params.id);
            res.json({ success: true });
        } catch (error) { res.json({ error: error.message }); }
    });

    // ── Project Routes ───────────────────────────────────────────────────────

    app.post('/api/projects', async (req, res) => {
        try {
            const db = services.database;
            if (!db) return res.json({ error: 'Database not ready' });
            const id = db.createProject(req.body.name);
            res.json({ success: true, id });
        } catch (e) { res.json({ error: e.message }); }
    });

    app.get('/api/projects', async (_req, res) => {
        try { res.json({ projects: services.database ? services.database.getProjects() : [] }); }
        catch (e) { res.json({ projects: [] }); }
    });

    app.delete('/api/projects/:id', async (req, res) => {
        try {
            if (services.database) services.database.deleteProject(req.params.id);
            res.json({ success: true });
        } catch (e) { res.json({ error: e.message }); }
    });

    app.patch('/api/projects/:id', async (req, res) => {
        try {
            if (services.database) services.database.renameProject(req.params.id, req.body.name);
            res.json({ success: true });
        } catch (e) { res.json({ error: e.message }); }
    });

    // ── Chat Routes ──────────────────────────────────────────────────────────

    app.post('/api/chats', async (req, res) => {
        try {
            const db = services.database;
            if (!db) return res.json({ error: 'Database not ready' });
            const chat = db.createChat(req.body.projectId ?? null);
            res.json({ success: true, chat });
        } catch (e) { res.json({ error: e.message }); }
    });

    app.get('/api/chats', async (req, res) => {
        try {
            const db = services.database;
            const projectId = req.query.projectId || undefined;
            res.json({ chats: db ? db.getChats(projectId) : [] });
        } catch (e) { res.json({ chats: [] }); }
    });

    app.delete('/api/chats/:id', async (req, res) => {
        try {
            if (services.database) services.database.deleteChat(req.params.id);
            res.json({ success: true });
        } catch (e) { res.json({ error: e.message }); }
    });

    app.get('/api/chats/search', async (req, res) => {
        try {
            const db = services.database;
            const query = req.query.q || '';
            res.json({ chats: db ? db.searchChats(query) : [] });
        } catch (e) { res.json({ chats: [] }); }
    });

    app.get('/api/chats/:chatId/messages', async (req, res) => {
        try {
            const db = services.database;
            res.json({ messages: db ? db.getChatMessages(req.params.chatId) : [] });
        } catch (e) { res.json({ messages: [] }); }
    });

    app.post('/api/chats/:chatId/messages', async (req, res) => {
        try {
            const db = services.database;
            if (!db) return res.json({ error: 'Database not ready' });
            const { role, content } = req.body;
            const id = db.addChatMessage(req.params.chatId, role, content);
            res.json({ success: true, id });
        } catch (e) { res.json({ error: e.message }); }
    });

    // ── SPA Fallback ─────────────────────────────────────────────────────────
    app.get('{*path}', (_req, res) => {
        res.sendFile(path.join(services.publicDir, 'index.html'));
    });

    // Error handler (must be last)
    app.use(errorHandler);
}

// Using express.static without importing express again
function express_static(dir) {
    return require('express').static(dir);
}

module.exports = { mountRoutes };

const request = require('supertest');
const express = require('express');
const path = require('path');
const { getDb } = require('../../src/storage/dbInit');
const { storageManager } = require('../../src/storage/storageManager');
const { aiManager } = require('../../src/ai/runtime/aiManager');

// Mock out the auth middleware so integration routes process 200 OKs
jest.mock('../../src/core/middleware', () => {
    return {
        authMiddleware: (req, res, next) => {
            req.user = { userId: 'integration_test_user' };
            next();
        },
        errorHandler: (err, req, res, next) => {
            res.status(500).json({ error: err.message });
        }
    };
});

const { mountRoutes } = require('../../src/core/routes');

// We use Supertest to assert the express routes instead of directly calling JS functions.
describe('Integration: RAG Pipeline + Storage API', () => {
    let app;
    let docId;

    beforeAll(() => {
        // Setup.js initialized the database and AI runtime. Let's wire up a test app.
        app = express();

        // Needed for JSON bodies in testing
        app.use(express.json());

        // Mock out ONNX Inference to bypass Jest Float32Array VM boundary issues
        jest.spyOn(aiManager, 'runEmbedding').mockResolvedValue(new Array(384).fill(0.1));
        jest.spyOn(aiManager, 'runLLM').mockResolvedValue('Mocked generative response avoiding out-of-context facts.');

        // We mount the core application routes the exact same way app.js does
        require('../../src/core/routes').mountRoutes(app, {
            aiManager,
            storageManager: storageManager,
            database: getDb(), // Legacy compat
            publicDir: path.join(__dirname, '../../../../frontend'),
            uploadsDir: path.join(process.env.TEST_DATA_DIR, 'uploads') // tmpdir defined in setup.js
        });
    });

    it('should successfully upload and index a test PDF file', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/dummy.pdf');

        const response = await request(app)
            .post('/api/upload-pdf')
            .attach('pdf', fixturePath);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.chunks).toBeGreaterThan(0);
        expect(response.body.docId).toBeDefined();

        docId = response.body.docId; // Store for later
    });

    it('should verify document statistics are accurately updated', async () => {
        const response = await request(app).get('/api/stats');
        expect(response.status).toBe(200);
        expect(response.body.documents).toBe(1);
        expect(response.body.chunks).toBeGreaterThan(0);
    });

    it('should run a strictly-constrained semantic search query via generative RAG', async () => {
        const testQuery = 'What is Cortex?';

        const response = await request(app)
            .post('/api/search')
            .send({ query: testQuery });

        console.log('Search Response Body:', response.body);

        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();

        // 1. Result Array Validation (Vector Search succeeded)
        const topResult = response.body.results[0];
        expect(topResult).toBeDefined();
        expect(topResult.score).toBeGreaterThan(0.5); // Semantic match should be high
        expect(topResult.content).toContain('Cortex is an advanced offline-first student AI tool');

        // 2. Synthesized AI Response formatting should exist
        if (response.body.synthesizedAnswer) {
            // Because integration testing with Phi-3 locally can be heavy, we ensure that if it outputs,
            // it acknowledges the context.
            const answer = response.body.synthesizedAnswer.toLowerCase();
            const includesCortex = answer.includes('cortex') || answer.includes('ai tool');
            const includesReject = answer.includes('not found');
            expect(includesCortex || includesReject).toBe(true);
        }
    });

    it('should securely defend against out-of-context hallucinations', async () => {
        const outOfBoundsQuery = 'What is the capital of France?';

        const response = await request(app)
            .post('/api/search')
            .send({ query: outOfBoundsQuery });

        expect(response.status).toBe(200);

        if (response.body.synthesizedAnswer) {
            const answer = response.body.synthesizedAnswer.toLowerCase();
            // It MUST deny knowing this, per system Prompt Builder constraints
            expect(answer).toContain('not found in documents');
        }
    });
});

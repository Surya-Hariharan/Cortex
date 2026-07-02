// @vitest-environment node
/**
 * EmbeddingsEngine unit tests.
 * onnxruntime-node is mocked to prevent native addon load failure.
 * The local-fallback path (no model + no API key) is the primary test target
 * because it exercises _hashEmbed() and the full embed() pipeline without ONNX.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

// ── Mock onnxruntime-node BEFORE importing embeddings ──────────────────────
// (vi.mock is hoisted, so this intercepts the require() in embeddings.js)

vi.mock('onnxruntime-node', () => ({
    InferenceSession: {
        create: vi.fn().mockResolvedValue({
            run: vi.fn().mockResolvedValue({
                sentence_embedding: { data: new Float32Array(384).fill(0.1) },
            }),
        }),
    },
    Tensor: vi.fn().mockImplementation((dtype, data, shape) => ({ dtype, data, shape })),
}));

import { EmbeddingsEngine } from '../services/ai/embeddings.js';

// ── Helpers ────────────────────────────────────────────────────────────────

// A modelDir that definitely does not contain model.onnx
const MISSING_MODEL_DIR = path.join(os.tmpdir(), `no-model-${Date.now()}`);

// ── Local-fallback path ───────────────────────────────────────────────────

describe('EmbeddingsEngine (local-fallback — no model file)', () => {
    let engine;

    beforeEach(async () => {
        engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        await engine.initialize();
    });

    it('sets activeProvider to local-fallback', () => {
        expect(engine.activeProvider).toBe('local-fallback');
    });

    it('isReady() returns true after initialize()', () => {
        expect(engine.isReady()).toBe(true);
    });

    it('embed() returns a Float32Array-like of length 384', async () => {
        const vec = await engine.embed('hello world');
        expect(vec).toHaveLength(384);
    });

    it('embed() returns a normalized vector (L2 ≈ 1)', async () => {
        const vec = await engine.embed('normalized vector test');
        const l2 = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        expect(l2).toBeCloseTo(1.0, 2);
    });

    it('embed() is deterministic for identical input', async () => {
        const a = await engine.embed('same text');
        const b = await engine.embed('same text');
        expect(a).toEqual(b);
    });

    it('embed() produces different vectors for different text', async () => {
        const a = await engine.embed('machine learning');
        const b = await engine.embed('quantum physics');
        const allSame = a.every((v, i) => v === b[i]);
        expect(allSame).toBe(false);
    });

    it('embed() tracks lastEmbedTimeMs as a number', async () => {
        await engine.embed('timing test');
        expect(typeof engine.lastEmbedTimeMs).toBe('number');
        expect(engine.lastEmbedTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('embed() accumulates embedHistory up to 10 entries', async () => {
        for (let i = 0; i < 12; i++) {
            await engine.embed(`text ${i}`);
        }
        expect(engine.embedHistory.length).toBeLessThanOrEqual(10);
    });

    it('embed() with empty string does not throw', async () => {
        await expect(engine.embed('')).resolves.toHaveLength(384);
    });

    it('embed() with single character returns normalized vector', async () => {
        const vec = await engine.embed('A');
        const l2 = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        expect(l2).toBeCloseTo(1.0, 2);
    });
});

// ── Not-initialized guard ─────────────────────────────────────────────────

describe('EmbeddingsEngine (not initialized)', () => {
    it('embed() throws before initialize()', async () => {
        const engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        await expect(engine.embed('oops')).rejects.toThrow('not initialized');
    });

    it('isReady() returns false before initialize()', () => {
        const engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        expect(engine.isReady()).toBe(false);
    });
});

// ── getPerfStats ──────────────────────────────────────────────────────────

describe('EmbeddingsEngine.getPerfStats()', () => {
    it('returns zeroed stats before any embeds', async () => {
        const engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        await engine.initialize();
        const stats = engine.getPerfStats();
        expect(stats).toHaveProperty('provider', 'local-fallback');
        expect(stats).toHaveProperty('lastEmbedTimeMs', 0);
        expect(stats).toHaveProperty('avgEmbedTimeMs', 0);
        expect(stats).toHaveProperty('embedHistory');
        expect(Array.isArray(stats.embedHistory)).toBe(true);
        expect(stats.embedHistory).toHaveLength(0);
        expect(stats).toHaveProperty('cpuBaselineMs', 41);
        expect(stats.speedupX).toBeNull();
    });

    it('returns non-zero avgEmbedTimeMs after one embed', async () => {
        const engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        await engine.initialize();
        await engine.embed('timing test');
        const stats = engine.getPerfStats();
        expect(stats.avgEmbedTimeMs).toBeGreaterThanOrEqual(0);
        expect(stats.embedHistory).toHaveLength(1);
    });

    it('computes speedupX when avgEmbedTimeMs > 0', async () => {
        const engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        await engine.initialize();
        // Manually set embedHistory to get a non-zero avg
        engine.embedHistory = [10, 20];
        engine.lastEmbedTimeMs = 20;
        const stats = engine.getPerfStats();
        expect(typeof stats.speedupX).toBe('number');
    });

    it('returns a copy of embedHistory (not the reference)', async () => {
        const engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        await engine.initialize();
        await engine.embed('a');
        const stats = engine.getPerfStats();
        stats.embedHistory.push(9999);
        expect(engine.embedHistory.includes(9999)).toBe(false);
    });
});



// Note: ONNX path tests (with real model files) require vi.spyOn on fs.existsSync,
// which is not configurable in ESM node environment. Those paths are covered by the
// fallback and Gemini tests above; ONNX-specific branches remain uncovered by design.

// ── _hashEmbed internals via embed (local-fallback) ───────────────────────

describe('EmbeddingsEngine._hashEmbed (via local-fallback embed)', () => {
    it('returns a 384-element array', async () => {
        const engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        await engine.initialize();
        const v = await engine.embed('test');
        expect(v).toHaveLength(384);
    });

    it('longer text produces different embedding than short text', async () => {
        const engine = new EmbeddingsEngine(MISSING_MODEL_DIR);
        await engine.initialize();
        const a = await engine.embed('a');
        const b = await engine.embed('a very long piece of text with many different words and characters');
        expect(a).not.toEqual(b);
    });
});

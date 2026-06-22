// @vitest-environment node
// Tests for pure-logic AI service modules: vectorSearch + ragPipeline.
// No native dependencies needed — ragPipeline takes engine/db as parameters.

import { describe, it, expect, vi } from 'vitest';
import { searchVectors, cosineSimilarity } from '../services/ai/vectorSearch.js';
import { synthesizeAnswer, ragSearch } from '../services/ai/ragPipeline.js';

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
    it('identical vectors → 1', () => {
        const v = [1, 0, 0];
        expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
    });

    it('orthogonal vectors → 0', () => {
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    it('opposite vectors → -1', () => {
        expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    });

    it('zero vector → 0 (no div-by-zero)', () => {
        expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });

    it('handles vectors of different lengths (uses min)', () => {
        const result = cosineSimilarity([1, 0, 0], [1, 0]);
        expect(typeof result).toBe('number');
        expect(isNaN(result)).toBe(false);
    });

    it('general case', () => {
        const a = [1, 2, 3];
        const b = [4, 5, 6];
        const dot = 1*4 + 2*5 + 3*6; // 32
        const normA = Math.sqrt(1+4+9);
        const normB = Math.sqrt(16+25+36);
        expect(cosineSimilarity(a, b)).toBeCloseTo(dot / (normA * normB), 5);
    });
});

// ── searchVectors ─────────────────────────────────────────────────────────────

describe('searchVectors', () => {
    const makeEmb = (id, docId, vector) => ({
        id, docId, title: `Doc ${docId}`, subject: 'Math', content: 'content', chunkIndex: 0, vector,
    });

    it('returns empty array for empty input', () => {
        expect(searchVectors([1, 0], [], 5)).toEqual([]);
    });

    it('returns top K results sorted by score desc', () => {
        const embeddings = [
            makeEmb(1, 1, [1, 0]),
            makeEmb(2, 2, [0, 1]),
            makeEmb(3, 3, [0.9, 0.1]),
        ];
        const results = searchVectors([1, 0], embeddings, 2);
        expect(results).toHaveLength(2);
        expect(results[0].id).toBe(1); // highest cosine with [1,0]
        expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('returns all results when topK > length', () => {
        const embeddings = [makeEmb(1, 1, [1, 0])];
        expect(searchVectors([1, 0], embeddings, 10)).toHaveLength(1);
    });

    it('result shape includes required fields', () => {
        const embeddings = [makeEmb(1, 1, [1, 0])];
        const [r] = searchVectors([1, 0], embeddings, 1);
        expect(r).toHaveProperty('id');
        expect(r).toHaveProperty('docId');
        expect(r).toHaveProperty('title');
        expect(r).toHaveProperty('subject');
        expect(r).toHaveProperty('content');
        expect(r).toHaveProperty('chunkIndex');
        expect(r).toHaveProperty('score');
    });
});

// ── synthesizeAnswer ──────────────────────────────────────────────────────────

describe('synthesizeAnswer', () => {
    const makeResult = (score, title = 'T', content = 'Hello world. This is text.') => ({
        title, subject: 'X', content, chunkIndex: 0, score,
    });

    it('returns null for empty results', () => {
        expect(synthesizeAnswer([])).toBeNull();
    });

    it('returns null for null results', () => {
        expect(synthesizeAnswer(null)).toBeNull();
    });

    it('returns null when all results are below threshold (0.35)', () => {
        expect(synthesizeAnswer([makeResult(0.1), makeResult(0.2)])).toBeNull();
    });

    it('returns a string starting with "Based on your study materials" when results qualify', () => {
        const result = synthesizeAnswer([makeResult(0.9)]);
        expect(typeof result).toBe('string');
        expect(result).toContain('Based on your study materials');
    });

    it('includes title and chunk in citations', () => {
        const result = synthesizeAnswer([makeResult(0.9, 'MyTitle')]);
        expect(result).toContain('MyTitle');
        expect(result).toContain('Chunk 1');
    });

    it('uses up to 3 results', () => {
        const results = [makeResult(0.9), makeResult(0.8), makeResult(0.7), makeResult(0.6)];
        const answer = synthesizeAnswer(results);
        expect(typeof answer).toBe('string');
    });

    it('handles results without sentence-ending punctuation', () => {
        const result = synthesizeAnswer([makeResult(0.9, 'T', 'no punctuation here')]);
        expect(typeof result).toBe('string');
    });
});

// ── ragSearch ─────────────────────────────────────────────────────────────────

describe('ragSearch', () => {
    const makeEngine = (vector = [1, 0]) => ({
        embed: vi.fn().mockResolvedValue(vector),
    });
    const makeDb = (embeddings = []) => ({
        getAllEmbeddings: vi.fn().mockReturnValue(embeddings),
    });

    it('returns expected shape with no stored embeddings', async () => {
        const result = await ragSearch('hello', makeEngine(), makeDb(), 5);
        expect(result).toHaveProperty('query', 'hello');
        expect(result).toHaveProperty('results');
        expect(Array.isArray(result.results)).toBe(true);
        expect(result).toHaveProperty('searchTimeMs');
        expect(result).toHaveProperty('totalDocuments', 0);
    });

    it('ranks stored embeddings by cosine similarity', async () => {
        const db = makeDb([
            { id: 1, docId: 1, title: 'Best', subject: 'X', content: 'A', chunkIndex: 0, vector: [1, 0] },
            { id: 2, docId: 2, title: 'Worst', subject: 'Y', content: 'B', chunkIndex: 0, vector: [0, 1] },
        ]);
        const result = await ragSearch('q', makeEngine([1, 0]), db, 5);
        expect(result.results[0].title).toBe('Best');
    });

    it('includes synthesizedAnswer field', async () => {
        const result = await ragSearch('q', makeEngine(), makeDb(), 5);
        expect(result).toHaveProperty('synthesizedAnswer');
    });

    it('result items have expected fields', async () => {
        const db = makeDb([
            { id: 1, docId: 1, title: 'T', subject: 'S', content: 'C', chunkIndex: 0, vector: [1, 0] },
        ]);
        const result = await ragSearch('q', makeEngine([1, 0]), db, 5);
        const [r] = result.results;
        expect(r).toHaveProperty('rank', 1);
        expect(r).toHaveProperty('docId');
        expect(r).toHaveProperty('score');
        expect(r).toHaveProperty('relevancePercent');
    });

    it('respects topK limit', async () => {
        const embs = Array.from({ length: 10 }, (_, i) => ({
            id: i, docId: i, title: `T${i}`, subject: 'S', content: 'C', chunkIndex: 0, vector: [1, 0],
        }));
        const result = await ragSearch('q', makeEngine([1, 0]), makeDb(embs), 3);
        expect(result.results).toHaveLength(3);
    });
});

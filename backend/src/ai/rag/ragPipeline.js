const { aiManager } = require('./ai/runtime/aiManager');
const { buildPrompt } = require('./ai/rag/promptBuilder');
const { getStorageManager } = require('./database');

/**
 * RAG Pipeline: query → embed → vector search → prompt construction → generative AI
 * 
 * Phase 2D: Uses new storage architecture with LanceDB for scalable vector search
 * 
 * @param {string} query
 * @param {import('./database').DatabaseWrapper} db - Legacy parameter (for compatibility)
 * @param {function} onTokenCallback Streaming callback
 * @param {number} topK
 */
async function ragSearch(query, db, onTokenCallback, topK = 5) {
    const startTime = Date.now();

    // Phase 2D: Use new storage manager for vector search
    const storageManager = getStorageManager();

    if (!storageManager.isReady()) {
        // Fallback to legacy mode if storage not initialized
        console.warn('[RAG] Storage manager not ready, falling back to legacy mode');
        return await ragSearchLegacy(query, db, onTokenCallback, topK);
    }

    try {
        // 1. Embed query via abstraction layer
        const queryVector = await aiManager.runEmbedding(query);

        // 2. Vector search (Phase 2D: LanceDB)
        const results = await storageManager.search(queryVector, topK);
        const searchTimeMs = Date.now() - startTime;

        // 3. Format retrieved facts
        const formattedResults = results.map((r, index) => ({
            rank: index + 1,
            docId: r.doc_id,
            title: r.title,
            subject: 'General', // Legacy compatibility
            content: r.content,
            chunkIndex: r.chunkIndex,
            score: Math.round(r.score * 1000) / 1000,
            relevancePercent: Math.round(r.score * 100),
        }));

        // 4. Construct Prompt & Generate Answer (Generative RAG)
        let aiResponse = null;
        try {
            const prompt = buildPrompt(query, formattedResults);
            aiResponse = await aiManager.runLLM(prompt, onTokenCallback);
        } catch (e) {
            console.error('[RAG] Fallback to retrieval only due to generation error:', e);
            // Graceful fallback to raw retrieval functionality
            aiResponse = { text: "AI generation failed. Displaying retrieved facts below.", stats: {} };
        }

        return {
            query,
            results: formattedResults,
            searchTimeMs,
            totalDocuments: (await storageManager.getStats()).documents,
            synthesizedAnswer: aiResponse.text,
            generationStats: aiResponse.stats,
            storageVersion: 'Phase 2D (LanceDB)', // Marker for debugging
        };
    } catch (error) {
        console.error('[RAG] Search failed, falling back to legacy:', error);
        return await ragSearchLegacy(query, db, onTokenCallback, topK);
    }
}

/**
 * Legacy RAG search (fallback for compatibility)
 */
async function ragSearchLegacy(query, db, onTokenCallback, topK) {
    const { searchVectors } = require('./vectorSearch');
    const startTime = Date.now();

    // 1. Embed query
    const queryVector = await aiManager.runEmbedding(query);

    // 2. Legacy in-memory vector search
    const allEmbeddings = db.getAllEmbeddings();
    const results = searchVectors(queryVector, allEmbeddings, topK);
    const searchTimeMs = Date.now() - startTime;

    // 3. Format results
    const formattedResults = results.map((r, index) => ({
        rank: index + 1,
        docId: r.docId,
        title: r.title,
        subject: r.subject,
        content: r.content,
        chunkIndex: r.chunkIndex,
        score: Math.round(r.score * 1000) / 1000,
        relevancePercent: Math.round(r.score * 100),
    }));

    // 4. Generate answer
    let aiResponse = null;
    try {
        const prompt = buildPrompt(query, formattedResults);
        aiResponse = await aiManager.runLLM(prompt, onTokenCallback);
    } catch (e) {
        console.error('[RAG] Fallback to retrieval only due to generation error:', e);
        aiResponse = { text: "AI generation failed. Displaying retrieved facts below.", stats: {} };
    }

    return {
        query,
        results: formattedResults,
        searchTimeMs,
        totalDocuments: allEmbeddings.length,
        synthesizedAnswer: aiResponse.text,
        generationStats: aiResponse.stats,
        storageVersion: 'Legacy (SQLite)',
    };
}

module.exports = { ragSearch };

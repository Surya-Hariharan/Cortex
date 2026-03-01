const { searchVectors } = require('./vectorSearch');
const { aiManager } = require('./ai/runtime/aiManager');
const { buildPrompt } = require('./ai/rag/promptBuilder');

/**
 * RAG Pipeline: query → embed → vector search → prompt construction → generative AI
 * @param {string} query
 * @param {import('./database').DatabaseWrapper} db
 * @param {function} onTokenCallback Streaming callback
 * @param {number} topK
 */
async function ragSearch(query, db, onTokenCallback, topK = 5) {
    const startTime = Date.now();

    // 1. Embed query via abstraction layer
    const queryVector = await aiManager.runEmbedding(query);

    // 2. Vector search
    const allEmbeddings = db.getAllEmbeddings();
    const results = searchVectors(queryVector, allEmbeddings, topK);
    const searchTimeMs = Date.now() - startTime;

    // 3. Format retrieved facts
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
        totalDocuments: allEmbeddings.length,
        synthesizedAnswer: aiResponse.text,
        generationStats: aiResponse.stats,
    };
}

module.exports = { ragSearch };

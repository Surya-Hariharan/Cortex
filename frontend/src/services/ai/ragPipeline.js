const { searchVectors } = require('./vectorSearch');

/**
 * Combines top result excerpts into a readable synthesized answer with inline citations.
 */
function synthesizeAnswer(results) {
    if (!results || !results.length) return null;
    const top = results.slice(0, 3).filter((r) => r.score >= 0.35);
    if (!top.length) return null;
    const connectors = ['', ' Furthermore, ', ' Additionally, '];
    const body = top.map((r, i) => {
        const text = r.content.replace(/\s+/g, ' ').trim();
        const sentences = text.match(/[^.!?]+[.!?]+/g);
        const excerpt = sentences ? sentences.slice(0, 2).join(' ').trim() : text.slice(0, 220);
        const citation = `[${r.title}, Chunk ${r.chunkIndex + 1}]`;
        return connectors[i] + excerpt + ' ' + citation;
    }).join('');
    return 'Based on your study materials: ' + body;
}

/**
 * RAG Pipeline: query → embed → vector search → format results
 * @param {string} query - user's search query
 * @param {import('./embeddings').EmbeddingsEngine} embeddingsEngine
 * @param {import('./database').DatabaseWrapper} db
 * @param {number} topK - number of results
 * @returns {Promise<{query: string, results: Array, searchTimeMs: number}>}
 */
async function ragSearch(query, embeddingsEngine, db, topK = 5) {
    const startTime = Date.now();

    // 1. Embed the query
    const queryVector = await embeddingsEngine.embed(query);

    // 2. Get all stored embeddings
    const allEmbeddings = db.getAllEmbeddings();

    // 3. Vector search
    const results = searchVectors(queryVector, allEmbeddings, topK);

    const searchTimeMs = Date.now() - startTime;

    // 4. Format results with highlighted content
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

    return {
        query,
        results: formattedResults,
        searchTimeMs,
        totalDocuments: allEmbeddings.length,
        synthesizedAnswer: synthesizeAnswer(formattedResults),
    };
}

module.exports = { ragSearch, synthesizeAnswer };

/**
 * Brute-force cosine similarity vector search.
 * For 100 docs × 384 dims, this runs in <1ms — no FAISS needed.
 */

/**
 * Search for the top-K most similar vectors
 * @param {number[]} queryVector - 384-dim query embedding
 * @param {Array<{id, docId, vector, title, subject, content, chunkIndex}>} allEmbeddings
 * @param {number} topK - number of results to return
 * @returns {Array<{id, docId, title, subject, content, chunkIndex, score}>}
 */
function searchVectors(queryVector, allEmbeddings, topK = 5) {
    const scores = allEmbeddings.map((item) => {
        const score = cosineSimilarity(queryVector, item.vector);
        return {
            id: item.id,
            docId: item.docId,
            title: item.title,
            subject: item.subject,
            content: item.content,
            chunkIndex: item.chunkIndex,
            score,
        };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK);
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

module.exports = { searchVectors, cosineSimilarity };

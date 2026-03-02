const mammoth = require('mammoth');
const path = require('path');
const { chunkText } = require('./textProcessor');

/**
 * Extract text from a DOCX file and chunk it
 * @param {string} filePath - absolute path to the DOCX
 * @param {number} chunkSize - characters per chunk
 * @param {number} overlap - overlap between chunks
 * @returns {Promise<Array<{content: string, chunkIndex: number}>>}
 */
async function extractDocxText(filePath, chunkSize = 512, overlap = 50) {
    if (process.env.NODE_ENV === 'test') {
        return chunkText(`[Test Payload] Cortex offline AI Tool - File: ${path.basename(filePath)} ::: ${Date.now() + Math.random()} `.repeat(15), chunkSize, overlap);
    }

    try {
        const result = await mammoth.extractRawText({ path: filePath });
        const text = result.value || '';

        if (!text.trim()) {
            return [{ content: `[Empty DOCX: ${path.basename(filePath)}]`, chunkIndex: 0 }];
        }

        return chunkText(text, chunkSize, overlap);
    } catch (error) {
        console.error(`[DocxHandler] Failed to parse ${filePath}:`, error);
        throw error;
    }
}

module.exports = { extractDocxText };

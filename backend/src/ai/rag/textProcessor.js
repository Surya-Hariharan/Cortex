const path = require('path');

/**
 * Split text into overlapping chunks
 * @param {string} text - text to split
 * @param {number} chunkSize - characters per chunk
 * @param {number} overlap - overlap between chunks
 * @returns {Array<{content: string, chunkIndex: number}>}
 */
function chunkText(text, chunkSize = 512, overlap = 50) {
    // Clean up text
    const cleanText = text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleanText.length <= chunkSize) {
        return [{ content: cleanText, chunkIndex: 0 }];
    }

    const chunks = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < cleanText.length) {
        let end = Math.min(start + chunkSize, cleanText.length);

        // Try to break at a sentence boundary
        if (end < cleanText.length) {
            const lastPeriod = cleanText.lastIndexOf('. ', end);
            if (lastPeriod > start + chunkSize / 2) {
                end = lastPeriod + 1;
            }
        }

        const chunk = cleanText.slice(start, end).trim();
        if (chunk.length > 20) {
            chunks.push({ content: chunk, chunkIndex });
            chunkIndex++;
        }

        start = end - overlap;
        if (start >= cleanText.length) break;
    }

    return chunks;
}

module.exports = { chunkText };

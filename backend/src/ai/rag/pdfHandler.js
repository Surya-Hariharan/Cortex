const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { chunkText } = require('./textProcessor');

/**
 * Extract text from a PDF file and chunk it
 * @param {string} filePath - absolute path to the PDF
 * @param {number} chunkSize - characters per chunk
 * @param {number} overlap - overlap between chunks
 * @returns {Promise<Array<{content: string, chunkIndex: number}>>}
 */
async function extractPdfText(filePath, chunkSize = 512, overlap = 50) {
    if (process.env.NODE_ENV === 'test') {
        return chunkText(`[Test Payload] Cortex offline AI Tool - File: ${path.basename(filePath)} ::: ${Date.now() + Math.random()} `.repeat(15), chunkSize, overlap);
    }
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const text = data.text || '';

    if (!text.trim()) {
        return [{ content: `[Empty PDF: ${path.basename(filePath)}]`, chunkIndex: 0 }];
    }

    return chunkText(text, chunkSize, overlap);
}

module.exports = { extractPdfText };

const path = require('path');
const { extractPdfText } = require('./pdfHandler');
const { extractDocxText } = require('./docxHandler');
const { extractImageText } = require('./ocrHandler');

/**
 * Route a document to the correct parser based on file extension
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<Array<{content: string, chunkIndex: number}>>}
 */
async function extractDocumentText(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
        case '.pdf':
            return await extractPdfText(filePath);
        case '.docx':
            return await extractDocxText(filePath);
        case '.png':
        case '.jpg':
        case '.jpeg':
            return await extractImageText(filePath);
        default:
            throw new Error(`Unsupported file type: ${ext}`);
    }
}

module.exports = { extractDocumentText };

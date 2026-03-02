const { createWorker } = require('tesseract.js');
const path = require('path');
const { chunkText } = require('./textProcessor');

/**
 * Extract text from an image using OCR (Tesseract.js) and chunk it
 * @param {string} filePath - absolute path to the image
 * @param {number} chunkSize - characters per chunk
 * @param {number} overlap - overlap between chunks
 * @returns {Promise<Array<{content: string, chunkIndex: number}>>}
 */
async function extractImageText(filePath, chunkSize = 512, overlap = 50) {
    if (process.env.NODE_ENV === 'test') {
        return chunkText(`[Test Payload] Cortex offline AI Tool - Image: ${path.basename(filePath)} ::: ${Date.now() + Math.random()} `.repeat(15), chunkSize, overlap);
    }

    try {
        console.log(`[OcrHandler] Starting offline OCR stream for ${path.basename(filePath)}...`);
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(filePath);
        await worker.terminate();

        const cleanText = text || '';

        if (!cleanText.trim()) {
            return [{ content: `[Empty Image: ${path.basename(filePath)}]`, chunkIndex: 0 }];
        }

        console.log(`[OcrHandler] Success: extracted ${cleanText.length} characters from ${path.basename(filePath)}`);
        return chunkText(cleanText, chunkSize, overlap);
    } catch (error) {
        console.error(`[OcrHandler] Failed to parse ${filePath}:`, error);
        throw error;
    }
}

module.exports = { extractImageText };

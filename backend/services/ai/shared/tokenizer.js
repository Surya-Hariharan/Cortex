const fs = require('fs');
const path = require('path');

/**
 * Shared Tokenizer Utilities
 * Provides reusable tokenization logic for embedding models
 */

/**
 * Simple wordpiece-style tokenizer using tokenizer.json from HuggingFace
 */
class SimpleTokenizer {
    constructor(tokenizerData) {
        this.vocab = {};
        this.unkId = 100;  // [UNK]
        this.clsId = 101;  // [CLS]
        this.sepId = 102;  // [SEP]
        this.padId = 0;    // [PAD]

        // Build vocab from tokenizer.json model
        if (tokenizerData.model && tokenizerData.model.vocab) {
            this.vocab = tokenizerData.model.vocab;
        } else if (tokenizerData.vocab) {
            this.vocab = tokenizerData.vocab;
        }
    }

    /**
     * Encode text into token IDs and attention mask
     * @param {string} text - Input text
     * @param {number} maxLength - Maximum sequence length
     * @returns {Object} { inputIds, attentionMask }
     */
    encode(text, maxLength = 512) {
        // Simple whitespace + punctuation tokenization
        const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
        const words = cleanText.split(/\s+/).filter(Boolean);

        let tokenIds = [this.clsId];

        for (const word of words) {
            if (tokenIds.length >= maxLength - 1) break;

            const id = this.vocab[word];
            if (id !== undefined) {
                tokenIds.push(id);
            } else {
                // Try wordpiece
                let remaining = word;
                while (remaining.length > 0 && tokenIds.length < maxLength - 1) {
                    let found = false;
                    for (let end = remaining.length; end > 0; end--) {
                        const piece = tokenIds.length > 1 && remaining !== word
                            ? '##' + remaining.slice(0, end)
                            : remaining.slice(0, end);
                        const pieceId = this.vocab[piece];
                        if (pieceId !== undefined) {
                            tokenIds.push(pieceId);
                            remaining = remaining.slice(end);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        tokenIds.push(this.unkId);
                        break;
                    }
                }
            }
        }

        tokenIds.push(this.sepId);

        const attentionMask = new Array(tokenIds.length).fill(1);

        return { inputIds: tokenIds, attentionMask };
    }
}

/**
 * Fallback tokenizer: maps words to pseudo-token IDs via hashing
 * Used when tokenizer.json is not available
 */
class FallbackTokenizer {
    constructor() {
        this.clsId = 101;  // [CLS]
        this.sepId = 102;  // [SEP]
    }

    /**
     * Encode text using simple hash-based tokenization
     * @param {string} text - Input text
     * @param {number} maxLength - Maximum sequence length
     * @returns {Object} { inputIds, attentionMask }
     */
    encode(text, maxLength = 512) {
        const words = text.toLowerCase().split(/\s+/).slice(0, maxLength - 2);
        const inputIds = [this.clsId]; // [CLS]
        
        for (const word of words) {
            // Hash the word to a token ID in range [1000, 30000]
            let hash = 0;
            for (let i = 0; i < word.length; i++) {
                hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
            }
            inputIds.push(1000 + Math.abs(hash) % 29000);
        }
        
        inputIds.push(this.sepId); // [SEP]
        const attentionMask = new Array(inputIds.length).fill(1);
        
        return { inputIds, attentionMask };
    }
}

/**
 * Load a tokenizer from a directory
 * @param {string} modelDir - Directory containing tokenizer.json
 * @returns {Object} Tokenizer instance
 */
function loadTokenizer(modelDir) {
    const tokenizerPath = path.join(modelDir, 'tokenizer.json');

    if (fs.existsSync(tokenizerPath)) {
        console.log('[Tokenizer] Loading tokenizer from:', tokenizerPath);
        const tokenizerData = JSON.parse(fs.readFileSync(tokenizerPath, 'utf-8'));
        return new SimpleTokenizer(tokenizerData);
    } else {
        console.warn('[Tokenizer] tokenizer.json not found, using fallback tokenizer');
        return new FallbackTokenizer();
    }
}

module.exports = {
    SimpleTokenizer,
    FallbackTokenizer,
    loadTokenizer
};

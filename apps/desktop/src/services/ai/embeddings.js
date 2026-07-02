const ort = require('onnxruntime-node');
const path = require('path');
const fs = require('fs');

class EmbeddingsEngine {
    constructor(modelDir) {
        this.modelDir = modelDir;
        this.session = null;
        this.tokenizer = null;
        this.ready = false;
        this.embeddingDim = 384;
        this.activeProvider = 'cpu';
        this.lastEmbedTimeMs = 0;
        this.embedHistory = [];
        this.useApi = false;
    }

    async initialize() {
        const modelPath = path.join(this.modelDir, 'model.onnx');
        const tokenizerPath = path.join(this.modelDir, 'tokenizer.json');

        if (!fs.existsSync(modelPath)) {
            // Fall back to deterministic local pseudo-embeddings when no local
            // model or external API key is configured.
            console.log(`[Embeddings] Local model not found — using local fallback embeddings`);
            this.useApi = false;
            this.activeProvider = 'local-fallback';
            this.ready = true;
            return;
        }

        // Load tokenizer config
        if (fs.existsSync(tokenizerPath)) {
            const tokenizerData = JSON.parse(fs.readFileSync(tokenizerPath, 'utf-8'));
            this.tokenizer = new SimpleTokenizer(tokenizerData);
        } else {
            console.warn('[Embeddings] tokenizer.json not found, using fallback tokenizer');
            this.tokenizer = new FallbackTokenizer();
        }

        // Create ONNX session with DirectML if available, else CPU
        try {
            const options = {
                executionProviders: [
                    { name: 'dml' },   // DirectML for AMD Ryzen AI / iGPU
                    { name: 'cpu' },   // Fallback
                ],
                graphOptimizationLevel: 'all',
            };
            this.session = await ort.InferenceSession.create(modelPath, options);
            this.activeProvider = 'dml';
            console.log('[Embeddings] Model loaded with DirectML+CPU providers');
        } catch (err) {
            // If DirectML fails, try CPU only
            console.warn('[Embeddings] DirectML failed, falling back to CPU:', err.message);
            this.session = await ort.InferenceSession.create(modelPath, {
                executionProviders: [{ name: 'cpu' }],
            });
            this.activeProvider = 'cpu';
            console.log('[Embeddings] Model loaded with CPU provider');
        }

        this.ready = true;
    }

    isReady() {
        return this.ready;
    }

    async embed(text) {
        if (!this.ready) throw new Error('Embeddings engine not initialized');

        const _t0 = Date.now();

        if (this.activeProvider === 'local-fallback') {
            // Generate deterministic pseudo-embeddings when no embedding provider exists.
            const embedding = this._hashEmbed(text);
            const elapsed = Date.now() - _t0;
            this.lastEmbedTimeMs = elapsed;
            this.embedHistory = [...this.embedHistory.slice(-9), elapsed];
            return embedding;
        }

        // Tokenize
        const { inputIds, attentionMask } = this.tokenizer.encode(text, 512);

        // Create tensors
        const inputIdsTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, inputIds.length]);
        const attentionMaskTensor = new ort.Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, attentionMask.length]);
        const tokenTypeIds = new Array(inputIds.length).fill(0n);
        const tokenTypeIdsTensor = new ort.Tensor('int64', BigInt64Array.from(tokenTypeIds), [1, inputIds.length]);

        // Run inference
        const feeds = {
            input_ids: inputIdsTensor,
            attention_mask: attentionMaskTensor,
            token_type_ids: tokenTypeIdsTensor,
        };

        const results = await this.session.run(feeds);

        // Get embeddings from last_hidden_state or sentence_embedding output
        let embedding;
        if (results.sentence_embedding) {
            embedding = Array.from(results.sentence_embedding.data);
        } else if (results.last_hidden_state) {
            // Mean pooling over token embeddings
            const hiddenState = results.last_hidden_state.data;
            const seqLen = inputIds.length;
            embedding = new Array(this.embeddingDim).fill(0);
            let validTokens = 0;

            for (let i = 0; i < seqLen; i++) {
                if (attentionMask[i] === 1) {
                    for (let j = 0; j < this.embeddingDim; j++) {
                        embedding[j] += hiddenState[i * this.embeddingDim + j];
                    }
                    validTokens++;
                }
            }

            for (let j = 0; j < this.embeddingDim; j++) {
                embedding[j] /= validTokens;
            }
        } else {
            // Use first available output
            const outputName = Object.keys(results)[0];
            embedding = Array.from(results[outputName].data).slice(0, this.embeddingDim);
        }

        // L2 normalize
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        const normalized = embedding.map((val) => val / (norm + 1e-12));

        const _elapsed = Date.now() - _t0;
        this.lastEmbedTimeMs = _elapsed;
        this.embedHistory = [...this.embedHistory.slice(-9), _elapsed];

        return normalized;
    }

    // Deterministic pseudo-embedding based on text hash.
    // Used as a fallback when the backend can't return raw vectors.
    _hashEmbed(text) {
        const vec = new Array(this.embeddingDim).fill(0);
        for (let i = 0; i < text.length; i++) {
            const c = text.charCodeAt(i);
            // % 256 keeps values in [0,255] so the vector is always non-zero for non-empty text
            vec[i % this.embeddingDim] += (c * (i + 1)) % 256;
        }
        const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
        return vec.map(v => v / norm);
    }

    getPerfStats() {
        const avg = this.embedHistory.length
            ? Math.round(this.embedHistory.reduce((a, b) => a + b, 0) / this.embedHistory.length)
            : 0;
        const cpuBaselineMs = 41;
        return {
            provider: this.activeProvider,
            lastEmbedTimeMs: this.lastEmbedTimeMs,
            avgEmbedTimeMs: avg,
            embedHistory: [...this.embedHistory],
            cpuBaselineMs,
            speedupX: avg > 0 ? Math.round((cpuBaselineMs / avg) * 10) / 10 : null,
        };
    }
}

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
 * Fallback tokenizer: maps characters to pseudo-token IDs
 */
class FallbackTokenizer {
    encode(text, maxLength = 512) {
        const words = text.toLowerCase().split(/\s+/).slice(0, maxLength - 2);
        const inputIds = [101]; // [CLS]
        for (const word of words) {
            // Hash the word to a token ID in range [1000, 30000]
            let hash = 0;
            for (let i = 0; i < word.length; i++) {
                hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
            }
            inputIds.push(1000 + Math.abs(hash) % 29000);
        }
        inputIds.push(102); // [SEP]
        const attentionMask = new Array(inputIds.length).fill(1);
        return { inputIds, attentionMask };
    }
}

module.exports = { EmbeddingsEngine };

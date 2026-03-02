const ort = require('onnxruntime-node');
const path = require('path');
const { sessionRegistry } = require('../runtime/sessionRegistry');
const { loadTokenizer } = require('../shared/tokenizer');
const { validateModelDir, getModelInfo } = require('../shared/modelLoader');

/**
 * BGE Embedding Runner
 * Handles BGE-small-en-v1.5 embedding model inference
 * 
 * Key features:
 * - Uses session registry for efficient session reuse
 * - Isolated from UI and other models
 * - Clean run() interface
 * - Performance tracking
 */
class BGERunner {
    constructor(modelDir) {
        this.modelDir = modelDir || path.join(__dirname, '../../../../../models/bge-small-en-v1.5');
        this.modelKey = 'bge-small-en-v1.5';
        this.tokenizer = null;
        this.ready = false;
        this.embeddingDim = 384;
        this.modelName = 'bge-small-en-v1.5';
        
        // Performance tracking
        this.lastEmbedTimeMs = 0;
        this.embedHistory = [];
    }

    /**
     * Initialize the embedding model
     */
    async initialize() {
        if (this.ready) {
            return;
        }

        console.log('[BGERunner] Initializing BGE embedding model...');

        // Validate model directory
        const validation = validateModelDir(this.modelDir, ['model.onnx']);
        if (!validation.valid) {
            console.error('[BGERunner] Missing required files:', validation.missing);
            throw new Error(`Model validation failed. Missing: ${validation.missing.join(', ')}`);
        }

        // Load tokenizer
        this.tokenizer = loadTokenizer(this.modelDir);

        // Get model info
        const modelPath = path.join(this.modelDir, 'model.onnx');
        const modelInfo = getModelInfo(modelPath);
        console.log(`[BGERunner] Model size: ${modelInfo.sizeMB} MB`);

        // Load ONNX session via registry (enables session reuse)
        const sessionData = await sessionRegistry.getSession(
            this.modelKey,
            modelPath,
            {
                executionProviders: [
                    { name: 'dml' },   // DirectML for AMD Ryzen AI / iGPU
                    { name: 'cpu' },   // Fallback
                ],
                graphOptimizationLevel: 'all',
            }
        );

        this.sessionData = sessionData;
        this.ready = true;

        console.log(`[BGERunner] Initialized successfully using ${sessionData.metadata.provider}`);
    }

    /**
     * Check if runner is ready
     * @returns {boolean}
     */
    isReady() {
        return this.ready;
    }

    /**
     * Generate embedding for text
     * @param {string} text - Input text
     * @returns {Promise<Array<number>>} Normalized embedding vector
     */
    async run(text) {
        if (!this.ready) {
            await this.initialize();
        }

        const startTime = Date.now();

        // Tokenize
        const { inputIds, attentionMask } = this.tokenizer.encode(text, 512);

        // Create tensors
        const inputIdsTensor = new ort.Tensor(
            'int64',
            BigInt64Array.from(inputIds.map(BigInt)),
            [1, inputIds.length]
        );
        
        const attentionMaskTensor = new ort.Tensor(
            'int64',
            BigInt64Array.from(attentionMask.map(BigInt)),
            [1, attentionMask.length]
        );
        
        const tokenTypeIds = new Array(inputIds.length).fill(0n);
        const tokenTypeIdsTensor = new ort.Tensor(
            'int64',
            BigInt64Array.from(tokenTypeIds),
            [1, inputIds.length]
        );

        // Run inference via session registry
        const feeds = {
            input_ids: inputIdsTensor,
            attention_mask: attentionMaskTensor,
            token_type_ids: tokenTypeIdsTensor,
        };

        const results = await this.sessionData.session.run(feeds);

        // Extract and process embeddings
        let embedding = this._extractEmbedding(results, inputIds, attentionMask);

        // L2 normalize
        embedding = this._normalizeEmbedding(embedding);

        // Record performance
        const elapsed = Date.now() - startTime;
        this.lastEmbedTimeMs = elapsed;
        this.embedHistory = [...this.embedHistory.slice(-9), elapsed];
        sessionRegistry.recordInference(this.modelKey, elapsed);

        return embedding;
    }

    /**
     * Extract embedding from model output
     * @private
     */
    _extractEmbedding(results, inputIds, attentionMask) {
        let embedding;

        if (results.sentence_embedding) {
            // Direct sentence embedding output
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

        return embedding;
    }

    /**
     * L2 normalize embedding vector
     * @private
     */
    _normalizeEmbedding(embedding) {
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map((val) => val / (norm + 1e-12));
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance metrics
     */
    getPerfStats() {
        const avg = this.embedHistory.length
            ? Math.round(this.embedHistory.reduce((a, b) => a + b, 0) / this.embedHistory.length)
            : 0;
        
        const cpuBaselineMs = 41; // Reference baseline
        
        const sessionMeta = sessionRegistry.getMetadata(this.modelKey);

        return {
            modelName: this.modelName,
            provider: sessionMeta?.provider || 'unknown',
            lastEmbedTimeMs: this.lastEmbedTimeMs,
            avgEmbedTimeMs: avg,
            embedHistory: [...this.embedHistory],
            cpuBaselineMs,
            speedupX: avg > 0 ? Math.round((cpuBaselineMs / avg) * 10) / 10 : null,
            inferenceCount: sessionMeta?.inferenceCount || 0,
        };
    }

    /**
     * Get model information
     * @returns {Object} Model metadata
     */
    getModelInfo() {
        return {
            name: this.modelName,
            embeddingDim: this.embeddingDim,
            modelPath: this.modelDir,
            ready: this.ready
        };
    }
}

module.exports = { BGERunner };

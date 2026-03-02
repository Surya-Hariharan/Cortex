const { BGERunner } = require('../embeddings/bgeRunner');
const { PhiRunner } = require('../llm/phiRunner');
const { hardwareDetector } = require('./hardwareDetector');
const { sessionRegistry } = require('./sessionRegistry');
const path = require('path');

/**
 * AI Manager - Single Public AI Entry Point
 * 
 * This is the ONLY interface between UI and AI models.
 * UI components must NEVER import model-specific files directly.
 * 
 * Architecture:
 * UI → aiManager → runtime adapters → model runners
 * 
 * This enables:
 * - Clean abstraction between UI and models
 * - Easy model swapping without UI changes
 * - Multi-model, multi-hardware support
 * - Centralized performance tracking
 */
class AIManager {
    constructor() {
        const modelDir = path.join(__dirname, '../../../../models/bge-small-en-v1.5');
        
        // Model runners (plugins)
        this.embedder = new BGERunner(modelDir);
        this.llm = new PhiRunner();
        
        // Runtime state
        this.initialized = false;
        this.hardwareInfo = null;
    }

    /**
     * Initialize AI systems
     * Detects hardware and prepares embedding model
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        console.log('[AIManager] Initializing AI systems...');
        
        // Detect hardware capabilities
        this.hardwareInfo = await hardwareDetector.detect();
        console.log('[AIManager] Hardware detection complete');
        
        // Initialize embedder (used frequently for search)
        // LLM is lazily initialized on first use to save boot time
        try {
            await this.embedder.initialize();
            console.log('[AIManager] Embeddings engine ready.');
        } catch (error) {
            console.warn('[AIManager] Embeddings engine unavailable:', error.message);
            console.warn('[AIManager] Running in limited mode until model files are available.');
        }
        
        this.initialized = true;
    }

    /**
     * Generate embedding for text
     * @param {string} text - Input text
     * @returns {Promise<Array<number>>} Normalized embedding vector (384-dim)
     */
    async runEmbedding(text) {
        if (!this.embedder.isReady()) {
            await this.embedder.initialize();
        }
        return await this.embedder.run(text);
    }

    /**
     * Run LLM inference with streaming support
     * @param {string} prompt - Formatted prompt
     * @param {function} onToken - Callback for streaming tokens (accumulated text)
     * @returns {Promise<Object>} { text, stats }
     */
    async runLLM(prompt, onToken) {
        return await this.llm.generateStream(prompt, onToken);
    }

    /**
     * Get comprehensive runtime metadata
     * Exposes system capabilities and performance metrics
     * 
     * @returns {Object} Runtime information
     */
    getRuntimeInfo() {
        const embeddingStats = this.embedder.getPerfStats();
        const llmStats = this.llm.getPerfStats();
        const memoryStats = sessionRegistry.getMemoryStats();

        return {
            // Active models
            models: {
                embedding: {
                    name: embeddingStats.modelName || 'bge-small-en-v1.5',
                    type: 'embedding',
                    provider: embeddingStats.provider,
                    ready: this.embedder.isReady(),
                    performance: {
                        lastInferenceMs: embeddingStats.lastEmbedTimeMs,
                        avgInferenceMs: embeddingStats.avgEmbedTimeMs,
                        speedupX: embeddingStats.speedupX,
                        inferenceCount: embeddingStats.inferenceCount
                    }
                },
                llm: {
                    name: llmStats.modelId || 'Phi-3-mini-4k-instruct',
                    type: 'text-generation',
                    provider: 'cpu', // Transformers.js uses CPU
                    ready: llmStats.ready,
                    performance: {
                        loadTimeMs: llmStats.lastStats?.loadTime || 0,
                        ttftMs: llmStats.lastStats?.ttft || 0,
                        tokensPerSec: llmStats.lastStats?.tokensPerSec || 0,
                        inferenceCount: llmStats.inferenceCount
                    }
                }
            },

            // Hardware capabilities
            hardware: this.hardwareInfo || {
                provider: 'cpu',
                deviceName: 'Unknown',
                supportsFP16: false,
            },

            // Memory and session info
            runtime: {
                activeSessions: memoryStats.activeSessions,
                estimatedMemoryMB: memoryStats.estimatedMemoryMB,
                sessions: memoryStats.sessions
            },

            // System status
            status: {
                initialized: this.initialized,
                embeddingReady: this.embedder.isReady(),
                llmReady: llmStats.ready
            }
        };
    }

    /**
     * Placeholder for future remote LLM inference via mesh network
     * Phase 2C: Distributed inference across peer devices
     * 
     * @param {string} prompt - Formatted prompt
     * @param {string} peerId - Target peer device ID
     * @returns {Promise<Object>} Inference result
     * @throws {Error} Not implemented
     */
    async runRemoteLLM(prompt, peerId) {
        throw new Error('Remote LLM inference not implemented. This will be available in Phase 2C (mesh inference).');
    }

    /**
     * Get hardware detection results
     * @returns {Object} Hardware capabilities
     */
    getHardwareInfo() {
        return this.hardwareInfo || { provider: 'unknown', deviceName: 'Not detected' };
    }
}

// Export a singleton instance
const aiManager = new AIManager();
module.exports = { aiManager };

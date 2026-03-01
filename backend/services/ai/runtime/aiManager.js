const { EmbeddingsEngine } = require('../../../services/embeddings');
const { PhiRunner } = require('./llm/phiRunner');
const path = require('path');

class AIManager {
    constructor() {
        const modelDir = path.join(__dirname, '../../../../../models/bge-small-en-v1.5');
        this.embedder = new EmbeddingsEngine(modelDir);
        this.llm = new PhiRunner();
    }

    async initialize() {
        console.log('[AIManager] Initializing AI systems...');
        // We initialize the embedder right away because search is frequent.
        // We lazily initialize the LLM to save boot time, but we can do it here if requested.
        await this.embedder.initialize();
        console.log('[AIManager] Embeddings engine ready.');
    }

    async runEmbedding(text) {
        if (!this.embedder.isReady()) {
            await this.embedder.initialize();
        }
        return await this.embedder.embed(text);
    }

    /**
     * Runs the LLM generator with streaming support.
     * @param {string} prompt 
     * @param {function} onToken Callback passing the accumulated string
     * @returns {object} { text (final text), stats }
     */
    async runLLM(prompt, onToken) {
        return await this.llm.generateStream(prompt, onToken);
    }
}

// Export a singleton instance
const aiManager = new AIManager();
module.exports = { aiManager };

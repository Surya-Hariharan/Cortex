/**
 * AI Provider Abstraction
 * Manages routing between Cloud and Local AI providers with offline fallback.
 */

class AIProviderManager {
    constructor() {
        this.cloudProviders = {
            openai: { enabled: true, endpoint: 'https://api.openai.com/v1/chat/completions' },
            anthropic: { enabled: false, endpoint: 'https://api.anthropic.com/v1/messages' }
        };
        this.localProviders = {
            ollama: { enabled: true, endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/generate' }
        };
        this.activeCloud = 'openai';
        this.activeLocal = 'ollama';
    }

    /**
     * Attempts to route the request to a Cloud Provider. If the network is down
     * or the request fails, it gracefully falls back to the Local Provider.
     */
    async generate(prompt) {
        // Fallback checks logic
        // We use global.navigator.onLine for web/electron renderer environments,
        // or a simulated network status check if running in Node main process.
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

        if (isOnline && this.cloudProviders[this.activeCloud]?.enabled) {
            try {
                // In a real implementation, this would make the actual fetch request
                // with the user's BYOK securely fetched from the OS keychain.
                console.log(`[AI] Routing request to Cloud (${this.activeCloud})...`);
                
                // Simulated cloud success
                return await this._mockNetworkCall(prompt, 'Cloud');
            } catch (err) {
                console.warn(`[AI] Cloud provider failed (${err.message}). Falling back to Local AI.`);
            }
        }

        // Fallback to local AI (Ollama/ONNX)
        console.log(`[AI] Network offline or Cloud unavailable. Using Local AI (${this.activeLocal}).`);
        return await this._mockNetworkCall(prompt, 'Local');
    }

    async _mockNetworkCall(prompt, source) {
        return new Promise((resolve) => {
            setTimeout(() => resolve(`[${source} AI Response] Based on the context: "${prompt.slice(0, 20)}..." this is a synthesized response.`), 500);
        });
    }
}

module.exports = new AIProviderManager();

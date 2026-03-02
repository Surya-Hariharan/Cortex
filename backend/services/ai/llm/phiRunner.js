const path = require('path');

let transformers = null;

async function getTransformers() {
    if (transformers) return transformers;

    const mod = await import('@xenova/transformers');

    mod.env.localModelPath = path.join(__dirname, '../../../../models');
    mod.env.allowRemoteModels = true;
    mod.env.cacheDir = path.join(__dirname, '../../../../models/.cache');
    mod.env.allowLocalModels = true;

    transformers = mod;
    return transformers;
}

class PhiRunner {
    constructor() {
        this.generator = null;
        this.ready = false;
        // Using a tiny quantized instruction model highly optimized for CPU inference
        this.modelId = 'Xenova/Phi-3-mini-4k-instruct';
        this.loadTime = 0;
        this.lastStats = null;
        this.inferenceCount = 0;
    }

    async initialize() {
        if (this.ready) return;
        console.log(`[PhiRunner] Loading model ${this.modelId}...`);
        const t0 = Date.now();

        try {
            const { pipeline } = await getTransformers();
            this.generator = await pipeline('text-generation', this.modelId, {
                quantized: true,       // Use INT8 automatically
            });
            this.loadTime = Date.now() - t0;
            this.ready = true;
            console.log(`[PhiRunner] Model loaded successfully in ${this.loadTime}ms.`);
        } catch (error) {
            console.error('[PhiRunner] Failed to load model:', error);
            throw error;
        }
    }

    /**
     * @param {string} prompt Formatted prompt string
     * @param {function} onUpdate Callback fired with the *accumulated* generated text
     * @returns {object} Final performance metrics
     */
    async generateStream(prompt, onUpdate) {
        if (!this.ready) {
            await this.initialize();
        }

        console.log('[PhiRunner] Starting inference...');
        const startTime = Date.now();
        let ttft = 0; // Time to first token

        const { BaseStreamer } = await getTransformers();

        class CallbackStreamer extends BaseStreamer {
            constructor(tokenizer, callback, onFirstToken) {
                super();
                this.tokenizer = tokenizer;
                this.callback = callback;
                this.onFirstToken = onFirstToken;
                this.tokenCache = [];
                this.first = true;
            }

            put(value) {
                if (value.length === 0) return;
                const tokens = Array.isArray(value[0]) ? value[0] : value;
                this.tokenCache.push(...tokens);

                if (this.first) {
                    this.first = false;
                    if (this.onFirstToken) this.onFirstToken();
                }

                const text = this.tokenizer.decode(this.tokenCache, { skip_special_tokens: true });
                this.callback(text);
            }

            end() { }
        }

        const streamer = new CallbackStreamer(
            this.generator.tokenizer,
            (text) => onUpdate(text),
            () => { ttft = Date.now() - startTime; }
        );

        try {
            const outputs = await this.generator(prompt, {
                max_new_tokens: 256,
                temperature: 0.1,
                repetition_penalty: 1.1,
                do_sample: false,
                streamer: streamer
            });

            const totalTime = Date.now() - startTime;
            // Rough token estimate: length of generated text / 4
            const generatedText = outputs[0].generated_text;
            // The pipeline returns the prompt + generated text if return_full_text is true (default).
            // But we used a streamer, so we already have the token callbacks.
            const tokensEstimated = Math.max(1, Math.floor(streamer.tokenCache.length));
            const tokensPerSec = (tokensEstimated / (totalTime / 1000)).toFixed(2);

            const stats = {
                loadTime: this.loadTime,
                ttft: ttft,
                tokensPerSec: parseFloat(tokensPerSec),
                totalTime: totalTime
            };
            this.lastStats = stats;
            this.inferenceCount++;

            return {
                text: streamer.tokenizer.decode(streamer.tokenCache, { skip_special_tokens: true }),
                stats: stats
            };
        } catch (error) {
            console.error('[PhiRunner] Inference error:', error);
            throw error;
        }
    }

    getPerfStats() {
        return {
            ready: this.ready,
            modelId: this.modelId,
            inferenceCount: this.inferenceCount,
            lastStats: this.lastStats || { loadTime: 0, ttft: 0, tokensPerSec: 0, totalTime: 0 }
        };
    }
}

module.exports = { PhiRunner };

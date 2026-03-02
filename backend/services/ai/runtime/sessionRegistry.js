const ort = require('onnxruntime-node');
const { hardwareDetector } = require('./hardwareDetector');

/**
 * Session Registry - Centralized ONNX Session Manager
 * 
 * Critical responsibilities:
 * - Cache loaded ONNX sessions
 * - Prevent duplicate model loads
 * - Enable session reuse across queries
 * - Support lazy loading
 * - Track memory usage
 * 
 * This prevents:
 * - Model reload per query
 * - Memory explosion
 * - Latency spikes
 */
class SessionRegistry {
    constructor() {
        this.sessions = new Map(); // key -> { session, metadata }
        this.loadPromises = new Map(); // Track in-flight loads
    }

    /**
     * Get or create an ONNX session
     * @param {string} key - Unique identifier for this model
     * @param {string} modelPath - Path to ONNX model file
     * @param {Object} options - Session options
     * @returns {Promise<Object>} Session object with metadata
     */
    async getSession(key, modelPath, options = {}) {
        // If session exists, return it immediately
        if (this.sessions.has(key)) {
            console.log(`[SessionRegistry] Reusing cached session: ${key}`);
            return this.sessions.get(key);
        }

        // If session is currently loading, wait for it
        if (this.loadPromises.has(key)) {
            console.log(`[SessionRegistry] Waiting for in-flight load: ${key}`);
            return await this.loadPromises.get(key);
        }

        // Load new session
        console.log(`[SessionRegistry] Loading new session: ${key}`);
        const loadPromise = this._loadSession(key, modelPath, options);
        this.loadPromises.set(key, loadPromise);

        try {
            const sessionData = await loadPromise;
            this.loadPromises.delete(key);
            return sessionData;
        } catch (error) {
            this.loadPromises.delete(key);
            throw error;
        }
    }

    /**
     * Internal method to load and cache a session
     * @private
     */
    async _loadSession(key, modelPath, options) {
        const startTime = Date.now();

        // Get hardware capabilities
        const hwCaps = await hardwareDetector.detect();

        // Merge options with hardware-recommended providers
        const sessionOptions = {
            executionProviders: hardwareDetector.getRecommendedProviders(true),
            graphOptimizationLevel: 'all',
            ...options
        };

        console.log(`[SessionRegistry] Creating session with providers:`, 
                    sessionOptions.executionProviders.map(p => p.name).join(', '));

        try {
            const session = await ort.InferenceSession.create(modelPath, sessionOptions);
            const loadTime = Date.now() - startTime;

            const sessionData = {
                session,
                metadata: {
                    key,
                    modelPath,
                    loadTime,
                    loadedAt: new Date().toISOString(),
                    provider: this._getActiveProvider(session, sessionOptions.executionProviders),
                    executionProviders: sessionOptions.executionProviders.map(p => p.name),
                    inputNames: session.inputNames,
                    outputNames: session.outputNames,
                    inferenceCount: 0,
                    totalInferenceTime: 0,
                }
            };

            // Cache the session
            this.sessions.set(key, sessionData);
            
            console.log(`[SessionRegistry] Session loaded successfully in ${loadTime}ms`);
            console.log(`[SessionRegistry] Active provider: ${sessionData.metadata.provider}`);
            
            return sessionData;
        } catch (error) {
            console.error(`[SessionRegistry] Failed to load session ${key}:`, error.message);
            throw error;
        }
    }

    /**
     * Determine which provider is actually being used
     * @private
     */
    _getActiveProvider(session, requestedProviders) {
        // ONNX Runtime doesn't expose this directly, so we infer from what was requested
        // In practice, it uses the first available provider from the list
        for (const provider of requestedProviders) {
            const providerName = provider.name || provider;
            if (ort.InferenceSession.availableProviders().includes(providerName)) {
                return providerName;
            }
        }
        return 'cpu'; // Fallback
    }

    /**
     * Record inference metrics
     * @param {string} key - Session key
     * @param {number} inferenceTimeMs - Time taken for inference
     */
    recordInference(key, inferenceTimeMs) {
        if (this.sessions.has(key)) {
            const sessionData = this.sessions.get(key);
            sessionData.metadata.inferenceCount++;
            sessionData.metadata.totalInferenceTime += inferenceTimeMs;
        }
    }

    /**
     * Get session metadata
     * @param {string} key - Session key
     * @returns {Object|null} Metadata or null if not found
     */
    getMetadata(key) {
        if (this.sessions.has(key)) {
            return this.sessions.get(key).metadata;
        }
        return null;
    }

    /**
     * Get all session metadata
     * @returns {Array} Array of all session metadata
     */
    getAllMetadata() {
        return Array.from(this.sessions.values()).map(s => s.metadata);
    }

    /**
     * Check if a session exists
     * @param {string} key - Session key
     * @returns {boolean}
     */
    hasSession(key) {
        return this.sessions.has(key);
    }

    /**
     * Release a specific session
     * @param {string} key - Session key
     */
    async releaseSession(key) {
        if (this.sessions.has(key)) {
            const sessionData = this.sessions.get(key);
            try {
                // ONNX Runtime will handle cleanup automatically
                // But we can explicitly trigger release if needed
                console.log(`[SessionRegistry] Releasing session: ${key}`);
                this.sessions.delete(key);
            } catch (error) {
                console.error(`[SessionRegistry] Error releasing session ${key}:`, error);
            }
        }
    }

    /**
     * Release all sessions
     */
    async releaseAll() {
        console.log(`[SessionRegistry] Releasing all sessions (${this.sessions.size})`);
        const keys = Array.from(this.sessions.keys());
        for (const key of keys) {
            await this.releaseSession(key);
        }
    }

    /**
     * Get memory usage estimate (rough approximation)
     * @returns {Object} Memory statistics
     */
    getMemoryStats() {
        const sessionCount = this.sessions.size;
        
        // Rough estimates based on typical model sizes
        const estimatedMemoryMB = sessionCount * 100; // ~100MB per model on average

        return {
            activeSessions: sessionCount,
            estimatedMemoryMB,
            sessions: this.getAllMetadata().map(m => ({
                key: m.key,
                provider: m.provider,
                inferenceCount: m.inferenceCount,
                avgInferenceTime: m.inferenceCount > 0 
                    ? Math.round(m.totalInferenceTime / m.inferenceCount) 
                    : 0
            }))
        };
    }
}

// Export singleton instance
const sessionRegistry = new SessionRegistry();

module.exports = { sessionRegistry, SessionRegistry };

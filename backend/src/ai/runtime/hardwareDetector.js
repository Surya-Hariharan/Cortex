const ort = require('onnxruntime-node');
const os = require('os');

/**
 * Hardware Detection Layer
 * Detects available acceleration providers (CPU, DirectML, etc.)
 * Provides capability reporting for runtime optimization
 */
class HardwareDetector {
    constructor() {
        this.detectedCapabilities = null;
    }

    /**
     * Detect available hardware acceleration
     * @returns {Object} Hardware capabilities
     */
    async detect() {
        if (this.detectedCapabilities) {
            return this.detectedCapabilities;
        }

        console.log('[HardwareDetector] Scanning available execution providers...');

        let availableProviders = ['cpu'];
        try {
            if (typeof ort.getAvailableExecutionProviders === 'function') {
                availableProviders = await Promise.resolve(ort.getAvailableExecutionProviders());
            } else if (
                ort.InferenceSession &&
                typeof ort.InferenceSession.getAvailableExecutionProviders === 'function'
            ) {
                availableProviders = await Promise.resolve(ort.InferenceSession.getAvailableExecutionProviders());
            } else if (
                ort.InferenceSession &&
                typeof ort.InferenceSession.availableProviders === 'function'
            ) {
                availableProviders = await Promise.resolve(ort.InferenceSession.availableProviders());
            }
        } catch (providerError) {
            console.warn('[HardwareDetector] Could not query execution providers, defaulting to CPU:', providerError.message);
            availableProviders = ['cpu'];
        }
        console.log('[HardwareDetector] Available providers:', availableProviders);

        // Determine best provider
        let provider = 'cpu';
        let deviceName = this.getCPUInfo();
        let supportsFP16 = false;
        let supportsDirectML = false;
        let supportsGPU = false;

        // Check for DirectML (AMD Ryzen AI NPU, Intel GPU, AMD GPU)
        if (availableProviders.includes('dml')) {
            supportsDirectML = true;
            provider = 'directml';
            supportsFP16 = true; // DirectML typically supports FP16
            deviceName = this.getGPUInfo();
            console.log('[HardwareDetector] DirectML acceleration available');
        }

        // Check for CUDA (NVIDIA GPU)
        if (availableProviders.includes('cuda')) {
            supportsGPU = true;
            provider = 'cuda';
            supportsFP16 = true;
            deviceName = 'NVIDIA GPU (CUDA)';
            console.log('[HardwareDetector] CUDA acceleration available');
        }

        // System info
        const totalMemoryGB = (os.totalmem() / (1024 ** 3)).toFixed(2);
        const freeMemoryGB = (os.freemem() / (1024 ** 3)).toFixed(2);

        this.detectedCapabilities = {
            provider,
            deviceName,
            supportsFP16,
            supportsDirectML,
            supportsGPU,
            availableProviders,
            system: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemoryGB: parseFloat(totalMemoryGB),
                freeMemoryGB: parseFloat(freeMemoryGB),
            }
        };

        console.log('[HardwareDetector] Detection complete:', this.detectedCapabilities);
        return this.detectedCapabilities;
    }

    /**
     * Get CPU information
     * @returns {string} CPU description
     */
    getCPUInfo() {
        const cpus = os.cpus();
        if (cpus && cpus.length > 0) {
            return `${cpus[0].model} (${cpus.length} cores)`;
        }
        return 'CPU';
    }

    /**
     * Get GPU/NPU information
     * @returns {string} GPU/NPU description
     */
    getGPUInfo() {
        // Try to detect AMD Ryzen AI or Intel iGPU
        const cpuModel = os.cpus()[0]?.model || '';
        
        if (cpuModel.includes('Ryzen')) {
            return 'AMD Ryzen AI NPU (DirectML)';
        }
        
        if (cpuModel.includes('Intel')) {
            return 'Intel Integrated Graphics (DirectML)';
        }

        return 'GPU/NPU (DirectML)';
    }

    /**
     * Get recommended execution providers for ONNX Runtime
     * @param {boolean} enableAcceleration - Whether to enable hardware acceleration
     * @returns {Array} List of execution provider configs
     */
    getRecommendedProviders(enableAcceleration = true) {
        if (!this.detectedCapabilities) {
            // Default fallback
            return [{ name: 'cpu' }];
        }

        const providers = [];

        if (enableAcceleration) {
            if (this.detectedCapabilities.supportsGPU) {
                providers.push({ name: 'cuda' });
            }
            
            if (this.detectedCapabilities.supportsDirectML) {
                providers.push({ name: 'dml' });
            }
        }

        // Always include CPU as fallback
        providers.push({ name: 'cpu' });

        return providers;
    }

    /**
     * Get current capabilities without re-detection
     * @returns {Object|null} Cached capabilities
     */
    getCapabilities() {
        return this.detectedCapabilities;
    }
}

// Export singleton instance
const hardwareDetector = new HardwareDetector();

module.exports = { hardwareDetector, HardwareDetector };

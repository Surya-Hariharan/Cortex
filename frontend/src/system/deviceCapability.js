/**
 * Device Capability Detection
 * Detects hardware capabilities and stores the result locally.
 * Runs once on first app boot / first login.
 *
 * localStorage key: "cortex-device-profile"
 */

const STORAGE_KEY = 'cortex-device-profile';

/**
 * Detect GPU availability via WebGL (works in renderer process).
 * Returns true if WebGL 2 or WebGL 1 context can be created.
 */
function detectGpu() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
            const info = gl.getExtension('WEBGL_debug_renderer_info');
            const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
            // Treat software / swiftshader as no real GPU
            if (/swiftshader|llvmpipe|software/i.test(renderer)) return false;
            return true;
        }
    } catch { /* ignore */ }
    return false;
}

/**
 * Probe ONNX runtime provider availability via Electron IPC.
 * Falls back to false if the IPC is unavailable.
 */
async function detectNpu() {
    try {
        // Ask the main process (which has access to onnxruntime-node)
        if (window.electronAPI?.getOnnxProviders) {
            const providers = await window.electronAPI.getOnnxProviders();
            // DirectML or CUDA indicate accelerator beyond plain CPU
            if (Array.isArray(providers)) {
                return providers.some(p => /directml|cuda|tensorrt|coreml/i.test(p));
            }
        }
    } catch { /* ignore */ }
    return false;
}

/**
 * Collect device capability profile.
 * Uses Node `os` module (available in Electron renderer with nodeIntegration
 * or via preload) and browser APIs for GPU detection.
 */
export async function getDeviceCapability() {
    // RAM & CPU via electronAPI (preferred) or navigator fallback
    let ramGB = 0;
    let cpuCores = 0;

    try {
        if (window.electronAPI?.getSystemInfo) {
            const info = await window.electronAPI.getSystemInfo();
            ramGB = info.ramGB ?? 0;
            cpuCores = info.cpuCores ?? 0;
        }
    } catch { /* ignore */ }

    // Fallback: navigator API (limited but available)
    if (!ramGB && navigator.deviceMemory) {
        ramGB = navigator.deviceMemory; // approximate
    }
    if (!cpuCores && navigator.hardwareConcurrency) {
        cpuCores = navigator.hardwareConcurrency;
    }

    const gpuAvailable = detectGpu();
    const npuAvailable = await detectNpu();

    return {
        ramGB,
        cpuCores,
        gpuAvailable,
        npuAvailable,
        detectedAt: new Date().toISOString(),
    };
}

/**
 * Run detection once and persist to localStorage.
 * No-ops if a profile already exists.
 * Call this after first successful login or first app boot.
 */
export async function ensureDeviceProfile() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
        try {
            return JSON.parse(existing);
        } catch { /* re-detect if corrupt */ }
    }

    try {
        const profile = await getDeviceCapability();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        return profile;
    } catch (err) {
        console.warn('[Cortex] Device capability detection failed:', err);
        return null;
    }
}

/**
 * Read the stored device profile (sync).
 */
export function getStoredDeviceProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

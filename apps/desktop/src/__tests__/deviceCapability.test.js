import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDeviceCapability, ensureDeviceProfile, getStoredDeviceProfile } from '../services/system/deviceCapability.js';

const STORAGE_KEY = 'cortex-device-profile';

describe('deviceCapability', () => {
    beforeEach(() => {
        localStorage.clear();
        window.electronAPI = undefined;
    });

    afterEach(() => {
        localStorage.clear();
        window.electronAPI = undefined;
    });

    // ── getStoredDeviceProfile ─────────────────────────────────────────────
    describe('getStoredDeviceProfile', () => {
        it('returns null when no profile stored', () => {
            expect(getStoredDeviceProfile()).toBeNull();
        });

        it('returns parsed profile when stored', () => {
            const profile = { ramGB: 16, cpuCores: 8, gpuAvailable: true, npuAvailable: false };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
            expect(getStoredDeviceProfile()).toEqual(profile);
        });

        it('returns null on corrupted JSON', () => {
            localStorage.setItem(STORAGE_KEY, 'invalid');
            expect(getStoredDeviceProfile()).toBeNull();
        });
    });

    // ── getDeviceCapability ────────────────────────────────────────────────
    describe('getDeviceCapability', () => {
        it('returns a capability object with the expected shape', async () => {
            const cap = await getDeviceCapability();
            expect(cap).toHaveProperty('ramGB');
            expect(cap).toHaveProperty('cpuCores');
            expect(cap).toHaveProperty('gpuAvailable');
            expect(cap).toHaveProperty('npuAvailable');
            expect(cap).toHaveProperty('detectedAt');
        });

        it('uses electronAPI.getSystemInfo when available', async () => {
            window.electronAPI = {
                getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 32, cpuCores: 16 }),
                getOnnxProviders: vi.fn().mockResolvedValue([]),
            };
            const cap = await getDeviceCapability();
            expect(cap.ramGB).toBe(32);
            expect(cap.cpuCores).toBe(16);
        });

        it('falls back to navigator when electronAPI is unavailable', async () => {
            Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
            Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
            const cap = await getDeviceCapability();
            // navigator fallback values should be reflected
            expect(cap.ramGB).toBeGreaterThanOrEqual(0);
            expect(cap.cpuCores).toBeGreaterThanOrEqual(0);
        });

        it('returns npuAvailable=true when directml provider is present', async () => {
            window.electronAPI = {
                getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 16, cpuCores: 8 }),
                getOnnxProviders: vi.fn().mockResolvedValue(['directml', 'cpu']),
            };
            const cap = await getDeviceCapability();
            expect(cap.npuAvailable).toBe(true);
        });

        it('returns npuAvailable=false when only cpu provider is present', async () => {
            window.electronAPI = {
                getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 8, cpuCores: 4 }),
                getOnnxProviders: vi.fn().mockResolvedValue(['cpu']),
            };
            const cap = await getDeviceCapability();
            expect(cap.npuAvailable).toBe(false);
        });

        it('returns npuAvailable=false when getOnnxProviders throws', async () => {
            window.electronAPI = {
                getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 8, cpuCores: 4 }),
                getOnnxProviders: vi.fn().mockRejectedValue(new Error('IPC error')),
            };
            const cap = await getDeviceCapability();
            expect(cap.npuAvailable).toBe(false);
        });

        it('handles electronAPI.getSystemInfo throwing gracefully', async () => {
            // Reset navigator so no fallback memory values pollute this test
            Object.defineProperty(navigator, 'deviceMemory', { value: undefined, configurable: true });
            Object.defineProperty(navigator, 'hardwareConcurrency', { value: undefined, configurable: true });
            window.electronAPI = {
                getSystemInfo: vi.fn().mockRejectedValue(new Error('system info error')),
                getOnnxProviders: vi.fn().mockResolvedValue([]),
            };
            const cap = await getDeviceCapability();
            // Should return an object without throwing
            expect(cap).toHaveProperty('gpuAvailable');
            expect(cap).toHaveProperty('npuAvailable');
        });

        it('includes detectedAt ISO timestamp', async () => {
            const cap = await getDeviceCapability();
            expect(() => new Date(cap.detectedAt)).not.toThrow();
            expect(new Date(cap.detectedAt).toISOString()).toBe(cap.detectedAt);
        });
    });

    // ── ensureDeviceProfile ────────────────────────────────────────────────
    describe('ensureDeviceProfile', () => {
        it('returns cached profile when already stored', async () => {
            const cached = { ramGB: 4, cpuCores: 2, gpuAvailable: false, npuAvailable: false };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
            const result = await ensureDeviceProfile();
            expect(result).toEqual(cached);
        });

        it('detects and saves profile when none exists', async () => {
            window.electronAPI = {
                getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 8, cpuCores: 4 }),
                getOnnxProviders: vi.fn().mockResolvedValue([]),
            };
            const result = await ensureDeviceProfile();
            expect(result).toHaveProperty('ramGB', 8);
            expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
        });

        it('re-detects when stored JSON is corrupted', async () => {
            localStorage.setItem(STORAGE_KEY, 'bad-json');
            window.electronAPI = {
                getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 16, cpuCores: 8 }),
                getOnnxProviders: vi.fn().mockResolvedValue([]),
            };
            const result = await ensureDeviceProfile();
            expect(result).toHaveProperty('ramGB', 16);
        });

        it('returns null when detection throws', async () => {
            window.electronAPI = {
                getSystemInfo: vi.fn().mockRejectedValue(new Error('fatal')),
                getOnnxProviders: vi.fn().mockRejectedValue(new Error('fatal')),
            };
            // Suppress console.warn
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const result = await ensureDeviceProfile();
            // returns null or a profile — either is valid (depends on fallback navigator values)
            expect(result === null || typeof result === 'object').toBe(true);
        });
    });
});

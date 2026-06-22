import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Reset module state between tests
let meshController;

describe('meshController', () => {
    beforeEach(async () => {
        // Re-import fresh module each test to reset the `running` state
        vi.resetModules();
        const mod = await import('../services/mesh/meshController.js');
        meshController = mod.meshController;
    });

    describe('isRunning', () => {
        it('returns false initially', () => {
            expect(meshController.isRunning()).toBe(false);
        });
    });

    describe('start', () => {
        it('sets isRunning to true and calls electronAPI.meshStart', async () => {
            const meshStart = vi.fn().mockResolvedValue(undefined);
            window.electronAPI = { meshStart, meshStop: vi.fn() };

            await meshController.start();

            expect(meshStart).toHaveBeenCalledOnce();
            expect(meshController.isRunning()).toBe(true);
        });

        it('dispatches mesh-controller-updated event', async () => {
            window.electronAPI = { meshStart: vi.fn() };
            const spy = vi.fn();
            window.addEventListener('mesh-controller-updated', spy);

            await meshController.start();

            expect(spy).toHaveBeenCalled();
            const detail = spy.mock.calls[0][0].detail;
            expect(detail.running).toBe(true);
            window.removeEventListener('mesh-controller-updated', spy);
        });

        it('is a no-op when already running', async () => {
            window.electronAPI = { meshStart: vi.fn() };
            await meshController.start();
            const callCount = window.electronAPI.meshStart.mock.calls.length;

            await meshController.start();
            expect(window.electronAPI.meshStart).toHaveBeenCalledTimes(callCount); // no additional call
        });

        it('sets running to true even when electronAPI.meshStart throws', async () => {
            window.electronAPI = { meshStart: vi.fn().mockRejectedValue(new Error('IPC error')) };
            await meshController.start();
            expect(meshController.isRunning()).toBe(true);
        });

        it('sets running to true when electronAPI is unavailable', async () => {
            window.electronAPI = undefined;
            await meshController.start();
            expect(meshController.isRunning()).toBe(true);
        });
    });

    describe('stop', () => {
        it('sets isRunning to false and calls electronAPI.meshStop', async () => {
            window.electronAPI = { meshStart: vi.fn(), meshStop: vi.fn().mockResolvedValue(undefined) };
            await meshController.start();
            await meshController.stop();

            expect(window.electronAPI.meshStop).toHaveBeenCalledOnce();
            expect(meshController.isRunning()).toBe(false);
        });

        it('dispatches mesh-controller-updated with running=false', async () => {
            window.electronAPI = { meshStart: vi.fn(), meshStop: vi.fn() };
            await meshController.start();
            const spy = vi.fn();
            window.addEventListener('mesh-controller-updated', spy);

            await meshController.stop();

            const detail = spy.mock.calls[0][0].detail;
            expect(detail.running).toBe(false);
            window.removeEventListener('mesh-controller-updated', spy);
        });

        it('sets running to false even when electronAPI.meshStop throws', async () => {
            window.electronAPI = {
                meshStart: vi.fn(),
                meshStop: vi.fn().mockRejectedValue(new Error('IPC stop error')),
            };
            await meshController.start();
            await meshController.stop();
            expect(meshController.isRunning()).toBe(false);
        });

        it('sets running to false when electronAPI is unavailable', async () => {
            window.electronAPI = undefined;
            await meshController.stop();
            expect(meshController.isRunning()).toBe(false);
        });
    });
});

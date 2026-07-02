import React, { useState, useEffect } from 'react';
import { GraduationCap, ArrowRight, WifiOff, Radio, Loader2 } from 'lucide-react';
import WindowControls from '../layout/WindowControls';
import { hasLocalIdentity, getValidatedLocalIdentity, setMeshConsent } from '../../../services/offline/offlineIdentity.js';
import { useMeshDiscovery } from '../../hooks/useMeshDiscovery.js';
import { auth as authApi } from '../../../services/api.js';
import { ensureDeviceProfile } from '../../../services/system/deviceCapability.js';
import { SignIn, SignUp, useAuth, useUser } from '@clerk/clerk-react';

export default function AuthPortal({ onAuthSuccess }) {
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
    const [error, setError] = useState('');
    const [syncing, setSyncing] = useState(false);
    
    const { isLoaded, isSignedIn, getToken } = useAuth();
    const { user } = useUser();

    // ── Offline login detection ──────────────────────────────────────────────
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const canContinueOffline = isOffline && hasLocalIdentity();
    const canContinueGuest = isOffline && !hasLocalIdentity();
    const { nearbyPeers, isMeshAvailable } = useMeshDiscovery();

    useEffect(() => {
        const check = () => setIsOffline(!navigator.onLine);
        window.addEventListener('online', check);
        window.addEventListener('offline', check);
        return () => {
            window.removeEventListener('online', check);
            window.removeEventListener('offline', check);
        };
    }, []);

    const handleContinueOffline = async () => {
        const identity = await getValidatedLocalIdentity();
        if (!identity) return;
        const rawProfile = localStorage.getItem('cortex-auth-profile');
        const profile = rawProfile ? JSON.parse(rawProfile) : { name: identity.displayName, email: identity.email };
        localStorage.setItem('cortex-auth-session', 'active');
        onAuthSuccess?.(profile, 'OFFLINE');
    };

    const handleContinueGuest = () => {
        const guestProfile = {
            id: `guest-${Date.now()}`,
            name: 'Guest User',
            email: 'guest@local.cortex',
            guest: true,
            cloudSyncEnabled: false,
            meshSharingEnabled: false,
        };
        localStorage.setItem('cortex-guest-session', JSON.stringify({ startedAt: new Date().toISOString(), userId: guestProfile.id }));
        localStorage.setItem('cortex-auth-profile', JSON.stringify(guestProfile));
        localStorage.setItem('cortex-auth-session', 'active');
        localStorage.setItem('cortex-cloud-sync-enabled', 'false');
        setMeshConsent(false);
        onAuthSuccess?.(guestProfile, 'OFFLINE');
    };

    async function buildDevicePayload() {
        const profile = await ensureDeviceProfile();
        let fingerprint = localStorage.getItem('cortex-device-fingerprint');
        if (!fingerprint) {
            const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
            fingerprint = `cortex-${uid}`;
            localStorage.setItem('cortex-device-fingerprint', fingerprint);
        }
        return {
            fingerprint,
            ram: profile?.ramGB ?? null,
            cpu: profile?.cpuCores ?? null,
            gpu: profile?.gpuAvailable ?? null,
            npu: profile?.npuAvailable ?? null,
        };
    }

    // When Clerk successfully authenticates, sync the device with our backend
    useEffect(() => {
        async function syncSession() {
            if (isLoaded && isSignedIn && user && !syncing) {
                setSyncing(true);
                try {
                    const token = await getToken();
                    // Call our backend to register the device and init session
                    const res = await authApi.initSession({
                        device: await buildDevicePayload()
                    }, token);

                    const profile = {
                        id: user.id,
                        name: user.fullName || user.firstName || 'Cortex User',
                        email: user.primaryEmailAddress?.emailAddress,
                    };
                    
                    localStorage.setItem('cortex-auth-profile', JSON.stringify(profile));
                    localStorage.setItem('cortex-auth-session', 'active');
                    localStorage.setItem('cortex-auth-redirect', 'workspace');
                    onAuthSuccess?.(profile, 'ONLINE');
                } catch (err) {
                    console.error('Failed to sync session with backend', err);
                    setError('Failed to initialize session. Please check your connection.');
                    setSyncing(false);
                }
            }
        }
        syncSession();
    }, [isLoaded, isSignedIn, user, getToken, onAuthSuccess]);

    return (
        <div className="min-h-screen w-full bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(14,116,144,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(21,128,61,0.2),transparent_30%),linear-gradient(180deg,#020617_0%,#0b1220_45%,#020617_100%)] flex items-center justify-center p-4">
            <div className="fixed top-0 right-0 z-[9999]" style={{ WebkitAppRegion: 'no-drag' }}>
                <WindowControls />
            </div>
            
            {syncing ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 size={32} className="animate-spin text-synapse-500" />
                    <p className="text-slate-600 dark:text-dark-300 font-medium">Initializing your workspace...</p>
                </div>
            ) : (
                <div className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
                    <section className="rounded-3xl border border-white/40 dark:border-dark-700/70 bg-white/70 dark:bg-dark-900/70 backdrop-blur-md shadow-2xl p-8 lg:p-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-synapse-50 text-synapse-700 dark:bg-synapse-900/40 dark:text-synapse-300 border border-synapse-200/60 dark:border-synapse-700/60">
                            <GraduationCap size={14} />
                            Cortex Student Network
                        </div>
                        <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-dark-50 leading-[1.05]">
                            Learn locally. Sync globally.
                        </h1>
                        <p className="mt-4 text-sm md:text-base text-slate-600 dark:text-dark-300 max-w-xl leading-relaxed">
                            Join Cortex with your student profile and unlock AI-powered study workflows, offline-first notes, and collaborative campus intelligence.
                        </p>

                        <div className="mt-8 grid sm:grid-cols-2 gap-4">
                            <div className="rounded-2xl p-4 bg-white/70 dark:bg-dark-800/80 border border-slate-200/70 dark:border-dark-700/70">
                                <p className="text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-dark-400">Profile Aware</p>
                                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-dark-100">Course-specific insights and campus context.</p>
                            </div>
                            <div className="rounded-2xl p-4 bg-white/70 dark:bg-dark-800/80 border border-slate-200/70 dark:border-dark-700/70">
                                <p className="text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-dark-400">Secure Access</p>
                                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-dark-100">Your account and identity are protected by industry-leading security.</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/40 dark:border-dark-700/70 bg-white/85 dark:bg-dark-900/85 backdrop-blur-md shadow-2xl p-6 md:p-7 flex flex-col justify-center items-center">
                        <div className="w-full flex justify-center mb-4">
                            {mode === 'signin' ? (
                                <SignIn routing="hash" signUpUrl="/sign-up" />
                            ) : (
                                <SignUp routing="hash" signInUrl="/sign-in" />
                            )}
                        </div>

                        {error && <p className="text-sm font-medium text-red-500 mb-4">{error}</p>}

                        <div className="w-full max-w-md mt-4 space-y-3">
                            {/* Offline Login */}
                            {canContinueOffline && (
                                <button
                                    type="button"
                                    onClick={handleContinueOffline}
                                    className="w-full rounded-xl border border-slate-300 dark:border-dark-600 bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-dark-200 py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors hover:bg-slate-100 dark:hover:bg-dark-700"
                                >
                                    <WifiOff size={15} /> Continue Offline
                                </button>
                            )}

                            {canContinueGuest && (
                                <button
                                    type="button"
                                    onClick={handleContinueGuest}
                                    className="w-full rounded-xl border border-slate-300 dark:border-dark-600 bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-dark-200 py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors hover:bg-slate-100 dark:hover:bg-dark-700"
                                >
                                    <WifiOff size={15} /> Continue in Guest Mode
                                </button>
                            )}

                            {/* Mesh Discovery Indicator */}
                            {isOffline && isMeshAvailable && (
                                <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1.5">
                                    <Radio size={13} className="animate-pulse" />
                                    {nearbyPeers.length} nearby peer{nearbyPeers.length !== 1 ? 's' : ''} detected.
                                </p>
                            )}
                            
                            <div className="flex justify-center text-sm pt-2 border-t border-slate-200 dark:border-dark-700">
                                <button
                                    type="button"
                                    className="text-slate-500 dark:text-dark-400 font-semibold hover:text-slate-800 dark:hover:text-dark-100"
                                    onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                                >
                                    {mode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

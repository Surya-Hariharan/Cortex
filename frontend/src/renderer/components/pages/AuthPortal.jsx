import React, { useMemo, useState, useRef, useEffect, useCallback, memo } from 'react';
import { ArrowRight, ChevronDown, GraduationCap, Lock, Mail, School, UserCircle2, Check, Eye, EyeOff, Loader2, WifiOff, Radio } from 'lucide-react';
import WindowControls from '../layout/WindowControls';
import { hasLocalIdentity, getValidatedLocalIdentity, setMeshConsent } from '../../../offline/offlineIdentity.js';
import { useMeshDiscovery } from '../../../mesh/useMeshDiscovery.js';
import { auth as authApi, reference as referenceApi } from '../../../services/api.js';
import { saveTokens } from '../../../services/storage/tokenStore.js';
import { ensureDeviceProfile } from '../../../system/deviceCapability.js';

const SelectField = memo(function SelectField({ label, value, onChange, options, disabled = false, placeholder = 'Select' }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="block space-y-1.5" ref={dropdownRef}>
            <span className="block text-xs font-semibold tracking-wide text-slate-500 dark:text-dark-400 uppercase">{label}</span>
            <div className="relative">
                <div
                    onClick={(e) => {
                        e.preventDefault();
                        if (!disabled) setIsOpen(!isOpen);
                    }}
                    onKeyDown={(e) => {
                        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            setIsOpen(!isOpen);
                        }
                    }}
                    className={`w-full relative flex items-center rounded-xl border bg-slate-50 dark:bg-dark-950 px-3 py-2.5 pr-10 text-sm font-semibold transition-all focus-within:border-synapse-400 focus-within:ring-2 focus-within:ring-synapse-500/20 ${disabled ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-dark-700' : 'cursor-pointer border-slate-200 dark:border-dark-700'}`}
                >
                    <input
                        type="text"
                        readOnly
                        value={value || ''}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={`w-full bg-transparent outline-none cursor-pointer text-slate-700 dark:text-dark-100 text-ellipsis ${value ? '' : 'placeholder-slate-400 dark:placeholder-dark-500'}`}
                    />
                    <ChevronDown
                        size={15}
                        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>

                {isOpen && !disabled && (
                    <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden py-1 max-h-60 overflow-y-auto scrollbar-thin">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-dark-800 ${!value ? 'text-synapse-600 dark:text-synapse-400 font-bold bg-slate-50 dark:bg-dark-900/50' : 'text-slate-600 dark:text-dark-300 font-medium'}`}
                        >
                            {placeholder}
                        </button>
                        {options.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-dark-800 ${value === opt ? 'text-synapse-600 dark:text-synapse-400 font-bold bg-slate-50 dark:bg-dark-900/50' : 'text-slate-700 dark:text-dark-100 font-medium'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

const InputField = memo(function InputField({ label, value, onChange, type = 'text', placeholder = '' }) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
        <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-dark-400 uppercase">{label}</span>
            <div className="relative">
                <input
                    type={inputType}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full rounded-xl border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-dark-100 placeholder-slate-400 dark:placeholder-dark-500 outline-none focus:ring-2 focus:ring-synapse-500/30 ${isPassword ? 'pr-10' : ''}`}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-dark-400 dark:hover:text-dark-200 transition-colors"
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
        </label>
    );
});

export default function AuthPortal({ onAuthSuccess }) {
    const [mode, setMode] = useState('signin');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [referencesLoading, setReferencesLoading] = useState(false);
    const [dependentOptionsLoading, setDependentOptionsLoading] = useState(false);
    const [referencesError, setReferencesError] = useState('');
    const [districts, setDistricts] = useState([]);
    const [degrees, setDegrees] = useState([]);
    const [colleges, setColleges] = useState([]);
    const [courses, setCourses] = useState([]);

    // ── Offline login detection ──────────────────────────────────────────────
    const [isOffline, setIsOffline] = useState(false);
    const canContinueOffline = isOffline && hasLocalIdentity();
    const canContinueGuest = isOffline && !hasLocalIdentity();
    const { nearbyPeers, isMeshAvailable } = useMeshDiscovery();

    useEffect(() => {
        const check = () => setIsOffline(!navigator.onLine);
        check();
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

        // Restore profile from localStorage and login in OFFLINE mode
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

        localStorage.setItem('cortex-guest-session', JSON.stringify({
            startedAt: new Date().toISOString(),
            userId: guestProfile.id,
        }));
        localStorage.setItem('cortex-auth-profile', JSON.stringify(guestProfile));
        localStorage.setItem('cortex-auth-session', 'active');
        localStorage.setItem('cortex-cloud-sync-enabled', 'false');
        setMeshConsent(false);
        onAuthSuccess?.(guestProfile, 'OFFLINE');
    };

    const [signinEmail, setSigninEmail] = useState('');
    const [signinPassword, setSigninPassword] = useState('');

    const [resetEmail, setResetEmail] = useState('');
    const [resetOtp, setResetOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [form, setForm] = useState({
        name: '',
        gender: '',
        phone: '',
        email: '',
        location: '',
        college: '',
        userType: 'Student',
        yearOfStudy: '',
        degree: '',
        course: '',
        password: '',
        confirmPassword: '',
    });

    const districtByName = useMemo(
        () => new Map(districts.map((item) => [item.name, item.id])),
        [districts]
    );

    const degreeByName = useMemo(
        () => new Map(degrees.map((item) => [item.name, item.id])),
        [degrees]
    );

    const collegeByName = useMemo(
        () => new Map(colleges.map((item) => [item.name, item.id])),
        [colleges]
    );

    const courseByName = useMemo(
        () => new Map(courses.map((item) => [item.name, item.id])),
        [courses]
    );

    const districtOptions = useMemo(() => districts.map((item) => item.name), [districts]);
    const degreeOptions = useMemo(() => degrees.map((item) => item.name), [degrees]);

    useEffect(() => {
        let active = true;
        async function fetchBaseReferences() {
            setReferencesLoading(true);
            setReferencesError('');

            try {
                const [districtRows, degreeRows] = await Promise.all([
                    referenceApi.districts(),
                    referenceApi.degrees(),
                ]);
                if (!active) return;
                setDistricts(Array.isArray(districtRows) ? districtRows : []);
                setDegrees(Array.isArray(degreeRows) ? degreeRows : []);
            } catch {
                if (!active) return;
                setReferencesError('Could not load reference data from server.');
                setDistricts([]);
                setDegrees([]);
            } finally {
                if (active) setReferencesLoading(false);
            }
        }

        fetchBaseReferences();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        async function fetchColleges() {
            const districtId = districtByName.get(form.location);
            if (!districtId) {
                setColleges([]);
                return;
            }

            try {
                setDependentOptionsLoading(true);
                const rows = await referenceApi.colleges(districtId);
                if (!active) return;
                setColleges(Array.isArray(rows) ? rows : []);
            } catch {
                if (!active) return;
                setColleges([]);
            } finally {
                if (active) setDependentOptionsLoading(false);
            }
        }

        fetchColleges();
        return () => {
            active = false;
        };
    }, [form.location, districtByName]);

    useEffect(() => {
        let active = true;
        async function fetchCourses() {
            const degreeId = degreeByName.get(form.degree);
            if (!degreeId) {
                setCourses([]);
                return;
            }

            try {
                setDependentOptionsLoading(true);
                const rows = await referenceApi.courses(degreeId);
                if (!active) return;
                setCourses(Array.isArray(rows) ? rows : []);
            } catch {
                if (!active) return;
                setCourses([]);
            } finally {
                if (active) setDependentOptionsLoading(false);
            }
        }

        fetchCourses();
        return () => {
            active = false;
        };
    }, [form.degree, degreeByName]);

    const availableColleges = useMemo(() => {
        if (!form.location) return [];
        return colleges.map((item) => item.name).sort((a, b) => a.localeCompare(b));
    }, [form.location, colleges]);

    const availableCourses = useMemo(() => {
        if (!form.degree) return [];
        return courses.map((item) => item.name).sort((a, b) => a.localeCompare(b));
    }, [form.degree, courses]);

    const yearOptions = useMemo(() => {
        if (form.userType === 'Alumni') {
            const currentYear = new Date().getFullYear();
            return Array.from({ length: 30 }, (_, i) => String(currentYear - i));
        }
        return ['1', '2', '3', '4', '5'];
    }, [form.userType]);

    const switchMode = (nextMode) => {
        if (nextMode === mode) return;
        setError('');
        setSuccessMsg('');
        setMode(nextMode);
    };

    const updateForm = useCallback((field, value) => {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'location') next.college = '';
            if (field === 'degree') next.course = '';
            if (field === 'userType') next.yearOfStudy = '';
            return next;
        });
    }, []);

    const toGenderValue = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'prefer not to say') return 'prefer_not_to_say';
        return normalized;
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

    async function handleRegister(e) {
        e.preventDefault();
        setError('');

        const required = [
            'name', 'gender', 'phone', 'email', 'location',
            'college', 'userType', 'yearOfStudy', 'degree', 'course', 'password', 'confirmPassword'
        ];
        const missing = required.find((k) => !form[k]);
        if (missing) {
            setError('Please fill all required fields.');
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
        if (!emailOk) {
            setError('Please enter a valid email.');
            return;
        }

        const districtId = districtByName.get(form.location);
        const collegeId = collegeByName.get(form.college);
        const degreeId = degreeByName.get(form.degree);
        const courseId = courseByName.get(form.course);

        if (!districtId || !collegeId || !degreeId || !courseId) {
            setError('Please select valid district, college, degree and course from server data.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                email: form.email,
                password: form.password,
                full_name: form.name,
                gender: toGenderValue(form.gender),
                district_id: districtId,
                college_id: collegeId,
                student_status: form.userType === 'Alumni' ? 'alumni' : 'student',
                year_of_study: form.userType === 'Student' ? Number(form.yearOfStudy) : null,
                graduation_year: form.userType === 'Alumni' ? Number(form.yearOfStudy) : null,
                degree_id: degreeId,
                course_id: courseId,
                device: await buildDevicePayload(),
            };

            const res = await authApi.signup(payload);
            const profile = {
                ...res.user,
                name: res.user?.full_name || form.name,
                email: res.user?.email || form.email,
            };

            saveTokens(res.accessToken || '', res.refreshToken || '');
            localStorage.setItem('cortex-auth-profile', JSON.stringify(profile));
            localStorage.setItem('cortex-auth-session', 'active');
            localStorage.setItem('cortex-auth-redirect', 'workspace');
            onAuthSuccess?.(profile, 'ONLINE');
        } catch (err) {
            if (err?.networkError) {
                setError('Cannot reach the server. Please try again when connected.');
                return;
            }

            setError(err?.data?.error || err?.data?.detail || err?.message || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSignIn(e) {
        e.preventDefault();
        setError('');

        if (!signinEmail || !signinPassword) {
            setError('Enter your email and password.');
            return;
        }

        setLoading(true);
        try {
            const res = await authApi.login({
                email: signinEmail.trim(),
                password: signinPassword,
                device: await buildDevicePayload(),
            });

            const profile = {
                ...res.user,
                name: res.user?.full_name || res.user?.name || 'Cortex User',
            };

            saveTokens(res.accessToken || '', res.refreshToken || '');
            localStorage.setItem('cortex-auth-profile', JSON.stringify(profile));
            localStorage.setItem('cortex-auth-session', 'active');
            localStorage.setItem('cortex-auth-redirect', 'workspace');

            if (profile.must_change_password) {
                setResetEmail(signinEmail);
                setSuccessMsg('Your password must be changed. Check your email for a reset code.');
                switchMode('forgot_otp');
                return;
            }
            onAuthSuccess?.(profile, 'ONLINE');
        } catch (err) {
            if (err?.networkError) {
                setError('Cannot reach the server. Please ensure the app is fully started.');
                return;
            }

            setError(err?.data?.error || err?.data?.detail || err?.message || 'Invalid credentials.');
        } finally {
            setLoading(false);
        }
    }

    async function handleForgotPassword(e) {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!resetEmail) {
            setError('Please enter your email.');
            return;
        }

        setLoading(true);
        try {
            const res = await window.electronAPI?.authForgotPassword({
                email: resetEmail.trim(),
            });

            if (!res || res.status === 0) {
                setError('Cannot reach the server. Please ensure the app is fully started.');
                return;
            }

            // Always 200 from backend (enumeration prevention) — move to OTP entry
            setSuccessMsg(res.data?.message || 'Check your email for the reset code.');
            switchMode('forgot_otp');
        } catch {
            setError('Cannot reach the server. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    async function handleResetWithOtp(e) {
        e.preventDefault();
        setError('');

        if (!resetOtp || resetOtp.length !== 8) {
            setError('Please enter the 8-character code from your email.');
            return;
        }
        if (!newPassword || newPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await window.electronAPI?.authResetPassword({
                token: resetOtp.toUpperCase().trim(),
                new_password: newPassword,
            });

            if (!res || res.status === 0) {
                setError('Cannot reach the server. Please ensure the app is fully started.');
                return;
            }

            if (res.status === 200) {
                setResetOtp('');
                setNewPassword('');
                setConfirmPassword('');
                setSuccessMsg(res.data?.message || 'Password reset! You can now log in.');
                setSigninEmail(resetEmail);
                switchMode('reset_success');
            } else {
                setError(res.data?.detail || 'Reset failed. Check your code and try again.');
            }
        } catch {
            setError('Cannot reach the server. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen w-full bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(14,116,144,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(21,128,61,0.2),transparent_30%),linear-gradient(180deg,#020617_0%,#0b1220_45%,#020617_100%)] flex items-center justify-center p-4">
            <div className="fixed top-0 right-0 z-[9999]" style={{ WebkitAppRegion: 'no-drag' }}>
                <WindowControls />
            </div>
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
                            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-dark-100">Your account and identity are protected by local auth flow.</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/40 dark:border-dark-700/70 bg-white/85 dark:bg-dark-900/85 backdrop-blur-md shadow-2xl p-6 md:p-7">
                    <div className="flex rounded-xl bg-slate-100 dark:bg-dark-800 p-1 mb-5">
                        <button
                            onClick={() => switchMode('signin')}
                            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${mode === 'signin' ? 'bg-white dark:bg-dark-700 text-synapse-600 dark:text-synapse-300 shadow-sm' : 'text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-100'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => switchMode('register')}
                            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${mode === 'register' ? 'bg-white dark:bg-dark-700 text-synapse-600 dark:text-synapse-300 shadow-sm' : 'text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-100'}`}
                        >
                            Create Account
                        </button>
                    </div>

                    {successMsg && (
                        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-semibold rounded-xl text-center">
                            {successMsg}
                        </div>
                    )}

                    <div key={mode} className="animate-fade-in [animation-duration:180ms] [transform:translateZ(0)] will-change-transform">
                        {mode === 'signin' && (
                            <form className="space-y-4" onSubmit={handleSignIn}>
                                <div className="flex items-center gap-2 text-slate-800 dark:text-dark-100 font-bold text-lg">
                                    <UserCircle2 size={18} />
                                    Welcome Back
                                </div>
                                <InputField label="Gmail" value={signinEmail} onChange={setSigninEmail} type="email" placeholder="yourname@gmail.com" />
                                <InputField label="Password" value={signinPassword} onChange={setSigninPassword} type="password" placeholder="Enter password" />

                                <div className="flex items-center justify-between text-sm">
                                    <button type="button" onClick={() => switchMode('forgot_password')} className="text-synapse-600 dark:text-synapse-300 font-semibold hover:underline">Forgot Password</button>
                                    <button
                                        type="button"
                                        className="text-slate-500 dark:text-dark-400 font-semibold hover:text-slate-800 dark:hover:text-dark-100"
                                        onClick={() => switchMode('register')}
                                    >
                                        New to Cortex? Create Account
                                    </button>
                                </div>

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" className="w-full rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    Login <ArrowRight size={16} />
                                </button>

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
                            </form>
                        )}

                        {mode === 'register' && (
                            <form className="space-y-4 max-h-[72vh] overflow-y-auto pr-1 scrollbar-thin" onSubmit={handleRegister}>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {referencesLoading && (
                                        <div className="sm:col-span-2 text-xs font-semibold text-slate-500 dark:text-dark-400 inline-flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" />
                                            Loading district, degree, college and course data...
                                        </div>
                                    )}
                                    {referencesError && (
                                        <div className="sm:col-span-2 text-xs font-semibold text-red-500">
                                            {referencesError}
                                        </div>
                                    )}
                                    {dependentOptionsLoading && (
                                        <div className="sm:col-span-2 text-xs font-semibold text-slate-500 dark:text-dark-400 inline-flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" />
                                            Updating colleges and courses...
                                        </div>
                                    )}
                                    <InputField label="Name" value={form.name} onChange={(v) => updateForm('name', v)} placeholder="Full name" />
                                    <SelectField label="Gender" value={form.gender} onChange={(v) => updateForm('gender', v)} options={['Male', 'Female', 'Other', 'Prefer not to say']} />
                                    <InputField label="Phone Number" value={form.phone} onChange={(v) => updateForm('phone', v)} placeholder="10-digit mobile" />
                                    <InputField label="Personal Email" value={form.email} onChange={(v) => updateForm('email', v)} type="email" placeholder="name@gmail.com" />
                                    <SelectField label="Location" value={form.location} onChange={(v) => updateForm('location', v)} options={districtOptions} disabled={referencesLoading || districtOptions.length === 0} placeholder="Select district" />
                                    <SelectField label="College" value={form.college} onChange={(v) => updateForm('college', v)} options={availableColleges} disabled={!form.location || referencesLoading || dependentOptionsLoading} placeholder={form.location ? 'Select college' : 'Select location first'} />
                                    <SelectField label="Student / Alumni" value={form.userType} onChange={(v) => updateForm('userType', v)} options={['Student', 'Alumni']} />
                                    <SelectField label={form.userType === 'Alumni' ? 'Graduation Year' : 'Year of Study'} value={form.yearOfStudy} onChange={(v) => updateForm('yearOfStudy', v)} options={yearOptions} />
                                    <SelectField label="Degree" value={form.degree} onChange={(v) => updateForm('degree', v)} options={degreeOptions} disabled={referencesLoading || degreeOptions.length === 0} placeholder="Select degree" />
                                    <SelectField label="Course" value={form.course} onChange={(v) => updateForm('course', v)} options={availableCourses} disabled={!form.degree || referencesLoading || dependentOptionsLoading} placeholder={form.degree ? 'Select course' : 'Select degree first'} />
                                    <InputField label="Password" value={form.password} onChange={(v) => updateForm('password', v)} type="password" placeholder="Create password" />
                                    <InputField label="Confirm Password" value={form.confirmPassword} onChange={(v) => updateForm('confirmPassword', v)} type="password" placeholder="Confirm password" />
                                </div>

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" className="w-full rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    Create Account <ArrowRight size={16} />
                                </button>
                            </form>
                        )}

                        {mode === 'forgot_password' && (
                            <form className="space-y-4" onSubmit={handleForgotPassword}>
                                <div className="flex items-center gap-2 text-slate-800 dark:text-dark-100 font-bold text-lg mb-2">
                                    <Lock size={18} />
                                    Reset Password
                                </div>
                                <p className="text-sm text-slate-500 dark:text-dark-400">Enter your registered email. We'll send an 8-character reset code valid for 15 minutes.</p>

                                <InputField label="Registered Email" value={resetEmail} onChange={setResetEmail} type="email" placeholder="name@gmail.com" />

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" disabled={loading} className="w-full mt-2 rounded-xl bg-synapse-600 hover:bg-synapse-700 disabled:opacity-60 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Send Reset Code <ArrowRight size={16} />
                                </button>

                                <div className="text-center mt-4 pt-2">
                                    <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-dark-100 transition-colors" onClick={() => switchMode('signin')}>
                                        Back to Sign In
                                    </button>
                                </div>
                            </form>
                        )}

                        {mode === 'forgot_otp' && (
                            <form className="space-y-4" onSubmit={handleResetWithOtp}>
                                <div className="flex items-center gap-2 text-slate-800 dark:text-dark-100 font-bold text-lg mb-2">
                                    <Lock size={18} />
                                    Enter Reset Code
                                </div>
                                <p className="text-sm text-slate-500 dark:text-dark-400">
                                    Enter the 8-character code sent to <strong>{resetEmail || 'your email'}</strong> and choose a new password.
                                </p>

                                <label className="block space-y-1.5">
                                    <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-dark-400 uppercase">Reset Code</span>
                                    <input
                                        type="text"
                                        value={resetOtp}
                                        onChange={e => setResetOtp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                                        placeholder="e.g. AB3K9PQR"
                                        maxLength={8}
                                        className="w-full rounded-xl border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-3 py-2.5 text-sm font-mono font-bold tracking-[0.2em] text-slate-800 dark:text-dark-100 placeholder-slate-400 dark:placeholder-dark-500 outline-none focus:ring-2 focus:ring-synapse-500/30 uppercase"
                                    />
                                </label>

                                <InputField label="New Password" value={newPassword} onChange={setNewPassword} type="password" placeholder="Min 8 characters" />
                                <InputField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Repeat new password" />

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" disabled={loading} className="w-full mt-2 rounded-xl bg-synapse-600 hover:bg-synapse-700 disabled:opacity-60 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Set New Password <ArrowRight size={16} />
                                </button>

                                <div className="flex justify-between mt-2 text-sm">
                                    <button type="button" className="font-semibold text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-dark-100 transition-colors" onClick={() => switchMode('forgot_password')}>
                                        ← Resend Code
                                    </button>
                                    <button type="button" className="font-semibold text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-dark-100 transition-colors" onClick={() => switchMode('signin')}>
                                        Back to Sign In
                                    </button>
                                </div>
                            </form>
                        )}

                        {mode === 'reset_success' && (
                            <div className="text-center py-6 space-y-4">
                                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800/60 shadow-inner">
                                    <Check size={32} strokeWidth={3} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-dark-50 tracking-tight">Password Reset Complete</h2>
                                <p className="text-slate-500 dark:text-dark-400 max-w-sm mx-auto leading-relaxed">
                                    Your Cortex account password has been successfully updated in your local profile. You can now securely log in with your new credentials.
                                </p>
                                <button
                                    onClick={() => switchMode('signin')}
                                    className="mt-6 inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold transition-colors shadow-sm"
                                >
                                    Click here to log in <ArrowRight size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-dark-700 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-slate-50 dark:bg-dark-800 p-2">
                            <Mail size={14} className="mx-auto mb-1 text-synapse-500" />
                            <p className="text-[11px] font-bold text-slate-600 dark:text-dark-300">Campus Email</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-dark-800 p-2">
                            <School size={14} className="mx-auto mb-1 text-synapse-500" />
                            <p className="text-[11px] font-bold text-slate-600 dark:text-dark-300">College Mapped</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-dark-800 p-2">
                            <Lock size={14} className="mx-auto mb-1 text-synapse-500" />
                            <p className="text-[11px] font-bold text-slate-600 dark:text-dark-300">Secure Access</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

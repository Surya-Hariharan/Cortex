import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, GraduationCap, Lock, Mail, School, UserCircle2 } from 'lucide-react';
import WindowControls from '../layout/WindowControls';

const DISTRICTS_TN = [
    'Ariyalur',
    'Chengalpattu',
    'Chennai',
    'Coimbatore',
    'Cuddalore',
    'Dharmapuri',
    'Dindigul',
    'Erode',
    'Kallakurichi',
    'Kancheepuram',
    'Kanniyakumari',
    'Karur',
    'Krishnagiri',
    'Madurai',
    'Mayiladuthurai',
    'Nagapattinam',
    'Namakkal',
    'Nilgiris',
    'Perambalur',
    'Pudukkottai',
    'Ramanathapuram',
    'Ranipet',
    'Salem',
    'Sivaganga',
    'Tenkasi',
    'Thanjavur',
    'Theni',
    'Thoothukudi',
    'Tiruchirappalli',
    'Tirunelveli',
    'Tirupathur',
    'Tiruppur',
    'Tiruvallur',
    'Tiruvannamalai',
    'Tiruvarur',
    'Vellore',
    'Viluppuram',
    'Virudhunagar',
];

const COLLEGES_TN = [
    { name: 'Indian Institute of Technology Madras', abbr: 'IITM', district: 'Chennai' },
    { name: 'Anna University', abbr: 'AU', district: 'Chennai' },
    { name: 'SSN College of Engineering', abbr: 'SSN', district: 'Chengalpattu' },
    { name: 'SRM Institute of Science and Technology', abbr: 'SRM', district: 'Chengalpattu' },
    { name: 'National Institute of Technology Tiruchirappalli', abbr: 'NITT', district: 'Tiruchirappalli' },
    { name: 'PSG College of Technology', abbr: 'PSG Tech', district: 'Coimbatore' },
    { name: 'Coimbatore Institute of Technology', abbr: 'CIT', district: 'Coimbatore' },
    { name: 'Amrita Vishwa Vidyapeetham, Coimbatore Campus', abbr: 'Amrita', district: 'Coimbatore' },
    { name: 'Kumaraguru College of Technology', abbr: 'KCT', district: 'Coimbatore' },
    { name: 'Karunya Institute of Technology and Sciences', abbr: 'KITS', district: 'Coimbatore' },
    { name: 'Vellore Institute of Technology', abbr: 'VIT', district: 'Vellore' },
    { name: 'SASTRA Deemed University', abbr: 'SASTRA', district: 'Thanjavur' },
    { name: 'Thiagarajar College of Engineering', abbr: 'TCE', district: 'Madurai' },
    { name: 'Madurai Kamaraj University', abbr: 'MKU', district: 'Madurai' },
    { name: 'Government College of Technology', abbr: 'GCT', district: 'Coimbatore' },
    { name: 'Kongu Engineering College', abbr: 'KEC', district: 'Erode' },
    { name: 'St. Joseph\'s College (Autonomous), Tiruchirappalli', abbr: 'SJC Trichy', district: 'Tiruchirappalli' },
    { name: 'Loyola College', abbr: 'Loyola', district: 'Chennai' },
    { name: 'Madras Christian College', abbr: 'MCC', district: 'Chengalpattu' },
    { name: 'Government College of Engineering, Salem', abbr: 'GCE Salem', district: 'Salem' },
    { name: 'Saveetha Engineering College', abbr: 'SEC', district: 'Tiruvallur' },
    { name: 'Sri Sivasubramaniya Nadar College, Kalavakkam', abbr: 'SSN', district: 'Chengalpattu' },
    { name: 'Sona College of Technology', abbr: 'Sona', district: 'Salem' },
    { name: 'Vel Tech Rangarajan Dr. Sagunthala R and D Institute', abbr: 'Vel Tech', district: 'Tiruvallur' },
];

const DEGREE_OPTIONS = ['B.E', 'B.Tech', 'B.Sc', 'M.Sc', 'MBA', 'M.E', 'M.Tech', 'PhD'];

const COURSES_BY_DEGREE = {
    'B.E': [
        'Computer Science Engineering',
        'Information Technology',
        'Mechanical Engineering',
        'Electrical Engineering',
        'Electronics and Communication Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Aerospace Engineering',
        'Biomedical Engineering',
    ],
    'B.Tech': [
        'Computer Science Engineering',
        'Information Technology',
        'Mechanical Engineering',
        'Electrical Engineering',
        'Electronics and Communication Engineering',
        'Civil Engineering',
        'Chemical Engineering',
        'Aerospace Engineering',
        'Biomedical Engineering',
    ],
    'B.Sc': ['Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Biotechnology'],
    'M.Sc': ['Data Science', 'Artificial Intelligence', 'Physics', 'Chemistry', 'Mathematics'],
    MBA: ['Finance', 'Marketing', 'Human Resources', 'Business Analytics'],
    'M.E': ['AI & ML', 'Data Science', 'Robotics', 'VLSI Design', 'Structural Engineering'],
    'M.Tech': ['AI & ML', 'Data Science', 'Robotics', 'VLSI Design', 'Structural Engineering'],
    PhD: [
        'Computer Science',
        'Electrical Engineering',
        'Electronics',
        'Mechanical Engineering',
        'Chemical Engineering',
        'Civil Engineering',
        'Mathematics',
        'Physics',
        'Management Studies',
        'Biotechnology',
    ],
};

function SelectField({ label, value, onChange, options, disabled = false, placeholder = 'Select' }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-dark-400 uppercase">{label}</span>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="w-full appearance-none rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-950 px-3 py-2.5 pr-10 text-sm font-semibold text-slate-700 dark:text-dark-100 outline-none transition-all focus:border-synapse-400 focus:ring-2 focus:ring-synapse-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <option value="">{placeholder}</option>
                    {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-400"
                />
            </div>
        </label>
    );
}

function InputField({ label, value, onChange, type = 'text', placeholder = '' }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-dark-400 uppercase">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-dark-100 placeholder-slate-400 dark:placeholder-dark-500 outline-none focus:ring-2 focus:ring-synapse-500/30"
            />
        </label>
    );
}

export default function AuthPortal({ onAuthSuccess }) {
    const [mode, setMode] = useState('signin');
    const [error, setError] = useState('');

    const [signinEmail, setSigninEmail] = useState('');
    const [signinPassword, setSigninPassword] = useState('');

    const [form, setForm] = useState({
        name: '',
        gender: '',
        phone: '',
        email: '',
        location: '',
        rollNumber: '',
        college: '',
        userType: 'Student',
        yearOfStudy: '',
        degree: '',
        course: '',
        password: '',
    });

    const availableColleges = useMemo(() => {
        if (!form.location) return [];
        return COLLEGES_TN
            .filter((c) => c.district === form.location)
            .map((c) => `${c.name} (${c.abbr})`)
            .sort((a, b) => a.localeCompare(b));
    }, [form.location]);

    const availableCourses = useMemo(() => {
        if (!form.degree) return [];
        return COURSES_BY_DEGREE[form.degree] || [];
    }, [form.degree]);

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
        setMode(nextMode);
    };

    function updateForm(field, value) {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'location') next.college = '';
            if (field === 'degree') next.course = '';
            if (field === 'userType') next.yearOfStudy = '';
            return next;
        });
    }

    function handleRegister(e) {
        e.preventDefault();
        setError('');

        const required = [
            'name', 'gender', 'phone', 'email', 'location', 'rollNumber',
            'college', 'userType', 'yearOfStudy', 'degree', 'course', 'password',
        ];
        const missing = required.find((k) => !form[k]);
        if (missing) {
            setError('Please fill all required fields.');
            return;
        }

        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
        if (!emailOk) {
            setError('Please enter a valid email.');
            return;
        }

        localStorage.setItem('cortex-auth-profile', JSON.stringify(form));
        localStorage.setItem('cortex-auth-session', 'active');
        onAuthSuccess?.(form);
    }

    function handleSignIn(e) {
        e.preventDefault();
        setError('');

        if (!signinEmail || !signinPassword) {
            setError('Enter your email and password.');
            return;
        }

        if (!/@gmail\.com$/i.test(signinEmail.trim())) {
            setError('Sign in currently supports Gmail addresses only.');
            return;
        }

        const raw = localStorage.getItem('cortex-auth-profile');
        if (raw) {
            const profile = JSON.parse(raw);
            if (profile.email !== signinEmail || profile.password !== signinPassword) {
                setError('Invalid credentials. Try again or create account.');
                return;
            }
            localStorage.setItem('cortex-auth-session', 'active');
            onAuthSuccess?.(profile);
            return;
        }

        setError('No account found. Create your account first.');
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

                    <div key={mode} className="animate-fade-in [animation-duration:180ms] [transform:translateZ(0)] will-change-transform">
                        {mode === 'signin' ? (
                            <form className="space-y-4" onSubmit={handleSignIn}>
                                <div className="flex items-center gap-2 text-slate-800 dark:text-dark-100 font-bold text-lg">
                                    <UserCircle2 size={18} />
                                    Welcome Back
                                </div>
                                <InputField label="Gmail" value={signinEmail} onChange={setSigninEmail} type="email" placeholder="yourname@gmail.com" />
                                <InputField label="Password" value={signinPassword} onChange={setSigninPassword} type="password" placeholder="Enter password" />

                                <div className="flex items-center justify-between text-sm">
                                    <button type="button" className="text-synapse-600 dark:text-synapse-300 font-semibold hover:underline">Forgot Password</button>
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
                            </form>
                        ) : (
                            <form className="space-y-4 max-h-[72vh] overflow-y-auto pr-1 scrollbar-thin" onSubmit={handleRegister}>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <InputField label="Name" value={form.name} onChange={(v) => updateForm('name', v)} placeholder="Full name" />
                                    <SelectField label="Gender" value={form.gender} onChange={(v) => updateForm('gender', v)} options={['Male', 'Female', 'Other', 'Prefer not to say']} />
                                    <InputField label="Phone Number" value={form.phone} onChange={(v) => updateForm('phone', v)} placeholder="10-digit mobile" />
                                    <InputField label="Personal Email" value={form.email} onChange={(v) => updateForm('email', v)} type="email" placeholder="name@gmail.com" />
                                    <SelectField label="Location" value={form.location} onChange={(v) => updateForm('location', v)} options={DISTRICTS_TN} placeholder="Select district" />
                                    <InputField label="Roll Number" value={form.rollNumber} onChange={(v) => updateForm('rollNumber', v)} placeholder="College roll number" />
                                    <SelectField label="College" value={form.college} onChange={(v) => updateForm('college', v)} options={availableColleges} disabled={!form.location} placeholder={form.location ? 'Select college' : 'Select location first'} />
                                    <SelectField label="Student / Alumni" value={form.userType} onChange={(v) => updateForm('userType', v)} options={['Student', 'Alumni']} />
                                    <SelectField label={form.userType === 'Alumni' ? 'Graduation Year' : 'Year of Study'} value={form.yearOfStudy} onChange={(v) => updateForm('yearOfStudy', v)} options={yearOptions} />
                                    <SelectField label="Degree" value={form.degree} onChange={(v) => updateForm('degree', v)} options={DEGREE_OPTIONS} placeholder="Select degree" />
                                    <SelectField label="Course" value={form.course} onChange={(v) => updateForm('course', v)} options={availableCourses} disabled={!form.degree} placeholder={form.degree ? 'Select course' : 'Select degree first'} />
                                    <InputField label="Password" value={form.password} onChange={(v) => updateForm('password', v)} type="password" placeholder="Create password" />
                                </div>

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" className="w-full rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    Create Account <ArrowRight size={16} />
                                </button>
                            </form>
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

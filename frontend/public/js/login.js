import api from './api.js';

let container = null;
let currentView = 'login';
let pendingEmail = '';
let academicOptions = null;

// ── Fetch dropdown options ──────────────────────────────────────────────────
async function loadOptions() {
    if (academicOptions) return academicOptions;
    try {
        academicOptions = await api.getAcademicOptions();
    } catch {
        // Fallback defaults if server unreachable
        academicOptions = {
            colleges: ['Amrita Vishwa Vidyapeetham, Coimbatore', 'PSG College of Technology'],
            degrees: ['B.Tech', 'B.Sc', 'MBA', 'M.Tech', 'PhD'],
            courses: ['Computer Science', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'MBA Finance', 'MBA Marketing'],
            academicLevels: ['Undergraduate', 'Postgraduate', 'Doctorate'],
        };
    }
    return academicOptions;
}

function buildSelect(id, label, options, placeholder = 'Select…') {
    return `
    <div class="auth-field">
        <label for="${id}">${label}</label>
        <select id="${id}" class="input-base select-input" required>
            <option value="" disabled selected>${placeholder}</option>
            ${options.map(o => `<option value="${o}">${o}</option>`).join('')}
        </select>
    </div>`;
}

// ── Entry Point ─────────────────────────────────────────────────────────────
export function renderLogin(el, onSuccess) {
    container = el;
    el.innerHTML = `
    <div class="auth-page">
        <div class="auth-card animate-scale-in">
            <div class="auth-logo">
                <div class="auth-logo-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                    </svg>
                </div>
                <h1 class="auth-title">Cortex</h1>
                <p class="auth-subtitle">Offline AI for Students</p>
            </div>
            <div id="auth-form-area"></div>
            <div id="auth-status" class="auth-status-bar">
                <div class="auth-status-dot" id="conn-dot"></div>
                <span id="conn-label">Checking connection…</span>
            </div>
        </div>
    </div>`;

    showLoginForm(onSuccess);
    checkConnectivity();
}

// ── Login Form ──────────────────────────────────────────────────────────────
function showLoginForm(onSuccess) {
    currentView = 'login';
    const area = container.querySelector('#auth-form-area');
    area.innerHTML = `
    <form id="login-form" class="auth-form animate-fade-in">
        <h2 class="auth-heading">Welcome back</h2>
        <p class="auth-desc">Sign in to access your knowledge base</p>
        <div class="auth-field">
            <label for="login-email">Email</label>
            <input id="login-email" type="email" class="input-base" placeholder="student@university.edu" required autocomplete="email">
        </div>
        <div class="auth-field">
            <label for="login-password">Password</label>
            <input id="login-password" type="password" class="input-base" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <div id="login-error" class="auth-error"></div>
        <button type="submit" id="login-submit" class="btn-primary auth-submit">Sign In</button>
        <p class="auth-switch">Don't have an account? <a href="#" id="goto-register">Create one</a></p>
    </form>`;

    area.querySelector('#goto-register').onclick = (e) => { e.preventDefault(); showRegisterForm(onSuccess); };
    area.querySelector('#login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = area.querySelector('#login-email').value.trim();
        const pass = area.querySelector('#login-password').value;
        const errEl = area.querySelector('#login-error');
        const btn = area.querySelector('#login-submit');
        errEl.textContent = '';
        btn.disabled = true; btn.textContent = 'Signing in…';
        try {
            const res = await api.authLogin(email, pass);
            if (res.error) { errEl.textContent = res.error; btn.disabled = false; btn.textContent = 'Sign In'; return; }
            localStorage.setItem('cortex_token', res.token);
            localStorage.setItem('cortex_user', JSON.stringify(res.user));
            onSuccess(res.user);
        } catch (err) {
            errEl.textContent = 'Connection error. Try again.';
            btn.disabled = false; btn.textContent = 'Sign In';
        }
    };
}

// ── Register Form (Structured Academic) ─────────────────────────────────────
async function showRegisterForm(onSuccess) {
    currentView = 'register';
    // Make the card wider for registration
    const card = container.querySelector('.auth-card');
    card.classList.add('auth-card-wide');

    const opts = await loadOptions();
    const area = container.querySelector('#auth-form-area');
    area.innerHTML = `
    <form id="register-form" class="auth-form animate-fade-in">
        <h2 class="auth-heading">Student Registration</h2>
        <p class="auth-desc">Create your Cortex account with academic details</p>
        <div class="reg-grid">
            <div class="auth-field">
                <label for="reg-name">Full Name</label>
                <input id="reg-name" type="text" class="input-base" placeholder="Your full name" required>
            </div>
            <div class="auth-field">
                <label for="reg-email">Email</label>
                <input id="reg-email" type="email" class="input-base" placeholder="student@university.edu" required autocomplete="email">
            </div>
            ${buildSelect('reg-college', 'College', opts.colleges, 'Select your college')}
            <div class="auth-field">
                <label for="reg-roll">Roll Number</label>
                <input id="reg-roll" type="text" class="input-base" placeholder="e.g. CB.EN.U4CSE21001" required>
            </div>
            ${buildSelect('reg-degree', 'Degree', opts.degrees, 'Select degree')}
            ${buildSelect('reg-course', 'Course', opts.courses, 'Select course')}
            ${buildSelect('reg-level', 'Academic Level', opts.academicLevels, 'Select level')}
            <div class="auth-field">
                <label for="reg-phone">Phone Number</label>
                <input id="reg-phone" type="tel" class="input-base" placeholder="10-digit number" required pattern="[0-9+\\-\\s]{7,15}">
            </div>
            <div class="auth-field">
                <label for="reg-password">Password</label>
                <input id="reg-password" type="password" class="input-base" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password">
            </div>
            <div class="auth-field">
                <label for="reg-confirm">Confirm Password</label>
                <input id="reg-confirm" type="password" class="input-base" placeholder="Re-enter password" required minlength="8" autocomplete="new-password">
            </div>
        </div>
        <div id="reg-error" class="auth-error"></div>
        <button type="submit" id="reg-submit" class="btn-primary auth-submit">Create Account</button>
        <p class="auth-switch">Already have an account? <a href="#" id="goto-login">Sign in</a></p>
    </form>`;

    area.querySelector('#goto-login').onclick = (e) => {
        e.preventDefault();
        card.classList.remove('auth-card-wide');
        showLoginForm(onSuccess);
    };

    area.querySelector('#register-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            fullName: area.querySelector('#reg-name').value.trim(),
            email: area.querySelector('#reg-email').value.trim(),
            collegeName: area.querySelector('#reg-college').value,
            rollNumber: area.querySelector('#reg-roll').value.trim(),
            degree: area.querySelector('#reg-degree').value,
            courseName: area.querySelector('#reg-course').value,
            academicLevel: area.querySelector('#reg-level').value,
            phoneNumber: area.querySelector('#reg-phone').value.trim(),
            password: area.querySelector('#reg-password').value,
            confirmPassword: area.querySelector('#reg-confirm').value,
        };

        const errEl = area.querySelector('#reg-error');
        const btn = area.querySelector('#reg-submit');
        errEl.textContent = '';

        // Client-side validation
        if (!data.fullName || !data.email || !data.collegeName || !data.rollNumber ||
            !data.degree || !data.courseName || !data.academicLevel || !data.phoneNumber ||
            !data.password || !data.confirmPassword) {
            errEl.textContent = 'All fields are required.'; return;
        }
        if (data.password.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
        if (data.password !== data.confirmPassword) { errEl.textContent = 'Passwords do not match.'; return; }

        btn.disabled = true; btn.textContent = 'Creating account…';
        try {
            const res = await api.authRegister(data);
            if (res.error) { errEl.textContent = res.error; btn.disabled = false; btn.textContent = 'Create Account'; return; }
            localStorage.setItem('cortex_token', res.token);
            localStorage.setItem('cortex_user', JSON.stringify(res.user));
            if (res.needsVerification) {
                pendingEmail = data.email;
                showSuccessScreen(onSuccess, res.message, res.user);
            } else {
                onSuccess(res.user);
            }
        } catch (err) {
            errEl.textContent = 'Registration failed. Please try again.';
            btn.disabled = false; btn.textContent = 'Create Account';
        }
    };
}

// ── Success / Post-Registration Screen ──────────────────────────────────────
function showSuccessScreen(onSuccess, message, user) {
    currentView = 'success';
    const card = container.querySelector('.auth-card');
    card.classList.remove('auth-card-wide');
    const area = container.querySelector('#auth-form-area');
    area.innerHTML = `
    <div class="auth-form animate-fade-in" style="text-align:center">
        <div class="auth-success-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
        </div>
        <h2 class="auth-heading" style="margin-top:16px">Account Created!</h2>
        <p class="auth-desc" style="margin:12px 0 20px">${message}</p>
        <button id="continue-btn" class="btn-primary auth-submit">Continue to Cortex</button>
    </div>`;

    area.querySelector('#continue-btn').onclick = () => onSuccess(user);
}

// ── Connectivity Check ──────────────────────────────────────────────────────
async function checkConnectivity() {
    const dot = container?.querySelector('#conn-dot');
    const label = container?.querySelector('#conn-label');
    if (!dot || !label) return;
    try {
        const res = await api.checkConnectivity();
        dot.className = `auth-status-dot ${res.online ? 'online' : 'offline'}`;
        label.textContent = res.online ? 'Online — registration with email verification' : 'Offline — register locally, verify later';
    } catch {
        dot.className = 'auth-status-dot offline';
        label.textContent = 'Offline — register locally, verify later';
    }
}

export function destroyLogin() { container = null; }

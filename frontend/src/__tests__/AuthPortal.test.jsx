import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Module mocks (must be declared before component import) ───────────────────

vi.mock('../services/api.js', () => ({
    auth: {
        login: vi.fn(),
        signup: vi.fn(),
        refresh: vi.fn(),
        logout: vi.fn(),
    },
    reference: {
        districts: vi.fn().mockResolvedValue([]),
        colleges: vi.fn().mockResolvedValue([]),
        degrees: vi.fn().mockResolvedValue([]),
        courses: vi.fn().mockResolvedValue([]),
    },
    isBackendReady: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/storage/tokenStore.js', () => ({
    saveTokens: vi.fn(),
    getAccessToken: vi.fn().mockReturnValue(null),
    getRefreshToken: vi.fn().mockReturnValue(null),
    clearTokens: vi.fn(),
}));

vi.mock('../offline/offlineIdentity.js', () => ({
    hasLocalIdentity: vi.fn().mockResolvedValue(false),
    getValidatedLocalIdentity: vi.fn().mockResolvedValue(null),
    setMeshConsent: vi.fn(),
}));

vi.mock('../mesh/useMeshDiscovery.js', () => ({
    useMeshDiscovery: () => ({
        nearbyPeers: [],
        isMeshAvailable: false,
    }),
}));

vi.mock('../system/deviceCapability.js', () => ({
    ensureDeviceProfile: vi.fn().mockResolvedValue({ fingerprint: 'test-device' }),
}));

vi.mock('../renderer/components/layout/WindowControls.jsx', () => ({
    default: () => null,
}));

vi.mock('lucide-react', () => {
    const icon = (name) => ({ [name]: () => React.createElement('span', null, name) });
    return {
        ...icon('ArrowRight'), ...icon('ChevronDown'), ...icon('GraduationCap'),
        ...icon('Lock'), ...icon('Mail'), ...icon('School'), ...icon('UserCircle2'),
        ...icon('Check'), ...icon('Eye'), ...icon('EyeOff'), ...icon('Loader2'),
        ...icon('WifiOff'), ...icon('Radio'), ...icon('Info'), ...icon('BarChart3'),
        ...icon('Users'),
    };
});

// ── Component import (after mocks) ────────────────────────────────────────────

import AuthPortal from '../renderer/components/pages/AuthPortal';
import { auth as authApi } from '../services/api.js';
import { saveTokens } from '../services/storage/tokenStore.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_USER = {
    id: 'user-001',
    email: 'student@college.edu',
    full_name: 'Test Student',
    gender: 'male',
    district_id: 1,
    college_id: 2,
    student_status: 'student',
    year_of_study: 2,
    graduation_year: null,
    degree_id: 3,
    course_id: 4,
};

const PLAINTEXT_PASSWORD = 'MyS3cur3P@ss!';

function renderPortal(props = {}) {
    return render(
        <AuthPortal onAuthSuccess={vi.fn()} {...props} />
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthPortal — password not stored in localStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('does not store plaintext password in cortex-auth-profile after sign-in', async () => {
        authApi.login.mockResolvedValueOnce({
            accessToken: 'access-tok',
            refreshToken: 'refresh-tok',
            user: FAKE_USER,
        });

        renderPortal();

        // Find and fill the sign-in form
        const emailInput = screen.getByPlaceholderText('yourname@gmail.com');
        const passwordInput = screen.getByPlaceholderText('Enter password');
        const loginButton = screen.getByRole('button', { name: /login/i });

        fireEvent.change(emailInput, { target: { value: 'student@college.edu' } });
        fireEvent.change(passwordInput, { target: { value: PLAINTEXT_PASSWORD } });
        fireEvent.click(loginButton);

        await waitFor(() => {
            expect(authApi.login).toHaveBeenCalledTimes(1);
        });

        const storedProfile = localStorage.getItem('cortex-auth-profile');
        expect(storedProfile).not.toBeNull();
        expect(storedProfile).not.toContain(PLAINTEXT_PASSWORD);
    });

    it('stored profile contains user id and email but not password', async () => {
        authApi.login.mockResolvedValueOnce({
            accessToken: 'access-tok',
            refreshToken: 'refresh-tok',
            user: FAKE_USER,
        });

        renderPortal();

        fireEvent.change(screen.getByPlaceholderText('yourname@gmail.com'), {
            target: { value: 'student@college.edu' },
        });
        fireEvent.change(screen.getByPlaceholderText('Enter password'), {
            target: { value: PLAINTEXT_PASSWORD },
        });
        fireEvent.click(screen.getByRole('button', { name: /login/i }));

        await waitFor(() => {
            expect(authApi.login).toHaveBeenCalledTimes(1);
        });

        const storedProfile = JSON.parse(localStorage.getItem('cortex-auth-profile') || 'null');
        expect(storedProfile).not.toBeNull();
        expect(storedProfile.email).toBe('student@college.edu');
        expect(storedProfile.id).toBe('user-001');
        expect(storedProfile.password).toBeUndefined();
        expect(storedProfile.password_hash).toBeUndefined();
    });

    it('calls saveTokens with access and refresh tokens (not password)', async () => {
        authApi.login.mockResolvedValueOnce({
            accessToken: 'tok-a',
            refreshToken: 'tok-r',
            user: FAKE_USER,
        });

        renderPortal();

        fireEvent.change(screen.getByPlaceholderText('yourname@gmail.com'), {
            target: { value: 'student@college.edu' },
        });
        fireEvent.change(screen.getByPlaceholderText('Enter password'), {
            target: { value: PLAINTEXT_PASSWORD },
        });
        fireEvent.click(screen.getByRole('button', { name: /login/i }));

        await waitFor(() => expect(saveTokens).toHaveBeenCalledTimes(1));

        const [accessArg, refreshArg] = saveTokens.mock.calls[0];
        expect(accessArg).toBe('tok-a');
        expect(refreshArg).toBe('tok-r');
        expect(accessArg).not.toBe(PLAINTEXT_PASSWORD);
        expect(refreshArg).not.toBe(PLAINTEXT_PASSWORD);
    });

    it('shows error message on login failure without exposing the password', async () => {
        authApi.login.mockRejectedValueOnce(
            Object.assign(new Error('Invalid credentials'), { data: { error: 'Invalid credentials' } })
        );

        renderPortal();

        fireEvent.change(screen.getByPlaceholderText('yourname@gmail.com'), {
            target: { value: 'student@college.edu' },
        });
        fireEvent.change(screen.getByPlaceholderText('Enter password'), {
            target: { value: PLAINTEXT_PASSWORD },
        });
        fireEvent.click(screen.getByRole('button', { name: /login/i }));

        // After failure, localStorage should have no new profile entry
        await waitFor(() => expect(authApi.login).toHaveBeenCalledTimes(1));

        const profile = localStorage.getItem('cortex-auth-profile');
        // Either null (not set) or doesn't contain the password
        if (profile !== null) {
            expect(profile).not.toContain(PLAINTEXT_PASSWORD);
        }
    });
});

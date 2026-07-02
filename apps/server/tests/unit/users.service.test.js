import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const usersRepo = require('../../src/repositories/users.repository.js');
const supabaseConfig = require('../../src/config/supabase.js');
const usersService = require('../../src/services/users.service.js');

describe('users.service', () => {
    let admin;

    beforeEach(() => {
        admin = {
            auth: {
                admin: {
                    getUserById: vi.fn(),
                    updateUserById: vi.fn().mockResolvedValue({ error: null }),
                },
            },
        };
        vi.spyOn(supabaseConfig, 'supabaseAdmin').mockReturnValue(admin);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getMe', () => {
        it('merges Supabase identity with the local profile row', async () => {
            admin.auth.admin.getUserById.mockResolvedValue({
                data: { user: { id: 'user-1', email: 'a@b.com', user_metadata: { full_name: 'A' }, email_confirmed_at: '2026-01-01', created_at: '2025-01-01' } },
                error: null,
            });
            vi.spyOn(usersRepo, 'getProfile').mockResolvedValue({ avatar_url: 'http://x/y.png', display_name: 'Ay' });

            const result = await usersService.getMe('user-1');

            expect(result).toEqual({
                id: 'user-1',
                email: 'a@b.com',
                full_name: 'A',
                email_verified: true,
                created_at: '2025-01-01',
                avatar_url: 'http://x/y.png',
                display_name: 'Ay',
            });
        });

        it('rejects when the Supabase user no longer exists', async () => {
            admin.auth.admin.getUserById.mockResolvedValue({ data: null, error: { message: 'not found' } });
            await expect(usersService.getMe('ghost')).rejects.toMatchObject({ status: 404 });
        });
    });

    describe('updateMe', () => {
        it('updates Supabase user_metadata when full_name changes, and the local profile for avatar/display name', async () => {
            admin.auth.admin.getUserById
                .mockResolvedValueOnce({ data: { user: { id: 'user-1', user_metadata: { full_name: 'Old' } } }, error: null })
                .mockResolvedValueOnce({ data: { user: { id: 'user-1', email: 'a@b.com', user_metadata: { full_name: 'New' }, created_at: '2025-01-01' } }, error: null });
            const upsertSpy = vi.spyOn(usersRepo, 'upsertProfile').mockResolvedValue({});
            vi.spyOn(usersRepo, 'getProfile').mockResolvedValue({ avatar_url: 'http://x/new.png' });

            await usersService.updateMe('user-1', { full_name: 'New', avatar_url: 'http://x/new.png' });

            expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { user_metadata: { full_name: 'New' } });
            expect(upsertSpy).toHaveBeenCalledWith('user-1', { avatarUrl: 'http://x/new.png', displayName: undefined });
        });
    });

    describe('getSubscription', () => {
        it('delegates to the repository', async () => {
            vi.spyOn(usersRepo, 'getSubscription').mockResolvedValue({ plan: 'free', status: 'active', renewsAt: null });
            const result = await usersService.getSubscription('user-1');
            expect(result).toEqual({ plan: 'free', status: 'active', renewsAt: null });
        });
    });
});

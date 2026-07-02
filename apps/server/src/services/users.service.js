const usersRepo = require('../repositories/users.repository');
// Namespace object, not destructured — see the comment in auth.service.js.
const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

async function getMe(userId) {
    const { data, error } = await supabase.supabaseAdmin().auth.admin.getUserById(userId);
    if (error || !data?.user) throw new ApiError(404, 'not_found', 'User not found.');
    const profile = await usersRepo.getProfile(userId);
    return {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name ?? null,
        email_verified: !!data.user.email_confirmed_at,
        created_at: data.user.created_at,
        avatar_url: profile?.avatar_url ?? null,
        display_name: profile?.display_name ?? null,
    };
}

async function updateMe(userId, { full_name: fullName, avatar_url: avatarUrl, display_name: displayName }) {
    if (fullName) {
        const { data: current } = await supabase.supabaseAdmin().auth.admin.getUserById(userId);
        await supabase.supabaseAdmin().auth.admin.updateUserById(userId, {
            user_metadata: { ...(current?.user?.user_metadata ?? {}), full_name: fullName },
        });
    }
    if (avatarUrl || displayName) await usersRepo.upsertProfile(userId, { avatarUrl, displayName });
    return getMe(userId);
}

async function getPreferences(userId) {
    const profile = await usersRepo.getProfile(userId);
    return profile?.preferences ?? {};
}

async function setPreferences(userId, preferences) {
    const profile = await usersRepo.upsertProfile(userId, { preferences });
    return profile.preferences;
}

async function getSubscription(userId) {
    return usersRepo.getSubscription(userId);
}

module.exports = { getMe, updateMe, getPreferences, setPreferences, getSubscription };

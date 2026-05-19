import { User } from '@/types';
import api from '@/lib/api';
import { fetchPresence } from '@/services/messageService';

interface ProfileItem {
    user_id: string;
    username?: string;
    display_name: string;
    bio?: string;
    avatar_media_id?: string;
    is_verified: boolean;
}

interface DiscoverResponse {
    data: {
        items: ProfileItem[];
        meta: {
            limit: number;
            offset: number;
            total: number;
            has_next: boolean;
        };
    };
}

const mapProfileToUser = (p: ProfileItem): User => {
    const avatar = p.avatar_media_id
        ? `/v1/media/${p.avatar_media_id}/serve`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_id}`;

    return {
        id: p.user_id,
        name: p.display_name || p.username || 'User',
        username: p.username,
        avatar,
        isOnline: false,
        bio: p.bio,
    };
};

/**
 * Enrich a list of users with live presence data from Redis.
 * Fails silently — if the chat backend is down, everyone shows as offline.
 */
const enrichWithPresence = async (users: User[]): Promise<User[]> => {
    if (users.length === 0) return users;
    try {
        const ids = users.map(u => u.id);
        const presence = await fetchPresence(ids);
        return users.map(u => ({ ...u, isOnline: !!presence[u.id] }));
    } catch {
        return users;
    }
};

export const fetchUsers = async (limit = 50, offset = 0): Promise<User[]> => {
    try {
        const res = await api.get<DiscoverResponse>(`/v1/profiles/discover`, {
            params: { limit: String(limit), offset: String(offset) },
        });
        const items: ProfileItem[] = res.data.data.items ?? [];
        const users = items.map(mapProfileToUser);
        return enrichWithPresence(users);
    } catch (err) {
        console.error('User Fetch Error:', err);
        return [];
    }
};

/**
 * Fetch a user's circle (friends/connections) from graph-service.
 *
 * graph-service's `GET /v1/graph/connections/{id}` returns a bare array of
 * user-id strings, so the ids are hydrated into full profiles via the batch
 * endpoint before being mapped to the User shape.
 */
export const fetchCircleMembers = async (userId: string, limit = 50): Promise<User[]> => {
    try {
        const res = await api.get<{ data: string[] }>(`/v1/graph/connections/${userId}`);
        const ids = (res.data?.data ?? []).slice(0, limit);
        if (ids.length === 0) return [];

        const batch = await api.post('/v1/profiles/batch', { user_ids: ids });
        const data = batch.data;
        const items: ProfileItem[] = [];
        if (data && typeof data === 'object') {
            if (Array.isArray(data.profiles)) {
                for (const p of data.profiles) items.push(p as ProfileItem);
            } else {
                for (const value of Object.values(data)) {
                    if (value && typeof value === 'object' && 'user_id' in (value as Record<string, unknown>)) {
                        items.push(value as ProfileItem);
                    }
                }
            }
        }
        const users = items.map(mapProfileToUser);
        return enrichWithPresence(users);
    } catch (err) {
        console.error('Circle Fetch Error:', err);
        return [];
    }
};

export const searchUsers = async (query: string, limit = 10): Promise<User[]> => {
    if (!query.trim()) return [];
    try {
        const res = await api.get('/v1/search/users', {
            params: { q: query.trim(), limit },
        });
        const items: ProfileItem[] = res.data?.items ?? res.data?.data?.items ?? [];
        const users = items.map(mapProfileToUser);
        return enrichWithPresence(users);
    } catch (err) {
        console.error('User Search Error:', err);
        return [];
    }
};

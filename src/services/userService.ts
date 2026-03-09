import { User } from '@/types';
import api from '@/lib/api';

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

export const fetchUsers = async (limit = 50, offset = 0): Promise<User[]> => {
    try {
        const res = await api.get<DiscoverResponse>(`/v1/profiles/discover`, {
            params: { limit: String(limit), offset: String(offset) },
        });
        const items: ProfileItem[] = res.data.data.items ?? [];
        return items.map(mapProfileToUser);
    } catch (err) {
        console.error('User Fetch Error:', err);
        return [];
    }
};

export const fetchCircleMembers = async (userId: string, limit = 50): Promise<User[]> => {
    try {
        const res = await api.get(`/v1/profiles/${userId}/friends`, {
            params: { limit, offset: 0 },
        });
        const items: ProfileItem[] = res.data?.data?.items ?? res.data?.items ?? [];
        return items.map(mapProfileToUser);
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
        return items.map(mapProfileToUser);
    } catch (err) {
        console.error('User Search Error:', err);
        return [];
    }
};

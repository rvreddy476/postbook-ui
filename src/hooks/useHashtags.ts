// Hashtag discovery hooks. Two endpoints, two hooks:
//   - useTrendingHashtags  → /v1/hashtags/trending (decorative chip strip)
//   - useHashtagSearch     → /v1/hashtags/search   (prefix-match dropdown)
// Both return the same HashtagModel shape so callers can render with
// one component. The composer uses these to anchor canonical tags
// instead of letting users invent fresh near-duplicates.

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface HashtagModel {
    normalized_name: string;
    display_name: string;
    post_count: number;
    is_trending?: boolean;
}

interface HashtagListResponse {
    data?: { hashtags?: HashtagModel[] };
    hashtags?: HashtagModel[];
}

function unwrap(res: { data: HashtagListResponse }): HashtagModel[] {
    return res.data?.data?.hashtags ?? res.data?.hashtags ?? [];
}

export function useTrendingHashtags(limit = 12) {
    return useQuery({
        queryKey: ["hashtags", "trending", limit],
        queryFn: async () => {
            const res = await api.get<HashtagListResponse>(
                "/v1/hashtags/trending",
                { params: { limit } },
            );
            return unwrap(res);
        },
        // Trending is decorative; don't refetch on every focus.
        staleTime: 5 * 60_000,
    });
}

// Backend rejects q < 2 chars with a 400, so the hook gates itself via
// the `enabled` flag. The query auto-runs whenever `query` (sanitized
// to >= 2 chars) changes; debouncing is the caller's job — pass a
// debounced value to keep traffic sane during typing.
export function useHashtagSearch(query: string, limit = 8) {
    const cleaned = query.replace(/#/g, "").trim();
    const enabled = cleaned.length >= 2;
    return useQuery({
        queryKey: ["hashtags", "search", cleaned, limit],
        enabled,
        queryFn: async () => {
            try {
                const res = await api.get<HashtagListResponse>(
                    "/v1/hashtags/search",
                    { params: { q: cleaned, limit } },
                );
                return unwrap(res);
            } catch (err) {
                // 429 (rate-limited) — fall back to empty so the
                // dropdown stays calm under burst typing.
                if (
                    typeof err === "object" &&
                    err !== null &&
                    "response" in err &&
                    (err as { response?: { status?: number } }).response?.status ===
                        429
                ) {
                    return [] as HashtagModel[];
                }
                throw err;
            }
        },
        staleTime: 30_000,
    });
}

// Small helper to format post counts compactly on the chips.
export function formatPostCount(n: number | undefined): string {
    if (!n || n <= 0) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
}

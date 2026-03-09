import { useQuery } from "@tanstack/react-query";
import { getCategoryFeed, type FeedCategory } from "../data/posttubeApi";

/**
 * Fetches a single category feed. Each category is an independent query —
 * React Query deduplicates and caches automatically.
 */
export function useCategoryFeed(category: FeedCategory, limit = 12) {
  return useQuery({
    queryKey: ["posttube", "feed", category],
    queryFn: () => getCategoryFeed(category, { limit }),
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 5 * 60 * 1000,
  });
}

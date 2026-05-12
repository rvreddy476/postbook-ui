// Trending hashtag chip strip. Fetches /v1/hashtags/trending once on
// mount and renders the top N chips. Click → `onTagSelected("#tag")`
// so the parent composer decides how to splice it into its own input
// state (cursor-aware insert vs. append vs. set).

"use client";

import { Loader2 } from "lucide-react";

import { formatPostCount, useTrendingHashtags } from "@/hooks/useHashtags";

interface Props {
    onTagSelected: (chip: string) => void;
    limit?: number;
    excluded?: Set<string>;
    label?: string;
}

export default function TrendingHashtagStrip({
    onTagSelected,
    limit = 8,
    excluded,
    label = "Trending",
}: Props) {
    // Fetch a few extra so client-side excluded filtering still has
    // candidates if the user already used some of the top tags.
    const fetchLimit = limit + (excluded?.size ?? 0);
    const { data, isLoading, isError } = useTrendingHashtags(fetchLimit);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-2 text-[12px] text-brand-text/50">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading trending tags...
            </div>
        );
    }
    if (isError || !data || data.length === 0) return null;

    const tags = data
        .filter((tag) => {
            const name = (tag.display_name || tag.normalized_name || "").toLowerCase();
            if (!name) return false;
            if (!excluded) return true;
            return !excluded.has(name) && !excluded.has(`#${name}`);
        })
        .slice(0, limit);
    if (tags.length === 0) return null;

    return (
        <div className="space-y-1.5">
            {label && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                    🔥 {label}
                </p>
            )}
            <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                    const name = tag.display_name || tag.normalized_name;
                    const chip = `#${name.toLowerCase()}`;
                    return (
                        <button
                            key={tag.normalized_name || name}
                            type="button"
                            onClick={() => onTagSelected(chip)}
                            className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-100"
                            title={`${formatPostCount(tag.post_count)} posts`}
                        >
                            #{name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

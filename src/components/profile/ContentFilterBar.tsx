"use client"

import type { ContentType } from "@/types/profile"

interface ContentFilterBarProps {
    activeFilter: ContentType
    onFilterChange: (filter: ContentType) => void
}

const filters: { key: ContentType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "post", label: "Posts" },
    { key: "reel", label: "Reels" },
    { key: "video", label: "Videos" },
]

export function ContentFilterBar({ activeFilter, onFilterChange }: ContentFilterBarProps) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filters.map((filter) => (
                <button
                    key={filter.key}
                    onClick={() => onFilterChange(filter.key)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                        activeFilter === filter.key
                            ? "bg-brand-text text-brand-card shadow-sm"
                            : "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary border border-brand-divider"
                    }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    )
}

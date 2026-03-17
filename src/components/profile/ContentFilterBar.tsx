"use client"

import type { ContentType } from "@/types/profile"

interface ContentFilterBarProps {
    activeFilter: ContentType
    onFilterChange: (filter: ContentType) => void
}

const filters: { key: ContentType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "post", label: "Posts" },
    { key: "reel", label: "Flicks" },
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
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-brand-secondary text-brand-highlight hover:bg-slate-100 border border-brand-divider"
                    }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    )
}

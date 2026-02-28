"use client"

import type { ContentType } from "@/types/profile"

interface ContentFilterBarProps {
    activeFilter: ContentType
    onFilterChange: (filter: ContentType) => void
}

const filters: { key: ContentType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "post", label: "Posts" },
    { key: "short", label: "Shorts" },
    { key: "video", label: "Videos" },
    { key: "photo", label: "Photos" },
]

export function ContentFilterBar({ activeFilter, onFilterChange }: ContentFilterBarProps) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => (
                <button
                    key={filter.key}
                    onClick={() => onFilterChange(filter.key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                        activeFilter === filter.key
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    )
}

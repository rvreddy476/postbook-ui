"use client"

import { Heart } from "lucide-react"
import type { AboutItem, HobbyData } from "@/types/profile"

interface AboutHobbiesCardProps {
    items: AboutItem[]
}

export function AboutHobbiesCard({ items }: AboutHobbiesCardProps) {
    if (items.length === 0) return null

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Heart className="h-4 w-4" />
                Hobbies & Interests
            </h3>
            <div className="flex flex-wrap gap-2 pl-6">
                {items.map((item) => {
                    const d = item.data as unknown as HobbyData
                    return (
                        <span
                            key={item.item_id}
                            className="px-3 py-1 bg-muted rounded-full text-xs font-medium"
                            title={d.description}
                        >
                            {d.name}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

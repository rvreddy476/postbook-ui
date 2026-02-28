"use client"

import { Star } from "lucide-react"
import type { AboutItem, LifeEventData } from "@/types/profile"

interface AboutLifeEventsCardProps {
    items: AboutItem[]
}

export function AboutLifeEventsCard({ items }: AboutLifeEventsCardProps) {
    if (items.length === 0) return null

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Star className="h-4 w-4" />
                Life Events
            </h3>
            {items.map((item) => {
                const d = item.data as unknown as LifeEventData
                return (
                    <div key={item.item_id} className="pl-6">
                        <p className="text-sm font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                            {d.description}
                            {d.date && ` · ${d.date}`}
                        </p>
                    </div>
                )
            })}
        </div>
    )
}

"use client"

import { Briefcase } from "lucide-react"
import type { AboutItem, WorkData } from "@/types/profile"

interface AboutWorkCardProps {
    items: AboutItem[]
}

export function AboutWorkCard({ items }: AboutWorkCardProps) {
    if (items.length === 0) return null

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Work
            </h3>
            {items.map((item) => {
                const d = item.data as unknown as WorkData
                const years = d.is_current
                    ? `${d.start_year ?? ""}–Present`
                    : [d.start_year, d.end_year].filter(Boolean).join("–")
                return (
                    <div key={item.item_id} className="pl-6">
                        <p className="text-sm font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                            {d.company}
                            {years && ` · ${years}`}
                        </p>
                    </div>
                )
            })}
        </div>
    )
}

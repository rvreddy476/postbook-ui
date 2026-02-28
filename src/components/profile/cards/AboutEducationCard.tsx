"use client"

import { GraduationCap } from "lucide-react"
import type { AboutItem, EducationData } from "@/types/profile"

interface AboutEducationCardProps {
    items: AboutItem[]
}

export function AboutEducationCard({ items }: AboutEducationCardProps) {
    if (items.length === 0) return null

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <GraduationCap className="h-4 w-4" />
                Education
            </h3>
            {items.map((item) => {
                const d = item.data as unknown as EducationData
                const years = [d.start_year, d.end_year].filter(Boolean).join("–")
                return (
                    <div key={item.item_id} className="pl-6">
                        <p className="text-sm font-medium">{d.school}</p>
                        <p className="text-xs text-muted-foreground">
                            {d.degree}
                            {years && ` · ${years}`}
                        </p>
                    </div>
                )
            })}
        </div>
    )
}

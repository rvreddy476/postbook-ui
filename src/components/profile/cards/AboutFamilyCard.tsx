"use client"

import { Users } from "lucide-react"
import type { AboutItem, FamilyData } from "@/types/profile"

interface AboutFamilyCardProps {
    items: AboutItem[]
}

export function AboutFamilyCard({ items }: AboutFamilyCardProps) {
    if (items.length === 0) return null

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                Family & Relationships
            </h3>
            {items.map((item) => {
                const d = item.data as unknown as FamilyData
                return (
                    <div key={item.item_id} className="pl-6">
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{d.relation}</p>
                    </div>
                )
            })}
        </div>
    )
}

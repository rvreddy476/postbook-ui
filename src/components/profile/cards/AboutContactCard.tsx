"use client"

import { Mail } from "lucide-react"
import type { AboutItem, ContactData } from "@/types/profile"

interface AboutContactCardProps {
    items: AboutItem[]
}

export function AboutContactCard({ items }: AboutContactCardProps) {
    if (items.length === 0) return null

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Contact Info
            </h3>
            {items.map((item) => {
                const d = item.data as unknown as ContactData
                return (
                    <div key={item.item_id} className="pl-6">
                        <p className="text-xs text-muted-foreground capitalize">{d.type}</p>
                        <p className="text-sm font-medium">{d.value}</p>
                    </div>
                )
            })}
        </div>
    )
}

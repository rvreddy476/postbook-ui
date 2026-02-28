"use client"

import { Clock } from "lucide-react"

export function ActivityTab() {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Activity</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Recent likes, comments, reposts, and watch history will appear here. Coming soon.
            </p>
        </div>
    )
}

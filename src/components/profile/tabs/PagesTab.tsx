"use client"

import { FileText } from "lucide-react"

export function PagesTab() {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Pages</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Pages and communities managed by this user will appear here. Coming soon.
            </p>
        </div>
    )
}

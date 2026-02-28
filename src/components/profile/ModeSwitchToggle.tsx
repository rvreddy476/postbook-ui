"use client"

import { useState } from "react"

type ProfileMode = "social" | "creator"

interface ModeSwitchToggleProps {
    defaultMode?: ProfileMode
    onChange?: (mode: ProfileMode) => void
}

export function ModeSwitchToggle({ defaultMode = "social", onChange }: ModeSwitchToggleProps) {
    const [mode, setMode] = useState<ProfileMode>(defaultMode)

    const toggle = (next: ProfileMode) => {
        setMode(next)
        onChange?.(next)
    }

    return (
        <div className="inline-flex bg-muted/50 p-0.5 rounded-lg">
            <button
                onClick={() => toggle("social")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    mode === "social"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                Social
            </button>
            <button
                onClick={() => toggle("creator")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    mode === "creator"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                Creator
            </button>
        </div>
    )
}

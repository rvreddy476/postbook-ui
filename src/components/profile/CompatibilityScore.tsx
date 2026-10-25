"use client"

import { useCompatibility } from "@/hooks/useReputation"
import { Loader2 } from "lucide-react"

interface CompatibilityScoreProps {
    userId: string
}

function getCompatibilityColor(score: number): string {
    // Theme tokens (the white theme has no browns): good is the success
    // green, fair the brand ink, some overlap the warning amber, little the
    // muted grey.
    if (score >= 80) return "rgb(var(--success))"
    if (score >= 60) return "rgb(var(--brand-ink))"
    if (score >= 40) return "rgb(var(--warning))"
    return "rgb(var(--text-muted))"
}

function getCompatibilityLabel(score: number): string {
    if (score >= 80) return "Great match"
    if (score >= 60) return "Good match"
    if (score >= 40) return "Some overlap"
    return "Different vibes"
}

export function CompatibilityScore({ userId }: CompatibilityScoreProps) {
    const { data, isLoading } = useCompatibility(userId)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!data) return null

    const score = data.compatibility_score
    const color = getCompatibilityColor(score)
    const label = getCompatibilityLabel(score)

    // SVG circle progress
    const radius = 36
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (score / 100) * circumference

    return (
        <div className="flex flex-col items-center gap-2 p-4 bg-brand-card rounded-2xl border border-border shadow-xs">
            <p className="text-xs font-bold text-muted-foreground tracking-wide">
                Compatibility
            </p>

            {/* Circular Progress */}
            <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    {/* Background circle */}
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        fill="none"
                        stroke="var(--brand-divider)"
                        strokeWidth="6"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-700 ease-out"
                    />
                </svg>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="text-lg font-bold"
                        style={{ color }}
                    >
                        {score}%
                    </span>
                </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
    )
}

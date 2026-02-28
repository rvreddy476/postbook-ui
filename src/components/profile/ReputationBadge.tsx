"use client"

import { Shield } from "lucide-react"

interface ReputationBadgeProps {
    reputation: number
    size?: "sm" | "md" | "lg"
}

function getReputationTier(score: number): {
    label: string
    color: string
    bgColor: string
    borderColor: string
} {
    if (score >= 90) return { label: "Exemplary", color: "text-[#3C2415]", bgColor: "bg-[#D4A574]/30", borderColor: "border-[#D4A574]" }
    if (score >= 70) return { label: "Trusted", color: "text-[#3C2415]", bgColor: "bg-[#D4A574]/20", borderColor: "border-[#D4A574]/60" }
    if (score >= 50) return { label: "Established", color: "text-[#7B5B3A]", bgColor: "bg-[#F0E6DC]", borderColor: "border-[#F0E6DC]" }
    if (score >= 30) return { label: "Growing", color: "text-[#7B5B3A]", bgColor: "bg-[#FAF5F0]", borderColor: "border-[#F0E6DC]" }
    return { label: "New", color: "text-[#7B5B3A]/60", bgColor: "bg-[#FAF5F0]", borderColor: "border-[#F0E6DC]/50" }
}

export function ReputationBadge({ reputation, size = "md" }: ReputationBadgeProps) {
    const tier = getReputationTier(reputation)

    const sizeConfig = {
        sm: { outer: "h-8 px-2 gap-1.5", icon: "w-3 h-3", score: "text-xs", label: "text-[9px]" },
        md: { outer: "h-10 px-3 gap-2", icon: "w-4 h-4", score: "text-sm", label: "text-[10px]" },
        lg: { outer: "h-12 px-4 gap-2.5", icon: "w-5 h-5", score: "text-base", label: "text-xs" },
    }

    const s = sizeConfig[size]

    // Calculate the ring percentage for the visual indicator
    const circumference = 2 * Math.PI * 14 // radius of 14
    const strokeDashoffset = circumference - (reputation / 100) * circumference

    return (
        <div
            className={`inline-flex items-center ${s.outer} ${tier.bgColor} border ${tier.borderColor} rounded-full`}
        >
            {/* Circular progress indicator */}
            <div className="relative flex items-center justify-center">
                <svg
                    className={s.icon}
                    viewBox="0 0 32 32"
                >
                    {/* Background circle */}
                    <circle
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-[#F0E6DC]"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="text-[#D4A574]"
                        transform="rotate(-90 16 16)"
                    />
                </svg>
                <Shield className={`absolute ${size === "sm" ? "w-1.5 h-1.5" : size === "md" ? "w-2 h-2" : "w-2.5 h-2.5"} text-[#D4A574]`} />
            </div>

            <div className="flex flex-col leading-none">
                <span className={`${s.score} font-bold ${tier.color}`}>
                    {reputation}
                </span>
                <span className={`${s.label} font-medium ${tier.color} uppercase tracking-wider`}>
                    {tier.label}
                </span>
            </div>
        </div>
    )
}

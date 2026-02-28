"use client"

import { X, Eye, EyeOff, Users, Lock } from "lucide-react"
import { motion } from "framer-motion"
import { getCategoryColor } from "@/lib/hobbiesData"
import type { AboutVisibility } from "@/types/profile"

interface TagChipProps {
    label: string
    category?: string
    visibility?: AboutVisibility
    onRemove?: () => void
    showVisibility?: boolean
    size?: "sm" | "md"
    disabled?: boolean
}

const visibilityIcons: Record<AboutVisibility, typeof Eye> = {
    public: Eye,
    followers: Users,
    friends: Users,
    only_me: Lock,
}

export function TagChip({
    label,
    category,
    visibility,
    onRemove,
    showVisibility = false,
    size = "md",
    disabled = false,
}: TagChipProps) {
    const colorClasses = getCategoryColor(category)
    const isSmall = size === "sm"
    const VisIcon = visibility ? visibilityIcons[visibility] : null

    return (
        <motion.span
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`inline-flex items-center gap-1.5 border rounded-full transition-all ${colorClasses} ${
                isSmall ? "px-2.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
            } ${disabled ? "opacity-50" : ""} font-semibold`}
        >
            {showVisibility && VisIcon && visibility !== "public" && (
                <VisIcon className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} />
            )}
            <span className="truncate max-w-[150px]">{label}</span>
            {onRemove && !disabled && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onRemove()
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
                    aria-label={`Remove ${label}`}
                >
                    <X className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} />
                </button>
            )}
        </motion.span>
    )
}

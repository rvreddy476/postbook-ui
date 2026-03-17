"use client"

import { useState, useEffect } from "react"
import { UserProfile } from "@/types/profile"
import { CheckCircle2, Circle, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ProfileCompletionCardProps {
    profile: UserProfile
    onEditProfile: () => void
}

const DISMISS_KEY = "profile_completion_dismissed"

interface ChecklistItem {
    label: string
    completed: boolean
}

function computeChecklist(profile: UserProfile): ChecklistItem[] {
    return [
        { label: "Add a profile photo", completed: !!profile.avatar_media_id },
        { label: "Set your display name", completed: !!profile.display_name?.trim() },
        { label: "Write a bio", completed: !!profile.bio?.trim() },
        { label: "Add a cover photo", completed: !!profile.cover_media_id },
        { label: "Create your first post", completed: profile.post_count > 0 },
    ]
}

function computePercentage(checklist: ChecklistItem[]): number {
    const completed = checklist.filter((item) => item.completed).length
    return Math.round((completed / checklist.length) * 100)
}

export default function ProfileCompletionCard({ profile, onEditProfile }: ProfileCompletionCardProps) {
    const [dismissed, setDismissed] = useState(true)

    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(DISMISS_KEY)
            setDismissed(stored === "true")
        }
    }, [])

    const checklist = computeChecklist(profile)
    const percentage = computePercentage(checklist)

    if (percentage >= 100 || dismissed) return null

    const handleDismiss = () => {
        setDismissed(true)
        if (typeof window !== "undefined") {
            localStorage.setItem(DISMISS_KEY, "true")
        }
    }

    // SVG circle ring parameters
    const size = 64
    const strokeWidth = 5
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, delay: 0.25 }}
                className="bg-brand-card rounded-2xl p-5 shadow-sm border border-brand-divider"
            >
                <div className="flex items-start justify-between mb-4">
                    <h3 className="text-sm font-bold text-brand-text">Complete your profile</h3>
                    <button
                        onClick={handleDismiss}
                        className="text-brand-text/60 hover:text-brand-highlight transition-colors -mt-0.5 -mr-0.5"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                    {/* Circular progress ring */}
                    <div className="relative shrink-0">
                        <svg width={size} height={size} className="-rotate-90">
                            {/* Background track */}
                            <circle
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                fill="none"
                                stroke="#f1f5f9"
                                strokeWidth={strokeWidth}
                            />
                            {/* Progress arc */}
                            <circle
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                fill="none"
                                stroke="#7c3aed"
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-[stroke-dashoffset] duration-500 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-brand-text">{percentage}%</span>
                        </div>
                    </div>

                    <p className="text-xs text-brand-highlight leading-relaxed">
                        A complete profile helps others discover and connect with you.
                    </p>
                </div>

                <div className="space-y-2.5">
                    {checklist.map((item) => (
                        <div key={item.label} className="flex items-center gap-2.5">
                            {item.completed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : (
                                <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                            )}
                            <span
                                className={`text-sm ${
                                    item.completed
                                        ? "text-brand-text/60 line-through"
                                        : "text-slate-700"
                                }`}
                            >
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={onEditProfile}
                    className="mt-4 w-full py-2 rounded-xl bg-[#D8103F] text-white text-sm font-semibold hover:bg-[#b80d35] transition-colors"
                >
                    Edit Profile
                </button>
            </motion.div>
        </AnimatePresence>
    )
}

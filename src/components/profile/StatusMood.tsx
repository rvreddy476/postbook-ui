"use client"

import { useState } from "react"
import { useUpdateStatus } from "@/hooks/useStatusMood"
import { Smile, X, Loader2, Pencil } from "lucide-react"

interface StatusMoodProps {
    currentStatusText?: string | null
    currentStatusEmoji?: string | null
    currentExpiresAt?: string | null
    isOwn: boolean
}

const QUICK_EMOJIS = ["😊", "🔥", "💻", "☕", "🎵", "📚", "✈️", "🏃", "💡", "🎯", "😴", "🤒"]

export function StatusMood({ currentStatusText, currentStatusEmoji, currentExpiresAt, isOwn }: StatusMoodProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [statusText, setStatusText] = useState(currentStatusText ?? "")
    const [statusEmoji, setStatusEmoji] = useState(currentStatusEmoji ?? "")
    const [expiresIn, setExpiresIn] = useState<string>("never")
    const updateStatus = useUpdateStatus()

    const hasStatus = currentStatusText || currentStatusEmoji

    // Check if status is expired
    const isExpired = currentExpiresAt ? new Date(currentExpiresAt) < new Date() : false
    const showStatus = hasStatus && !isExpired

    const getExpiresAt = (): string | null => {
        if (expiresIn === "never") return null
        const now = new Date()
        const hours = parseInt(expiresIn, 10)
        now.setHours(now.getHours() + hours)
        return now.toISOString()
    }

    const handleSave = () => {
        updateStatus.mutate(
            {
                status_text: statusText,
                status_emoji: statusEmoji,
                expires_at: getExpiresAt(),
            },
            {
                onSuccess: () => {
                    setIsEditing(false)
                },
            }
        )
    }

    const handleClear = () => {
        updateStatus.mutate(
            { status_text: "", status_emoji: "", expires_at: null },
            {
                onSuccess: () => {
                    setStatusText("")
                    setStatusEmoji("")
                    setIsEditing(false)
                },
            }
        )
    }

    // Display mode (not editing)
    if (!isEditing) {
        return (
            <div className="flex items-center gap-2">
                {showStatus ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAF5F0] rounded-full border border-[#F0E6DC]">
                        {currentStatusEmoji && (
                            <span className="text-sm">{currentStatusEmoji}</span>
                        )}
                        {currentStatusText && (
                            <span className="text-xs font-medium text-[#7B5B3A] italic max-w-[200px] truncate">
                                {currentStatusText}
                            </span>
                        )}
                        {isOwn && (
                            <button
                                onClick={() => {
                                    setStatusText(currentStatusText ?? "")
                                    setStatusEmoji(currentStatusEmoji ?? "")
                                    setIsEditing(true)
                                }}
                                className="ml-1 text-[#7B5B3A]/40 hover:text-[#7B5B3A] transition-colors"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ) : isOwn ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#7B5B3A] bg-[#FAF5F0] rounded-full border border-[#F0E6DC] hover:border-[#D4A574] transition-colors"
                    >
                        <Smile className="w-3.5 h-3.5" />
                        Set status
                    </button>
                ) : null}
            </div>
        )
    }

    // Edit mode (modal-like inline form)
    return (
        <div className="bg-brand-card rounded-2xl border border-[#F0E6DC] shadow-lg p-4 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#3C2415]">Set your status</h3>
                <button
                    onClick={() => setIsEditing(false)}
                    className="text-[#7B5B3A]/40 hover:text-[#7B5B3A] transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Emoji selection */}
            <div className="mb-3">
                <p className="text-[10px] font-bold text-[#7B5B3A] uppercase tracking-wide mb-1.5">
                    Emoji
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {QUICK_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => setStatusEmoji(emoji)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${
                                statusEmoji === emoji
                                    ? "bg-[#D4A574]/20 border border-[#D4A574] scale-110"
                                    : "bg-[#FAF5F0] border border-[#F0E6DC] hover:border-[#D4A574]/50"
                            }`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            {/* Status text */}
            <div className="mb-3">
                <p className="text-[10px] font-bold text-[#7B5B3A] uppercase tracking-wide mb-1.5">
                    Status
                </p>
                <input
                    type="text"
                    value={statusText}
                    onChange={(e) => setStatusText(e.target.value)}
                    placeholder="What's on your mind?"
                    maxLength={80}
                    className="w-full px-3 py-2 text-sm border border-[#F0E6DC] rounded-lg bg-[#FAF5F0] text-[#3C2415] placeholder:text-[#7B5B3A]/40 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
                />
            </div>

            {/* Expiry */}
            <div className="mb-4">
                <p className="text-[10px] font-bold text-[#7B5B3A] uppercase tracking-wide mb-1.5">
                    Clear after
                </p>
                <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#F0E6DC] rounded-lg bg-[#FAF5F0] text-[#3C2415] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
                >
                    <option value="never">Don&apos;t clear</option>
                    <option value="1">1 hour</option>
                    <option value="4">4 hours</option>
                    <option value="24">Today</option>
                    <option value="168">This week</option>
                </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {showStatus && (
                    <button
                        onClick={handleClear}
                        disabled={updateStatus.isPending}
                        className="flex-1 px-3 py-2 text-xs font-bold text-[#7B5B3A] bg-[#FAF5F0] rounded-lg border border-[#F0E6DC] hover:bg-[#F0E6DC] disabled:opacity-50 transition-colors"
                    >
                        Clear status
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={updateStatus.isPending || (!statusText.trim() && !statusEmoji)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#7B5B3A] rounded-lg hover:bg-[#3C2415] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {updateStatus.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        "Save"
                    )}
                </button>
            </div>
        </div>
    )
}
